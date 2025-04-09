import React, { useEffect, useRef, useState } from "react";
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

  // 줌 효과 계산 및 적용
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
      let scale;

      if (faceRatio < 0.1) {
        // 매우 작은 얼굴
        scale = Math.min(4.0, 1.0 / Math.max(faceRatio, 0.05));
      } else if (faceRatio < 0.2) {
        // 중간 크기 얼굴
        scale = Math.min(2.5, 1.0 / Math.max(faceRatio, 0.08));
      } else {
        // 큰 얼굴
        scale = Math.min(1.8, 1.0 / Math.max(faceRatio, 0.1));
      }

      // 또는 zoomParams가 있으면 사용
      scale = zoomParams?.scale || scale;

      // 화면 중앙에서 얼굴까지의 상대적 오프셋 계산
      const centerX = x + w / 2;
      const centerY = y + h / 2;

      // 비디오 중앙 기준으로 변환 값 계산 (-1 ~ 1 범위로 정규화)
      const translateX = ((videoWidth / 2 - centerX) / (videoWidth / 2)) * 0.5;
      const translateY =
        ((videoHeight / 2 - centerY) / (videoHeight / 2)) * 0.5;

      // 줌 트랜스폼 설정
      setZoomTransform(
        `scale(${scale}) translate(${translateX * 100}%, ${translateY * 100}%)`
      );
      setZoomActive(true);

      // 비디오 요소에 트랜스폼 적용
      if (videoElement) {
        const duration = zoomParams?.duration || 0.8;
        videoElement.style.transition = `transform ${duration}s ease-out`;
        videoElement.style.transform = `translate3d(0, 0, 0) ${zoomTransform}`;
      }
    }
  }, [
    selectedFace,
    curtainPosition,
    cameraContainerRef,
    zoomParams,
    zoomTransform,
  ]);

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
