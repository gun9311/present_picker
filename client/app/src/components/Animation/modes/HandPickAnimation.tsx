import React, { useEffect, useState, useLayoutEffect } from "react";
import styled from "@emotion/styled";
import { AnimationProps, FaceCoordinates } from "../types";
import { useAnimation } from "../useAnimation";


const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
`;

const Overlay = styled.div<{ isActive: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${(props) =>
    props.isActive ? "rgba(0, 0, 0, 0.5)" : "transparent"};
  display: flex;
  z-index: 5;
  transition: background-color 0.3s ease;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

const Instruction = styled.div`
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: bold;
  color: white;
  text-align: center;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 1.5vmin 3vmin;
  border-radius: 1vmin;
  max-width: 80%;
  text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.7);
  position: absolute;
  top: 15vh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  pointer-events: none;
`;

const FaceContainer = styled.div<{
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}>`
  position: absolute;
  border: ${(props) =>
    props.active ? "4px solid #ff0" : "2px solid rgba(255, 255, 255, 0.5)"};
  border-radius: 8px;
  /* transition: all 0.3s ease; */
  pointer-events: none;
`;

const ExpressionMeter = styled.div<{ value: number }>`
  position: absolute;
  bottom: -15px;
  left: 0;
  width: 100%;
  height: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${(props) => props.value * 100}%;
    background-color: ${(props) => {
      if (props.value < 0.3) return "#3498db";
      if (props.value < 0.7) return "#f39c12";
      return "#e74c3c";
    }};
    transition: width 0.3s ease;
  }
`;

const ResultText = styled.div`
  position: absolute;
  bottom: 2vh;
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(1.8rem, 3.5vw, 3rem);
  font-weight: bold;
  color: white;
  background-color: rgba(87, 75, 139, 0.8);
  padding: 1.2vh 3.5vw;
  border-radius: 1.2vmin;
  z-index: 15;
  text-align: center;
  width: 90%;
  max-width: 900px;
`;

// --- 추가: 진행률 표시줄과 표정 안내를 묶는 컨테이너 ---
const TopInfoContainer = styled.div`
  position: absolute;
  top: 3vh; // 상단 여백 조정 (vh 단위 사용)
  left: 5%; // 좌우 여백
  width: 90%; // 전체 너비
  display: flex;
  align-items: center; // 세로 중앙 정렬
  justify-content: space-between; // 요소 간 간격 최대 확보
  z-index: 10;
  gap: 2vw; // 요소 사이 간격
`;

// 수정: ProgressBarContainer 스타일 조정
const ProgressBarContainer = styled.div`
  // 변경: position 관련 속성 제거 (부모 컨테이너에서 배치)
  // position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  // 변경: 너비를 flex-grow로 설정하여 가변적으로 조절
  flex: 1; // 사용 가능한 공간 최대한 차지
  height: 5vh; // 변경: 세로 크기 키움 (vh 단위 사용)
  min-height: 30px; // 최소 높이 설정
  background-color: rgba(0, 0, 0, 0.6); // 배경 약간 더 진하게
  border-radius: 2.5vh; // 변경: 높이에 맞춰 border-radius 조정
  // z-index 제거 (부모에서 관리)
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.3); // 테두리 약간 더 잘 보이게
  position: relative; // ProgressBarFill의 absolute 기준점
`;

// 수정: ProgressBarFill 스타일 조정 (변경 없음, 기준 컨테이너만 바뀜)
const ProgressBarFill = styled.div<{
  progress: number;
  urgency: "normal" | "warning" | "critical";
}>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${(props) => props.progress * 100}%;
  background-color: ${(props) =>
    props.urgency === "critical"
      ? "#e74c3c"
      : props.urgency === "warning"
      ? "#f39c12"
      : "#3498db"};
  transition: width 0.1s linear, background-color 0.3s ease;
  // 변경: border-radius 수정 (왼쪽만 둥글게)
  border-radius: 2.5vh 0 0 2.5vh;
`;

