import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { AnimationProps } from "../types";
import { useAnimation } from "../useAnimation";

const SlotMachineContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const SlotMachineImage = styled.img`
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const SlotFace = styled.div<{
  x: number;
  y: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  overflow: hidden;
`;

const SlotFaceImage = styled.div<{
  backgroundImage: string;
  x: number;
  y: number;
  scale: number;
}>`
  width: 100%;
  height: 100%;
  background-image: url(${(props) => props.backgroundImage});
  background-position: -${(props) => props.x}px -${(props) => props.y}px;
  background-size: auto;
  transform: scale(${(props) => props.scale}, ${(props) => props.scale});
  transform-origin: 0 0;
`;

// 슬롯 위치를 상대적인 비율로 정의
const SLOT_RELATIVE_POSITIONS = [
  { x: 0.22, y: 0.268, width: 0.181, height: 0.432 }, // 첫 번째 슬롯
  { x: 0.413, y: 0.268, width: 0.181, height: 0.432 }, // 두 번째 슬롯
  { x: 0.605, y: 0.268, width: 0.181, height: 0.432 }, // 세 번째 슬롯
];

// 슬롯 위치 타입 정의
interface SlotPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- 잭팟 효과 관련 스타일 ---
const JackpotOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden; // 오버레이 밖으로 나가는 동전 숨김
  pointer-events: none; // 아래 요소 클릭 방지
  z-index: 10; // 다른 요소들 위에 표시
`;

// 떨어지는 애니메이션 정의
const fall = keyframes`
  0% {
    transform: translateY(-100px) rotateZ(0deg); // 시작 위치 (화면 위)
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotateZ(720deg); // 종료 위치 (화면 아래) + 회전
    opacity: 0.8;
  }
`;

// 개별 동전 스타일
const Coin = styled.div<{
  delay: number;
  left: number;
  duration: number;
  size: number; // vw 단위의 숫자 값
}>`
  position: absolute;
  top: -50px; // 초기 위치는 화면 바깥 위쪽
  left: ${(props) => props.left}%; // 가로 위치 랜덤 설정
  width: ${(props) => props.size}vw; // vw 단위 사용
  height: ${(props) => props.size}vw; // vw 단위 사용 (정사각형 유지)
  background-image: url("assets/images/slot_machine/coin.png"); // 동전 이미지 경로 (실제 경로로 수정 필요)
  background-size: contain;
  background-repeat: no-repeat;
  opacity: 0; // 애니메이션 시작 전에는 숨김
  animation: ${fall} ${(props) => props.duration}s linear infinite;
  animation-delay: ${(props) =>
    props.delay}s; // 각 동전의 떨어지는 시작 시간 랜덤 설정
