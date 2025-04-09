import random
import asyncio

async def apply_roulette_effect(frame, faces, websocket, original_frame=None, is_running=lambda: True, animation_service=None, client_id=None):
    """ 룰렛 애니메이션 실행하며 발표자 선정 (WebSocket 통신 방식) """

    height, width = frame.shape[:2]
    
    # 애니메이션 시작 알림
    await websocket.send_json({
        'type': 'animation_start',
        'mode': 'roulette'
    })
    
    # 회전 관련 랜덤 값 설정 - 선형 감속 방식으로 변경
    initial_speed = random.uniform(10, 13)  # 초기 속도
    deceleration_constant = random.uniform(0.20, 0.30)  # 선형 감속 상수
    direction = random.choice([-1, 1])  # 회전 방향
    
    # 얼굴 ID 매핑
    face_ids = list(range(len(faces)))
    
    # 최대 7명만 선택
    num_faces = min(7, len(faces))
    selected_face_indices = random.sample(face_ids, num_faces)
    selected_faces = [faces[i] for i in selected_face_indices]
    
    # 클라이언트에서 애니메이션을 실행하기 위한 필요한 매개변수를 전송
    # 선형 감속 방식에 맞게 파라미터 변경
    await websocket.send_json({
        'type': 'init_roulette',
        'faces': [face.tolist() for face in selected_faces],
        'face_indices': selected_face_indices,
        'frame': original_frame,
        'animation_params': {
            'initial_speed': initial_speed * direction,  # 방향을 곱한 초기 속도
            'deceleration_constant': deceleration_constant,  # 선형 감속 상수
            'speed_threshold': 0.01,  # 이 속도 이하가 되면 멈추도록 설정
            'use_linear_deceleration': True  # 선형 감속 사용 여부 플래그
        }
    })
    
    return frame