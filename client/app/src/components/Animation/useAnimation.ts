//useAnimation.ts

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  WebSocketMessage,
  AnimationMode,
  RouletteAnimationParams,
  RaceObstacle,
  RacePowerup,
  RaceParticipant,
  FaceCoordinates,
} from "./types";
import { useAnimationContext } from "./AnimationContext";

// --- 1. HandpickState 인터페이스를 여기로 이동 ---
interface HandpickState {
  handpickActive: boolean;
  handpickFaces: Array<{
    face: FaceCoordinates;
    expression_score: number;
    is_candidate: boolean;
  }>;
  handpickStage: string;
  handpickProgress: number;
  expressionMode: string;
  remainingSeconds: number | null;
  resultFace: FaceCoordinates | null;
  resultExpressionName: string;
  resultMessage: string;
  handpickRanking: Array<{
    face: FaceCoordinates;
    rank: number;
    score: number;
  }> | null;
  handpickCountdown: number | null;
  finalHandpickFrame: string | null;
}
// --- 이동 끝 ---

// 모드별 메시지 핸들러 타입 정의
type ModeMessageHandler = (message: WebSocketMessage) => void;

// 안정성 확인 임계 시간 (밀리초)
const FACE_DETECTION_STABILITY_THRESHOLD = 500;