// 수정: ProgressBarText 스타일 조정
const ProgressBarText = styled.span<{
  urgency: "normal" | "warning" | "critical";
}>`
  position: relative;
  z-index: 1; // ProgressBarFill 위에 오도록 수정
  // 변경: font-size 조정
  font-size: clamp(12px, 1.8vh, 18px); // vh 단위 사용 및 범위 조정
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8); // 그림자 강화
  // color 속성 제거 (항상 흰색 유지)
`;

// 수정: ExpressionInfo 스타일 조정
const ExpressionInfo = styled.div`
  // 변경: position 관련 속성 제거
  // position: absolute; top: 55px; left: 50%; transform: translateX(-50%);
  // 변경: 높이를 ProgressBarContainer와 맞춤
  height: 5vh;
  min-height: 30px;
  display: flex; // 내부 텍스트 세로 중앙 정렬 위해 추가
  align-items: center; // 내부 텍스트 세로 중앙 정렬 위해 추가
  background-color: rgba(87, 75, 139, 0.85); // 배경 약간 더 진하게
  color: white;
  // 변경: font-size 조정
  font-size: clamp(14px, 2vh, 20px);
  font-weight: bold;
  // 변경: padding 조정 (좌우만)
  padding: 0 2vw; // 좌우 패딩 조정
  border-radius: 2.5vh; // 변경: 높이에 맞춰 border-radius 조정
  // z-index 제거 (부모에서 관리)
  white-space: nowrap; // 텍스트 줄바꿈 방지
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3); // 그림자 추가
`;

// --- 순위 표시 스타일 수정 ---
const RankingContainer = styled.div`
  position: absolute;
  top: 12vh; // 상단 여백 증가 (3vh -> 10vh)
  left: 0;
  right: 0;
  bottom: 12%; // 하단 결과 텍스트 영역 확보 (기존값 유지)
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; // 중앙 정렬 유지
  gap: 3vmin; // 요소간 간격 조정
  z-index: 10;
  pointer-events: none;
  padding: 20px;
  /* overflow: hidden; */ // 필요시 추가
`;

// --- 추가: 시상대 레이아웃 컨테이너 ---
const PodiumDisplayContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-end; // 아이템을 아래 기준으로 정렬
  gap: 5vmin; // 시상대 아이템 간 간격 조정
  width: 100%;
  /* background-color: rgba(0, 0, 255, 0.1); // 디버깅용 */
`;

const RankItem = styled.div<{ rank: number }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: transform 0.5s ease-out;
  transform: scale(1);

  // --- 높이 조정 (1등 위치만 살짝 아래로) ---
  margin-bottom: ${(props) =>
    props.rank === 1 ? "6vmin" : "0"}; // 8vmin -> 6vmin (약간 아래로)

  z-index: ${(props) => (props.rank === 1 ? 3 : props.rank === 2 ? 2 : 1)};
`;

const RankedFace = styled.div<{ rank: number; imageSrc?: string | null }>`
  // --- 크기 재조정 (현실적인 범위 내에서 크게) ---
  width: ${(props) =>
    props.rank === 1
      ? "55vmin" // 80 -> 55
      : "45vmin"}; // 70 -> 45
  height: ${(props) =>
    props.rank === 1
      ? "55vmin" // 80 -> 55
      : "45vmin"}; // 70 -> 45

  // --- 관련 스타일 재조정 ---
  border: ${(props) =>
    props.rank === 1
      ? "1.8vmin solid #ffd700" // 2.5 -> 1.8
      : props.rank === 2
      ? "1.5vmin solid #c0c0c0" // 2.2 -> 1.5
      : "1.5vmin solid #cd7f32"}; // 2.2 -> 1.5
  border-radius: 3vmin; // 4 -> 3
  margin-bottom: 3vmin; // 4 -> 3
  background-color: rgba(50, 50, 50, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  text-align: center;
  box-shadow: 0 0.8vmin 2.5vmin rgba(0, 0, 0, 0.5); // 그림자 조정
  position: relative;
  overflow: hidden;

  background-image: ${(props) =>
    props.imageSrc ? `url(${props.imageSrc})` : "none"};
  background-size: cover;
  background-position: center;

  color: ${(props) => (props.imageSrc ? "transparent" : "white")};
  // --- 폰트 크기 재조정 ---
  font-size: ${(props) =>
    props.rank === 1 ? "9vmin" : "7vmin"}; // 14/12 -> 9/7

  span {
    position: absolute;
    bottom: 1.5vmin; // 2 -> 1.5
    right: 2vmin; // 3 -> 2
    // --- 폰트 크기 재조정 ---
    font-size: ${(props) =>
      props.rank === 1 ? "2.5vmin" : "2vmin"}; // 3.2/2.8 -> 2.5/2
    color: rgba(255, 255, 255, 0.7);
  }
`;

