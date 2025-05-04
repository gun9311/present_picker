import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { AnimationProps } from "../types";
import { useAnimation } from "../useAnimation";

// 커튼 컨테이너 스타일 수정 - 절대 위치로 변경
const CurtainContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none; // 아래 레이어의 이벤트 통과
`;

// 배경 이미지 제거 (실제 카메라 영상 이용)

// 왼쪽 커튼 스타일
const LeftCurtain = styled.div<{ position: number }>`
  position: absolute;
  top: 0;
  left: ${(props) => props.position * -50}%;
  width: 50%;
  height: 100%;
  background-image: url("assets/images/curtain/curtain_left.png");
  background-size: cover;
  transform: translate3d(0, 0, 0); // 하드웨어 가속
  transition: left 0.05s linear;
  z-index: 10;
  pointer-events: auto; // 이벤트 활성화
`;

// 오른쪽 커튼 스타일
const RightCurtain = styled.div<{ position: number }>`
  position: absolute;
  top: 0;
  right: ${(props) => props.position * -50}%;
  width: 50%;
  height: 100%;
  background-image: url("assets/images/curtain/curtain_right.png");
  background-size: cover;
  transform: translate3d(0, 0, 0); // 하드웨어 가속
  transition: right 0.05s linear;
  z-index: 10;
`;

// 상단 커튼 스타일
const TopCurtain = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 9%;
  background-image: url("assets/images/curtain/curtain_top.png");
  background-size: 100% 100%;
  z-index: 11;
`;

// 인트로 오버레이 스타일
const IntroOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 20;
`;

// 메인 타이틀 스타일
const MainTitle = styled.div<{ blinking: boolean }>`
  font-size: 3rem;
  font-weight: bold;
  color: white;
  text-align: center;
  padding: 1rem 2rem;
  border-radius: 1rem;
  margin-bottom: 2rem;
  background-color: ${(props) =>
    props.blinking ? "rgba(150, 10, 50, 0.8)" : "rgba(50, 10, 150, 0.8)"};
  transition: background-color 0.5s ease;
`;

// 서브타이틀 스타일
const SubTitle = styled.div`
  font-size: 1.5rem;
  color: white;
  text-align: center;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background-color: rgba(0, 0, 0, 0.6);
`;

// 결과 텍스트 스타일
const ResultText = styled.div`
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2rem;
  font-weight: bold;
  color: white;
  background-color: rgba(180, 30, 30, 0.8);
  padding: 0.5rem 1.5rem;
  border-radius: 0.5rem;
  z-index: 15;
