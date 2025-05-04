export type AnimationMode =
  | "slot"
  | "roulette"
  | "curtain"
  | "scanner"
  | "race"
  | "handpick";

export interface FaceData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextOverlayData {
  text: string;
  position: { x: number; y: number };
  style: {
    color: string;
    fontSize: number;
    backgroundColor?: string;
  };
}

export interface OverlayData {
  image: string;
  duration: number;
}

export interface SlotPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnimationProps {
  faces: Array<[number, number, number, number]>;
  websocket: WebSocket | null;
  cameraContainerRef?: React.RefObject<HTMLDivElement>;
}

// 기본 웹소켓 메시지 타입 인터페이스
export interface BaseWebSocketMessage {
  type: string;
}

// 공통 메시지 타입들
export interface AnimationFrameMessage extends BaseWebSocketMessage {
  type: "animation_frame";
  frame: string;
}

export interface PlaySoundMessage extends BaseWebSocketMessage {
  type: "play_sound";
  sound: string;
  options?: { loop?: boolean };
}

export interface StopSoundMessage extends BaseWebSocketMessage {
  type: "stop_sound";
  sound: string;
}

export interface ShowOverlayMessage extends BaseWebSocketMessage {
  type: "show_overlay";
  name: string;
  duration: number;
}

export interface ShowTextMessage extends BaseWebSocketMessage {
  type: "show_text";
  text: string;
  position: { x: number; y: number };
  style: {
    color: string;
    fontSize: number;
    backgroundColor?: string;
  };
}

export interface FacesDetectedMessage extends BaseWebSocketMessage {
  type: "faces";
  faces: Array<[number, number, number, number]>;
}

export interface SelectionCompleteMessage extends BaseWebSocketMessage {
  type: "selection_complete";
}

export interface AnimationStartMessage extends BaseWebSocketMessage {
  type: "animation_start";
  mode?: AnimationMode;
}

export interface AnimationCompleteMessage extends BaseWebSocketMessage {
  type: "animation_complete";
  mode: AnimationMode;
}

export interface ErrorMessage extends BaseWebSocketMessage {
  type: "error";
  message: string;
}

