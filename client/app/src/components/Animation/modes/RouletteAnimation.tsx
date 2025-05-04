import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { AnimationProps, RouletteAnimationParams } from "../types";
import { useAnimationContext } from "../AnimationContext";
import { useAnimation } from "../useAnimation";

// 스타일 컴포넌트 정의
const RouletteContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
`;

// 룰렛 배경과 회전하는 부분을 포함하는 래퍼
const RouletteWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

// 배경 이미지 (고정)
const RouletteBase = styled.img`
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1;
`;

// 회전에 사용할 CSS 트랜지션을 동적으로 제어할 수 있도록 수정
const RouletteRotatingPart = styled.div<{
  rotation: number;
  transitionDuration: string;
  transitionTimingFunction: string;
}>`
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(${(props) => props.rotation}deg);
  transition: transform ${(props) => props.transitionDuration}
    ${(props) => props.transitionTimingFunction};
  z-index: 2;
`;

// 슬롯 이미지
const RouletteSlots = styled.img`
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

// 화살표 (고정)
const RouletteArrow = styled.img`
  position: absolute;
  top: 49%;
  left: 17%;
  transform: translate(-50%, -50%);
  height: 15%;
  width: 15%;
  object-fit: contain;
  z-index: 10;
`;

// 얼굴 컨테이너 - 자전 기능 추가
const FaceContainer = styled.div<{
  x: number;
  y: number;
  size: number;
  highlight: boolean;
  rotation: number; // 회전 각도 추가
}>`
  position: absolute;
  left: ${(props) => props.x}%;
  top: ${(props) => props.y}%;
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
  overflow: hidden;
  border: ${(props) =>
    props.highlight ? "4px solid yellow" : "2px solid white"};
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%) rotate(${(props) => props.rotation}deg); // 자전 적용
`;

const FaceImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

// WinnerText 나타나는 애니메이션 정의
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -30%); /* 시작 위치 약간 위 */
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%); /* 최종 중앙 위치 */
  }
`;

// WinnerText 스타일 개선 및 중앙 배치, 반응형 폰트 크기 적용
const WinnerText = styled.div`
  position: absolute;
  /* --- 중앙 배치 스타일 --- */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* 초기 위치는 애니메이션 시작점 */
  /* ---------------------- */
  background-color: rgba(0, 0, 0, 0.8); /* 배경 약간 더 진하게 */
  color: #ffd700; /* 골드 색상으로 변경 */
  padding: 20px 40px; /* 패딩 증가 */
  border-radius: 30px; /* 모서리 더 둥글게 */
  /* --- 반응형 폰트 크기 (clamp 사용) --- */
  /* 최소 24px, 기본 5vw, 최대 48px */
  font-size: clamp(24px, 5vw, 48px);
  /* ----------------------------------- */
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9); /* 그림자 강화 */
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.6); /* 그림자 강화 */
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 15px; /* 아이콘 간격 조정 */
  animation: ${fadeIn} 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; /* 애니메이션 지속 시간, 타이밍 함수 변경 */
  opacity: 0;
  white-space: nowrap;
`;

// 아이콘 스타일 (기존과 동일)
const WinnerIcon = styled.span`
  font-size: 1.2em;
  line-height: 1;