`;

// 컴포넌트 props 타입 확장
interface ExtendedAnimationProps extends AnimationProps {
  cameraContainerRef?: React.RefObject<HTMLDivElement>;
}

const CurtainAnimation: React.FC<ExtendedAnimationProps> = ({
  websocket,
  cameraContainerRef,
}) => {
  const { getCurtainState, detectedFaces } = useAnimation(websocket);
  const [blinking, setBlinking] = useState(false);

  // 줌 상태 추가
  const [zoomTransform, setZoomTransform] = useState<string>(
    "scale(1) translate(0, 0)"
  );
  const [zoomActive, setZoomActive] = useState<boolean>(false);

  // 스케일 애니메이션을 위한 상태 추가
  const [targetScale, setTargetScale] = useState<number>(1.0);
  const [currentScale, setCurrentScale] = useState<number>(1.0);
  const [isAnimatingScale, setIsAnimatingScale] = useState<boolean>(false);
  const animationRef = useRef<number | null>(null);

  // 프리웜업 상태 추가
  const [isWarmedUp, setIsWarmedUp] = useState<boolean>(false);

  // 이전 줌 상태 저장용 ref
  const prevZoomStateRef = useRef<{
    face: [number, number, number, number] | null;
    position: number;
  }>({ face: null, position: 1.0 });

  // 깜빡임 효과를 위한 타이머
  useEffect(() => {
    if (getCurtainState().introActive) {
      const interval = setInterval(() => {
        setBlinking((prev) => !prev);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [getCurtainState().introActive]);

  // 상태 가져오기 (zoomParams 추가)
  const {
    curtainActive,
    curtainPosition,
    selectedFace,
    introText,
    countdownValue,
    resultText,
    introActive,
    resultActive,
    zoomParams,
  } = getCurtainState();

  // 부드러운 스케일 애니메이션 함수
  const animateScale = useCallback(
    (target: number, translateX: number, translateY: number) => {
      setIsAnimatingScale(true);

      let startTime: number | null = null;
      const duration = zoomParams?.duration || 0.8; // 초 단위
      const durationMs = duration * 1000; // 밀리초 단위로 변환

      // 이전 애니메이션이 있다면 취소
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / durationMs, 1); // 0~1 사이 값

        // 현재 스케일 값 계산 (easeOutCubic 애니메이션 적용)
        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const easedProgress = easeOutCubic(progress);

        const newScale = currentScale + (target - currentScale) * easedProgress;
        setCurrentScale(newScale);

        // 새 줌 트랜스폼 적용
        const newTransform = `scale(${newScale}) translate(${
          translateX * 100
        }%, ${translateY * 100}%)`;
        setZoomTransform(newTransform);

        // 비디오 요소에 트랜스폼 직접 적용
        if (cameraContainerRef?.current) {
          const videoElement =
            cameraContainerRef.current.querySelector("video");
          if (videoElement) {
            videoElement.style.transition = "none"; // 트랜지션을 비활성화하고 직접 애니메이션 적용
            videoElement.style.transform = `translate3d(0, 0, 0) ${newTransform}`;
          }
        }

        // 애니메이션이 완료되지 않았으면 계속 진행
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // 애니메이션 완료
          setIsAnimatingScale(false);
          setCurrentScale(target);
          animationRef.current = null;
        }
      };

      // 애니메이션 시작
      animationRef.current = requestAnimationFrame(animate);
    },
    [cameraContainerRef, zoomParams, currentScale]
  );

  // 프리웜업 실행 함수 추가
  const performPrewarmup = useCallback(() => {
    if (!cameraContainerRef?.current) return;

    console.log("줌 애니메이션 프리웜업 시작...");

    // 보이지 않는 곳에 숨겨진 더미 요소 생성
    const dummyElement = document.createElement("div");
    dummyElement.style.position = "absolute";
    dummyElement.style.top = "-9999px";
    dummyElement.style.left = "-9999px";
    dummyElement.style.width = "100px";
    dummyElement.style.height = "100px";
    document.body.appendChild(dummyElement);

    // 더미 스케일 애니메이션 수행 (값은 작게 시작)
    const warmupScales = [1.2, 1.5, 2.0, 2.5];
    let currentIndex = 0;

    const runWarmupStep = () => {
      if (currentIndex >= warmupScales.length) {
        // 웜업 완료
        document.body.removeChild(dummyElement);
        setIsWarmedUp(true);
        console.log("줌 애니메이션 프리웜업 완료");
        return;
      }

      const scale = warmupScales[currentIndex];
      dummyElement.style.transform = `scale(${scale})`;

      // GPU 가속 강제 트리거
      void dummyElement.offsetHeight;

      // 다음 스텝
      currentIndex++;
      setTimeout(runWarmupStep, 50);
    };

    // 웜업 시작
    runWarmupStep();

    // 실제 비디오 요소에도 미리 CSS 속성 설정
    const videoElement = cameraContainerRef.current.querySelector("video");
    if (videoElement) {
      videoElement.style.willChange = "transform";
      videoElement.style.transform = "translate3d(0, 0, 0)";
      // 하드웨어 가속 트리거
      void videoElement.offsetHeight;
    }
  }, [cameraContainerRef]);

  // 컴포넌트 마운트 시 프리웜업 실행
  useEffect(() => {
    if (!isWarmedUp && curtainActive) {
      // 첫 렌더링 후 잠시 지연시켜 프리웜업 실행
      const warmupTimer = setTimeout(performPrewarmup, 100);
      return () => clearTimeout(warmupTimer);
    }
  }, [isWarmedUp, curtainActive, performPrewarmup]);

  // 줌 효과 계산 및 적용 (수정된 버전)
  useEffect(() => {
    if (!cameraContainerRef?.current || !selectedFace) return;

    // 현재 상태와 이전 상태 비교
    const currentState = { face: selectedFace, position: curtainPosition };
    const prevState = prevZoomStateRef.current;

    // 상태가 변경되었을 때만 처리
    if (
      JSON.stringify(currentState.face) !== JSON.stringify(prevState.face) ||
      Math.abs(currentState.position - prevState.position) > 0.1
    ) {
      prevZoomStateRef.current = currentState;

      const container = cameraContainerRef.current;
      const videoElement = container.querySelector("video");

      if (!videoElement) return;

      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      // 얼굴 좌표 가져오기
      const [x, y, w, h] = selectedFace;

      // 얼굴 크기에 따른 확대율 계산 (비율 기반)
      const faceRatio = w / videoWidth; // 얼굴이 화면 너비에서 차지하는 비율
      const targetRatio = 0.27; // 얼굴이 화면의 1/3 정도 차지하게
      let scale = targetRatio / Math.max(faceRatio, 0.01); // 너무 작은 비율 방지
      scale = Math.max(1.0, Math.min(4.0, scale)); // 줌 스케일 제한

      // 또는 zoomParams가 있으면 사용
      scale = zoomParams?.scale || scale;

      // 화면 중앙에서 얼굴까지의 상대적 오프셋 계산
      const centerX = x + w / 2;
      const centerY = y + h / 2;

      // 비디오 중앙 기준으로 변환 값 계산 (-1 ~ 1 범위로 정규화)
      const translateX = ((videoWidth / 2 - centerX) / (videoWidth / 2)) * 0.5;
      const translateY =
        ((videoHeight / 2 - centerY) / (videoHeight / 2)) * 0.5;

      // 목표 스케일 설정
      setTargetScale(scale);

      // 스케일 애니메이션 실행
      animateScale(scale, translateX, translateY);

      setZoomActive(true);
    }
  }, [
    selectedFace,
    curtainPosition,
    cameraContainerRef,
    zoomParams,
    animateScale,
  ]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 선택된 얼굴이 있으면 카메라 컨테이너 스타일 변경
  useEffect(() => {
    if (!cameraContainerRef?.current) {
      console.log("CurtainAnimation: cameraContainerRef가 없습니다.");
      return;
    }

    const cameraContainer = cameraContainerRef.current;

    if (curtainActive) {
      // 커튼 활성화 시 카메라를 뒤로 배치
      cameraContainer.style.zIndex = "1";
    } else {
      // 커튼이 비활성화되면 원래 상태로 복구
      cameraContainer.style.zIndex = "10";
      cameraContainer.style.boxShadow = "none";

      // 비디오 요소 스타일 초기화
      const videoElement = cameraContainer.querySelector("video");
      if (videoElement) {
        videoElement.style.transition = "";
        videoElement.style.transform = "translate3d(0, 0, 0)";
      }
    }

    // 컴포넌트 언마운트 시에만 상태 복구 (렌더링 사이클에는 영향 없도록)
    return () => {
      // curtainActive가 false인 경우만 정리 함수 실행
      if (!curtainActive) {
        cameraContainer.style.zIndex = "10";
        cameraContainer.style.boxShadow = "none";

        // 비디오 요소 스타일 초기화
        const videoElement = cameraContainer.querySelector("video");
        if (videoElement) {
          videoElement.style.transition = "";
          videoElement.style.transform = "translate3d(0, 0, 0)";
        }
      }
    };
  }, [curtainActive, cameraContainerRef]);

  if (!curtainActive) return null;

  return (
    <CurtainContainer>
      {/* 커튼 요소들 */}
      <LeftCurtain position={curtainPosition} />
      <RightCurtain position={curtainPosition} />
      <TopCurtain />
      {/* 인트로 오버레이 */}
      {introActive && (
        <IntroOverlay>
          <MainTitle blinking={blinking}>{introText}</MainTitle>
          <SubTitle>
            잠시 후 주인공을 선정합니다... ({countdownValue}초)
          </SubTitle>
        </IntroOverlay>
      )}
      {/* 결과 텍스트 */}
      {resultActive && resultText && <ResultText>{resultText}</ResultText>}
    </CurtainContainer>
  );
};

export default CurtainAnimation;
