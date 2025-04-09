//useAnimation.ts

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  WebSocketMessage,
  AnimationMode,
  RouletteAnimationParams,
  RaceObstacle,
  RacePowerup,
  RaceParticipant,
} from "./types";
import { useAnimationContext } from "./AnimationContext";

// 모드별 메시지 핸들러 타입 정의
type ModeMessageHandler = (message: WebSocketMessage) => void;

export const useAnimation = (websocket: WebSocket | null) => {
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

  // 최적화 설정값
  const POSITION_THRESHOLD = 8; // 위치 변화 임계값 (px)
  const SIZE_THRESHOLD = 5; // 크기 변화 임계값 (px)
  const UPDATE_INTERVAL = 150; // 업데이트 간격 (ms)

  // 마지막 업데이트 시간 추적용 ref
  const lastUpdateTimeRef = useRef<number>(0);

  // 최적화된 얼굴 업데이트 함수
  const updateFacesOptimized = useCallback(
    (newFaces: Array<[number, number, number, number]>) => {
      const now = Date.now();

      // 스로틀링: 지정된 간격보다 짧은 시간이 지났으면 업데이트 스킵
      if (now - lastUpdateTimeRef.current < UPDATE_INTERVAL) {
        return;
      }

      setDetectedFaces((prevFaces) => {
        // 얼굴 개수가 변경된 경우는 즉시 업데이트
        if (prevFaces.length !== newFaces.length) {
          lastUpdateTimeRef.current = now;
          return newFaces;
        }

        // 임계값 기반 업데이트: 위치나 크기가 임계값 이상 변경되었는지 확인
        let significantChange = false;

        for (let i = 0; i < newFaces.length; i++) {
          const [prevX, prevY, prevW, prevH] = prevFaces[i] || [0, 0, 0, 0];
          const [newX, newY, newW, newH] = newFaces[i];

          if (
            Math.abs(prevX - newX) > POSITION_THRESHOLD ||
            Math.abs(prevY - newY) > POSITION_THRESHOLD ||
            Math.abs(prevW - newW) > SIZE_THRESHOLD ||
            Math.abs(prevH - newH) > SIZE_THRESHOLD
          ) {
            significantChange = true;
            break;
          }
        }

        // 유의미한 변화가 있는 경우에만 업데이트
        if (significantChange) {
          lastUpdateTimeRef.current = now;
          return newFaces;
        }

        return prevFaces; // 변화가 미미하면 이전 상태 유지
      });
    },
    []
  );

  // 공통 메시지 핸들러
  const handleCommonMessages = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "animation_frame":
          // 커튼 모드 추가: 커튼 모드에서는 프레임 업데이트 필요 없음
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

        case "faces":
          updateFacesOptimized(message.faces);
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
          // 애니메이션 완료 시 모드별 초기화 함수 호출
          handleAnimationComplete(message.mode);
          break;

        case "error":
          console.error("WebSocket 에러:", message.message);
          setStatus(`오류: ${message.message}`);

          // 얼굴 감지 관련 오류 시 특별한 처리
          if (message.message?.includes("얼굴이 없습니다")) {
            setStatus("❌ 감지된 얼굴이 없습니다. 잠시 후 다시 시도해주세요.");
            // 2초 후 상태 메시지 초기화
            setTimeout(() => {
              setStatus("");
              setIsSelecting(false);
            }, 2000);
          }
          break;
      }
    },
    [
      slotMachineActive,
      rouletteActive,
      raceActive,
      setCurrentFrame,
      playSound,
      stopSound,
      setOverlay,
      addTextOverlay,
      setIsSelecting,
      setStatus,
      currentMode,
      curtainState.isActive,
      updateFacesOptimized,
    ]
  );

  // 애니메이션 완료 시 모드별 초기화를 처리하는 공통 함수 추가
  const handleAnimationComplete = useCallback(
    (mode: string) => {
      console.log(`[handleAnimationComplete] 시작, 모드: ${mode}`);
      // 모든 모드에 공통으로 적용되는 카운트다운 로직
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

      // 6초 후 모드별 초기화 실행
      setTimeout(() => {
        console.log(
          `[handleAnimationComplete] 6초 타이머 완료, 모드: ${mode} 초기화 실행`
        );
        // 공통 초기화 작업
        setFrozenFrame(null);
        setStatus("");
        setIsSelecting(false);
        setResetCountdown(null);
        clearInterval(countdownInterval);

        // 모드별 특수 초기화 작업
        switch (mode) {
          case "slot":
            setSlotMachineActive(false);
            setCurrentSlotFaces([]);
            setVisibleSlots([]);
            setSelectedFace(null);
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

          // 필요시 다른 모드 추가
        }
      }, 6000);
    },
    [setStatus, setIsSelecting]
  );

  // 슬롯머신 메시지 핸들러
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
    [setCurrentFrame]
  );

  // 룰렛 메시지 핸들러
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

          // 애니메이션 매개변수가 있으면 저장
          if (message.animation_params) {
            // @ts-ignore - 타입스크립트 오류 방지를 위한 임시 처리
            setRouletteParams(message.animation_params);
            animationRunningRef.current = true;
          }
          break;
      }
    },
    [setCurrentFrame]
  );

  // 레이스 메시지 핸들러
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
          // 충돌 효과 처리 (실제 효과는 RaceAnimation 컴포넌트에서 처리)
          break;

        case "race_powerup":
          // 파워업 효과 처리 (실제 효과는 RaceAnimation 컴포넌트에서 처리)
          break;

        case "race_result":
          setRaceWinner(message.winner_id);
          break;
      }
    },
    [setFrozenFrame, setCurrentFrame]
  );

  // 커튼 모드 메시지 핸들러를 useCallback으로 래핑
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
    [setCurtainState]
  ); // 의존성 배열에 setCurtainState 추가

  // messageHandlers를 useMemo로 감싸서 불필요한 재생성 방지
  const messageHandlers = useMemo<Record<AnimationMode, ModeMessageHandler>>(
    () => ({
      slot: handleSlotMachineMessages,
      roulette: handleRouletteMessages,
      race: handleRaceMessages,
      curtain: handleCurtainMessage,
      scanner: () => {}, // 아직 구현 안됨
      handpick: () => {}, // 아직 구현 안됨
    }),
    [
      handleSlotMachineMessages,
      handleRouletteMessages,
      handleRaceMessages,
      handleCurtainMessage,
    ]
  );

  // 웹소켓 핸들러를 위한 ref 추가
  const messageHandlerRef = useRef<(event: MessageEvent) => void>(() => {});

  // 웹소켓 메시지 핸들러 등록
  useEffect(() => {
    if (!websocket) return;

    // 핸들러 함수를 ref에 저장
    messageHandlerRef.current = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        // 공통 메시지 처리
        handleCommonMessages(message);

        // 현재 모드에 따른 특정 메시지 처리
        if (currentMode && messageHandlers[currentMode]) {
          messageHandlers[currentMode](message);
        }
      } catch (error) {
        console.error("Error parsing websocket message:", error);
      }
    };

    // 실제 이벤트 리스너는 ref의 값을 사용하는 안정적인 함수
    const stableHandler = (event: MessageEvent) =>
      messageHandlerRef.current(event);

    console.log("[useAnimation] 웹소켓 메시지 핸들러 등록");
    websocket.addEventListener("message", stableHandler);

    return () => {
      console.log("[useAnimation] 웹소켓 메시지 핸들러 제거");
      websocket.removeEventListener("message", stableHandler);
    };
  }, [websocket]); // 의존성 최소화

  // 모드별로 필요한 상태 반환
  const getSlotMachineState = () => ({
    slotMachineActive,
    currentSlotFaces,
    selectedFace,
    visibleSlots,
    frozenFrame,
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

  // 커튼 모드 상태 반환 함수 수정
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

  // 상태 선택 함수
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
      default:
        return {};
    }
  };

  return {
    detectedFaces,
    resetCountdown,
    ...getModeState(),

    // 필요한 경우 직접 특정 모드 상태 접근을 위한 게터 함수들
    getSlotMachineState,
    getRouletteState,
    getRaceState,
    getCurtainState,
    getModeState,
  };
};
