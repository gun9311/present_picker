import React, {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import styled from "@emotion/styled";
import { useAnimationContext } from "../Animation/AnimationContext";

const VideoContainer = styled.div`
  width: 99%;
  max-width: none;
  aspect-ratio: 16/9;
  position: relative;
  overflow: hidden;
  background: #000;
  transform: translate3d(0, 0, 0); // 하드웨어 가속
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translate3d(0, 0, 0); // 하드웨어 가속
`;

// 캔버스 기반으로 되돌리고 최적화
const FaceCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transform: translate3d(0, 0, 0); // 하드웨어 가속
`;

// 프레임 캡처용 숨겨진 캔버스 추가
const HiddenCanvas = styled.canvas`
  display: none; // 화면에 보이지 않게
`;

export interface CameraProps {
  onFrame?: (frame: string) => void;
  isActive: boolean;
  faces?: Array<[number, number, number, number]>; // [x, y, width, height]
  isConnected?: boolean;
}

// 외부에서 호출할 수 있는 메서드 타입 정의
export interface CameraHandle {
  updateFaceFrames: (faces: Array<[number, number, number, number]>) => void;
}

const Camera = forwardRef<CameraHandle, CameraProps>(
  ({ onFrame, isActive, faces = [], isConnected = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const faceCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameRequestRef = useRef<number | null>(null);
    const lastCaptureTime = useRef<number>(0);
    const prevFacesRef = useRef<Array<[number, number, number, number]>>([]);
    const faceUpdateAnimationRef = useRef<number | null>(null);

    // useAnimationContext 훅을 사용하여 현재 애니메이션 상태 가져오기
    const { currentMode, isSelecting } = useAnimationContext();

    // useEffect를 추가하여 isSelecting이나 currentMode가 변경될 때 캔버스 초기화
    useEffect(() => {
      // 커튼 애니메이션이 시작되면 즉시 캔버스 초기화
      if (
        isSelecting &&
        (currentMode === "curtain" ||
          currentMode === "scanner" ||
          currentMode === "handpick") &&
        faceCanvasRef.current
      ) {
        const ctx = faceCanvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            faceCanvasRef.current.width,
            faceCanvasRef.current.height
          );
        }
      }
    }, [isSelecting, currentMode]);

    // 얼굴 프레임 그리기 함수를 수정합니다
    const drawFaces = useCallback(() => {
      // 애니메이션이 진행 중이거나 필요한 참조가 없으면 리턴
      if (
        (isSelecting &&
          (currentMode === "curtain" ||
            currentMode === "scanner" ||
            currentMode === "handpick")) ||
        !faceCanvasRef.current ||
        !videoRef.current
      )
        return;

      const canvas = faceCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 완전히 투명한 배경으로 초기화
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 스타일 설정
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;

      // 얼굴 프레임 그리기
      if (prevFacesRef.current.length > 0) {
        prevFacesRef.current.forEach(([x, y, w, h]) => {
          ctx.strokeRect(x, y, w, h);
        });
      }
    }, [isSelecting, currentMode]);

    // useImperativeHandle을 수정합니다
    useImperativeHandle(
      ref,
      () => ({
        updateFaceFrames: (
          newFaces: Array<[number, number, number, number]>
        ) => {
          if (!isActive) return;

          // 커튼 애니메이션 중에는 얼굴 프레임 업데이트 건너뜀
          if (
            isSelecting &&
            (currentMode === "curtain" ||
              currentMode === "scanner" ||
              currentMode === "handpick")
          )
            return;

          prevFacesRef.current = [...newFaces];
          drawFaces();
        },
      }),
      [isActive, drawFaces, isSelecting, currentMode]
    );

    const captureFrame = useCallback(() => {
      if (!isActive || !isConnected) {
        if (frameRequestRef.current)
          cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < video.HAVE_METADATA) {
        frameRequestRef.current = requestAnimationFrame(captureFrame);
        return;
      }

      const now = Date.now();
      // 프레임 캡처 간격 (150ms)
      if (now - lastCaptureTime.current < 150) {
        frameRequestRef.current = requestAnimationFrame(captureFrame);
        return;
      }

      try {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = canvas.toDataURL("image/jpeg", 0.85);
          const base64Data = frame.split(",")[1];

          if (base64Data && base64Data.length > 10000) {
            onFrame?.(base64Data);
            lastCaptureTime.current = now;
          } else {
            console.warn(
              "캡처된 프레임 데이터가 너무 작거나 유효하지 않습니다:",
              base64Data?.length
            );
          }
        }
      } catch (error) {
        console.error("프레임 캡처 중 오류:", error);
      }

      frameRequestRef.current = requestAnimationFrame(captureFrame);
    }, [isActive, onFrame, isConnected]);

    useEffect(() => {
      let currentStream: MediaStream | null = null;

      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { max: 30 },
            },
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            currentStream = stream;
            videoRef.current.playsInline = true;
            videoRef.current.style.transform = "translate3d(0, 0, 0)";

            videoRef.current.onloadeddata = () => {
              const video = videoRef.current;
              const hiddenCanvas = canvasRef.current;
              const faceCanvas = faceCanvasRef.current;
              if (video && hiddenCanvas && faceCanvas) {
                const { videoWidth, videoHeight } = video;
                hiddenCanvas.width = videoWidth;
                hiddenCanvas.height = videoHeight;
                faceCanvas.width = videoWidth;
                faceCanvas.height = videoHeight;
                console.log("Video metadata loaded, dimensions set.");
              }

              setTimeout(() => {
                video
                  ?.play()
                  .catch((e) => console.error("Video play error:", e));
                if (isActive && isConnected) {
                  console.log("Starting frame capture after delay.");
                  captureFrame();
                } else {
                  console.log(
                    "Delay ended, but not starting capture (isActive:",
                    isActive,
                    "isConnected:",
                    isConnected,
                    ")"
                  );
                }
              }, 300);
            };
            videoRef.current.onloadedmetadata = videoRef.current.onloadeddata;
          }
        } catch (err) {
          console.error("카메라 접근 에러:", err);
        }
      };

      const stopCamera = () => {
        console.log("Stopping camera and cleaning up...");
        if (frameRequestRef.current) {
          cancelAnimationFrame(frameRequestRef.current);
          frameRequestRef.current = null;
        }
        if (faceUpdateAnimationRef.current) {
          cancelAnimationFrame(faceUpdateAnimationRef.current);
          faceUpdateAnimationRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop());
          currentStream = null;
        }
      };

      if (isActive) {
        startCamera();
      } else {
        stopCamera();
      }

      return () => {
        stopCamera();
      };
    }, [isActive, captureFrame, isConnected]);

    return (
      <VideoContainer>
        <Video ref={videoRef} autoPlay playsInline muted />
        <FaceCanvas ref={faceCanvasRef} />
        <HiddenCanvas ref={canvasRef} />
      </VideoContainer>
    );
  }
);

// 리렌더링을 막기 위한 비교 함수 유지
const areEqual = (prevProps: CameraProps, nextProps: CameraProps) => {
  // isActive나 isConnected가 변경되면 리렌더링 허용
  if (
    prevProps.isActive !== nextProps.isActive ||
    prevProps.isConnected !== nextProps.isConnected
  ) {
    return false;
  }

  // faces는 이제 이벤트 기반으로 처리하므로 무시
  return true;
};

export default React.memo(Camera, areEqual);
