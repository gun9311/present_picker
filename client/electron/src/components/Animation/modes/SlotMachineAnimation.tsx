import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { AnimationProps } from "../types";
import { useAnimationContext } from "../AnimationContext";
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
  { x: 0.209, y: 0.268, width: 0.181, height: 0.432 }, // 첫 번째 슬롯
  { x: 0.409, y: 0.268, width: 0.181, height: 0.432 }, // 두 번째 슬롯
  { x: 0.609, y: 0.268, width: 0.181, height: 0.432 }, // 세 번째 슬롯
];

// 슬롯 위치 타입 정의
interface SlotPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

  // 슬롯머신 관련 상태만 가져오기
  const {
    slotMachineActive,
    currentSlotFaces,
    selectedFace,
    visibleSlots,
    frozenFrame,
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

  if (!slotMachineActive || !frameToUse) return null;

  return (
    <SlotMachineContainer ref={containerRef}>
      {/* 배경 이미지 (항상 표시) */}
      <SlotMachineImage ref={bgImageRef} src={bgImage} alt="Slot Machine" />

      {/* 로딩 인디케이터 (선택적) */}
      {!bgImageLoaded && (
        <LoadingOverlay>
          <span>로딩 중...</span>
        </LoadingOverlay>
      )}

      {/* 얼굴 이미지 (bgImageLoaded가 true이고 위치 계산이 완료된 경우에만 표시) */}
      {bgImageLoaded &&
        slotPositions.length > 0 &&
        slotPositions.map((slot, idx) => {
          let faceCoords: [number, number, number, number] | null = null;

          if (visibleSlots.includes(idx) && selectedFace) {
            faceCoords = selectedFace;
          } else if (currentSlotFaces.length > idx) {
            faceCoords = currentSlotFaces[idx];
          }

          if (!faceCoords) return null;

          const [x, y, w, h] = faceCoords;

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
