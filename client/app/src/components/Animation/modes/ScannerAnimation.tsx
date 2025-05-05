import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { AnimationProps } from "../types";
import { useAnimation } from "../useAnimation";

const ScannerContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
`;

const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 90%;
  height: 90%;
  object-fit: contain;
  z-index: 2;
  opacity: 0.4;
  pointer-events: none;
`;

const OverlayImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 10;
`;

const StatusText = styled.div<{
  posX: number;
  posY: number;
  color: string;
  size?: string;
}>`
  position: absolute;
  left: ${(props) => `${props.posX * 100}%`};
  top: ${(props) => `${props.posY * 100}%`};
  transform: translate(-50%, -50%);
  color: ${(props) => props.color};
  font-size: ${(props) => props.size || "min(28px, 2.8vw)"};
  font-weight: bold;
  font-family: "Cinzel", serif;
  text-shadow: 0 0 10px rgba(255, 165, 0, 0.8), 1px 1px 3px rgba(0, 0, 0, 0.9);
  z-index: 6;
  letter-spacing: 1px;
  opacity: 0;
  animation: fadeInText 0.5s forwards;
  text-align: center;
  max-width: 90%;
  white-space: nowrap;

  @keyframes fadeInText {
    to {
      opacity: 1;
    }
  }
`;

const FireEffect = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 69, 0, 0) 0%,
    rgba(255, 69, 0, 0.1) 50%,
    rgba(255, 69, 0, 0.2) 100%
  );
  pointer-events: none;
  z-index: 4;
  opacity: 0.5;
`;

const VignetteEffect = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at center,
    transparent 50%,
    rgba(0, 0, 0, 0.7) 100%
  );
  pointer-events: none;
  z-index: 3;
`;

const ResultMessage = styled.div`
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffdd00;
  padding: min(20px, 2.5vw) min(30px, 3.5vw);
  border-radius: 5px;
  font-size: min(36px, 4vw);
  font-weight: bold;
  font-family: "Cinzel", serif;
  z-index: 15;
  text-align: center;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.4);
  border: 1px solid rgba(255, 215, 0, 0.6);
  letter-spacing: 1px;
  animation: pulseGlow 2s infinite alternate;
  max-width: 90%;

  @keyframes pulseGlow {
    from {
      box-shadow: 0 0 20px rgba(255, 140, 0, 0.4);
    }
    to {
      box-shadow: 0 0 30px rgba(255, 140, 0, 0.8);
    }
  }
`;

const FakeEyeTarget = styled.img<{
  posX: number;
  posY: number;
  sizeFactor: number;
}>`
  position: absolute;
  left: ${(props) => `${props.posX * 100}%`};
  top: ${(props) => `${props.posY * 100}%`};
  width: ${(props) => `${props.sizeFactor * 100}%`};
  height: auto;
  transform: translate(-50%, -50%);
  z-index: 5;
  pointer-events: none;
`;

const RadarTargetOverlay = styled.img<{
  posX: number;
  posY: number;
  width: number;
  height: number;
  isFinal: boolean;
}>`
  position: absolute;
  left: ${(props) => `${props.posX * 100}%`};
  top: ${(props) => `${props.posY * 100}%`};
  width: ${(props) => `${props.width}px`};
  height: ${(props) => `${props.height}px`};
  transform: translate(-50%, -50%)
    ${(props) => (props.isFinal ? "scale(1.05)" : "scale(1)")};
  object-fit: contain;
  z-index: 5;
  pointer-events: none;
  opacity: ${(props) => (props.isFinal ? 1 : 0.8)};
  transition: transform 0.2s ease;
`;

const FailureMessage = styled(ResultMessage)`
  color: #ff6b6b;
  background-color: rgba(0, 0, 0, 0.8);
  border: 2px solid #ff4444;
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);

  @keyframes pulseGlow {
    from {
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
    }
    to {
      box-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
    }
  }
`;

const ZoomTargetPoint = styled.img<{
  x: number;
  y: number;
  size: number;
}>`
  position: absolute;
  left: ${(props) => props.x - props.size / 2}px;
  top: ${(props) => props.y - props.size / 2}px;
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
  z-index: 6;
  pointer-events: none;
  animation: radarPulse 1s infinite alternate;
  filter: hue-rotate(30deg) brightness(1.2);

  @keyframes radarPulse {
    from {
      transform: scale(0.9) rotate(-5deg);
      opacity: 0.8;
    }
    to {
      transform: scale(1.1) rotate(5deg);
      opacity: 1;
    }
  }
