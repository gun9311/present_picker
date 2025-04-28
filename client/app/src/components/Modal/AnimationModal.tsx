//AnimationModal.tsx

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import styled from "@emotion/styled";
import Camera, { CameraHandle } from "../Camera/Camera";
import { AnimationProvider } from "../Animation/AnimationProvider";
import { AnimationMode } from "../Animation/types";
import { useAnimationContext } from "../Animation/AnimationContext";
import SlotMachineAnimation from "../Animation/modes/SlotMachineAnimation";
import RouletteAnimation from "../Animation/modes/RouletteAnimation";
import RaceAnimation from "../Animation/modes/RaceAnimation";
import { useAnimation } from "../Animation/useAnimation";
import CurtainAnimation from "../Animation/modes/CurtainAnimation";
import ScannerAnimation from "../Animation/modes/ScannerAnimation";
import HandpickAnimation from "../Animation/modes/HandPickAnimation";

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: #2d2d2d;
  padding: 20px;
  border-radius: 10px;
  width: 100%;
  max-width: 1800px;
  height: 95%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const Title = styled.h2`
  color: white;
  margin: 0;
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 1001;
  font-size: 28px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  padding: 10px 20px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  width: fit-content;
  max-width: 80%;
  margin: 0 auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
`;

const SoundToggle = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  z-index: 1001;
`;

const CameraContainer = styled.div`
  width: 99%;
  height: auto;
  max-height: 1000px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
`;

const ControlsContainer = styled.div`
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
  z-index: 1001;
`;

type ButtonVariant = "primary" | "secondary" | "return";

const StyledButton = styled.button<{ variant?: ButtonVariant }>`
  background-color: ${(props) => {
    switch (props.variant) {
      case "primary":
        return "#007bff";
      case "secondary":
        return "#ff9800";
      case "return":
        return "#28a745";
      default:
        return "#007bff";
    }
  }};
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    filter: brightness(1.1);
  }
`;

// 로딩 오버레이 추가
const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1005;
  flex-direction: column;
`;

const LoadingSpinner = styled.div`
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.p`
  color: white;
  font-size: 18px;
`;

// --- 새 뒤로가기 버튼 스타일 추가 ---
const BackButton = styled.button`
  position: absolute;
  top: 25px; // Title 높이 고려하여 조정
  left: 25px;
  background: rgba(0, 0, 0, 0.4); // 반투명 배경
  border: none;
  color: white;
  font-size: 22px; // 아이콘 크기
  cursor: pointer;
  z-index: 1001; // Title, SoundToggle과 동일 레벨
  border-radius: 50%; // 원형 버튼
  width: 40px; // 버튼 크기
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.2s;
  line-height: 1; // 아이콘 수직 정렬

  &:hover {
    background: rgba(0, 0, 0, 0.6); // 호버 시 약간 더 진하게
  }
`;
// --- 스타일 추가 끝 ---

// --- 버튼 컨테이너 추가 ---
const TopRightControls = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 15px; // 버튼 사이 간격
  z-index: 1001;
`;

const ControlButton = styled.button`
  background: rgba(0, 0, 0, 0.4); // 반투명 배경
  border: none;
  color: white;
  font-size: 22px; // 아이콘 크기
  cursor: pointer;
  border-radius: 50%; // 원형 버튼
  width: 40px; // 버튼 크기
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.2s;
  line-height: 1; // 아이콘 수직 정렬

  &:hover {
    background: rgba(0, 0, 0, 0.6); // 호버 시 약간 더 진하게
  }
`;

// --- 새 로딩/처리 중 오버레이 스타일 추가 ---
const ProcessingIndicatorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6); // 약간 어두운 반투명 배경
  display: flex;
  flex-direction: column; // 세로 배치
  justify-content: center;
  align-items: center;
  z-index: 1002; // Title, 버튼들보다는 위, 모달 최상단보다는 아래
  color: white;
  font-size: 24px; // 텍스트 크기 증가
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
  pointer-events: none; // 뒤쪽 요소 클릭 가능하도록 (필요하다면)
