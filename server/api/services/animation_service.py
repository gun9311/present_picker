from fastapi import WebSocket
import base64
import cv2
import numpy as np
from src.face_detection import detect_faces_yolo
from src.animation import ANIMATION_MODULES
import asyncio

# 모드별 최대 허용 인원 정의 (handpick: 1명, scanner: 3명, 나머지는 제한 없음 - 매우 큰 수)
MODE_LIMITS = {
    "handpick": 1,
    "scanner": 3,
    "slot": 20,
    "roulette": 20,
    "curtain": 20,
    "race": 20,
}

class AnimationService:
    def __init__(self):
        # 사용자별 마지막 프레임을 저장할 딕셔너리
        self.last_frames = {}
        # 활성 클라이언트 저장 (웹소켓 객체)
        self.active_clients = {}
        # 진행 중인 애니메이션 작업 저장 (애니메이션 중지 플래그)
        self.running_animations = {}
        # 클라이언트별 활성 애니메이션 상태 (애니메이션 로직 실행 여부)
        self.active_animations = {}
        # 모드별 활성 사용자 ID 저장 (set 사용)
        self.active_mode_users = {mode: set() for mode in MODE_LIMITS}
        # print(f"AnimationService 초기화 완료. 모드별 사용자 저장소: {self.active_mode_users}")

    def register_client(self, client_id, websocket):
        """새로운 클라이언트 연결 등록"""
        self.active_clients[client_id] = websocket
        # active_animations 초기화는 애니메이션 시작 시점으로 이동 고려
        # print(f"새 클라이언트 등록: {client_id}, 현재 총 {len(self.active_clients)}개 연결")

    def unregister_client(self, client_id):
        """클라이언트 연결 해제 처리"""
        if client_id in self.active_clients:
            del self.active_clients[client_id]
            # print(f"클라이언트 등록 해제: {client_id}, 현재 총 {len(self.active_clients)}개 연결")

    def cleanup_resources(self, client_id):
        """클라이언트 연결 종료 시 관련 리소스 정리"""
        # print(f"클라이언트 리소스 정리 시작: {client_id}")

        # 저장된 프레임 제거
        if client_id in self.last_frames:
            del self.last_frames[client_id]

        # 진행 중인 애니메이션 작업 정리
        if client_id in self.running_animations:
            self.running_animations[client_id] = False # 실행 중지 플래그 설정
            del self.running_animations[client_id]

        # 활성 애니메이션 상태 정리
        if client_id in self.active_animations:
             # print(f"클라이언트 {client_id}의 활성 애니메이션 상태 정리")
             del self.active_animations[client_id]

        # 모드별 활성 사용자 목록에서 제거
        removed_from_mode = None
        for mode, users_set in self.active_mode_users.items():
            if client_id in users_set:
                users_set.remove(client_id)
                removed_from_mode = mode
                # print(f"클라이언트 {client_id}가 {mode} 모드에서 나감. 현재 {mode} 인원: {len(users_set)}")
                break # 일반적으로 클라이언트는 하나의 모드에만 있을 것으로 가정

        # 클라이언트 등록 해제 (중요: 여기서 호출)
        self.unregister_client(client_id)

        # print(f"클라이언트 리소스 정리 완료: {client_id}, 모드: {removed_from_mode}")

    async def handle_animation(self, websocket: WebSocket, data: dict):
        client_id = id(websocket)

        # print(f"[AnimationService] 메시지 수신 (클라이언트 ID: {client_id}): {data}")

        message_type = data.get('type')

        # --- 모드 입장 가능 여부 확인 ---
        if message_type == 'check_availability':
            mode = data.get('mode')
            # print(f"[AnimationService] 모드 입장 가능 여부 확인 요청 - 모드: {mode}, 클라이언트: {client_id}")

            if not mode or mode not in MODE_LIMITS:
                # print(f"[AnimationService] 잘못된 모드 요청: {mode}")
                await websocket.send_json({
                    'type': 'availability_response',
                    'allowed': False,
                    'mode': mode,
                    'reason': 'invalid_mode'
                })
                return

            current_users = len(self.active_mode_users.get(mode, set()))
            limit = MODE_LIMITS.get(mode, 0)
            # print(f"[AnimationService] 모드 '{mode}': 현재 인원 {current_users}, 제한 {limit}")

            if current_users < limit:
                 # 입장 허용: active_mode_users에 추가하고 응답 전송
                self.active_mode_users[mode].add(client_id)
                # print(f"[AnimationService] 모드 '{mode}' 입장 허용. 클라이언트 {client_id} 추가. 현재 인원: {len(self.active_mode_users[mode])}")
                await websocket.send_json({
                    'type': 'availability_response',
                    'allowed': True,
                    'mode': mode
                })
            else:
                 # 입장 불가 (인원 초과): 응답만 전송
                # print(f"[AnimationService] 모드 '{mode}' 입장 불가 (인원 초과). 클라이언트: {client_id}")
                await websocket.send_json({
                    'type': 'availability_response',
                    'allowed': False,
                    'mode': mode,
                    'reason': 'limit_reached'
                })
            return # 확인 요청 처리 후 종료

        # --- 기존 메시지 처리 로직 ---

        # 클라이언트에서 보내는 애니메이션 완료 메시지 처리 추가
        if message_type == 'animation_complete_client':
            mode = data.get('mode')
            winner_index = data.get('winnerIndex')

            # print(f"[AnimationService] 클라이언트에서 애니메이션 완료 메시지 수신 - 모드: {mode}, 당첨자: {winner_index}, 클라이언트: {client_id}")

            # 애니메이션 완료 처리 (선택 완료 메시지 등)
            await websocket.send_json({'type': 'selection_complete', 'mode': mode})
            await websocket.send_json({'type': 'animation_complete', 'mode': mode})

            # 애니메이션 완료 시 active_animations 상태 업데이트
            if client_id in self.active_animations:
                self.active_animations[client_id] = False

            return

        if message_type == 'start_animation':
            # print(f"[AnimationService] 애니메이션 시작/프레임 수신 - 모드: {data.get('mode')}, 직접 시작: {data.get('startAnimation', False)}, 클라이언트: {client_id}")
            mode = data.get('mode') # 모드 정보 가져오기

             # 요청한 모드가 유효하고, 클라이언트가 해당 모드에 입장한 상태인지 확인 (선택적이지만 안전)
            # if mode not in self.active_mode_users or client_id not in self.active_mode_users[mode]:
            #     print(f"[AnimationService] 경고: 클라이언트 {client_id}가 {mode} 모드에 없는데 애니메이션 시작 요청함.")
                # 여기서 오류 처리 또는 무시할 수 있음

            try:
                # 이전에 실행 중인 애니메이션이 있으면 중지 플래그 설정
                if client_id in self.running_animations and self.running_animations[client_id]:
                    # print(f"[AnimationService] 기존 애니메이션 중지 플래그 설정 (클라이언트: {client_id})")
                    self.running_animations[client_id] = False # 실행 중지 플래그만 설정

                # 새 애니메이션 실행용 플래그 설정 (startAnimation=True 일 때만 의미 가짐)
                self.running_animations[client_id] = True
                # 활성 애니메이션 상태 초기화 (실제 애니메이션 시작 직전에 True로 설정)
                self.active_animations[client_id] = False

                # 프레임 디코딩 - 'frame' 필드가 있는 경우에만 처리
                if 'frame' in data:
                    frame = self._decode_frame(data['frame'])
                    self.last_frames[client_id] = frame # 최신 프레임 저장

                    # 실제 애니메이션 시작 요청인지 확인 (startAnimation 플래그)
                    if data.get('startAnimation'):
                        # print(f"[AnimationService] startAnimation=True 확인. 얼굴 감지 시작 (클라이언트: {client_id})")
                        faces = await detect_faces_yolo(frame)

                        if len(faces) == 0:
                            # print(f"[AnimationService] 얼굴 미감지 - 오류 메시지 전송 (클라이언트: {client_id})")
                            await websocket.send_json({
                                'type': 'error',
                                'message': '❌ 감지된 얼굴이 없습니다.'
                            })
                            # 애니메이션 실행 플래그 및 상태 해제
                            self.running_animations[client_id] = False
                            self.active_animations[client_id] = False
                            return # 애니메이션 실행 안함

                        # mode = data['mode'] # 이미 위에서 가져옴
                        if mode and mode in ANIMATION_MODULES:
                            # print(f"[AnimationService] {mode} 애니메이션 함수 준비 (클라이언트: {client_id})")
                            animation_func = ANIMATION_MODULES[mode]

                            # 활성 애니메이션 상태를 True로 설정 (실제 실행 직전)
                            self.active_animations[client_id] = True
                            # print(f"[AnimationService] active_animations[{client_id}] = True 설정")


                            # 애니메이션 실행 중지 확인 함수 (클로저 사용)
                            def is_running():
                                is_still_running = self.running_animations.get(client_id, False)
                                # print(f"[is_running check for {client_id}]: {is_still_running}") # 디버깅 로그 추가
                                return is_still_running


                            # 비동기 태스크로 애니메이션 함수 실행
                            # print(f"[AnimationService] {mode} 애니메이션 태스크 생성 및 실행 (클라이언트: {client_id})")
                            animation_task = asyncio.create_task(
                                animation_func(frame, faces, websocket, data['frame'], is_running, self, client_id)
                            )

                            # 애니메이션 완료 후 처리 (비동기 태스크 내에서 완료 메시지 전송 등)
                            async def handle_animation_completion():
                                try:
                                    await animation_task # 애니메이션 태스크 완료 대기
                                    # print(f"[AnimationService] {mode} 애니메이션 태스크 완료 (클라이언트: {client_id})")

                                    # 애니메이션이 정상적으로 (중단되지 않고) 완료되었고, 룰렛 모드가 아닐 경우 완료 메시지 전송
                                    if is_running() and mode != 'roulette':
                                        # print(f"[AnimationService] {mode} 애니메이션 완료 메시지 전송 (클라이언트: {client_id})")
                                        await websocket.send_json({
                                            'type': 'animation_complete',
                                            'mode': mode
                                        })
                                except asyncio.CancelledError:
                                     print(f"[AnimationService] {mode} 애니메이션 태스크 취소됨 (클라이언트: {client_id})")
                                except Exception as e:
                                    print(f"[AnimationService] 애니메이션 완료 처리 중 오류 (클라이언트: {client_id}): {str(e)}")
                                finally:
                                     # 애니메이션 태스크 완료 또는 취소/오류 시 active_animations 상태 업데이트
                                     if client_id in self.active_animations:
                                          # print(f"[AnimationService] active_animations[{client_id}] = False 설정 (태스크 종료)")
                                          self.active_animations[client_id] = False
                                     # running_animations 플래그는 is_running() 호출 시 체크되므로 여기서 건드리지 않음
                                     # print(f"[AnimationService] 애니메이션 완료 처리 종료 (클라이언트: {client_id})")


                            # 완료 처리 태스크 시작
                            asyncio.create_task(handle_animation_completion())

                            # handle_animation 함수는 즉시 반환되어 다음 메시지를 받을 수 있음
                            return

                        else:
                            # print(f"[AnimationService] 정의되지 않은 모드 또는 모듈 없음: {mode} (클라이언트: {client_id})")
                            # 유효하지 않은 모드에 대한 오류 메시지 전송 등 처리 추가 가능
                             await websocket.send_json({
                                 'type': 'error',
                                 'message': f"❌ 알 수 없는 모드({mode})입니다."
                             })
                             self.running_animations[client_id] = False
                             self.active_animations[client_id] = False


                    # else: startAnimation=False 인 경우
                        # print(f"[AnimationService] startAnimation=False, 프레임만 업데이트 (클라이언트: {client_id})")
                        # 단순히 프레임만 업데이트하고 얼굴 감지 등은 하지 않음
                        # 필요 시 얼굴 감지 결과만 보내는 로직 추가 가능
                        pass

                else: # 'frame' 데이터가 없는 경우
                    print(f"[AnimationService] 프레임 데이터 누락 (클라이언트: {client_id})")
                    await websocket.send_json({
                        'type': 'error',
                        'message': "프레임 데이터가 필요합니다."
                    })
                    # 이 경우에도 실행 관련 플래그 해제 필요
                    self.running_animations[client_id] = False
                    self.active_animations[client_id] = False


            except Exception as e:
                # start_animation 처리 중 예외 발생 시
                print(f"[AnimationService] start_animation 처리 중 오류 (클라이언트: {client_id}): {str(e)}")
                await websocket.send_json({
                    'type': 'error',
                    'message': f"처리 중 오류 발생: {str(e)}"
                })
                # 애니메이션 실행 플래그 및 상태 확실히 해제
                if client_id in self.running_animations:
                    self.running_animations[client_id] = False
                if client_id in self.active_animations:
                     self.active_animations[client_id] = False
                # raise # 디버깅 시 주석 해제

    def _decode_frame(self, frame_data: str) -> np.ndarray:
        try:
            # Base64 문자열 앞의 'data:image/jpeg;base64,' 제거 (클라이언트에서 붙이는 경우)
            if frame_data.startswith('data:image'):
                frame_data = frame_data.split(',')[1]

            nparr = np.frombuffer(base64.b64decode(frame_data), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("cv2.imdecode returned None")
            return img
        except Exception as e:
            print(f"프레임 디코딩 오류: {e}")
            # print(f"오류 발생한 프레임 데이터 (앞 50자): {frame_data[:50]}") # 디버깅용
            raise

    async def _send_faces(self, websocket: WebSocket, faces):
        # 이 함수는 현재 직접 호출되지 않음. 필요 시 사용.
        await websocket.send_json({
            'type': 'faces',
            'faces': faces.tolist() if faces is not None else []
        })