// 실시간 점수 표시 스타일
const FaceScore = styled.div`
  position: absolute;
  top: -4vmin;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  min-width: 50%;
  text-align: center;
  color: white;
  font-size: 2.2vmin;
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 0.8vmin;
  padding: 0.5vmin 1.5vmin;
  text-shadow: 1px 1px 3px black;
  white-space: nowrap;
`;

// 순위 점수 표시 스타일
const ScoreText = styled.div`
  font-size: 4.5vmin; // 4vmin -> 4.5vmin (약간 크게)
  color: #eee;
  text-shadow: 0.15vmin 0.15vmin 0.4vmin rgba(0, 0, 0, 0.6);
  margin-top: 1.5vmin;
`;

const Crown = styled.div`
  position: absolute;
  top: -7vmin; // -10 -> -7
  left: 50%;
  transform: translateX(-50%);
  font-size: 8vmin; // 10 -> 8
  text-shadow: 0 0 3vmin rgba(255, 215, 0, 0.8); // 3.5 -> 3
`;

// 카운트다운 숫자 스타일 추가
const CountdownNumber = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 25vmin; /* 매우 크게 */
  font-weight: bold;
  color: rgba(255, 255, 255, 0.8); /* 약간 투명한 흰색 */
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 2px 2px 5px rgba(0, 0, 0, 0.5);
  z-index: 6; /* 오버레이보다 위에 */
  pointer-events: none; /* 클릭 이벤트 방해 안 함 */
  animation: countdown-pulse 1s ease-out infinite alternate;

  @keyframes countdown-pulse {
    from {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.8;
    }
    to {
      transform: translate(-50%, -50%) scale(1.1);
      opacity: 1;
    }
  }
