import React, {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import styled from "@emotion/styled";
import * as faceapi from "face-api.js";
import { useAnimationContext } from "../Animation/AnimationContext";

// --- 추가: face-api.js 환경 설정 ---
// face-api.js가 브라우저 환경에서 실행됨을 명시적으로 설정
// @ts-ignore - face-api.js 타입 정의에 env 관련 부분이 없을 수 있음
if (typeof window !== "undefined") {
  // 브라우저 환경인지 한번 더 확인
  faceapi.env.setEnv(faceapi.env.createBrowserEnv());
}
// --- 추가 끝 ---

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
  onStabilityChange?: (isStable: boolean) => void;
}

// 외부에서 호출할 수 있는 메서드 타입 정의
export interface CameraHandle {
  updateFaceFrames: (faces: Array<[number, number, number, number]>) => void;
  captureCurrentFrame: () => string | null;
}

const Camera = forwardRef<CameraHandle, CameraProps>(
  (
    { onFrame, isActive, faces = [], isConnected = false, onStabilityChange },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const faceCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameRequestRef = useRef<number | null>(null);
    const clientFaceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastCaptureTime = useRef<number>(0);
    const prevFacesRef = useRef<Array<[number, number, number, number]>>([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const modelsLoadedRef = useRef(false);
    const [detectorOptions, setDetectorOptions] = useState<
      faceapi.TinyFaceDetectorOptions | faceapi.SsdMobilenetv1Options | null
    >(null);
    const stabilityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isStableRef = useRef<boolean>(false);
    const FACE_DETECTION_STABILITY_THRESHOLD = 500;

    const { currentMode, isSelecting } = useAnimationContext();

    useEffect(() => {
      const loadModels = async () => {
        const MODEL_URL = "/models";
        try {
          console.log("Loading face-api models (SSD Mobilenet V1)...");
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          ]);
          console.log(
            "Face-api models loaded successfully (SSD Mobilenet V1)."
          );
          setDetectorOptions(
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
          );
          setModelsLoaded(true);
          modelsLoadedRef.current = true;
        } catch (error) {
          console.error("Error loading face-api models:", error);
        }
      };
      loadModels();
    }, []);

    useEffect(() => {
      if (isSelecting && faceCanvasRef.current) {
        const ctx = faceCanvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            faceCanvasRef.current.width,
            faceCanvasRef.current.height
          );
          if (clientFaceDetectionIntervalRef.current) {
            clearInterval(clientFaceDetectionIntervalRef.current);
            clientFaceDetectionIntervalRef.current = null;
          }
        }
      } else if (
        !isSelecting &&
        modelsLoadedRef.current &&
        isActive &&
        videoRef.current
      ) {
        startClientFaceDetection();
      }
    }, [isSelecting, modelsLoaded, isActive]);

    const drawFaces = useCallback(() => {
      if (!faceCanvasRef.current || !videoRef.current) return;

      const canvas = faceCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;

      const facesToDraw = isSelecting ? faces : prevFacesRef.current;

      if (facesToDraw.length > 0) {
        facesToDraw.forEach(([x, y, w, h]) => {
          ctx.strokeRect(x, y, w, h);
        });
      }
    }, [isSelecting]);

    useImperativeHandle(
      ref,
      () => ({
        updateFaceFrames: (
          newFaces: Array<[number, number, number, number]>
        ) => {
          if (isActive && isSelecting) {
            drawFaces();
          }
        },
        captureCurrentFrame: (): string | null => {
          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (!video || !canvas || video.readyState < video.HAVE_METADATA) {
            console.error("캡처 위한 비디오 또는 캔버스 준비 안 됨");
            return null;
          }

          try {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              if (
                canvas.width !== video.videoWidth ||
                canvas.height !== video.videoHeight
              ) {
                console.warn(
                  "캔버스 크기 불일치, 재설정 시도:",
                  video.videoWidth,
                  video.videoHeight
                );
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
              }

              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = canvas.toDataURL("image/jpeg", 0.85);
              const base64Data = frame.split(",")[1];

              if (base64Data && base64Data.length > 1000) {
                return base64Data;
              } else {
                console.warn(
                  "캡처된 프레임 데이터가 너무 작거나 유효하지 않습니다 (captureCurrentFrame):",
                  base64Data?.length
                );
                return null;
              }
            }
          } catch (error) {
            console.error("프레임 캡처 중 오류 (captureCurrentFrame):", error);
          }
          return null;
        },
      }),
      [isActive, isSelecting, drawFaces]
    );

    const detectFacesClientSide = useCallback(async () => {
      if (
        !videoRef.current ||
        !faceCanvasRef.current ||
        videoRef.current.paused ||
        videoRef.current.ended ||
        !modelsLoadedRef.current ||
        isSelecting ||
        !detectorOptions
      ) {
        if (isStableRef.current) {
          isStableRef.current = false;
          onStabilityChange?.(false);
        }
        if (stabilityTimerRef.current) {
          clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
        return;
      }

      const video = videoRef.current;
      const canvas = faceCanvasRef.current;

      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      faceapi.matchDimensions(canvas, displaySize);

      const detections = await faceapi.detectAllFaces(video, detectorOptions);

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const detectedFaceBoxes = resizedDetections.map((d) => {
        const box = d.box;
        return [box.x, box.y, box.width, box.height] as [
          number,
          number,
          number,
          number
        ];
      });

      prevFacesRef.current = detectedFaceBoxes;
      drawFaces();

      if (detectedFaceBoxes.length > 0) {
        if (!stabilityTimerRef.current && !isStableRef.current) {
          stabilityTimerRef.current = setTimeout(() => {
            isStableRef.current = true;
            onStabilityChange?.(true);
            stabilityTimerRef.current = null;
          }, FACE_DETECTION_STABILITY_THRESHOLD);
        } else if (stabilityTimerRef.current && isStableRef.current) {
          // 이미 안정상태가 true 이고 타이머도 돌고 있다면 (이 경우는 거의 없음)
          // 타이머가 완료되기 전에 얼굴 인식이 끊겼다가 다시 시작된 경우일 수 있음
          // 이 경우 타이머를 재시작하지 않고 안정 상태 유지
        } else if (!stabilityTimerRef.current && isStableRef.current) {
          // 이미 안정된 상태 (true)이고 타이머가 없음 (정상)
          // 아무것도 안함
        }
      } else {
        if (stabilityTimerRef.current) {
          clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
        if (isStableRef.current) {
          isStableRef.current = false;
          onStabilityChange?.(false);
        }
      }
    }, [
      isSelecting,
      drawFaces,
      detectorOptions,
      onStabilityChange,
      FACE_DETECTION_STABILITY_THRESHOLD,
    ]);

    const startClientFaceDetection = useCallback(() => {
      if (clientFaceDetectionIntervalRef.current) {
        clearInterval(clientFaceDetectionIntervalRef.current);
      }
      clientFaceDetectionIntervalRef.current = setInterval(
        detectFacesClientSide,
        170
      );
    }, [detectFacesClientSide]);

    const captureAndSendFrame = useCallback(() => {
      // <<< 로그 추가: captureAndSendFrame 호출 및 상태 확인 >>>
      // console.log(`[captureAndSendFrame] Called. isActive: ${isActive}, isConnected: ${isConnected}, isSelecting: ${isSelecting}, currentMode: ${currentMode}`);

      // isSelecting이 false이면 즉시 중단
      if (!isActive || !isConnected || !isSelecting) {
        if (frameRequestRef.current)
          cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
        // console.log("[captureAndSendFrame] Aborted (inactive, disconnected, or not selecting).");
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 비디오나 캔버스가 준비되지 않았으면 다음 프레임 요청
      if (!video || !canvas || video.readyState < video.HAVE_METADATA) {
        frameRequestRef.current = requestAnimationFrame(captureAndSendFrame);
        // console.log("[captureAndSendFrame] Waiting for video/canvas.");
        return;
      }

      const now = Date.now();
      // 마지막 캡처 후 충분한 시간이 지나지 않았으면 다음 프레임 요청
      if (now - lastCaptureTime.current < 150) {
        frameRequestRef.current = requestAnimationFrame(captureAndSendFrame);
        // console.log("[captureAndSendFrame] Skipping due to interval.");
        return;
      }

      // --- 프레임 전송 조건 추가 ---
      const shouldSendFrameContinuously =
        currentMode !== "slot" &&
        currentMode !== "roulette" &&
        currentMode !== "race";

      // console.log(`[captureAndSendFrame] shouldSendFrameContinuously: ${shouldSendFrameContinuously}`);

      if (shouldSendFrameContinuously) {
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // 캔버스 크기가 비디오 크기와 다르면 조정 (기존 로직 유지)
            if (
              canvas.width !== video.videoWidth ||
              canvas.height !== video.videoHeight
            ) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL("image/jpeg", 0.85); // 프레임 캡처
            const base64Data = frame.split(",")[1]; // Base64 데이터 추출

            if (base64Data && base64Data.length > 10000) {
              // console.log(`[captureAndSendFrame] Sending frame for mode: ${currentMode}`);
              onFrame?.(base64Data); // onFrame 콜백 호출 (프레임 전송)
              lastCaptureTime.current = now; // 마지막 캡처 시간 업데이트
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
      } else {
        // console.log(`[captureAndSendFrame] Skipping frame send for mode: ${currentMode}`);
      }
      // --- 조건 추가 끝 ---

      // 다음 프레임 요청 (루프 계속)
      frameRequestRef.current = requestAnimationFrame(captureAndSendFrame);
    }, [isActive, onFrame, isConnected, isSelecting, currentMode]); // currentMode 의존성 추가

    // --- 메인 카메라 제어 useEffect ---
    useEffect(() => {
      // <<< 로그 추가: useEffect 실행 및 의존성 값 확인 >>>
      console.log(
        `[Camera Effect Triggered] isActive: ${isActive}, isConnected: ${isConnected}, isSelecting: ${isSelecting}`
      );

      let currentStream: MediaStream | null = null;

      const startCamera = async () => {
        // <<< 로그 추가: 카메라 시작 시도 >>>
        console.log("[Camera Effect] Attempting to start camera...");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { max: 30 },
            },
          });

          if (videoRef.current) {
            // <<< 로그 추가: 스트림 할당 >>>
            console.log("[Camera Effect] Assigning stream to video element.");
            videoRef.current.srcObject = stream;
            currentStream = stream;
            videoRef.current.playsInline = true;
            videoRef.current.style.transform = "translate3d(0, 0, 0)";

            videoRef.current.onloadedmetadata = () => {
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

                if (modelsLoadedRef.current && !isSelecting) {
                  // <<< 로그 추가: 클라이언트 감지 시작 호출 >>>
                  console.log(
                    "[Camera Effect] Calling startClientFaceDetection from onloadedmetadata."
                  );
                  startClientFaceDetection();
                }
              }

              setTimeout(() => {
                // <<< 로그 추가: 비디오 재생 시도 >>>
                console.log("[Camera Effect] Attempting to play video.");
                video
                  ?.play()
                  .catch((e) => console.error("Video play error:", e));

                if (isActive && isConnected && isSelecting) {
                  // <<< 로그 추가: 프레임 캡처 시작 호출 (isSelecting=true) >>>
                  console.log(
                    "[Camera Effect] Calling captureAndSendFrame from timeout (isSelecting=true)."
                  );
                  captureAndSendFrame();
                } else if (
                  isActive &&
                  !isSelecting &&
                  modelsLoadedRef.current
                ) {
                  // <<< 로그 추가: 클라이언트 감지 활성 확인 >>>
                  console.log(
                    "[Camera Effect] Client-side face detection is active (from timeout)."
                  );
                } else {
                  // <<< 로그 추가: 캡처/감지 시작 안 함 >>>
                  console.log(
                    `[Camera Effect] Not starting capture/detection (isActive: ${isActive}, isConnected: ${isConnected}, isSelecting: ${isSelecting}, modelsLoaded: ${modelsLoadedRef.current})`
                  );
                }
              }, 300);
            };
          }
        } catch (err) {
          console.error("카메라 접근 에러:", err);
        }
      };

      const stopCamera = () => {
        // <<< 로그 추가: 카메라 중지 시도 >>>
        console.log("[Camera Effect] Stopping camera...");
        if (frameRequestRef.current) {
          cancelAnimationFrame(frameRequestRef.current);
          frameRequestRef.current = null;
        }
        if (clientFaceDetectionIntervalRef.current) {
          clearInterval(clientFaceDetectionIntervalRef.current);
          clientFaceDetectionIntervalRef.current = null;
        }
        if (faceCanvasRef.current) {
          const ctx = faceCanvasRef.current.getContext("2d");
          ctx?.clearRect(
            0,
            0,
            faceCanvasRef.current.width,
            faceCanvasRef.current.height
          );
        }
        prevFacesRef.current = [];

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop());
          currentStream = null;
        }
      };

      if (isActive) {
        // <<< 로그 추가: startCamera 호출 결정 >>>
        console.log("[Camera Effect] isActive is true, calling startCamera()");
        startCamera();
      } else {
        // <<< 로그 추가: stopCamera 호출 결정 >>>
        console.log("[Camera Effect] isActive is false, calling stopCamera()");
        stopCamera();
      }

      // isSelecting 상태가 변경될 때 captureAndSendFrame 시작/중단 로직
      if (isActive && isConnected && isSelecting) {
        console.log(
          "[Camera Effect] isSelecting is true, ensuring captureAndSendFrame starts/continues."
        );
        // 이미 실행 중이 아닐 경우에만 시작
        if (!frameRequestRef.current) {
          frameRequestRef.current = requestAnimationFrame(captureAndSendFrame);
        }
      } else {
        // isSelecting이 false가 되면 프레임 전송 루프 중단
        if (frameRequestRef.current) {
          console.log(
            "[Camera Effect] isSelecting is false, cancelling captureAndSendFrame loop."
          );
          cancelAnimationFrame(frameRequestRef.current);
          frameRequestRef.current = null;
        }
      }

      // --- 클린업 함수 ---
      return () => {
        // <<< 로그 추가: 클린업 함수 실행 >>>
        console.log("[Camera Effect] Cleanup function running...");
        stopCamera();
        // 컴포넌트 언마운트 시 타이머 정리
        if (stabilityTimerRef.current) {
          clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
        // <<< 클린업 함수 내에서도 frameRequestRef 정리 확인 >>>
        if (frameRequestRef.current) {
          cancelAnimationFrame(frameRequestRef.current);
          frameRequestRef.current = null;
        }
        // <<< 로그 추가: 클린업 완료 >>>
        console.log("[Camera Effect] Cleanup function finished.");
      };
    }, [
      isActive,
      isConnected,
      isSelecting, // isSelecting 의존성 유지하여 상태 변경 감지
      captureAndSendFrame,
      startClientFaceDetection,
    ]);

    return (
      <VideoContainer>
        {!modelsLoaded && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              color: "white",
              background: "rgba(0,0,0,0.5)",
              padding: "5px",
            }}
          >
            얼굴 인식 모델 로딩 중...
          </div>
        )}
        <Video ref={videoRef} autoPlay playsInline muted />
        <FaceCanvas ref={faceCanvasRef} />
        <HiddenCanvas ref={canvasRef} />
      </VideoContainer>
    );
  }
);

export default React.memo(Camera);