`;

const SlotMachineAnimation: React.FC<AnimationProps> = ({
  faces,
  lastCapturedFrame,
  websocket,
}) => {
  const { getSlotMachineState } = useAnimation(websocket);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgImageRef = useRef<HTMLImageElement>(null);
  const [slotPositions, setSlotPositions] = useState<SlotPosition[]>([]);
  const [bgImageLoaded, setBgImageLoaded] = useState(false);
  const bgImage = "assets/images/slot_machine/slot_machine.png";

  // 슬롯머신 관련 상태 + 잭팟 상태 가져오기
  const {
    slotMachineActive,
    currentSlotFaces,
    selectedFace,
    visibleSlots,
    frozenFrame,
    jackpotActive,
  } = getSlotMachineState();

  // 배경 이미지 프리로드
  useEffect(() => {
    // 컴포넌트 마운트 시 이미지 프리로드
    const preloadImage = new Image();
    preloadImage.src = bgImage;
    preloadImage.onload = () => {
      setBgImageLoaded(true);
    };

    return () => {
      // 클린업: 이미지 로드 이벤트 제거
      preloadImage.onload = null;
    };
  }, []);

  // 슬롯 위치를 동적으로 계산하는 함수
  const updateSlotPositions = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const positions = SLOT_RELATIVE_POSITIONS.map((slot) => ({
      x: slot.x * width,
      y: slot.y * height,
      width: slot.width * width,
      height: slot.height * height,
    }));

    setSlotPositions(positions);
  }, []);

  // 슬롯 위치 초기 계산 및 리사이즈 이벤트 리스너
  useEffect(() => {
    // 초기 계산 (bgImageLoaded가 true일 때만)
    if (bgImageLoaded) {
      updateSlotPositions();
    }

    // 리사이즈 이벤트에 대한 리스너 등록
    window.addEventListener("resize", updateSlotPositions);

    return () => {
      window.removeEventListener("resize", updateSlotPositions);
    };
  }, [updateSlotPositions, bgImageLoaded]);

  // 상태가 변경될 때마다 위치 계산 실행 (bgImageLoaded가 true일 때만)
  useEffect(() => {
    if (bgImageLoaded && slotMachineActive) {
      // 약간의 지연 후에 위치 계산 실행
      const timer = setTimeout(() => {
        updateSlotPositions();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [slotMachineActive, updateSlotPositions, bgImageLoaded]);

  // 데이터 변경 시 위치 계산 (bgImageLoaded가 true일 때만)
  useEffect(() => {
    if (bgImageLoaded && (currentSlotFaces.length > 0 || selectedFace)) {
      updateSlotPositions();
    }
  }, [currentSlotFaces, selectedFace, updateSlotPositions, bgImageLoaded]);

  const frameToUse = frozenFrame || lastCapturedFrame;

  // --- 잭팟 효과를 위한 동전 데이터 생성 (메모이제이션 사용 추천) ---
  const coins = React.useMemo(() => {
    if (!jackpotActive) return []; // 비활성 시 빈 배열 반환

    // 화면 너비에 따른 상대적인 크기 계산 (예: 1vw ~ 2.5vw)
    const minSizeVW = 2;
    const maxSizeVW = 4.5;

    return Array.from({ length: 80 }).map((_, index) => ({
      // 동전 개수 (예: 80개)
      id: index,
      delay: Math.random() * 5, // 애니메이션 지연 시간 (0~5초 사이 랜덤)
      left: Math.random() * 100, // 가로 위치 (0% ~ 100% 사이 랜덤)
      duration: Math.random() * 3 + 4, // 떨어지는 시간 (4~7초 사이 랜덤)
      size: Math.random() * (maxSizeVW - minSizeVW) + minSizeVW, // VW 기반 상대 크기
    }));
  }, [jackpotActive]); // jackpotActive가 변경될 때만 재생성

  // 슬롯머신 비활성 + 잭팟 비활성 + 프레임 없을 때만 렌더링 안 함
  if (!slotMachineActive && !jackpotActive) return null;
  if (!frameToUse && !jackpotActive) return null; // 프레임 없어도 잭팟은 나올 수 있게

  return (
    <SlotMachineContainer ref={containerRef}>
      {/* 배경 이미지 (슬롯 활성 상태일 때만 또는 항상 표시?) */}
      {slotMachineActive && bgImageLoaded && (
        <SlotMachineImage ref={bgImageRef} src={bgImage} alt="Slot Machine" />
      )}

      {/* 로딩 인디케이터 (선택적) */}
      {slotMachineActive && !bgImageLoaded && (
        <LoadingOverlay>
          <span>로딩 중...</span>
        </LoadingOverlay>
      )}

      {/* 얼굴 이미지 (슬롯 활성, 로딩 완료, 위치 계산 완료 시) */}
      {slotMachineActive &&
        bgImageLoaded &&
        slotPositions.length > 0 &&
        frameToUse &&
        slotPositions.map((slot, idx) => {
          let faceCoords: [number, number, number, number] | null = null;

          if (visibleSlots.includes(idx) && selectedFace) {
            faceCoords = selectedFace;
          } else if (currentSlotFaces.length > idx) {
            faceCoords = currentSlotFaces[idx];
          }

          if (!faceCoords) return null;

          const [x, y, w, h] = faceCoords;

          if (!frameToUse) return null;

          return (
            <SlotFace
              key={`slot-${idx}`}
              x={slot.x}
              y={slot.y}
              width={slot.width}
              height={slot.height}
            >
              <SlotFaceImage
                backgroundImage={frameToUse}
                x={x}
                y={y}
                scale={slot.width / w}
              />
            </SlotFace>
          );
        })}

      {/* --- 잭팟 효과 렌더링 --- */}
      {jackpotActive && (
        <JackpotOverlay>
          {coins.map((coin) => (
            <Coin
              key={coin.id}
              delay={coin.delay}
              left={coin.left}
              duration={coin.duration}
              size={coin.size}
            />
          ))}
        </JackpotOverlay>
      )}
    </SlotMachineContainer>
  );
};

// 로딩 인디케이터 스타일 컴포넌트 (선택적)
const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 18px;
  z-index: 3;
`;

export default SlotMachineAnimation;