`;

interface ExtendedAnimationProps extends AnimationProps {
  cameraContainerRef?: React.RefObject<HTMLDivElement>;
}

// 얼굴 이미지 자르기 헬퍼 함수 (이전 코드와 동일하게 유지)
const cropFaceImage = (
  image: HTMLImageElement,
  faceCoords: FaceCoordinates,
  videoWidth: number,
  videoHeight: number
): string | null => {
  if (!videoWidth || !videoHeight) return null;

  const [x, y, w, h] = faceCoords;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 약간의 여백을 포함하여 정사각형 형태로 자르기 위한 계산
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const size = Math.max(w, h) * 1.2; // 여백 20% 추가
  const cropX = Math.max(0, centerX - size / 2);
  const cropY = Math.max(0, centerY - size / 2);
  const cropW = Math.min(videoWidth - cropX, size);
  const cropH = Math.min(videoHeight - cropY, size);

  // 자를 영역이 너무 작으면 null 반환
  if (cropW <= 0 || cropH <= 0) {
    console.warn("Invalid crop dimensions:", { cropX, cropY, cropW, cropH });
    return null;
  }

  canvas.width = 128; // 출력 이미지 크기 (정사각형)
  canvas.height = 128;

  try {
    // 이미지의 특정 영역을 캔버스에 그림 (소스 영역 -> 대상 영역)
    ctx.drawImage(
      image,
      cropX, // 소스 X
      cropY, // 소스 Y
      cropW, // 소스 너비
      cropH, // 소스 높이
      0, // 대상 X
      0, // 대상 Y
      canvas.width, // 대상 너비
      canvas.height // 대상 높이
    );
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Error cropping face image:", error);
    return null;
  }
};

const HandpickAnimation: React.FC<ExtendedAnimationProps> = ({
  websocket,
  cameraContainerRef,
}) => {
  const { getHandpickState } = useAnimation(websocket);
  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [rankedFaceImages, setRankedFaceImages] = useState<
    Array<{ rank: number; score: number; imageSrc: string | null }>
  >([]);

  // 상태 가져오기
  const {
    handpickActive,
    handpickFaces,
    handpickStage,
    handpickProgress,
    expressionMode,
    remainingSeconds,
    resultMessage,
    resultExpressionName,
    handpickRanking,
    handpickCountdown,
    finalHandpickFrame,
  } = getHandpickState();

  // 비디오 요소와 컨테이너 크기를 가져오는 로직 (useLayoutEffect 사용)
  useLayoutEffect(() => {
    if (!cameraContainerRef?.current) return;

    const containerElement = cameraContainerRef.current;
    const videoElement = containerElement.querySelector("video");

    const updateDimensions = () => {
      if (
        videoElement &&
        videoElement.videoWidth > 0 &&
        videoElement.videoHeight > 0
      ) {
        setVideoDimensions({
          width: videoElement.videoWidth, // 원본 비디오 너비
          height: videoElement.videoHeight, // 원본 비디오 높이
        });
      }
      if (containerElement) {
        // 화면에 렌더링된 카메라 컨테이너의 실제 크기
        setContainerDimensions({
          width: containerElement.offsetWidth,
          height: containerElement.offsetHeight,
        });
      }
    };

    // 초기 크기 측정
    updateDimensions();

    // 비디오 메타데이터 로드 시 다시 측정
    videoElement?.addEventListener("loadedmetadata", updateDimensions);
    // 컨테이너 크기 변경 감지
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerElement);

    // 클린업 함수
    return () => {
      videoElement?.removeEventListener("loadedmetadata", updateDimensions);
      resizeObserver.disconnect();
    };
  }, [cameraContainerRef]); // cameraContainerRef가 변경될 때만 실행

  // --- 결과 스테이지에서 얼굴 이미지 생성하는 useEffect (수정) ---
  useEffect(() => {
    // finalHandpickFrame이 있고, 결과 스테이지이고, 랭킹 데이터가 있을 때 실행
    if (
      handpickStage === "result" &&
      handpickRanking &&
      finalHandpickFrame &&
      videoDimensions.width > 0 &&
      videoDimensions.height > 0
    ) {
      console.log("Final handpick frame available, attempting to crop faces.");
      const image = new Image();
      image.src = finalHandpickFrame;

      image.onload = () => {
        console.log("Final frame loaded for cropping.");
        const faceImages = handpickRanking.map((item) => {
          const imageSrc = cropFaceImage(
            image,
            item.face,
            videoDimensions.width,
            videoDimensions.height
          );
          if (!imageSrc) {
            console.warn(`Failed to crop image for rank ${item.rank}`);
          }
          return {
            rank: item.rank,
            score: item.score,
            imageSrc: imageSrc,
          };
        });
        console.log(
          "Cropped face images from final frame:",
          faceImages.filter((img) => img.imageSrc).length
        );
        setRankedFaceImages(faceImages);
      };
      image.onerror = (error) => {
        console.error("Error loading final handpick frame:", error);
        // 이미지 로드 실패 시 빈 이미지로 설정
        setRankedFaceImages(
          handpickRanking.map((item) => ({
            rank: item.rank,
            score: item.score,
            imageSrc: null,
          }))
        );
      };
    } else if (handpickStage !== "result") {
      // 결과 스테이지가 아니면 이미지 초기화
      setRankedFaceImages([]);
    }
  }, [handpickStage, handpickRanking, finalHandpickFrame, videoDimensions]);

  // 애니메이션이 활성화되어있지 않으면 null을 반환
  if (!handpickActive) return null;

  // 스테이지 텍스트 로직 수정
  const getStageText = () => {
    // start 스테이지에서도 expressionMode에 따라 다른 텍스트 표시
    if (handpickStage === "start") {
      switch (expressionMode) {
        case "open_mouth":
          return "😲 입을 크게 벌려보세요!";
        case "big_smile":
          return "😄 활짝 웃어보세요!";
        case "surprise":
          return "😮 놀란 표정을 지어보세요!";
        case "ugly_face": // <<< 수정: 못난이 표정 시작 안내
          return "🤪 못난이 표정을 지어보세요!"; // "개성있는" -> "못난"
        default:
          return "🎭 최고의 표정을 찾아라!";
      }
    }

    // 기존 스테이지 텍스트 로직
    switch (handpickStage) {
      case "calibration":
        return "😐 평소 표정을 유지해주세요...";
      case "waiting":
      case "detecting":
        // expressionMode가 확실히 있을 것이므로 기본값 제거 가능
        switch (expressionMode) {
          case "open_mouth":
            return "😲 입을 크게 벌려보세요!";
          case "big_smile":
            return "😄 활짝 웃어보세요!";
          case "surprise":
            return "😮 놀란 표정을 지어보세요!";
          case "ugly_face": // <<< 수정: 못난이 표정 진행 안내
            return "🤪 못난이 표정을 지어보세요!"; // "개성있는" -> "못난"
          default:
            return "표정을 지어주세요!"; // 혹시 모를 기본값
        }
      case "result":
        return "✨ 결과 발표! ✨";
      default:
        // handpickStage가 예상 못한 값일 경우
        return "🎭 연기 대상 선정 중...";
    }
  };

  // 남은 시간 긴급도 계산 (remainingSeconds 직접 사용)
  const getTimerUrgency = (): "normal" | "warning" | "critical" => {
    if (remainingSeconds === null) return "normal";
    if (remainingSeconds <= 3) return "critical";
    if (remainingSeconds <= 5) return "warning";
    return "normal";
  };

  const urgency = getTimerUrgency(); // 긴급도 계산

  // --- 순위 데이터를 1, 2, 3등으로 분리 ---
  const rank1 = handpickRanking?.find((item) => item.rank === 1);
  const rank2 = handpickRanking?.find((item) => item.rank === 2);
  const rank3 = handpickRanking?.find((item) => item.rank === 3);

  // 오버레이 활성화 여부 결정 (초기 카운트다운 단계에서만 활성)
  // 'start' 스테이지는 서버에서 handpick_progress 메시지로 전달됨
  const isOverlayActive = handpickStage === "start";

  // 좌표 변환 로직
  const transformCoordinates = (
    faceCoords: [number, number, number, number]
  ) => {
    const [x, y, w, h] = faceCoords;

    // 원본 비디오 및 컨테이너 크기가 유효한 경우에만 변환
    if (
      videoDimensions.width > 0 &&
      videoDimensions.height > 0 &&
      containerDimensions.width > 0 &&
      containerDimensions.height > 0
    ) {
      const scaleX = containerDimensions.width / videoDimensions.width;
      const scaleY = containerDimensions.height / videoDimensions.height;

      // 중요: CSS transform: scaleX(-1) 등으로 비디오가 좌우 반전된 경우 x 좌표 보정 필요
      // Camera.tsx 확인 필요. 만약 반전되었다면:
      // const transformedX = (videoDimensions.width - x - w) * scaleX;
      // 현재는 반전 없다고 가정:
      const transformedX = x * scaleX;
      const transformedY = y * scaleY;
      const transformedW = w * scaleX;
      const transformedH = h * scaleY;

      return {
        left: `${transformedX}px`,
        top: `${transformedY}px`,
        width: `${transformedW}px`,
        height: `${transformedH}px`,
      };
    }
    // 크기 정보가 아직 없으면 기본값 반환 (또는 렌더링 안 함)
    return {
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
      display: "none",
    };
  };

  return (
    <Container>
      {/* 변경: ProgressBar와 ExpressionInfo를 TopInfoContainer로 묶음 */}
      {handpickStage !== "start" && handpickStage !== "result" && (
        <TopInfoContainer>
          <ProgressBarContainer>
            <ProgressBarFill progress={handpickProgress} urgency={urgency} />
            {remainingSeconds !== null && (
              <ProgressBarText urgency={urgency}>
                {remainingSeconds}초
              </ProgressBarText>
            )}
          </ProgressBarContainer>
          {expressionMode && (
            <ExpressionInfo>
              {expressionMode === "open_mouth"
                ? "😲 입 크게!"
                : expressionMode === "big_smile"
                ? "😄 활짝 웃기!"
                : expressionMode === "surprise"
                ? "😮 놀란 표정!"
                : expressionMode === "ugly_face" // <<< 수정: 못난이 표정 상단 안내
                ? "🤪 못난이 표정!" // "개성 발사!" -> "못난 표정!"
                : "표정 준비!"}
            </ExpressionInfo>
          )}
        </TopInfoContainer>
      )}

      {/* 스테이지 안내 오버레이 (카운트다운 중 활성) */}
      {handpickStage === "start" && (
        <Overlay isActive={isOverlayActive}>
          <Instruction>{getStageText()}</Instruction>
          {handpickCountdown !== null && (
            <CountdownNumber>{handpickCountdown}</CountdownNumber>
          )}
        </Overlay>
      )}

      {/* 실시간 얼굴 표시 (결과 화면에서는 숨김) */}
      {handpickStage !== "result" &&
        handpickFaces.map((faceData, index) => {
          const style = transformCoordinates(faceData.face);
          return (
            <FaceContainer
              key={index}
              style={style}
              x={0}
              y={0}
              width={0}
              height={0}
              active={faceData.is_candidate}
            >
              <FaceScore>{`${Math.round(
                faceData.expression_score // 점수 스케일이 0-100으로 변경되었으므로 /100 제거
              )}점`}</FaceScore>
              <ExpressionMeter value={faceData.expression_score / 100} />
            </FaceContainer>
          );
        })}

      {/* --- 결과 표시 (시상대 레이아웃 적용) --- */}
      {handpickStage === "result" && handpickRanking && (
        <>
          {/* 순위 표시 컨테이너 */}
          <RankingContainer>
            {/* --- 시상대 표시 컨테이너 --- */}
            <PodiumDisplayContainer>
              {/* 2등 표시 */}
              {rank2 && (
                <RankItem key={rank2.rank} rank={rank2.rank}>
                  <RankedFace
                    rank={rank2.rank}
                    imageSrc={
                      rankedFaceImages.find((img) => img.rank === rank2.rank)
                        ?.imageSrc
                    }
                  >
                    {!rankedFaceImages.find((img) => img.rank === rank2.rank)
                      ?.imageSrc && `2위`}
                  </RankedFace>
                  <ScoreText>({Math.round(rank2.score)}점)</ScoreText>
                </RankItem>
              )}

              {/* 1등 표시 */}
              {rank1 && (
                <RankItem key={rank1.rank} rank={rank1.rank}>
                  <Crown>👑</Crown>
                  <RankedFace
                    rank={rank1.rank}
                    imageSrc={
                      rankedFaceImages.find((img) => img.rank === rank1.rank)
                        ?.imageSrc
                    }
                  >
                    {!rankedFaceImages.find((img) => img.rank === rank1.rank)
                      ?.imageSrc && `1위`}
                  </RankedFace>
                  <ScoreText>({Math.round(rank1.score)}점)</ScoreText>
                </RankItem>
              )}

              {/* 3등 표시 */}
              {rank3 && (
                <RankItem key={rank3.rank} rank={rank3.rank}>
                  <RankedFace
                    rank={rank3.rank}
                    imageSrc={
                      rankedFaceImages.find((img) => img.rank === rank3.rank)
                        ?.imageSrc
                    }
                  >
                    {!rankedFaceImages.find((img) => img.rank === rank3.rank)
                      ?.imageSrc && `3위`}
                  </RankedFace>
                  <ScoreText>({Math.round(rank3.score)}점)</ScoreText>
                </RankItem>
              )}
            </PodiumDisplayContainer>
          </RankingContainer>

          {/* 최종 결과 메시지 */}
          {resultMessage && (
            <ResultText>
              {resultExpressionName && `🏆 ${resultExpressionName}! `}
              {resultMessage}
            </ResultText>
          )}
        </>
      )}
    </Container>
  );
};

export default HandpickAnimation;