`;

const RouletteAnimation: React.FC<AnimationProps> = ({ websocket }) => {
  const { playSound, stopSound } = useAnimationContext();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [faceSize, setFaceSize] = useState(60);
  const [showWinnerText, setShowWinnerText] = useState<boolean>(false);
  const [faceImages, setFaceImages] = useState<string[]>([]);
  const [localRouletteWinner, setLocalRouletteWinner] = useState<number | null>(
    null
  );

  // 애니메이션 관련 상태 추가
  const [transitionDuration, setTransitionDuration] = useState("0.05s");
  const [transitionTimingFunction, setTransitionTimingFunction] =
    useState("linear");
  const animationRef = useRef<number | null>(null);
  const animationParamsRef = useRef<RouletteAnimationParams | null>(null);
  const animationCompletedRef = useRef<boolean>(false);

  // 로컬 상태로 룰렛 각도 및 회전 완료 상태 관리
  const [rouletteAngleState, setRouletteAngleState] = useState(0);
  const [animationCompleted, setAnimationCompleted] = useState(false);

  // 룰렛 관련 상태 가져오기
  const { getRouletteState } = useAnimation(websocket);
  const { rouletteActive, rouletteFaces, frozenFrame, rouletteParams } =
    getRouletteState();

  // 화면에 표시할 프레임 (frozenFrame 사용)
  const frameToUse = frozenFrame;

  // faceImagesRef를 추가하여 최신 상태 추적
  const faceImagesRef = useRef<string[]>([]);

  // 컨테이너 크기 측정 - 창 크기에 반응하도록 개선
  const updateDimensions = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });

      // 얼굴 크기 동적 계산 - 룰렛 크기의 비율 조정 (크기 증가)
      // 창 너비에 비례하도록 더 직접적인 계산 방식 사용
      const containerWidth = rect.width;
      const newFaceSize = containerWidth * 0.11; // 컨테이너 너비의 10%로 설정
      console.log(
        `Container size updated: ${containerWidth}px x ${rect.height}px, Face size: ${newFaceSize}px`
      );
      setFaceSize(newFaceSize);
    }
  }, []);

  // 초기화 및 리사이즈 이벤트 리스너 - 개선된 버전은 그대로 유지
  useEffect(() => {
    // ResizeObserver 사용하여 컨테이너 크기 변화 감지
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === wrapperRef.current) {
          console.log("ResizeObserver detected size change");
          updateDimensions();
        }
      }
    });

    // 초기 크기 적용을 위한 함수
    const applyInitialDimensions = () => {
      // 초기 크기 즉시 적용
      updateDimensions();

      // 다시 한번 시도 (여러 단계로 시도)
      setTimeout(updateDimensions, 50);
      setTimeout(updateDimensions, 200);
    };

    // 컴포넌트가 마운트되면 즉시 크기 업데이트 시도
    applyInitialDimensions();

    // 창 크기 변경 시 업데이트
    window.addEventListener("resize", updateDimensions);

    // wrapperRef가 있으면 ResizeObserver 연결
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    // 마운트 후 rAF를 사용하여 렌더링 사이클 후에 다시 측정
    requestAnimationFrame(() => {
      updateDimensions();
    });

    return () => {
      window.removeEventListener("resize", updateDimensions);
      if (wrapperRef.current) {
        resizeObserver.unobserve(wrapperRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [updateDimensions]);

  // 활성화될 때마다 크기 업데이트
  useEffect(() => {
    if (rouletteActive) {
      console.log("Roulette activated, updating dimensions");
      // 활성화될 때 즉시 업데이트
      updateDimensions();
      // 약간의 지연 후 다시 업데이트 (레이아웃 계산 시간 확보)
      setTimeout(updateDimensions, 100);
    }
  }, [rouletteActive, updateDimensions]);

  // 얼굴 이미지 추출 함수 - 원본 얼굴 형태 그대로 유지
  const extractFaceImage = useCallback((frame: string, face: number[]) => {
    const [x, y, w, h] = face;

    // Canvas 생성
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return Promise.resolve("");

    return new Promise<string>((resolve) => {
      // 이미지 로드
      const img = new Image();
      img.src = frame;

      img.onload = () => {
        // 캔버스 크기 설정 - 원본 얼굴 비율 유지
        canvas.width = w;
        canvas.height = h;

        // 얼굴 이미지 그리기 - 원본 비율 유지
        ctx.drawImage(
          img,
          x,
          y,
          w,
          h, // 원본에서 얼굴 영역
          0,
          0,
          w,
          h // 캔버스에 그릴 위치와 크기 (원본 비율 유지)
        );

        // 캔버스 내용을 데이터 URL로 변환
        resolve(canvas.toDataURL("image/jpeg"));
      };

      // 이미지 로드 실패 시
      img.onerror = () => {
        resolve("");
      };
    });
  }, []);

  // 얼굴 위치 계산 함수를 먼저 선언 - 여기로 위치 이동
  const getFacePosition = useCallback(
    (index: number, totalFaces: number) => {
      // 컨테이너 크기가 유효하지 않으면 (0이면) 계산을 중단하고 기본값(중앙) 반환
      if (!containerSize.width || !containerSize.height) {
        console.warn(
          "getFacePosition: Container size is not valid yet, returning default position.",
          containerSize
        );
        return { x: 50, y: 50 }; // 기본값 반환 (화면 중앙)
      }

      const angleStep = 360 / totalFaces;
      const angle = index * angleStep;
      const radians = angle * (Math.PI / 180);

      const baseRadius = 18;
      // 이제 height가 0이 아님이 보장됨
      const aspectRatio = containerSize.width / containerSize.height;
      const radiusX = baseRadius;
      const radiusY = baseRadius * aspectRatio;

      const x = 50 + Math.cos(radians) * radiusX;
      const y = 50 + Math.sin(radians) * radiusY;

      // 계산된 값 반환 (이제 NaN이 아님)
      return { x, y };
    },
    [containerSize] // 의존성 배열은 그대로 유지
  );

  // 얼굴 이미지 추출 효과 (기존과 동일)
  useEffect(() => {
    const processFaces = async () => {
      if (!frameToUse || !rouletteFaces.length) return;

      const images = await Promise.all(
        rouletteFaces.map((face) => extractFaceImage(frameToUse, face))
      );

      setFaceImages(images);
      faceImagesRef.current = images;
    };

    if (rouletteActive && frameToUse) {
      processFaces();
    }
  }, [rouletteFaces, frameToUse, extractFaceImage, rouletteActive]);

  // 클라이언트 측 애니메이션 실행 함수 수정
  const slowSoundPlayedRef = useRef<boolean>(false);

  const startClientSideAnimation = useCallback(
    (params: RouletteAnimationParams) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animationParamsRef.current = params;
      animationCompletedRef.current = false;
      setAnimationCompleted(false);

      slowSoundPlayedRef.current = false;

      let currentAngle = 0;
      let currentSpeed = params.initial_speed;

      playSound("roulette/spin_loop", { loop: true });

      // 애니메이션 진행 함수
      const animateFrame = () => {
        // 애니메이션 계속 진행할지 결정
        if (Math.abs(currentSpeed) > params.speed_threshold) {
          // 속도에 따른 사운드 변경
          if (
            Math.abs(currentSpeed) < 6 &&
            Math.abs(currentSpeed) > 3 &&
            !slowSoundPlayedRef.current
          ) {
            slowSoundPlayedRef.current = true;
            stopSound("roulette/spin_loop");
            setTimeout(() => {
              playSound("roulette/spin_slow", { loop: true });
            }, 50);
          } else if (Math.abs(currentSpeed) >= 6) {
            slowSoundPlayedRef.current = false;
          }

          // 속도에 따른 트랜지션 적용 방식 변경
          if (Math.abs(currentSpeed) > 5) {
            setTransitionDuration("0s");
          } else {
            setTransitionDuration("0.08s");
          }

          // 각도 업데이트
          currentAngle += currentSpeed;

          // 속도 업데이트 - 속도에 따라 감속 정도를 조절하는 방식
          if (params.use_linear_deceleration && params.deceleration_constant) {
            // 속도가 느려질수록 감속 상수를 점진적으로 더 많이 줄임
            const sign = Math.sign(currentSpeed);
            const speedAbs = Math.abs(currentSpeed);

            // 속도에 따른 가변적 감속 상수 계산 - 더 강한 감소 곡선 적용
            let adjustedDeceleration = params.deceleration_constant;

            // 속도가 낮아질수록 감속 상수를 더 급격히 줄이는 로직
            if (speedAbs < 15) {
              // 속도의 제곱에 비례하도록 설정 (비선형적 감소)
              adjustedDeceleration =
                params.deceleration_constant * Math.pow(speedAbs / 15, 2);
              // 최소값 보장 (더 작은 최소값 설정)
              adjustedDeceleration = Math.max(
                adjustedDeceleration,
                params.deceleration_constant * 0.13
              );
            }

            // 조정된 감속 상수 적용
            const newSpeed = speedAbs - adjustedDeceleration;
            currentSpeed = newSpeed > 0 ? newSpeed * sign : 0;
          } else if (params.deceleration) {
            // 기존 지수적 감속: 계수 곱하기
            currentSpeed *= params.deceleration;
          } else {
            // 기본값으로 약한 선형 감속 적용
            const sign = Math.sign(currentSpeed);
            const newSpeed = Math.abs(currentSpeed) - 0.2;
            currentSpeed = newSpeed > 0 ? newSpeed * sign : 0;
          }

          // React 상태 업데이트를 통한 시각적 회전 효과
          setRouletteAngleState(currentAngle);

          // 다음 프레임 요청
          animationRef.current = requestAnimationFrame(animateFrame);
        } else {
          // 속도가 임계값 이하로 떨어졌을 때 애니메이션 완료
          setTransitionDuration("0.5s");
          setTransitionTimingFunction("ease-out");

          // 애니메이션 완료 상태 설정
          console.log("[상태 업데이트] animationCompleted를 true로 설정");
          animationCompletedRef.current = true;
          setAnimationCompleted(true);

          // 애니메이션 참조 정리
          animationRef.current = null;

          // 애니메이션 멈출 때 효과음 처리
          stopSound("roulette/spin_loop");
          stopSound("roulette/spin_slow");
          playSound("roulette/win_sound");

          determineWinner();
        }
      };

      // 애니메이션 시작
      animationRef.current = requestAnimationFrame(animateFrame);
    },
    [playSound, stopSound]
  );

  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);

  // determineWinner 함수 수정
  const determineWinner = useCallback(() => {
    let winnerIndex = 0;
    let minX = Infinity;

    faceRefs.current.forEach((faceRef, index) => {
      if (faceRef) {
        const rect = faceRef.getBoundingClientRect();
        if (rect.left < minX) {
          minX = rect.left;
          winnerIndex = index;
        }
      }
    });

    console.log(
      `[Determine Winner] Winner Index: ${winnerIndex}, Setting states.`
    );
    setLocalRouletteWinner(winnerIndex);
    setShowWinnerText(true);

    // 애니메이션 완료 알림 서버로 전송
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(
        JSON.stringify({
          type: "animation_complete_client",
          mode: "roulette",
          winnerIndex: winnerIndex,
        })
      );
    }
  }, [websocket, localRouletteWinner]);

  // 활성화될 때마다 크기 업데이트 및 애니메이션 매개변수 적용
  useEffect(() => {
    if (rouletteActive) {
      console.log("Roulette activated, updating dimensions");
      updateDimensions();
      setTimeout(updateDimensions, 100);

      // 애니메이션 매개변수가 있으면 클라이언트 애니메이션 시작
      if (rouletteParams) {
        console.log(
          "Starting client-side animation with params:",
          rouletteParams
        );
        playSound("roulette/spin_start");
        startClientSideAnimation(rouletteParams);
      }
    }

    // 컴포넌트 언마운트 시 애니메이션 정리
    return () => {
      setLocalRouletteWinner(null);
      setShowWinnerText(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [
    rouletteActive,
    updateDimensions,
    rouletteParams,
    startClientSideAnimation,
  ]);

  if (!rouletteActive) return null;

  return (
    <RouletteContainer>
      <RouletteWrapper ref={wrapperRef}>
        {/* 고정된 배경 */}
        <RouletteBase
          src="assets/images/roulette/roulette_base.png"
          alt="Roulette Base"
        />

        {/* 회전하는 부분 */}
        <RouletteRotatingPart
          rotation={rouletteAngleState}
          transitionDuration={transitionDuration}
          transitionTimingFunction={transitionTimingFunction}
        >
          <RouletteSlots
            src="assets/images/roulette/roulette_slots.png"
            alt="Roulette Slots"
          />

          {/* 얼굴들 */}
          {rouletteFaces.map((face, index) => {
            const position = getFacePosition(index, rouletteFaces.length);
            // 애니메이션이 완료되고 당첨자가 결정되었을 때만 하이라이트 표시
            const isWinner =
              animationCompleted && localRouletteWinner === index;

            // 얼굴 자전 - 룰렛 회전 각도의 반대 방향으로 회전
            const faceRotation = -rouletteAngleState;

            return (
              <FaceContainer
                key={`face-${index}`}
                ref={(el) => {
                  faceRefs.current[index] = el;
                }}
                className="face-container"
                x={position.x}
                y={position.y}
                size={faceSize}
                highlight={isWinner}
                rotation={faceRotation}
              >
                {faceImages[index] ? (
                  <FaceImage src={faceImages[index]} alt={`Face ${index}`} />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#333",
                    }}
                  />
                )}
              </FaceContainer>
            );
          })}
        </RouletteRotatingPart>

        {/* 고정된 화살표 */}
        <RouletteArrow
          src="assets/images/roulette/roulette_arrow.png"
          alt="Roulette Arrow"
        />
      </RouletteWrapper>

      {/* 선택 결과 텍스트 - JSX 수정 (첫 번째 아이콘 제거) */}
      {(showWinnerText || animationCompleted) &&
        localRouletteWinner !== null && (
          <WinnerText>
            너는 내 운명! <WinnerIcon>💖</WinnerIcon>
          </WinnerText>
        )}
    </RouletteContainer>
  );
};

export default RouletteAnimation;
