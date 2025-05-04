from fastapi import WebSocket
import base64
import cv2
import numpy as np
from src.face_detection import detect_faces_yolo
from src.animation import ANIMATION_MODULES

class AnimationService:
    def __init__(self):
        # 사용자별 마지막 프레임을 저장할 딕셔너리
        self.last_frames = {}
        # 활성 클라이언트 저장
        self.active_clients = {}
        # 진행 중인 애니메이션 작업 저장
        self.running_animations = {}
        self.active_animations = {}
        
    def register_client(self, client_id, websocket):
        """새로운 클라이언트 연결 등록"""
        self.active_clients[client_id] = websocket
        self.active_animations[client_id] = False
        # print(f"새 클라이언트 등록: {client_id}, 현재 총 {len(self.active_clients)}개 연결")
        
    def unregister_client(self, client_id):
        """클라이언트 연결 해제 처리"""
        if client_id in self.active_clients:
            del self.active_clients[client_id]
            # print(f"클라이언트 등록 해제: {client_id}, 현재 총 {len(self.active_clients)}개 연결")
        
    def cleanup_resources(self, client_id):
        """클라이언트 연결 종료 시 관련 리소스 정리"""
        # 저장된 프레임 제거
        if client_id in self.last_frames:
            del self.last_frames[client_id]
            
        # 진행 중인 애니메이션 작업 정리
        if client_id in self.running_animations:
            # 애니메이션 실행 플래그를 False로 설정하여 중지
            self.running_animations[client_id] = False
            del self.running_animations[client_id]
            
        if client_id in self.active_animations:
            self.active_animations[client_id] = False
            del self.active_animations[client_id]
        
        # 클라이언트 등록 해제 (중요: 여기서 호출)
        self.unregister_client(client_id)
            
        # print(f"클라이언트 리소스 정리 완료: {client_id}")
        
    async def handle_animation(self, websocket: WebSocket, data: dict):
        client_id = id(websocket)
        
        # print(f"[AnimationService] 메시지 수신: {data['type']}")
        
        # 클라이언트에서 보내는 애니메이션 완료 메시지 처리 추가
        if data['type'] == 'animation_complete_client':
            mode = data.get('mode')
            winner_index = data.get('winnerIndex')
            
            # print(f"[AnimationService] 클라이언트에서 애니메이션 완료 메시지 수신 - 모드: {mode}, 당첨자: {winner_index}")
            
            # 애니메이션 완료 처리
            await websocket.send_json({
                'type': 'selection_complete',
                'mode': mode
            })
            
            # 애니메이션 완료 알림
            await websocket.send_json({
                'type': 'animation_complete',
                'mode': mode
            })
            
            self.active_animations[client_id] = False
            
            return
        
        if data['type'] == 'start_animation':
            try:
                # print(f"[AnimationService] 애니메이션 시작 요청 - 모드: {data.get('mode')}, 직접 시작: {data.get('startAnimation', False)}")
                
                # 이전에 실행 중인 애니메이션이 있으면 중지 플래그 설정
                if client_id in self.running_animations:
                    self.running_animations[client_id] = False
                
                # 새 애니메이션 실행용 플래그 설정
                self.running_animations[client_id] = True
                
                
                # 프레임 디코딩 - 'frame' 필드가 있는 경우에만 처리
                if 'frame' in data:
                    frame = self._decode_frame(data['frame'])
                    # 최신 프레임 저장 (웹소켓 객체 ID를 키로 사용)
                    self.last_frames[client_id] = frame
                    
                    # 애니메이션 시작 요청인지 확인 (startAnimation 플래그)
                    if data.get('startAnimation'):
                        # startAnimation=True일 때만 얼굴 감지 수행
                        faces = await detect_faces_yolo(frame)

                        # 얼굴이 감지되지 않은 경우 오류 메시지 전송
                        if len(faces) == 0:
                            # print("[AnimationService] 얼굴이 감지되지 않음 - 오류 메시지 전송")
                            await websocket.send_json({
                                'type': 'error',
                                'message': '❌ 감지된 얼굴이 없습니다.'
                            })
                            # 중요: 애니메이션 실행 플래그 해제
                            self.running_animations[client_id] = False
                            self.active_animations[client_id] = False # 활성 상태도 해제
                            return  # 이후 애니메이션 실행하지 않고 종료
                        
                        mode = data['mode']
                        if mode in ANIMATION_MODULES:
                            animation_func = ANIMATION_MODULES[mode]
                            
                            self.active_animations[client_id] = True
                            
                            # print(f"[AnimationService] {mode} 애니메이션 함수 실행")
                            
                            # 애니메이션 실행 시 중지 함수 전달
                            # 클로저를 사용해 현재 클라이언트 ID 캡처
                            def is_running():
                                return self.running_animations.get(client_id, False)
                            
                            # 비동기 태스크로 애니메이션 함수 실행
                            import asyncio
                            animation_task = asyncio.create_task(
                                animation_func(frame, faces, websocket, data['frame'], is_running, self, client_id)
                            )
                            
                            # 애니메이션 완료 후 메시지 전송 처리 (비동기)
                            async def handle_animation_completion():
                                try:
                                    await animation_task
                                    # 중요: 룰렛 모드에서는 클라이언트가 완료 신호를 보내므로 여기서 완료 메시지를 보내지 않음
                                    if is_running() and mode != 'roulette':  # 룰렛 예외 처리 추가
                                        # print(f"[AnimationService] {mode} 애니메이션 완료 메시지 전송")
                                        await websocket.send_json({
                                            'type': 'animation_complete',
                                            'mode': mode
                                        })
                                        # 완료 시 active_animations 해제는 여기서 하는 것이 더 안전할 수 있음
                                        # 하지만 is_running() 체크로 이미 제어됨
                                except Exception as e:
                                    print(f"[AnimationService] 애니메이션 완료 처리 중 오류: {str(e)}")
                                finally:
                                     # 애니메이션 태스크 완료 시 active_animations 상태 업데이트
                                     if client_id in self.active_animations:
                                          self.active_animations[client_id] = False
                            
                            # 완료 처리 태스크 시작
                            asyncio.create_task(handle_animation_completion())
                            
                            # 이 부분이 중요: 함수가 여기서 반환되므로 다음 WebSocket 메시지를 처리할 수 있음
                            return
                        else:
                            # startAnimation이 false인 경우에는 얼굴 감지만 수행하고 에러 메시지는 보내지 않음
                            pass
                else:
                    # 프레임 데이터가 없는 경우 에러 메시지 전송
                    print("[AnimationService] 프레임 데이터 누락")
                    await websocket.send_json({
                        'type': 'error',
                        'message': "프레임 데이터가 필요합니다."
                    })
            except Exception as e:
                # 에러 발생 시 클라이언트에 알림
                print(f"[AnimationService] 오류 발생: {str(e)}")
                await websocket.send_json({
                    'type': 'error',
                    'message': f"처리 중 오류 발생: {str(e)}"
                })
                # 애니메이션 실행 플래그 해제
                self.running_animations[client_id] = False
                # 에러 발생 시 active_animations 상태도 확실히 해제
                if client_id in self.active_animations:
                    self.active_animations[client_id] = False
                # raise # 디버깅 시 주석 해제

    def _decode_frame(self, frame_data: str) -> np.ndarray:
        try:
            nparr = np.frombuffer(base64.b64decode(frame_data), np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"프레임 디코딩 오류: {e}")
            raise

    async def _send_faces(self, websocket: WebSocket, faces):
        await websocket.send_json({
            'type': 'faces',
            'faces': faces.tolist() if faces is not None else []
        })
