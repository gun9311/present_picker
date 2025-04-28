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

// 모드별 메시지 핸들러 타입 정의
type ModeMessageHandler = (message: WebSocketMessage) => void;

// 안정성 확인 임계 시간 (밀리초)
const FACE_DETECTION_STABILITY_THRESHOLD = 500;

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

        case "show_jackpot_effect":
          if (currentMode === "slot") {
            setJackpotActive(true);
          }
          break;

        case "faces":
          updateFacesOptimized(message.faces);

          // 얼굴 감지 안정성 로직 추가
          if (message.faces.length > 0) {
            const now = Date.now();
            if (faceDetectionStartTimeRef.current === null) {
              faceDetectionStartTimeRef.current = now;
              // 얼굴 감지 시작 시 바로 안정 상태는 아님
              setIsFaceDetectionStable(false);
            } else {
              // 임계 시간 이상 감지 유지 시 안정 상태로 변경
              if (
                now - faceDetectionStartTimeRef.current >=
                FACE_DETECTION_STABILITY_THRESHOLD
              ) {
                setIsFaceDetectionStable(true);
              }
            }
          } else {
            // 얼굴 감지 안되면 시작 시간 및 안정 상태 초기화
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
      setIsFaceDetectionStable,
    ]
  );

  // --- HandpickState 인터페이스 정의 추가 ---
  interface HandpickState {
    handpickActive: boolean;
    handpickFaces: Array<{
      face: FaceCoordinates; // FaceCoordinates 타입 사용
      expression_score: number;
      is_candidate: boolean;
    }>;
    handpickStage: string;
    handpickProgress: number;
    expressionMode: string;
    remainingSeconds: number | null;
    resultFace: FaceCoordinates | null; // FaceCoordinates 타입 사용
    resultExpressionName: string;
    resultMessage: string;
    handpickRanking: Array<{
      face: FaceCoordinates; // FaceCoordinates 타입 사용
      rank: number;
      score: number;
    }> | null;
    handpickCountdown: number | null;
    finalHandpickFrame: string | null; // 여기에 finalHandpickFrame 포함
  }
  // --- 인터페이스 정의 끝 ---

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

        // 얼굴 감지 안정성 상태 초기화 추가
        faceDetectionStartTimeRef.current = null;
        setIsFaceDetectionStable(false);

        // --- 추가: 애니메이션 완료 시 관련 루프 사운드 중지 ---
        console.log(
          `[handleAnimationComplete] Stopping sounds for mode: ${mode}`
        );
        // 각 모드별로 루프 가능성이 있는 사운드를 중지시킵니다.
        // (정확한 사운드 파일명은 assets/sounds/ 폴더 구조 확인 필요)
        if (mode === "roulette") {
          stopSound("roulette/spin_loop");
          stopSound("roulette/spin_slow"); // 느려지는 소리도 멈춤
        } else if (mode === "race") {
          // race_loop는 서버에서도 멈추지만, 안전하게 여기서도 멈춤
          stopSound("race/race_loop");
        } else if (mode === "scanner") {
          // 스캐너 모드에서 루프되는 사운드가 있다면 추가 (예: processing 등)
          stopSound("scanner_zoom/processing"); // processing 사운드가 루프될 경우
        }
        // 다른 모드들도 필요시 추가
        // --- 추가 끝 ---

        // 모드별 특수 초기화 작업
        switch (mode) {
          case "slot":
            setSlotMachineActive(false);
            setCurrentSlotFaces([]);
            setVisibleSlots([]);
            setSelectedFace(null);
            setJackpotActive(false);
            // 슬롯머신은 일반적으로 완료 시점에 루프 사운드가 없음
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
            // 커튼콜은 일반적으로 완료 시점에 루프 사운드가 없음
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
            // 핸드픽은 일반적으로 완료 시점에 루프 사운드가 없음
            break;
        }
      }, 6000);
    },
    [setStatus, setIsSelecting, setIsFaceDetectionStable, stopSound] // stopSound 의존성 추가
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
          setJackpotActive(false);
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
          // 레이서 상태 업데이트 시 shield_active, shield_timer 포함
          setRacerPositions(message.racers);
          setRaceObstacles(message.obstacles);
          setRacePowerups(message.powerups);
          setRaceCamera(message.camera_position);
          break;

        case "race_collision":
          // is_elimination 플래그에 따른 처리는 RaceAnimation 컴포넌트에서 직접 수행
          // 여기서 상태를 변경할 필요는 없음 (시각 효과와 직접 관련)
          // 타입 검사 예시 (필요시):
          // const collisionMessage = message as RaceCollisionMessage;
          // if (collisionMessage.is_elimination) {
          //   console.log(`Racer ${collisionMessage.racer_id} eliminated!`);
          // }
          break;

        case "race_powerup":
          // 파워업 효과 처리 (실제 효과는 RaceAnimation 컴포넌트에서 처리)
          // message.powerup_type (1: 부스트, 2: 보호막) 정보를 활용 가능
          // console.log(`Racer ${message.racer_id} got powerup type ${message.powerup_type}`);
          break;

        case "race_result":
          setRaceWinner(message.winner_id);
          break;
      }
    },
    [setFrozenFrame, setCurrentFrame] // 의존성 배열은 변경 필요 없음
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

  // 스캐너 메시지 핸들러
  const handleScannerMessage = useCallback((message: WebSocketMessage) => {
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
        // 타겟 얼굴이 없는 경우에도 결과 메시지 처리 (실패 메시지)
        if (message.face) {
          setScannerTargetFace(message.face);
        }
        setScannerResultMessage(message.message);
        setScannerStage("result"); // 결과 단계 표시를 위한 상태 추가
        break;

      case "scanner_camera_pan":
        setScannerTargetFace(message.face);
        setScannerStage(message.stage);
        setScannerProgress(message.progress);
        setScannerStatusText("대상 분석 중...");
        // 카메라 패닝에 필요한 오프셋 정보 저장
        setCameraPanOffset({
          x: message.offset_x,
          y: message.offset_y,
        });
        break;
    }
  }, []);

  // 핸들픽 메시지 핸들러 추가
  const handleHandpickMessage = useCallback((message: WebSocketMessage) => {
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
        }
        break;

      case "handpick_start":
        setHandpickStage("calibration");
        setHandpickCountdown(null);
        break;

      case "handpick_calibration_complete":
        setHandpickStage("waiting");
        // <<< 제거 또는 주석 처리: expressionMode는 progress에서 먼저 설정될 수 있음
        // setExpressionMode(message.expression_mode);
        setRemainingSeconds(message.measurement_time || 7);

        // 카운트다운 타이머 시작
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
        // <<< 추가: progress 메시지에서도 expressionMode 업데이트
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
          console.warn("Final handpick frame not received in result message.");
          setFinalHandpickFrame(null);
        }
        break;
    }
  }, []);

  // messageHandlers를 useMemo로 감싸서 불필요한 재생성 방지
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
  }, [websocket, handleCommonMessages, currentMode, messageHandlers]); // 필요한 의존성 추가

  // 모드별로 필요한 상태 반환
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

  // getScannerState 함수 추가
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

  // getHandpickState 함수 개선 (명시적 반환 타입 사용)
  const getHandpickState = (): HandpickState => ({
    // HandpickState 타입 명시
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
    finalHandpickFrame, // 이 속성이 타입 정의에 포함됨
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

    // 필요한 경우 직접 특정 모드 상태 접근을 위한 게터 함수들
    getSlotMachineState,
    getRouletteState,
    getRaceState,
    getCurtainState,
    getScannerState,
    getHandpickState,
    getModeState,
  };
};