// 슬롯머신 관련 메시지 타입들
export interface InitSlotMachineMessage extends BaseWebSocketMessage {
  type: "init_slot_machine";
  frame?: string;
  slots: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface AnimationStepMessage extends BaseWebSocketMessage {
  type: "animation_step";
  step?: number;
  faces: Array<[number, number, number, number]>;
}

export interface AnimationResultMessage extends BaseWebSocketMessage {
  type: "animation_result";
  face: [number, number, number, number];
}

export interface ShowSlotMessage extends BaseWebSocketMessage {
  type: "show_slot";
  slot_idx: number;
  face?: [number, number, number, number];
}

// 룰렛 관련 메시지 타입 추가
export interface RouletteRotationMessage extends BaseWebSocketMessage {
  type: "roulette_rotation";
  angle: number;
  speed: number;
}

export interface RouletteResultMessage extends BaseWebSocketMessage {
  type: "roulette_result";
}

// 룰렛 애니메이션 매개변수 인터페이스 업데이트
export interface RouletteAnimationParams {
  initial_speed: number;
  deceleration_constant?: number; // 선형 감속 상수
  deceleration?: number; // 기존 지수적 감속률 - 호환성 유지
  direction?: number; // 방향 - 초기 속도에 이미 포함된 경우 선택적
  speed_threshold: number;
  use_linear_deceleration?: boolean; // 선형 감속 사용 여부
}

// InitRouletteMessage 인터페이스 정의
export interface InitRouletteMessage extends BaseWebSocketMessage {
  type: "init_roulette";
  faces: [number, number, number, number][];
  face_indices: number[];
  frame?: string;
  animation_params?: RouletteAnimationParams;
}

// 레이스 관련 타입들
export interface RaceObstacle {
  id: number;
  type: number;
  position: number;
  lane: number;
  width: number;
  height: number;
  active: boolean;
}

export interface RacePowerup {
  id: number;
  type: number;
  position: number;
  lane: number;
  width: number;
  height: number;
  active: boolean;
}

export interface RaceParticipant {
  id: number;
  position: number;
  speed: number;
  lane: number;
  face_index: number;
  powerup_timer?: number; // 부스트 타이머
  shield_active?: boolean; // 보호막 활성화 상태
  shield_timer?: number; // 보호막 남은 시간
  z_index?: number;
  eliminated?: boolean;
}

export interface InitRaceMessage extends BaseWebSocketMessage {
  type: "init_race";
  frame?: string;
  faces: Array<[number, number, number, number]>;
  face_indices: number[];
  track_config: {
    width: number;
    height: number;
    num_lanes: number;
    racers_per_lane?: number[]; // 레인별 참가자 수 정보 추가
    visible_width: number;
    camera_position: number;
  };
}

export interface RaceItemsMessage extends BaseWebSocketMessage {
  type: "race_items";
  obstacles: RaceObstacle[];
  powerups: RacePowerup[];
}

export interface RaceCountdownMessage extends BaseWebSocketMessage {
  type: "race_countdown";
  count: number | string;
}

export interface RaceUpdateMessage extends BaseWebSocketMessage {
  type: "race_update";
  racers: RaceParticipant[];
  obstacles: RaceObstacle[];
  powerups: RacePowerup[];
  camera_position: number;
}

export interface RaceCollisionMessage extends BaseWebSocketMessage {
  type: "race_collision";
  racer_id: number;
  item_id: number;
  is_elimination?: boolean;
  shield_broken?: boolean; // 보호막 깨짐 여부 필드 추가
}

export interface RacePowerupMessage extends BaseWebSocketMessage {
  type: "race_powerup";
  racer_id: number;
  item_id: number;
  powerup_type: number; // 파워업 타입 추가 (1: 부스트, 2: 보호막)
}

export interface RaceResultMessage extends BaseWebSocketMessage {
  type: "race_result";
  winner_id: number;
  winner_index: number;
}

// 커튼콜 인트로 메시지
export interface CurtainIntroMessage extends BaseWebSocketMessage {
  type: "curtain_intro";
  duration: number;
  text: string;
}

// 커튼콜 카운트다운 메시지
export interface CurtainCountdownMessage extends BaseWebSocketMessage {
  type: "curtain_countdown";
  count: number;
}

// 커튼 상태 업데이트 메시지
export interface CurtainUpdateMessage extends BaseWebSocketMessage {
  type: "curtain_update";
  position: number; // 0: 완전히 닫힘, 1: 완전히 열림
  state: "opening" | "closing";
}

// 커튼콜 선택 메시지
export interface CurtainSelectionMessage extends BaseWebSocketMessage {
  type: "curtain_selection";
  face: [number, number, number, number];
  zoom_params?: {
    scale: number;
    duration: number;
  };
}

// 커튼콜 결과 메시지
export interface CurtainResultMessage extends BaseWebSocketMessage {
  type: "curtain_result";
  face: [number, number, number, number];
  text: string;
  zoom_params?: {
    scale: number;
    duration: number;
  };
}

export interface CurtainIntroEndMessage extends BaseWebSocketMessage {
  type: "curtain_intro_end";
}

// 스캐너 타겟팅 메시지
export interface ScannerTargetMessage extends BaseWebSocketMessage {
  type: "scanner_target";
  target_point: [number, number];
  progress: number;
  stage: string;
}

// 스캐너 얼굴 타겟팅 메시지
export interface ScannerFaceTargetMessage extends BaseWebSocketMessage {
  type: "scanner_face_target";
  face: [number, number, number, number];
  is_final: boolean;
  stage: string;
}

// 스캐너 전환 메시지
export interface ScannerTransitionMessage extends BaseWebSocketMessage {
  type: "scanner_transition";
  text: string;
}

// 스캐너 줌 메시지
export interface ScannerZoomMessage extends BaseWebSocketMessage {
  type: "scanner_zoom";
  face: [number, number, number, number];
  zoom_scale: number;
  stage: string;
  progress: number;
  show_border?: boolean;
}

// 스캐너 카메라 패닝 메시지
export interface ScannerCameraPanMessage extends BaseWebSocketMessage {
  type: "scanner_camera_pan";
  face: [number, number, number, number];
  offset_x: number;
  offset_y: number;
  stage: string;
  progress: number;
}

// 스캐너 결과 메시지
export interface ScannerResultMessage extends BaseWebSocketMessage {
  type: "scanner_result";
  face?: [number, number, number, number];
  message: string;
}

// 표정 감지 시작 메시지
export interface HandpickStartMessage extends BaseWebSocketMessage {
  type: "handpick_start";
}

// 표정 감지 진행 메시지
export interface HandpickProgressMessage extends BaseWebSocketMessage {
  type: "handpick_progress";
  faces: Array<{
    face: [number, number, number, number];
    expression_score: number;
    is_candidate: boolean;
  }>;
  stage: string;
  progress: number;
  countdown?: number; // Optional: 시작 카운트다운 숫자
  expression_mode: string;
}

// 표정 감지 결과 메시지
export interface HandpickResultMessage extends BaseWebSocketMessage {
  type: "handpick_result";
  face: [number, number, number, number];
  expression_name: string;
  message: string;
  ranking: Array<{
    face: [number, number, number, number];
    rank: number;
    score: number;
  }>;
  result_frame?: string; // Optional: 최종 결과 시점의 프레임 (Base64)
}

// 보정 완료 메시지 추가
export interface HandpickCalibrationCompleteMessage
  extends BaseWebSocketMessage {
  type: "handpick_calibration_complete";
  expression_mode: string;
  measurement_time: number;
}

// --- 추가: 핸드픽 감지 종료 메시지 ---
export interface HandpickDetectionEndMessage extends BaseWebSocketMessage {
  type: "handpick_detection_end";
}
// --- 추가 끝 ---

// --- 잭팟 효과 메시지 타입 추가 ---
export interface ShowJackpotEffectMessage extends BaseWebSocketMessage {
  type: "show_jackpot_effect";
}

// 얼굴 좌표 타입 추가
export type FaceCoordinates = [number, number, number, number];

// 핸드픽 상태 인터페이스 정의 (기존 useAnimation.ts 에서 이동/정의되었다고 가정)
// 또는 useAnimation.ts 내부에 정의되어 있다면 해당 위치 수정
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
  // --- 추가: 핸드픽 프레임 전송 상태 ---
  isSendingFrameForHandpickDetection: boolean;
  // --- 추가 끝 ---
}