export const useAnimation = (
  websocket: WebSocket | null,
  onAnimationReady?: () => void
) => {
  const {
    currentMode,
    setIsSelecting,
    setStatus,
    setCurrentFrame,
    setOverlay,
    addTextOverlay,
    playSound,
    stopSound,
  } = useAnimationContext();

  const [detectedFaces, setDetectedFaces] = useState<
    Array<[number, number, number, number]>
  >([]);

  // 슬롯머신 관련 상태들
  const [slotMachineActive, setSlotMachineActive] = useState<boolean>(false);
  const [currentSlotFaces, setCurrentSlotFaces] = useState<
    Array<[number, number, number, number]>
  >([]);
  const [selectedFace, setSelectedFace] = useState<
    [number, number, number, number] | null
  >(null);
  const [visibleSlots, setVisibleSlots] = useState<number[]>([]);
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);
  const [jackpotActive, setJackpotActive] = useState<boolean>(false);

  // 룰렛 관련 상태들
  const [rouletteActive, setRouletteActive] = useState<boolean>(false);
  const [rouletteFaces, setRouletteFaces] = useState<
    Array<[number, number, number, number]>
  >([]);
  const [rouletteParams, setRouletteParams] =
    useState<RouletteAnimationParams | null>(null);

  // 애니메이션 실행 중 여부를 추적하는 ref 추가
  const animationRunningRef = useRef<boolean>(false);

  // 레이스 관련 상태들
  const [raceActive, setRaceActive] = useState<boolean>(false);
  const [raceTrackConfig, setRaceTrackConfig] = useState<any>(null);
  const [raceObstacles, setRaceObstacles] = useState<RaceObstacle[]>([]);
  const [racePowerups, setRacePowerups] = useState<RacePowerup[]>([]);
  const [racerPositions, setRacerPositions] = useState<RaceParticipant[]>([]);
  const [raceWinner, setRaceWinner] = useState<number | null>(null);
  const [raceCountdown, setRaceCountdown] = useState<number | string | null>(
    null
  );
  const [raceFaces, setRaceFaces] = useState<
    Array<[number, number, number, number]>
  >([]);
  const [raceFaceIndices, setRaceFaceIndices] = useState<number[]>([]);
  const [raceCamera, setRaceCamera] = useState<number>(0);

  // 카운트다운을 위한 상태 추가
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);

  // 커튼 애니메이션 상태 추가
  const [curtainState, setCurtainState] = useState({
    isActive: false,
    curtainPosition: 1.0, // 1: 완전히 열림, 0: 완전히 닫힘
    selectedFace: null as [number, number, number, number] | null,
    introText: "",
    countdownValue: 0,
    resultText: "",
    showBorder: false,
    introActive: false,
    resultActive: false,
    zoomParams: null as { scale: number; duration: number } | null,
  });

  // 스캐너 상태 추가
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerTargetPoints, setScannerTargetPoints] = useState<
    [number, number][]
  >([]);
  const [scannerTargetFace, setScannerTargetFace] = useState<
    [number, number, number, number] | null
  >(null);
  const [scannerZoomScale, setScannerZoomScale] = useState(1);
  const [scannerStage, setScannerStage] = useState("");
  const [scannerProgress, setScannerProgress] = useState(0);
  const [scannerStatusText, setScannerStatusText] = useState("");
  const [scannerShowBorder, setScannerShowBorder] = useState(false);
  const [scannerResultMessage, setScannerResultMessage] = useState("");
  const [scannerIsFinalTarget, setScannerIsFinalTarget] = useState(false);
  const [cameraPanOffset, setCameraPanOffset] = useState({ x: 0, y: 0 });

  // 핸들픽 모드 상태 추가
  const [handpickActive, setHandpickActive] = useState<boolean>(false);
  const [handpickFaces, setHandpickFaces] = useState<
    Array<{
      face: [number, number, number, number];
      expression_score: number;
      is_candidate: boolean;
    }>
  >([]);
  const [handpickStage, setHandpickStage] = useState<string>("");
  const [handpickProgress, setHandpickProgress] = useState<number>(0);
  const [resultFace, setResultFace] = useState<
    [number, number, number, number] | null
  >(null);
  const [resultExpressionName, setResultExpressionName] = useState<string>("");
  const [resultMessage, setResultMessage] = useState<string>("");
  const [expressionMode, setExpressionMode] = useState<string>("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [handpickRanking, setHandpickRanking] = useState<Array<{
    face: [number, number, number, number];
    rank: number;
    score: number;
  }> | null>(null);
  const [handpickCountdown, setHandpickCountdown] = useState<number | null>(
    null
  );
  const [finalHandpickFrame, setFinalHandpickFrame] = useState<string | null>(
    null
  );

  // 얼굴 감지 안정성 관련 상태 및 ref 추가
  const faceDetectionStartTimeRef = useRef<number | null>(null);
  const [isFaceDetectionStable, setIsFaceDetectionStable] =
    useState<boolean>(false);

  // 최적화된 얼굴 업데이트 함수
  const updateFacesOptimized = useCallback(
    (newFaces: Array<[number, number, number, number]>) => {
      setDetectedFaces(newFaces);
    },
    []
  );

  // --- 수정: messageHandlerRef 정의 위치 변경 및 타입 명시 ---
  const messageHandlerRef = useRef<(eventDataString: string) => void>(() => {});
  // --- 수정 끝 ---

  // useCallback 안의 로직은 그대로 두되, 의존성 배열을 비워서 최초 렌더링 시에만 생성되도록 함
  // 또는 필요한 최소한의 안정적인 의존성만 남김 (예: setter 함수들)
  // 여기서는 일단 빈 배열로 시도하여 함수의 참조 자체를 안정화
  const handleCommonMessages = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "animation_frame":
          if (
            !slotMachineActive &&
            !rouletteActive &&
            !raceActive &&
            !curtainState.isActive
          ) {
            setCurrentFrame(`data:image/jpeg;base64,${message.frame}`);
          }
          break;

        case "play_sound":
          playSound(message.sound, message.options);
          break;

        case "stop_sound":
          stopSound(message.sound);
          break;

        case "show_overlay":
          try {
            const [overlayMode, overlayName] = message.name.split("/");
            const overlayPath = `assets/images/${overlayMode}/${overlayName}.png`;

            setOverlay({
              image: overlayPath,
              duration: message.duration,
            });

            if (message.duration) {
              setTimeout(() => setOverlay(null), message.duration);
            }
          } catch (error) {
            console.error("Overlay handling error:", error);
          }
          break;

        case "show_text":
          addTextOverlay({
            text: message.text,
            position: message.position,
            style: message.style,
          });
          break;

        case "selection_complete":
          setStatus("🎉 선정 완료!");
          break;

        case "show_jackpot_effect":
          if (currentMode === "slot") {
            setJackpotActive(true);
          }
          break;

        case "faces":
          updateFacesOptimized(message.faces);

          if (message.faces.length > 0) {
            const now = Date.now();
            if (faceDetectionStartTimeRef.current === null) {
              faceDetectionStartTimeRef.current = now;
              setIsFaceDetectionStable(false);
            } else {
              if (
                now - faceDetectionStartTimeRef.current >=
                FACE_DETECTION_STABILITY_THRESHOLD
              ) {
                setIsFaceDetectionStable(true);
              }
            }
          } else {
            faceDetectionStartTimeRef.current = null;
            setIsFaceDetectionStable(false);
          }
          break;

        case "animation_start":
          setIsSelecting(true);
          setStatus(
            `${
              currentMode === "slot"
                ? "슬롯머신"
                : currentMode === "roulette"
                ? "룰렛"
                : currentMode === "race"
                ? "레이스"
                : currentMode === "curtain"
                ? "커튼"
                : currentMode === "scanner"
                ? "스캐너"
                : "애니메이션"
            } 진행 중...`
          );
          break;

        case "animation_complete":
          console.log(
            `[useAnimation] animation_complete 메시지 수신, 모드: ${message.mode}`
          );
          handleAnimationComplete(message.mode);
          break;

        case "error":
          console.error("WebSocket 에러:", message.message);
          setStatus(`오류: ${message.message}`);

          if (message.message?.includes("얼굴이 없습니다")) {
            setStatus("❌ 감지된 얼굴이 없습니다. 잠시 후 다시 시도해주세요.");
            setTimeout(() => {
              setStatus("");
              setIsSelecting(false);
            }, 2000);
          }
          break;
      }
    },
    [
      setCurrentFrame,
      playSound,
      stopSound,
      setOverlay,
      addTextOverlay,
      setIsSelecting,
      setStatus,
      setIsFaceDetectionStable,
      updateFacesOptimized,
    ]
  );

  // --- 추가: handleAnimationComplete도 useCallback으로 감싸기 ---
  const handleAnimationComplete = useCallback(
    (mode: string) => {
      console.log(`[handleAnimationComplete] 시작, 모드: ${mode}`);
      setResetCountdown(6);

      const countdownInterval = setInterval(() => {
        setResetCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => {
        console.log(
          `[handleAnimationComplete] 6초 타이머 완료, 모드: ${mode} 초기화 실행`
        );
        setFrozenFrame(null);
        setStatus("");
        setIsSelecting(false);
        setResetCountdown(null);
        clearInterval(countdownInterval);

        faceDetectionStartTimeRef.current = null;
        setIsFaceDetectionStable(false);

        console.log(
          `[handleAnimationComplete] Stopping sounds for mode: ${mode}`
        );
        if (mode === "roulette") {
          stopSound("roulette/spin_loop");
          stopSound("roulette/spin_slow");
        } else if (mode === "race") {
          stopSound("race/race_loop");
        } else if (mode === "scanner") {
          stopSound("scanner_zoom/processing");
        }

        switch (mode) {
          case "slot":
            setSlotMachineActive(false);
            setCurrentSlotFaces([]);
            setVisibleSlots([]);
            setSelectedFace(null);
            setJackpotActive(false);
            break;

          case "roulette":
            setRouletteActive(false);
            setRouletteFaces([]);
            setRouletteParams(null);
            break;

          case "race":
            setRaceActive(false);
            setRaceTrackConfig(null);
            setRaceObstacles([]);
            setRacePowerups([]);
            setRacerPositions([]);
            setRaceWinner(null);
            setRaceCountdown(null);
            setRaceFaces([]);
            setRaceFaceIndices([]);
            setRaceCamera(0);
            break;

          case "curtain":
            console.log(
              `[handleAnimationComplete] curtainState.isActive를 false로 설정`
            );
            setCurtainState((prev) => ({
              ...prev,
              isActive: false,
              zoomParams: null,
            }));
            break;

          case "scanner":
            setScannerActive(false);
            setScannerTargetPoints([]);
            setScannerTargetFace(null);
            setScannerZoomScale(1);
            setScannerStage("");
            setScannerProgress(0);
            setScannerStatusText("");
            setScannerShowBorder(false);
            setScannerResultMessage("");
            setScannerIsFinalTarget(false);
            setCameraPanOffset({ x: 0, y: 0 });
            break;

          case "handpick":
            setHandpickActive(false);
            setHandpickFaces([]);
            setHandpickStage("");
            setExpressionMode("");
            setRemainingSeconds(null);
            setResultFace(null);
            setResultExpressionName("");
            setResultMessage("");
            setHandpickRanking(null);
            setHandpickCountdown(null);
            setFinalHandpickFrame(null);
            break;
        }
      }, 6000);
    },
    [setStatus, setIsSelecting, setIsFaceDetectionStable, stopSound]
  );
  // --- 수정 끝 ---

  // --- 각 모드별 핸들러 함수 정의 (useCallback) ---
  const handleSlotMachineMessages = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "init_slot_machine":
          if (message.frame) {
            const frameData = `data:image/jpeg;base64,${message.frame}`;
            setFrozenFrame(frameData);
            setCurrentFrame(frameData);
          }
          setSlotMachineActive(true);
          setCurrentSlotFaces([]);
          setVisibleSlots([]);
          setJackpotActive(false);
          onAnimationReady?.();
          break;

        case "animation_step":
          setCurrentSlotFaces(message.faces);
          break;

        case "animation_result":
          setSelectedFace(message.face);
          break;

        case "show_slot":
          setVisibleSlots((prev) => [...prev, message.slot_idx]);
          break;
      }
    },
    [setCurrentFrame, onAnimationReady]
  );

  const handleRouletteMessages = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "init_roulette":
          setRouletteActive(true);
          if (message.frame) {
            const frameData = `data:image/jpeg;base64,${message.frame}`;
            setFrozenFrame(frameData);
            setCurrentFrame(frameData);
          }
          setRouletteFaces(message.faces);

          if (message.animation_params) {
            setRouletteParams(message.animation_params);
            animationRunningRef.current = true;
          }
          onAnimationReady?.();
          break;
      }
    },
    [setCurrentFrame, onAnimationReady]
  );

  const handleRaceMessages = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "init_race":
          setRaceActive(true);
          if (message.frame) {
            const frameData = `data:image/jpeg;base64,${message.frame}`;
            setFrozenFrame(frameData);
            setCurrentFrame(frameData);
          }
          setRaceTrackConfig(message.track_config);
          setRaceFaces(message.faces);
          setRaceFaceIndices(message.face_indices);
          setRaceCamera(message.track_config.camera_position);
          onAnimationReady?.();
          break;

        case "race_items":
          setRaceObstacles(message.obstacles);
          setRacePowerups(message.powerups);
          break;

        case "race_countdown":
          setRaceCountdown(message.count);
          break;

        case "race_update":
          setRacerPositions(message.racers);
          setRaceObstacles(message.obstacles);
          setRacePowerups(message.powerups);
          setRaceCamera(message.camera_position);
          break;

        case "race_collision":
          break;

        case "race_powerup":
          break;

        case "race_result":
          setRaceWinner(message.winner_id);
          break;
      }
    },
    [setFrozenFrame, setCurrentFrame, onAnimationReady]
  );

  const handleCurtainMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "animation_start":
          if (message.mode === "curtain") {
            setCurtainState((prev) => ({
              ...prev,
              isActive: true,
              curtainPosition: 1.0,
              selectedFace: null,
              introText: "",
              countdownValue: 0,
              resultText: "",
              showBorder: false,
              introActive: false,
              resultActive: false,
              zoomParams: null,
            }));
            onAnimationReady?.();
          }
          break;

        case "curtain_intro":
          setCurtainState((prev) => ({
            ...prev,
            introText: message.text,
            introActive: true,
          }));
          break;

        case "curtain_countdown":
          setCurtainState((prev) => ({
            ...prev,
            countdownValue: message.count,
          }));
          break;

        case "curtain_update":
          setCurtainState((prev) => ({
            ...prev,
            curtainPosition: message.position,
          }));
          break;

        case "curtain_selection":
          setCurtainState((prev) => ({
            ...prev,
            selectedFace: message.face,
            zoomParams: message.zoom_params || null,
          }));
          break;

        case "curtain_result":
          setCurtainState((prev) => ({
            ...prev,
            selectedFace: message.face,
            resultText: message.text,
            showBorder: true,
            resultActive: true,
            introActive: false,
            zoomParams: message.zoom_params || prev.zoomParams,
          }));
          break;

        case "curtain_intro_end":
          setCurtainState((prev) => ({
            ...prev,
            introActive: false,
          }));
          break;
      }
    },
    [setCurtainState, onAnimationReady]
  );

  const handleScannerMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "animation_start":
          if (message.mode === "scanner") {
            setScannerActive(true);
            setScannerTargetPoints([]);
            setScannerTargetFace(null);
            setScannerZoomScale(1);
            setScannerStage("");
            setScannerProgress(0);
            setScannerStatusText("");
            setScannerShowBorder(false);
            setScannerResultMessage("");
            setScannerIsFinalTarget(false);
            onAnimationReady?.();
          }
          break;

        case "scanner_target":
          setScannerTargetPoints((prev) => [...prev, message.target_point]);
          setScannerProgress(message.progress);
          setScannerStage(message.stage);
          setScannerStatusText("중간계 관찰 중...");
          break;

        case "scanner_transition":
          setScannerStatusText(message.text);
          break;

        case "scanner_face_target":
          setScannerTargetFace(message.face);
          setScannerIsFinalTarget(message.is_final);
          setScannerStage(message.stage);
          setScannerStatusText(
            message.is_final ? "대상 포착 완료" : "의지 분석 중..."
          );
          break;

        case "scanner_zoom":
          setScannerTargetFace(message.face);
          setScannerZoomScale(message.zoom_scale);
          setScannerStage(message.stage);
          setScannerProgress(message.progress);
          setScannerStatusText(
            message.stage === "first_zoom"
              ? `사우론의 시선 집중: ${Math.round(message.progress)}%`
              : `최종 시선 집중: ${Math.round(message.progress)}%`
          );
          setScannerShowBorder(!!message.show_border);
          break;

        case "scanner_result":
          if (message.face) {
            setScannerTargetFace(message.face);
          }
          setScannerResultMessage(message.message);
          setScannerStage("result");
          break;

        case "scanner_camera_pan":
          setScannerTargetFace(message.face);
          setScannerStage(message.stage);
          setScannerProgress(message.progress);
          setScannerStatusText("대상 분석 중...");
          setCameraPanOffset({
            x: message.offset_x,
            y: message.offset_y,
          });
          break;
      }
    },
    [onAnimationReady]
  );

  const handleHandpickMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "animation_start":
          if (message.mode === "handpick") {
            setHandpickActive(true);
            setHandpickFaces([]);
            setHandpickStage("start");
            setHandpickProgress(0);
            setExpressionMode("");
            setRemainingSeconds(null);
            setResultFace(null);
            setResultExpressionName("");
            setResultMessage("");
            setHandpickRanking(null);
            setHandpickCountdown(null);
            onAnimationReady?.();
          }
          break;

        case "handpick_start":
          setHandpickStage("calibration");
          setHandpickCountdown(null);
          break;

        case "handpick_calibration_complete":
          setHandpickStage("waiting");
          setRemainingSeconds(message.measurement_time || 7);

          const countdownInterval = setInterval(() => {
            setRemainingSeconds((prev) => {
              if (prev === null || prev <= 1) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          break;

        case "handpick_progress":
          setHandpickFaces(message.faces);
          setHandpickStage(message.stage);
          setHandpickProgress(message.progress);
          setHandpickCountdown(message.countdown ?? null);
          if (message.expression_mode) {
            setExpressionMode(message.expression_mode);
          }
          break;

        case "handpick_result":
          setResultFace(message.face);
          setResultExpressionName(message.expression_name);
          setResultMessage(message.message);
          setHandpickRanking(message.ranking);
          setHandpickStage("result");
          setRemainingSeconds(null);
          setHandpickCountdown(null);
          if (message.result_frame) {
            setFinalHandpickFrame(
              `data:image/jpeg;base64,${message.result_frame}`
            );
            console.log("Received and set final handpick frame.");
          } else {
            console.warn(
              "Final handpick frame not received in result message."
            );
            setFinalHandpickFrame(null);
          }
          break;
      }
    },
    [onAnimationReady]
  );
  // --- 핸들러 정의 끝 ---

  // --- 2. messageHandlers 정의를 여기로 이동 ---
  const messageHandlers = useMemo<Record<AnimationMode, ModeMessageHandler>>(
    () => ({
      slot: handleSlotMachineMessages,
      roulette: handleRouletteMessages,
      race: handleRaceMessages,
      curtain: handleCurtainMessage,
      scanner: handleScannerMessage,
      handpick: handleHandpickMessage,
    }),
    [
      handleSlotMachineMessages,
      handleRouletteMessages,
      handleRaceMessages,
      handleCurtainMessage,
      handleScannerMessage,
      handleHandpickMessage,
    ]
  );
  // --- 이동 끝 ---

  // --- 추가: handleCommonMessages의 최신 버전을 ref에 저장 ---
  useEffect(() => {
    messageHandlerRef.current = (eventDataString: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(eventDataString);
        handleCommonMessages(message);

        if (currentMode && messageHandlers[currentMode]) {
          messageHandlers[currentMode](message);
        }
      } catch (error) {
        console.error("Error parsing websocket message:", error);
      }
    };
  }, [handleCommonMessages, currentMode, messageHandlers]);
  // --- 수정 끝 ---

  // --- useEffect: 웹소켓 메시지 핸들러 등록 ---
  useEffect(() => {
    if (!websocket) return;

    const stableHandler = (event: MessageEvent) =>
      messageHandlerRef.current(event.data);

    console.log("[useAnimation] 웹소켓 메시지 핸들러 등록 (stable ref)");
    websocket.addEventListener("message", stableHandler);

    return () => {
      console.log("[useAnimation] 웹소켓 메시지 핸들러 제거 (stable ref)");
      websocket.removeEventListener("message", stableHandler);
    };
  }, [websocket]);

  const getSlotMachineState = () => ({
    slotMachineActive,
    currentSlotFaces,
    selectedFace,
    visibleSlots,
    frozenFrame,
    jackpotActive,
  });

  const getRouletteState = () => ({
    rouletteActive,
    rouletteFaces,
    frozenFrame,
    rouletteParams,
  });

  const getRaceState = () => ({
    raceActive,
    raceTrackConfig,
    raceObstacles,
    racePowerups,
    racerPositions,
    raceWinner,
    raceCountdown,
    raceFaces,
    raceFaceIndices,
    frozenFrame,
    raceCamera,
  });

  const getCurtainState = () => ({
    curtainActive: curtainState.isActive,
    curtainPosition: curtainState.curtainPosition,
    selectedFace: curtainState.selectedFace,
    introText: curtainState.introText,
    countdownValue: curtainState.countdownValue,
    resultText: curtainState.resultText,
    showBorder: curtainState.showBorder,
    introActive: curtainState.introActive,
    resultActive: curtainState.resultActive,
    zoomParams: curtainState.zoomParams,
  });

  const getScannerState = () => ({
    scannerActive,
    scannerTargetPoints,
    scannerTargetFace,
    scannerZoomScale,
    scannerStage,
    scannerProgress,
    scannerStatusText,
    scannerShowBorder,
    resultMessage: scannerResultMessage,
    isFinalTarget: scannerIsFinalTarget,
    cameraPanOffset,
  });

  const getHandpickState = (): HandpickState => ({
    handpickActive,
    handpickFaces,
    handpickStage,
    handpickProgress,
    expressionMode,
    remainingSeconds,
    resultFace,
    resultExpressionName,
    resultMessage,
    handpickRanking,
    handpickCountdown,
    finalHandpickFrame,
  });

  const getModeState = () => {
    switch (currentMode) {
      case "slot":
        return getSlotMachineState();
      case "roulette":
        return getRouletteState();
      case "race":
        return getRaceState();
      case "curtain":
        return getCurtainState();
      case "scanner":
        return getScannerState();
      case "handpick":
        return getHandpickState();
      default:
        return null;
    }
  };

  return {
    detectedFaces,
    resetCountdown,
    isFaceDetectionStable,
    ...getModeState(),

    getSlotMachineState,
    getRouletteState,
    getRaceState,
    getCurtainState,
    getScannerState,
    getHandpickState,
    getModeState,
  };
};