`;

interface ExtendedAnimationProps extends AnimationProps {
  cameraContainerRef?: React.RefObject<HTMLDivElement>;
  isCameraFlipped?: boolean;
}

const ScannerAnimation: React.FC<ExtendedAnimationProps> = ({
  websocket,
  cameraContainerRef,
  isCameraFlipped = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targetPoints, setTargetPoints] = useState<
    { x: number; y: number; size: number }[]
  >([]);
  const [targetFace, setTargetFace] = useState<
    [number, number, number, number] | null
  >(null);
  const [isFinalTarget, setIsFinalTarget] = useState(false);
  const [scannerStage, setScannerStage] = useState<string>("idle");
  const [statusText, setStatusText] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [showBorder, setShowBorder] = useState(false);
  const [resultMessage, setResultMessage] = useState<string>("");

  const [currentScale, setCurrentScale] = useState<number>(1.0);
  const [isAnimatingScale, setIsAnimatingScale] = useState<boolean>(false);
  const animationRef = useRef<number | null>(null);
  const [isWarmedUp, setIsWarmedUp] = useState<boolean>(false);

  const prevZoomStateRef = useRef<{
    face: [number, number, number, number] | null;
    stage: string;
  }>({ face: null, stage: "" });

  const { getScannerState } = useAnimation(websocket);

  const {
    scannerActive,
    scannerTargetPoints,
    scannerTargetFace,
    scannerZoomScale,
    scannerStage: currentStage,
    scannerProgress,
    scannerStatusText,
    scannerShowBorder,
    resultMessage: currentResultMessage,
    isFinalTarget: currentIsFinalTarget,
    cameraPanOffset,
  } = getScannerState();

  const animateScale = useCallback(
    (target: number, translateX: number, translateY: number) => {
      setIsAnimatingScale(true);

      let startTime: number | null = null;
      const duration = 0.8;
      const durationMs = duration * 1000;

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const easedProgress = easeOutCubic(progress);

        const newScale = currentScale + (target - currentScale) * easedProgress;
        setCurrentScale(newScale);

        const flipPrefix = isCameraFlipped ? "scaleY(-1) " : "";
        const zoomPanTransform = `scale(${newScale}) translate(${
          translateX * 100
        }%, ${translateY * 100}%)`;
        const newTransform = `translate3d(0, 0, 0) ${flipPrefix}${zoomPanTransform}`;

        if (cameraContainerRef?.current) {
          const videoElement =
            cameraContainerRef.current.querySelector("video");
          if (videoElement) {
            videoElement.style.transition = "none";
            videoElement.style.transform = newTransform;
          }
        }

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsAnimatingScale(false);
          setCurrentScale(target);
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [cameraContainerRef, currentScale, isCameraFlipped]
  );

  const performPrewarmup = useCallback(() => {
    if (!cameraContainerRef?.current) return;

    console.log("줌 애니메이션 프리웜업 시작...");

    const dummyElement = document.createElement("div");
    dummyElement.style.position = "absolute";
    dummyElement.style.top = "-9999px";
    dummyElement.style.left = "-9999px";
    dummyElement.style.width = "100px";
    dummyElement.style.height = "100px";
    document.body.appendChild(dummyElement);

    const warmupScales = [1.2, 1.5, 2.0, 2.5];
    let currentIndex = 0;

    const runWarmupStep = () => {
      if (currentIndex >= warmupScales.length) {
        document.body.removeChild(dummyElement);
        setIsWarmedUp(true);
        console.log("줌 애니메이션 프리웜업 완료");
        return;
      }

      const scale = warmupScales[currentIndex];
      dummyElement.style.transform = `scale(${scale})`;

      void dummyElement.offsetHeight;

      currentIndex++;
      setTimeout(runWarmupStep, 50);
    };

    // 웜업 시작
    runWarmupStep();

    const videoElement = cameraContainerRef.current.querySelector("video");
    if (videoElement) {
      videoElement.style.willChange = "transform";
      const initialFlipTransform = isCameraFlipped ? "scaleY(-1)" : "none";
      videoElement.style.transform = `translate3d(0, 0, 0) ${initialFlipTransform}`;
      void videoElement.offsetHeight;
    }
  }, [cameraContainerRef, isCameraFlipped]);

  useEffect(() => {
    if (!isWarmedUp && scannerActive) {
      const warmupTimer = setTimeout(performPrewarmup, 100);
      return () => clearTimeout(warmupTimer);
    }
  }, [isWarmedUp, scannerActive, performPrewarmup]);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const updateContainerSize = useCallback(() => {
    if (cameraContainerRef?.current) {
      const { clientWidth, clientHeight } = cameraContainerRef.current;
      setContainerSize({ width: clientWidth, height: clientHeight });
    }
  }, [cameraContainerRef]);

  useEffect(() => {
    updateContainerSize();

    const handleResize = () => {
      updateContainerSize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateContainerSize]);

  const transformCoordinates = useCallback(
    (
      rect: [number, number, number, number]
    ): { posX: number; posY: number; width: number; height: number } => {
      if (!cameraContainerRef?.current)
        return { posX: 0.5, posY: 0.5, width: 0, height: 0 };

      const container = cameraContainerRef.current;
      const videoElement = container.querySelector("video");

      if (!videoElement) return { posX: 0.5, posY: 0.5, width: 0, height: 0 };

      const { clientWidth: containerWidth, clientHeight: containerHeight } =
        container;

      // 좌표 변환
      const [x, y, w, h] = rect;

      // 비디오 원본 크기
      const videoWidth = videoElement.videoWidth || containerWidth;
      const videoHeight = videoElement.videoHeight || containerHeight;

      // 비율 계산
      const scaleX = containerWidth / videoWidth;
      const scaleY = containerHeight / videoHeight;

      // 스케일된 치수 계산
      const scaledW = w * scaleX;
      const scaledH = h * scaleY;

      // 중심점 좌표를 0~1 사이의 상대 값으로 변환
      const centerX = (x * scaleX + scaledW / 2) / containerWidth;
      const centerY = (y * scaleY + scaledH / 2) / containerHeight;

      return {
        posX: centerX,
        posY: centerY,
        width: scaledW,
        height: scaledH,
      };
    },
    [cameraContainerRef]
  );

  const [transformedTargetFace, setTransformedTargetFace] = useState<{
    posX: number;
    posY: number;
    width: number;
    height: number;
  } | null>(null);

  const [zoomTargetPoints, setZoomTargetPoints] = useState<
    { x: number; y: number; size: number }[]
  >([]);

  useEffect(() => {
    if (scannerTargetPoints.length > 0) {
      if (scannerStage === "fake_targeting") {
        setTargetPoints(
          scannerTargetPoints.map((point) => ({
            x: point[0],
            y: point[1],
            size: 100,
          }))
        );
      } else if (scannerStage === "zoom_targeting") {
        // 줌 영역 내 타겟팅 처리
        setZoomTargetPoints(
          scannerTargetPoints.map((point) => ({
            x: point[0],
            y: point[1],
            size: 20, // 더 작은 크기의 타겟 포인트
          }))
        );
      }
    }

    if (scannerTargetFace) {
      setTargetFace(scannerTargetFace);
      setIsFinalTarget(currentIsFinalTarget);

      if (
        cameraContainerRef?.current &&
        (currentStage === "first_zoom" || currentStage === "final_zoom")
      ) {
        const currentState = { face: scannerTargetFace, stage: currentStage };
        const prevState = prevZoomStateRef.current;

        if (
          JSON.stringify(currentState.face) !==
            JSON.stringify(prevState.face) ||
          currentState.stage !== prevState.stage
        ) {
          prevZoomStateRef.current = currentState;

          const container = cameraContainerRef.current;
          const videoElement = container.querySelector("video");

          if (videoElement && videoElement.videoHeight > 0) {
            const videoWidth = videoElement.videoWidth;
            const videoHeight = videoElement.videoHeight;

            const [x, y, w, h] = scannerTargetFace;

            let centerY_for_translate: number;
            if (isCameraFlipped) {
              const originalY = videoHeight - y - h;
              centerY_for_translate = originalY + h / 2;
            } else {
              centerY_for_translate = y + h / 2;
            }

            const centerX = x + w / 2;
            const translateX =
              ((videoWidth / 2 - centerX) / (videoWidth / 2)) * 0.5;
            const translateY =
              ((videoHeight / 2 - centerY_for_translate) / (videoHeight / 2)) *
              0.5;

            const faceRatio = w / videoWidth;
            let finalScale =
              typeof scannerZoomScale === "number" ? scannerZoomScale : 1.0;

            if (currentStage === "first_zoom") {
              const firstZoomRatio = 0.07;
              finalScale = firstZoomRatio / Math.max(faceRatio, 0.01);
              finalScale = Math.max(1.0, Math.min(3.0, finalScale));
            } else if (currentStage === "final_zoom") {
              const finalZoomRatio = 0.27;
              finalScale = finalZoomRatio / Math.max(faceRatio, 0.01);
              finalScale = Math.max(1.0, Math.min(5.0, finalScale));
            }

            animateScale(finalScale, translateX, translateY);
          }
        }
      }
    } else {
      setTargetFace(null);
    }

    if (currentStage) {
      setScannerStage(currentStage);
    }

    if (scannerProgress > 0) {
      setProgress(scannerProgress);
    }

    if (scannerStatusText) {
      setStatusText(scannerStatusText);
    }

    setShowBorder(scannerShowBorder);

    if (currentResultMessage) {
      setResultMessage(currentResultMessage);
    }

    if (scannerTargetPoints.length > 0 && currentStage === "fake_targeting") {
      setTargetPoints(
        scannerTargetPoints.map((point) => ({
          x: point[0],
          y: point[1],
          size: 100,
        }))
      );
    } else if (
      scannerTargetPoints.length > 0 &&
      currentStage === "zoom_targeting"
    ) {
      setZoomTargetPoints(
        scannerTargetPoints.map((point) => ({
          x: point[0],
          y: point[1],
          size: 20,
        }))
      );
    }

    if (scannerTargetFace) {
      setTransformedTargetFace(transformCoordinates(scannerTargetFace));
    } else {
      setTransformedTargetFace(null);
    }
  }, [
    scannerTargetPoints,
    scannerTargetFace,
    scannerZoomScale,
    currentStage,
    scannerProgress,
    scannerStatusText,
    scannerShowBorder,
    currentResultMessage,
    currentIsFinalTarget,
    cameraContainerRef,
    animateScale,
    transformCoordinates,
    isCameraFlipped,
  ]);

  const [fireOpacity, setFireOpacity] = useState(0.4);

  useEffect(() => {
    if (!scannerActive) return;

    const interval = setInterval(() => {
      setFireOpacity((prev) => 0.3 + Math.random() * 0.2);
    }, 200);

    return () => clearInterval(interval);
  }, [scannerActive]);

  useEffect(() => {
    if (!cameraContainerRef?.current) {
      console.log("ScannerAnimation: cameraContainerRef가 없습니다.");
      return;
    }

    const cameraContainer = cameraContainerRef.current;
    const videoElement = cameraContainer.querySelector("video");

    if (scannerActive) {
      cameraContainer.style.zIndex = "1";
    } else {
      cameraContainer.style.zIndex = "10";
      cameraContainer.style.boxShadow = "none";
      if (videoElement) {
        videoElement.style.transition = "";
        const flipTransform = isCameraFlipped ? "scaleY(-1)" : "";
        const resetZoomPan = " scale(1) translate(0%, 0%)";
        videoElement.style.transform = `translate3d(0, 0, 0)${flipTransform}${resetZoomPan}`;
      }
    }

    return () => {
      cameraContainer.style.zIndex = "10";
      cameraContainer.style.boxShadow = "none";
      if (videoElement) {
        videoElement.style.transition = "";
        const flipTransform = isCameraFlipped ? "scaleY(-1)" : "";
        const resetZoomPan = " scale(1) translate(0%, 0%)";
        videoElement.style.transform = `translate3d(0, 0, 0)${flipTransform}${resetZoomPan}`;
      }
    };
  }, [scannerActive, cameraContainerRef, isCameraFlipped]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 카메라 패닝 애니메이션 함수
  const animatePan = useCallback(
    (offsetX: number, offsetY: number, isLastPosition: boolean) => {
      if (!cameraContainerRef?.current) return;

      const videoElement = cameraContainerRef.current.querySelector("video");
      if (!videoElement) return;

      const flipPrefix = isCameraFlipped ? "scaleY(-1) " : "";

      // --- 수정: isCameraFlipped일 때 offsetY 부호 반전 ---
      const finalOffsetY = isCameraFlipped ? -offsetY : offsetY;
      // --- 수정 끝 ---

      // 수정된 finalOffsetY 사용
      const zoomPanTransform = `scale(${currentScale}) translate(${
        offsetX * 100
      }%, ${finalOffsetY * 100}%)`;
      const newTransform = `translate3d(0, 0, 0) ${flipPrefix}${zoomPanTransform}`;

      if (isLastPosition) {
        videoElement.style.transition =
          "transform 0.85s cubic-bezier(0.23, 1, 0.32, 1)";
      } else {
        videoElement.style.transition =
          "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)";
      }

      videoElement.style.transform = newTransform;
    },
    [cameraContainerRef, currentScale, isCameraFlipped]
  );

  // 카메라 패닝 효과 적용
  useEffect(() => {
    if (scannerStage === "camera_panning" && cameraPanOffset) {
      // 마지막 위치인지 확인 (progress가 90% 이상이면 마지막 위치로 간주)
      const isLastPosition = scannerProgress >= 90;
      animatePan(cameraPanOffset.x, cameraPanOffset.y, isLastPosition);
    }
  }, [scannerStage, cameraPanOffset, scannerProgress, animatePan]);

  if (!scannerActive) return null;

  return (
    <ScannerContainer ref={containerRef}>
      {scannerStage === "fake_targeting" && (
        <BackgroundImage
          src="assets/images/scanner_zoom/tower_of_sauron.png"
          alt="Tower Background"
        />
      )}

      <FireEffect style={{ opacity: fireOpacity }} />

      <VignetteEffect />

      {scannerStage === "fake_targeting" &&
        targetPoints.slice(-2).map((point, index) => {
          const posX = point.x / containerSize.width;
          const posY = point.y / containerSize.height;
          const sizeFactor = Math.min(0.1, 100 / containerSize.width);

          return (
            <FakeEyeTarget
              key={`eye-${index}`}
              posX={posX}
              posY={posY}
              sizeFactor={sizeFactor}
              src="assets/images/scanner_zoom/fake_eye.png"
              alt="Target"
            />
          );
        })}

      {scannerStage === "zoom_targeting" &&
        zoomTargetPoints
          .slice(-3)
          .map((point, index) => (
            <ZoomTargetPoint
              key={`zoom-target-${index}`}
              x={point.x}
              y={point.y}
              size={point.size * 3}
              src="assets/images/scanner_zoom/target_radar.png"
              alt="Radar Target"
            />
          ))}

      {scannerStage === "face_targeting" && transformedTargetFace && (
        <RadarTargetOverlay
          posX={transformedTargetFace.posX}
          posY={transformedTargetFace.posY}
          width={transformedTargetFace.width}
          height={transformedTargetFace.height}
          src="assets/images/scanner_zoom/target_radar.png"
          alt="Radar Target"
          isFinal={isFinalTarget}
        />
      )}

      {statusText && scannerStage !== "result" && (
        <StatusText
          posX={0.5}
          posY={0.9}
          color={
            scannerStage === "first_zoom" || scannerStage === "final_zoom"
              ? "rgba(255, 215, 0, 0.9)"
              : "rgba(255, 69, 0, 0.9)"
          }
          size={`min(${scannerStage === "face_targeting" ? "32px" : "28px"}, ${
            scannerStage === "face_targeting" ? "3.5vw" : "3vw"
          })`}
        >
          {statusText === "중간계 관찰 중..."
            ? "중간계 탐색 중..."
            : statusText === "대상 포착 완료"
            ? "대상 포착 완료"
            : statusText === "의지 분석 중..."
            ? "의지력 측정 중..."
            : statusText === "대상 분석 중..."
            ? "운명의 저울이 기울고 있습니다..."
            : statusText.includes("사우론의 시선")
            ? statusText.replace("사우론의 시선 집중:", "사우론의 시선 집중:")
            : statusText.includes("최종 시선")
            ? statusText.replace("최종 시선 집중:", "운명의 고리가 완성됩니다:")
            : statusText}
          {progress > 0 &&
          !statusText.includes("%") &&
          statusText !== "대상 포착 완료" &&
          statusText !== "의지 분석 중..."
            ? ` ${progress}%`
            : ""}
        </StatusText>
      )}

      {showBorder && (
        <OverlayImage
          src="assets/images/scanner_zoom/eye_of_sauron_border.png"
          alt="Eye of Sauron"
        />
      )}

      {resultMessage &&
        scannerStage === "result" &&
        (resultMessage.includes("찾을 수 없습니다") ? (
          <FailureMessage>{"어둠이 운명을 가리었습니다..."}</FailureMessage>
        ) : (
          <ResultMessage>
            {resultMessage.includes("한 명의 반지의 제왕")
              ? "한 명의 반지의 제왕만이 존재할 뿐..."
              : resultMessage}
          </ResultMessage>
        ))}
    </ScannerContainer>
  );
};

export default ScannerAnimation;
