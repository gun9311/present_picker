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
  lastCapturedFrame: string | null;
  websocket: WebSocket | null;
  // 카메라 컨테이너 참조 추가 (선택적)
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
  powerup_timer?: number;
  z_index?: number; // z-index 추가
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
}

export interface RacePowerupMessage extends BaseWebSocketMessage {
  type: "race_powerup";
  racer_id: number;
  item_id: number;
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
  | CurtainIntroEndMessage;
