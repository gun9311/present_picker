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
    { type: "sound", path: "assets/sounds/curtain/applause.wav" },
    { type: "sound", path: "assets/sounds/curtain/curtain_open.wav" },
    { type: "sound", path: "assets/sounds/curtain/curtain_close.wav" },
    { type: "sound", path: "assets/sounds/curtain/drumroll.wav" },
    { type: "sound", path: "assets/sounds/curtain/spotlight.wav" },
    { type: "sound", path: "assets/sounds/curtain/tada.wav" },
  ],
  scanner: [
    { type: "image", path: "assets/images/scanner_zoom/eye_of_sauron.png" },
    {
      type: "image",
      path: "assets/images/scanner_zoom/eye_of_sauron_border.png",
    },
    { type: "sound", path: "assets/sounds/scanner_zoom/alert.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/beep.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/mode_change.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/processing.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/scanner_start.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/success.wav" },
    { type: "sound", path: "assets/sounds/scanner_zoom/zoom.wav" },
  ],
  race: [
    { type: "image", path: "assets/images/race/obstacle1.png" },
    { type: "image", path: "assets/images/race/obstacle2.png" },
    { type: "image", path: "assets/images/race/powerup1.png" },
    { type: "image", path: "assets/images/race/powerup2.png" },
    { type: "image", path: "assets/images/race/race_track.png" },
    { type: "sound", path: "assets/sounds/race/beep.wav" },
    { type: "sound", path: "assets/sounds/race/crash.wav" },
    { type: "sound", path: "assets/sounds/race/powerup.wav" },
    { type: "sound", path: "assets/sounds/race/race_loop.wav" },
    { type: "sound", path: "assets/sounds/race/race_start.wav" },
    { type: "sound", path: "assets/sounds/race/win.wav" },
  ],
  handpick: [
    { type: "sound", path: "assets/sounds/handpick/countdown.wav" },
    { type: "sound", path: "assets/sounds/handpick/go.wav" },
    { type: "sound", path: "assets/sounds/handpick/success.wav" },
    { type: "sound", path: "assets/sounds/handpick/timeout.wav" },
  ],
};

// 리소스 캐시 객체 (전역 캐시로 사용)
const resourceCache: Record<string, HTMLImageElement | HTMLAudioElement> = {};

// 프리로드 유틸리티 함수
const preloadResource = (resource: ResourceInfo): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 이미 캐시에 있으면 바로 완료
    if (resourceCache[resource.path]) {
      resolve();
      return;
    }

    if (resource.type === "image") {
      const img = new Image();
      img.src = resource.path;
      img.onload = () => {
        resourceCache[resource.path] = img;
        resolve();
      };
      img.onerror = () => {
        console.error(`이미지 로드 실패: ${resource.path}`);
        reject(new Error(`이미지 로드 실패: ${resource.path}`));
      };
    } else if (resource.type === "sound") {
      const audio = new Audio();
      audio.src = resource.path;
      audio.preload = "auto";

      // 사운드는 로드가 완료되면 캐시에 저장하고 완료
      audio.onloadeddata = () => {
        resourceCache[resource.path] = audio;
        resolve();
      };
      audio.onerror = () => {
        console.error(`오디오 로드 실패: ${resource.path}`);
        reject(new Error(`오디오 로드 실패: ${resource.path}`));
      };

      // 모바일 브라우저에서는 사용자 상호작용 없이 오디오를 로드할 수 없으므로,
      // 일정 시간 후 성공한 것으로 간주
      setTimeout(() => {
        if (!resourceCache[resource.path]) {
          resourceCache[resource.path] = audio;
          resolve();
        }
      }, 1000);
    }
  });
};

// 모드에 맞는 리소스 일괄 프리로드
const preloadModeResources = async (mode: AnimationMode | null) => {
  if (!mode) return;

  console.log(`${mode} 모드 리소스 프리로딩 시작...`);
  try {
    const resources = MODE_RESOURCES[mode];
    await Promise.all(resources.map(preloadResource));
    console.log(`${mode} 모드 리소스 프리로딩 완료!`);
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
  const { detectedFaces, resetCountdown, ...animationState } = useAnimation(
    websocket || null
  );
  const cameraRef = useRef<CameraHandle>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);

  const { isSelecting, status, isSoundEnabled, setIsSoundEnabled, setStatus } =
    useAnimationContext();

  const { slotMachineActive } = animationState.getSlotMachineState();
  const { rouletteActive } = animationState.getRouletteState();
  const { raceActive } = animationState.getRaceState();

  // 얼굴 정보가 업데이트되면 Camera 컴포넌트에 전달
  useEffect(() => {
    if (cameraRef.current && detectedFaces.length > 0) {
      //   console.log("Updating face frames in Camera component:", detectedFaces);
      cameraRef.current.updateFaceFrames(detectedFaces);
    }
  }, [detectedFaces]);

  // 활성 모드가 변경될 때 해당 모드의 리소스 프리로드
  useEffect(() => {
    const modeId = getModeId(modeName);
    if (modeId) {
      // 연결되면 리소스 프리로드 시작
      if (connectionStatus === "connected") {
        setStatus("🔄 리소스 로딩 중...");
        preloadModeResources(modeId).then(() => {
          // 프리로드 완료 후 상태 업데이트
          setStatus("");
        });
      }
    }
  }, [modeName, connectionStatus, setStatus]);

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
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.log("WebSocket not ready");
      return;
    }

    // lastCapturedFrame에서 Base64 데이터 추출
    if (!lastCapturedFrame) {
      console.log("카메라 프레임이 준비되지 않았습니다.");
      setStatus("⌛ 카메라 준비 중... 잠시 후 다시 시도해주세요.");
      // 2초 후 상태 메시지 초기화
      setTimeout(() => {
        setStatus("");
      }, 2000);
      return;
    }

    // Base64 데이터 형식 (data:image/jpeg;base64,XXXXX)에서 실제 데이터 부분만 추출
    const base64Data = lastCapturedFrame.split(",")[1];

    // 프레임 데이터가 너무 짧으면 유효하지 않음
    if (!base64Data || base64Data.length < 1000) {
      console.error("유효하지 않은 프레임 데이터");
      // 상태 메시지 설정
      if (status !== "⚠️ 카메라 데이터 오류. 잠시 후 다시 시도해주세요.") {
        setStatus("⚠️ 카메라 데이터 오류. 잠시 후 다시 시도해주세요.");
        // 2초 후 상태 메시지 초기화
        setTimeout(() => {
          setStatus("");
        }, 2000);
      }
      return;
    }

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
  }, [websocket, lastCapturedFrame, modeName, status, setStatus]);

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

  return (
    <>
      <Title>
        {status}
        {resetCountdown !== null && status.includes("완료") && (
          <span style={{ fontSize: "0.8em", marginLeft: "10px" }}>
            ({resetCountdown}초 후 초기화)
          </span>
        )}
        {!status && modeName}
      </Title>
      <SoundToggle onClick={() => setIsSoundEnabled(!isSoundEnabled)}>
        {isSoundEnabled ? "🔊" : "🔇"}
      </SoundToggle>

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
        {!isSelecting && (
          <StyledButton variant="primary" onClick={startAnimationDirectly}>
            🔮 뽑기
          </StyledButton>
        )}
        <StyledButton variant="return" onClick={onClose}>
          🏠 모드 선택
        </StyledButton>
      </ControlsContainer>
    </>
  );
});

const AnimationModal = React.memo<AnimationModalProps>(
  ({ isOpen, onClose, websocket, modeName, frameData, connectionStatus }) => {
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
