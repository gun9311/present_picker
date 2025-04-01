import random
import asyncio  # time 대신 asyncio 사용

async def apply_slot_machine_effect(frame, faces, websocket, original_frame=None, is_running=lambda: True):
    """ 슬롯머신 효과 적용 - 좌표 기반으로 변경 """
    
    if faces is None or len(faces) == 0:
        print("❌ 감지된 얼굴이 없습니다. 슬롯머신 실행 불가")
        return frame, None
    
    height, width, _ = frame.shape
    
    # 슬롯머신 초기화 메시지 - 슬롯 위치 정보 제거
    await websocket.send_json({
        'type': 'init_slot_machine',
        'frame': original_frame  # 원본 프레임 데이터만 전송
    })
    
    # 슬롯머신 회전 사운드 재생 요청
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'slot_machine/slot_spin',
        'options': {
            'loop': True
        }
    })
    
    # NumPy int32를 Python int로 변환
    face_coords = []
    for face in faces:
        x, y, w, h = int(face[0]), int(face[1]), int(face[2]), int(face[3])
        face_coords.append([x, y, w, h])  # 리스트 사용
    
    # 애니메이션 시작 알림
    await websocket.send_json({
        'type': 'animation_start',
        'mode': 'slot_machine'
    })
    
    # 15단계의 슬롯머신 회전 애니메이션
    for i in range(15):
        if not is_running():
            return frame, None
            
        # 무작위로 3개의 얼굴 선택
        selected_indices = random.choices(range(len(face_coords)), k=3)
        
        # 선택된 얼굴 좌표 전송
        await websocket.send_json({
            'type': 'animation_step',
            'step': i,
            'faces': [face_coords[idx] for idx in selected_indices]
        })

        # 속도 조절 (점점 느려짐)
        await asyncio.sleep(0.1 + (i * 0.02))
    
    # 슬롯머신 회전 사운드 중지 - 15번 회전 후에 중지
    await websocket.send_json({
        'type': 'stop_sound',
        'sound': 'slot_machine/slot_spin'
    })
    
    # 최종 당첨자 선택
    winner_idx = random.randrange(len(face_coords))
    selected = face_coords[winner_idx]
    
    # 최종 결과 전송
    await websocket.send_json({
        'type': 'animation_result',
        'face': selected
    })
    
    # 순차적으로 슬롯 표시 (3개의 슬롯 모두 동일한 얼굴)
    for slot_idx in range(3):
        # 각 슬롯이 멈출 때마다 멈춤 효과음 재생
        await websocket.send_json({
            'type': 'play_sound',
            'sound': 'slot_machine/slot_stop'
        })
        
        await websocket.send_json({
            'type': 'show_slot',
            'slot_idx': slot_idx,
            'face': selected
        })
        await asyncio.sleep(1)
    
    # 승리 효과음 재생 요청
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'slot_machine/winner'
    })
    
    # 텍스트 오버레이 요청
    await websocket.send_json({
        'type': 'show_text',
        'text': '🎉 럭키 777',
        'position': {'x': 50, 'y': int(height - 50)},  # int로 변환
        'style': {
            'fontSize': 30,
            'color': '#00ff00'
        }
    })
    
    # 선택 완료 메시지 전송
    await websocket.send_json({
        'type': 'selection_complete'
    })
    
    return frame  # 원본 얼굴 좌표 반환