`;

// (선택적) 로딩 스피너 스타일 (기존 LoadingSpinner 재활용 또는 새로 정의)
const ProcessingSpinner = styled(LoadingSpinner)`
  border-top-color: #ff9800; // 주황색 등으로 색상 변경 가능
  width: 40px; // 크기 조절
  height: 40px;
  margin-bottom: 15px;
`;
// --- 스타일 추가 끝 ---

interface AnimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  websocket?: WebSocket | null;
  modeName?: string;
  frameData?: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
}

// 모드 이름을 AnimationMode 타입으로 변환하는 헬퍼 함수
const getModeId = (modeName?: string): AnimationMode | null => {
  if (!modeName) return null;

  if (modeName.includes("슬롯머신")) return "slot";
  if (modeName.includes("룰렛")) return "roulette";
  if (modeName.includes("커튼콜")) return "curtain";
  if (modeName.includes("사우론")) return "scanner";
  if (modeName.includes("레이서")) return "race";
  if (modeName.includes("연기대상")) return "handpick";

  return null;
};

// 리소스 프리로더 타입 및 유틸리티 함수 추가
type ResourceType = "image" | "sound";

interface ResourceInfo {
  type: ResourceType;
  path: string;
}

// 모드별 필요한 리소스 정의
const MODE_RESOURCES: Record<AnimationMode, ResourceInfo[]> = {
  slot: [
    { type: "image", path: "assets/images/slot_machine/slot_machine.png" },
    { type: "image", path: "assets/images/slot_machine/coin.png" },
    { type: "sound", path: "assets/sounds/slot_machine/slot_spin.wav" },
    { type: "sound", path: "assets/sounds/slot_machine/slot_stop.wav" },
    { type: "sound", path: "assets/sounds/slot_machine/winner.wav" },
  ],
  roulette: [
    { type: "image", path: "assets/images/roulette/roulette_base.png" },
    { type: "image", path: "assets/images/roulette/roulette_slots.png" },
    { type: "image", path: "assets/images/roulette/roulette_arrow.png" },
    { type: "sound", path: "assets/sounds/roulette/spin_loop.wav" },
    { type: "sound", path: "assets/sounds/roulette/spin_slow.wav" },
    { type: "sound", path: "assets/sounds/roulette/spin_start.wav" },
    { type: "sound", path: "assets/sounds/roulette/win_sound.wav" },
  ],
  curtain: [
    { type: "image", path: "assets/images/curtain/curtain_left.png" },
    { type: "image", path: "assets/images/curtain/curtain_right.png" },
    { type: "image", path: "assets/images/curtain/curtain_top.png" },
    { type: "sound", path: "assets/sounds/curtain/curtain_open.wav" },
    { type: "sound", path: "assets/sounds/curtain/curtain_close.wav" },
    { type: "sound", path: "assets/sounds/curtain/tada.wav" },
  ],
  scanner: [
    { type: "image", path: "assets/images/scanner_zoom/eye_of_sauron.png" },
    {
      type: "image",
      path: "assets/images/scanner_zoom/eye_of_sauron_border.png",
    },
    { type: "image", path: "assets/images/scanner_zoom/fake_eye.png" },
    { type: "image", path: "assets/images/scanner_zoom/target_radar.png" },
    { type: "image", path: "assets/images/scanner_zoom/tower_of_sauron.png" },
    { type: "image", path: "assets/images/scanner_zoom/laser.png" },

    { type: "sound", path: "assets/sounds/scanner_zoom/alert.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/beep.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/mode_change.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/processing.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/scanner_start.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/gollum.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/whistle.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/zoom.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/target_locked.wav" },
  ],
  race: [
    { type: "image", path: "assets/images/race/obstacle1.png" },
    { type: "image", path: "assets/images/race/obstacle2.png" },
    { type: "image", path: "assets/images/race/powerup1.png" },
    { type: "image", path: "assets/images/race/powerup2.png" },
    { type: "image", path: "assets/images/race/race_track_1.png" },
    { type: "image", path: "assets/images/race/race_track_2.png" },
    { type: "image", path: "assets/images/race/race_track_3.png" },
    { type: "sound", path: "assets/sounds/race/beep.wav" },
    { type: "sound", path: "assets/sounds/race/crash.wav" },
    { type: "sound", path: "assets/sounds/race/powerup.wav" },
    { type: "sound", path: "assets/sounds/race/race_loop.wav" },
    { type: "sound", path: "assets/sounds/race/race_start.wav" },
    { type: "sound", path: "assets/sounds/race/win.wav" },
    { type: "sound", path: "assets/sounds/race/blackhole.wav" },
  ],
  handpick: [
    { type: "sound", path: "assets/sounds/handpick/countdown.wav" },
    { type: "sound", path: "assets/sounds/handpick/go.wav" },
    { type: "sound", path: "assets/sounds/handpick/success.wav" },
    { type: "sound", path: "assets/sounds/handpick/timeout.wav" },
    { type: "sound", path: "assets/sounds/handpick/applause.wav" },
    { type: "sound", path: "assets/sounds/handpick/result.wav" },
    { type: "sound", path: "assets/sounds/handpick/start.wav" },
  ],
};

// 프리로드 유틸리티 함수 수정
const preloadResource = (
  resource: ResourceInfo,
  cacheRef: React.RefObject<Map<string, HTMLAudioElement>>
): Promise<void> => {
  // cacheRef 인자 추가
  return new Promise((resolve, reject) => {
    // --- 캐시 확인 로직 수정: Provider의 캐시 확인 ---
    if (cacheRef.current?.has(resource.path)) {
      // console.log(`[preloadResource] Already preloaded: ${resource.path}`);
      resolve();
      return;
    }
    // --- 수정 끝 ---

    if (resource.type === "image") {
      const img = new Image();
      img.src = resource.path;
      img.onload = () => {
        // 이미지는 여전히 로컬 캐시 또는 다른 방식으로 관리 필요 시 여기에 로직 추가 가능
        // 현재는 이미지 캐싱 로직은 별도로 없음 (브라우저 캐시 의존)
        resolve();
      };
      img.onerror = () => {
        console.error(`이미지 로드 실패: ${resource.path}`);
        reject(new Error(`이미지 로드 실패: ${resource.path}`));
      };
    } else if (resource.type === "sound") {
      // --- 오디오 객체 생성 및 캐싱 로직 ---
      if (!cacheRef.current) {
        console.error("Preloaded audio cache ref is not available.");
        reject(new Error("Preloaded audio cache ref is not available."));
        return;
      }

      const audio = new Audio();
      audio.src = resource.path;
      audio.preload = "auto";

      const handleLoad = () => {
        // 웜업 시도
        audio.volume = 0; // 소리 안 나게
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              audio.pause(); // 즉시 정지
              audio.currentTime = 0; // 시작 위치로
              audio.volume = 0.2; // 기본 볼륨 복원
              // console.log(`[preloadResource] Warmed up: ${resource.path}`);
            })
            .catch((err) => {
              console.warn(
                `[preloadResource] Warm-up play failed for ${resource.path}:`,
                err
              );
              // 실패해도 객체는 생성되었으므로 캐시에 저장, 볼륨 복원
              audio.volume = 0.2;
            })
            .finally(() => {
              // Provider의 캐시에 저장 (키는 경로 전체)
              cacheRef.current?.set(resource.path, audio);
              resolve();
            });
        } else {
          // play()가 promise를 반환하지 않는 경우 (거의 없음)
          audio.volume = 0.2; // 볼륨 복원
          cacheRef.current?.set(resource.path, audio);
          resolve();
        }
        // 이벤트 리스너 정리
        audio.removeEventListener("loadeddata", handleLoad);
        audio.removeEventListener("error", handleError);
      };

      const handleError = () => {
        console.error(`오디오 로드/처리 실패: ${resource.path}`);
        // 이벤트 리스너 정리
        audio.removeEventListener("loadeddata", handleLoad);
        audio.removeEventListener("error", handleError);
        reject(new Error(`오디오 로드/처리 실패: ${resource.path}`));
      };

      audio.addEventListener("loadeddata", handleLoad);
      audio.addEventListener("error", handleError);
      // --- 로직 끝 ---
    }
  });
};

// 모드에 맞는 리소스 일괄 프리로드 수정
const preloadModeResources = async (
  mode: AnimationMode | null,
  cacheRef: React.RefObject<Map<string, HTMLAudioElement>>
) => {
  // cacheRef 인자 추가
  if (!mode || !cacheRef) return;

  // console.log(`${mode} 모드 리소스 프리로딩 시작...`);
  try {
    const resources = MODE_RESOURCES[mode] || []; // 모드에 리소스 없으면 빈 배열
    await Promise.all(
      resources.map((resource) => preloadResource(resource, cacheRef))
    ); // cacheRef 전달
    // console.log(`${mode} 모드 리소스 프리로딩 완료!`);
  } catch (error) {
    console.error(`리소스 프리로딩 중 오류 발생:`, error);
  }
};

// ModalContentComponent를 React.memo로 감싸서 불필요한 리렌더링 방지
const ModalContentComponent = React.memo<{
  modeName?: string;
  websocket?: WebSocket | null;
  onClose: () => void;
  connectionStatus: "connecting" | "connected" | "disconnected";
}>(({ modeName, websocket, onClose, connectionStatus }) => {
  const [lastCapturedFrame, setLastCapturedFrame] = useState<string | null>(
    null
  );
  // --- 1. isProcessingInitialRequest 상태 추가 ---
  const [isProcessingInitialRequest, setIsProcessingInitialRequest] =
    useState(false);

  // --- 2. useAnimation 훅에 콜백 전달 ---
  const {
    detectedFaces,
    resetCountdown,
    isFaceDetectionStable,
    ...animationState
  } = useAnimation(websocket || null, () =>
    setIsProcessingInitialRequest(false)
  ); // 콜백 전달

  const cameraRef = useRef<CameraHandle>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);

  const {
    isSelecting,
    status,
    isSoundEnabled,
    setIsSoundEnabled,
    setStatus, // 여전히 다른 상태 메시지용으로 사용 가능
    setIsSelecting,
    preloadedAudioCache,
  } = useAnimationContext();

  const { slotMachineActive } = animationState.getSlotMachineState();
  const { rouletteActive } = animationState.getRouletteState();
  const { raceActive } = animationState.getRaceState();

  // --- 전체 화면 상태 추가 ---
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement // 초기 상태는 현재 fullscreen 상태 반영
  );
  // --- 여기까지 추가 ---

  // 얼굴 정보가 업데이트되면 Camera 컴포넌트에 전달
  useEffect(() => {
    if (cameraRef.current && detectedFaces.length > 0) {
      //   console.log("Updating face frames in Camera component:", detectedFaces);
      cameraRef.current.updateFaceFrames(detectedFaces);
    }
  }, [detectedFaces]);

  // 활성 모드가 변경될 때 해당 모드의 리소스 프리로드 (cacheRef 전달)
  useEffect(() => {
    const modeId = getModeId(modeName);
    if (modeId) {
      if (connectionStatus === "connected") {
        setStatus("🔄 리소스 로딩 중...");
        preloadModeResources(modeId, preloadedAudioCache).then(() => {
          // preloadedAudioCache 전달
          setStatus("");
        });
      }
    }
  }, [modeName, connectionStatus, setStatus, preloadedAudioCache]); // preloadedAudioCache 의존성 추가

  // --- 전체 화면 변경 감지 및 상태 동기화 useEffect ---
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // 클린업 함수: 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []); // 마운트 시 한 번만 실행
  // --- 여기까지 추가 ---

  const handleFrame = useCallback(
    (frame: string) => {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.log("WebSocket not ready");
        return;
      }

      const frameData = `data:image/jpeg;base64,${frame}`;
      setLastCapturedFrame(frameData);

      // 일반 프레임 전송 (얼굴 인식용)
      websocket.send(
        JSON.stringify({
          type: "start_animation",
          mode: getModeId(modeName),
          frame: frame,
        })
      );
    },
    [websocket, modeName]
  );

  const startAnimationDirectly = useCallback(() => {
    if (isSelecting || !websocket || websocket.readyState !== WebSocket.OPEN) {
      console.log(
        "WebSocket not ready or animation already selecting. Aborting."
      );
      return;
    }

    if (!lastCapturedFrame) {
      console.log("카메라 프레임이 준비되지 않았습니다.");
      setStatus("⌛ 카메라 준비 중... 잠시 후 다시 시도해주세요.");
      setTimeout(() => setStatus(""), 2000);
      return;
    }

    const base64Data = lastCapturedFrame.split(",")[1];

    if (!base64Data || base64Data.length < 1000) {
      console.error("유효하지 않은 프레임 데이터");
      if (status !== "⚠️ 카메라 데이터 오류. 잠시 후 다시 시도해주세요.") {
        setStatus("⚠️ 카메라 데이터 오류. 잠시 후 다시 시도해주세요.");
        setTimeout(() => setStatus(""), 2000);
      }
      return;
    }

    // --- 3. 즉시 isProcessingInitialRequest 상태 true로 설정 ---
    setIsProcessingInitialRequest(true);

    // --- isSelecting 상태 변경 (이 위치는 유지) ---
    console.log("[AnimationModal] Setting isSelecting to true immediately.");
    setIsSelecting(true);

    console.log(
      `[AnimationModal] 애니메이션 시작 요청 - 모드: ${getModeId(modeName)}`
    );

    // 애니메이션 시작 명령 전송
    websocket.send(
      JSON.stringify({
        type: "start_animation",
        mode: getModeId(modeName),
        frame: base64Data,
        startAnimation: true,
      })
    );
  }, [
    websocket,
    lastCapturedFrame,
    modeName,
    status,
    setStatus,
    isSelecting,
    setIsSelecting,
  ]);

  // --- 전체 화면 토글 함수 ---
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // documentElement는 전체 HTML 문서를 나타냄
      document.documentElement
        .requestFullscreen()
        .catch((err) =>
          console.error(
            `Fullscreen request failed: ${err.message} (${err.name})`
          )
        );
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);
  // --- 여기까지 추가 ---

  const animationComponent = useMemo(() => {
    const mode = getModeId(modeName);
    console.log(
      `[AnimationModal] 렌더링 애니메이션 컴포넌트 - 모드: ${mode}, isSelecting: ${isSelecting}`
    );

    const animationProps = {
      faces: detectedFaces,
      lastCapturedFrame,
      websocket: websocket || null,
      cameraContainerRef: cameraContainerRef as React.RefObject<HTMLDivElement>,
    };

    console.log(`[AnimationModal] 애니메이션 props: `, {
      facesCount: detectedFaces.length,
      hasLastFrame: !!lastCapturedFrame,
      hasWebsocket: !!websocket,
      hasCamera: !!cameraContainerRef.current,
      resetCountdown: resetCountdown,
    });

    switch (mode) {
      case "slot":
        return <SlotMachineAnimation {...animationProps} />;
      case "roulette":
        return <RouletteAnimation {...animationProps} />;
      case "race":
        return <RaceAnimation {...animationProps} />;
      case "curtain":
        return <CurtainAnimation {...animationProps} />;
      case "scanner":
        return <ScannerAnimation {...animationProps} />;
      case "handpick":
        return <HandpickAnimation {...animationProps} />;
      default:
        return null;
    }
  }, [
    modeName,
    isSelecting,
    detectedFaces,
    lastCapturedFrame,
    websocket,
    cameraContainerRef,
    resetCountdown,
  ]);

  // --- 플랫폼 확인 변수 추가 ---
  const isWebPlatform = import.meta.env.VITE_TARGET_PLATFORM === "web";
  // --- 여기까지 추가 ---

  // 연결 중일 때는 로딩 화면 표시
  if (connectionStatus === "connecting") {
    return (
      <>
        <Title>{modeName}</Title>
        <LoadingOverlay>
          <LoadingSpinner />
          <LoadingText>서버에 연결 중입니다...</LoadingText>
        </LoadingOverlay>
      </>
    );
  }

  // 연결 실패 시 오류 메시지 표시
  if (connectionStatus === "disconnected") {
    return (
      <>
        <Title>{modeName}</Title>
        <LoadingOverlay>
          <LoadingText>서버 연결에 실패했습니다.</LoadingText>
          <StyledButton
            variant="return"
            onClick={onClose}
            style={{ marginTop: "20px" }}
          >
            돌아가기
          </StyledButton>
        </LoadingOverlay>
      </>
    );
  }

  // --- 4. 처리 중 오버레이 조건부 렌더링 ---
  return (
    <>
      {/* --- 뒤로가기 버튼 추가 (isSelecting일 때만 표시) --- */}
      {isSelecting && (
        <BackButton onClick={onClose} title="모드 선택으로 돌아가기">
          ←
        </BackButton>
      )}
      {/* --- 추가 끝 --- */}

      {/* --- Title 컴포넌트 렌더링 조건 수정 --- */}
      {(!isSelecting || status.includes("선정 완료")) && (
        <Title>
          {status}
          {resetCountdown !== null && status.includes("완료") && (
            <span style={{ fontSize: "0.8em", marginLeft: "10px" }}>
              ({resetCountdown}초 후 초기화)
            </span>
          )}
          {!status && modeName}
        </Title>
      )}
      {/* --- 수정 끝 --- */}

      {/* --- 오른쪽 상단 컨트롤 버튼들 --- */}
      <TopRightControls>
        {/* 웹 플랫폼일 때만 전체 화면 버튼 표시 */}
        {isWebPlatform && (
          <ControlButton
            onClick={toggleFullscreen}
            title={isFullscreen ? "전체 화면 종료" : "전체 화면 시작"}
          >
            {/* 아이콘: 전체 화면이면 축소 아이콘, 아니면 확대 아이콘 */}
            {isFullscreen ? "↘️" : "↗️"}
          </ControlButton>
        )}
        <ControlButton
          onClick={() => setIsSoundEnabled(!isSoundEnabled)}
          title={isSoundEnabled ? "소리 끄기" : "소리 켜기"}
        >
          {isSoundEnabled ? "🔊" : "🔇"}
        </ControlButton>
      </TopRightControls>
      {/* --- 여기까지 추가 --- */}

      {/* 처리 중 오버레이 */}
      {isProcessingInitialRequest && (
        <ProcessingIndicatorOverlay>
          <ProcessingSpinner />
          <span>얼굴 확인 및 요청 처리 중...</span>
        </ProcessingIndicatorOverlay>
      )}

      {!slotMachineActive && !rouletteActive && !raceActive && (
        <CameraContainer ref={cameraContainerRef}>
          <Camera
            isActive={true}
            onFrame={handleFrame}
            isConnected={websocket?.readyState === WebSocket.OPEN}
            ref={cameraRef}
            faces={detectedFaces}
          />
        </CameraContainer>
      )}

      {animationComponent}

      <ControlsContainer>
        {/* --- 기존 버튼들 모두 isSelecting이 아닐 때만 표시 --- */}
        {!isSelecting && (
          <>
            <StyledButton
              variant="primary"
              onClick={startAnimationDirectly}
              disabled={!isFaceDetectionStable || isSelecting}
              title={
                !isFaceDetectionStable
                  ? "안정적인 얼굴 인식이 필요합니다."
                  : isSelecting
                  ? "애니메이션 시작 중..."
                  : ""
              }
            >
              🔮 뽑기 {isFaceDetectionStable ? "" : "(카메라 준비 중)"}
            </StyledButton>
            <StyledButton variant="return" onClick={onClose}>
              🏠 모드 선택
            </StyledButton>
          </>
        )}
        {/* --- 수정 끝 --- */}
      </ControlsContainer>
    </>
  );
});

const AnimationModal = React.memo<AnimationModalProps>(
  ({ isOpen, onClose, websocket, modeName, connectionStatus }) => {
    if (!isOpen) return null;

    const modeId = getModeId(modeName);

    return (
      <ModalOverlay onClick={onClose}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <AnimationProvider mode={modeId}>
            <ModalContentComponent
              modeName={modeName}
              websocket={websocket}
              onClose={onClose}
              connectionStatus={connectionStatus}
            />
          </AnimationProvider>
        </ModalContent>
      </ModalOverlay>
    );
  }
);

export default AnimationModal;