// 모든 웹소켓 메시지 타입의 유니온 타입 업데이트
export type WebSocketMessage =
  | AnimationFrameMessage
  | PlaySoundMessage
  | StopSoundMessage
  | ShowOverlayMessage
  | ShowTextMessage
  | FacesDetectedMessage
  | SelectionCompleteMessage
  | AnimationStartMessage
  | AnimationCompleteMessage
  | ErrorMessage
  | InitSlotMachineMessage
  | AnimationStepMessage
  | AnimationResultMessage
  | ShowSlotMessage
  | ShowJackpotEffectMessage
  | InitRouletteMessage
  | RouletteRotationMessage
  | RouletteResultMessage
  | InitRaceMessage
  | RaceItemsMessage
  | RaceCountdownMessage
  | RaceUpdateMessage
  | RaceCollisionMessage
  | RacePowerupMessage
  | RaceResultMessage
  | CurtainIntroMessage
  | CurtainCountdownMessage
  | CurtainUpdateMessage
  | CurtainSelectionMessage
  | CurtainResultMessage
  | CurtainIntroEndMessage
  | ScannerTargetMessage
  | ScannerFaceTargetMessage
  | ScannerTransitionMessage
  | ScannerZoomMessage
  | ScannerCameraPanMessage
  | ScannerResultMessage
  | HandpickStartMessage
  | HandpickCalibrationCompleteMessage
  | HandpickProgressMessage
  | HandpickResultMessage
  | HandpickDetectionEndMessage;
