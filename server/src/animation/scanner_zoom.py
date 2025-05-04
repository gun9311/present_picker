import asyncio
import random
from ..face_detection import detect_faces_yolo
import time # time 모듈 임포트 (asyncio.get_event_loop().time() 대체 가능)

async def apply_scanner_zoom_effect(frame, initial_faces, websocket, original_frame=None, is_running=lambda: True, animation_service=None, client_id=None):
    """사우론의 눈 효과 적용 - 웹소켓 통신 방식"""
    
    # --- 초기 얼굴 유효성 검사 ---
    # 초기 프레임에도 얼굴이 없으면 바로 종료
    if initial_faces is None or len(initial_faces) == 0:
        print("❌ 초기 프레임에 감지된 얼굴이 없습니다. 사우론의 눈 실행 불가")
        await websocket.send_json({'type': 'error', 'message': '시작 시점에 얼굴 감지 불가'})
        return frame, None
    # --- 검사 끝 ---

    height, width, _ = frame.shape
    
    # 애니메이션 시작 알림
    await websocket.send_json({
        'type': 'animation_start',
        'mode': 'scanner'
    })
    
    # 1단계: 시작 효과음
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'scanner_zoom/scanner_start'
    })
    
    # 2단계: 사우론 눈 오버레이 표시
    await websocket.send_json({
        'type': 'show_overlay',
        'name': 'eye_of_sauron',
        'duration': 1.0
    })
    
    # 3단계: 가짜 타겟팅 - 스캔 사운드 재생
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'scanner_zoom/scan_sweep',
        'options': {
            'loop': True
        }
    })
    
    # 가짜 타겟팅 포인트 생성
    fake_target_points = []
    for _ in range(10):
        fake_x = random.randint(width // 10, width - width // 10)
        fake_y = random.randint(height // 10, height - height // 10)
        fake_target_points.append((fake_x, fake_y))
    
    # --- 가짜 타겟팅 최적화: 루프 전 YOLO 호출 제거 ---
    # 아래 블록 제거
    # faces_for_targeting = initial_faces
    # if animation_service and client_id and client_id in animation_service.last_frames:
    #     latest_frame_before_fake = animation_service.last_frames[client_id]
    #     detected_faces_before_fake = await detect_faces_yolo(latest_frame_before_fake)
    #     if len(detected_faces_before_fake) > 0:
    #         faces_for_targeting = detected_faces_before_fake
    # --- 제거 끝 ---

    # 가짜 타겟팅 효과 (YOLO 호출 없음)
    for i, (fake_x, fake_y) in enumerate(fake_target_points):
        if not is_running(): return frame, None
        await websocket.send_json({
            'type': 'scanner_target',
            'target_point': [fake_x, fake_y],
            'progress': (i+1)*100//len(fake_target_points),
            'stage': 'fake_targeting'
        })
        await asyncio.sleep(0.2)

    # 가짜 타겟팅 이후에 sweep 사운드 중지
    await websocket.send_json({
        'type': 'stop_sound',
        'sound': 'scanner_zoom/scan_sweep'
    })
    
    # 4단계: 타겟 발견 전환
    await websocket.send_json({
        'type': 'scanner_transition',
        'text': "운명의 제물이 발견되었습니다!"
    })
    
    await asyncio.sleep(0.5)
    
    # 5단계: 얼굴 타겟팅 (12회로 변경)
    # --- valid_faces 초기화 수정 ---
    # 초기 얼굴 정보로 시작 (initial_faces 사용)
    valid_faces = initial_faces.copy()
    # --- 수정 끝 ---
    last_yolo_call_time = 0
    yolo_call_interval = 0.7 # 또는 다른 원하는 간격으로 설정

    selected_idx_at_end = -1

    for i in range(12):
        if not is_running(): return frame, None

        # processing 사운드를 타겟팅 과정 중 10번 정도 실행
        if i % 1 == 0 and i < 12:  # 0부터 11까지 12번 실행
            await websocket.send_json({
                'type': 'play_sound',
                'sound': 'scanner_zoom/processing'
            })
        
        current_loop_time = asyncio.get_event_loop().time()

        if current_loop_time - last_yolo_call_time >= yolo_call_interval:
            # 실시간 프레임 가져오기 및 YOLO 호출
            current_frame = None
            if animation_service and client_id and client_id in animation_service.last_frames:
                current_frame = animation_service.last_frames[client_id]
            else:
                print("⚠️ 최신 프레임 가져오기 실패 (얼굴 타겟팅)")
                current_frame = frame # fallback

            if current_frame is not None:
                current_faces = await detect_faces_yolo(current_frame)
                if len(current_faces) > 0:
                    # --- valid_faces 업데이트: 여기서 최신 정보로 덮어씀 ---
                    valid_faces = current_faces
                    # --- 업데이트 끝 ---
                # else: 얼굴 없으면 이전 valid_faces 유지 (초기값 또는 이전 호출 결과)
                last_yolo_call_time = current_loop_time

        if len(valid_faces) == 0:
            await asyncio.sleep(0.1)
            continue

        # --- 현재 타겟 얼굴 결정 (단순히 i % len(valid_faces)) ---
        current_idx = i % len(valid_faces)
        selected_face = valid_faces[current_idx].tolist()
        # --- 결정 끝 ---

        await websocket.send_json({
            'type': 'scanner_face_target',
            'face': selected_face,
            'is_final': False, # 이 플래그는 더 이상 의미 없음 (항상 False 또는 제거)
            'stage': 'face_targeting'
        })

        # --- 마지막 반복(i=11)에서 최종 인덱스 저장 ---
        if i == 11:
            selected_idx_at_end = current_idx
        # --- 저장 끝 ---

        # 단계별 지연 시간 설정 (루프 횟수 변경에 따라 조정 가능)
        if i < 4: delay = 0.2
        elif i < 7: delay = 0.3
        elif i < 10: delay = 0.5
        else: delay = 0.7 # 마지막 두 번은 더 느리게
        await asyncio.sleep(delay)

    # 6단계: 첫 번째 줌
    # 최종 인덱스가 유효한지 확인 및 사용
    if selected_idx_at_end == -1 or selected_idx_at_end >= len(valid_faces):
        if len(valid_faces) > 0:
            selected_idx_at_end = 0
        else:
            await websocket.send_json({'type': 'error', 'message': '최종 선정 시점에 얼굴 없음'})
            return frame, None

    selected_face = valid_faces[selected_idx_at_end].tolist()
    
    # 얼굴 크기에 따른 줌 비율 계산 (화면 너비 대비 비율 방식)
    x, y, w, h = selected_face
    face_ratio = w / width  # 화면 너비 대비 얼굴 비율
    
    # 첫번째 줌 - 화면 너비의 7% 정도 차지하도록
    middle_target_ratio = 0.07
    zoom_scale = middle_target_ratio / max(face_ratio, 0.01)  # 너무 작은 비율 방지
    zoom_scale = max(1.0, min(3.0, zoom_scale))  # 줌 한도 설정
    
    # 줌 효과 전송
    for step in range(1, 5):
        if not is_running():
            return frame, None
            
        # 실시간 프레임 업데이트
        if animation_service and client_id and client_id in animation_service.last_frames:
            frame = animation_service.last_frames[client_id]
            
        current_zoom = 1.0 + (zoom_scale - 1.0) * (step / 4)
        
        await websocket.send_json({
            'type': 'scanner_zoom',
            'face': selected_face,
            'zoom_scale': current_zoom,
            'stage': 'first_zoom',
            'progress': step * 25
        })
        
        await asyncio.sleep(0.2)
    
    # 6.5단계: 줌 영역 내 추가 분석 단계 추가
    # await websocket.send_json({
    #     'type': 'scanner_transition',
    #     'text': "의지력 측정 완료: 최종 심판을 시작합니다"
    # })
    
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'scanner_zoom/processing'
    })
    
    # 카메라 패닝 효과 - 더 예측 불가능한 패턴으로 움직임
    x, y, w, h = selected_face
    # 무작위성을 높인 패닝 경로
    pan_offsets = [
        (-0.15, -0.15),     # 좌상
        (0.2, -0.1),        # 우상 (갑자기 반대쪽으로 이동)
        (-0.05, -0.25),     # 상단 약간 좌측
        (0.15, 0.2),        # 우하 (대각선 이동)
        (-0.22, 0.05),      # 좌측 약간 아래
        (0.25, -0.15),      # 우상 (다시 반대쪽으로)
        (-0.1, 0.18),       # 좌하
        (0, -0.22),         # 상단 중앙
        (0.18, 0.12),       # 우측 약간 아래
        (-0.23, -0.08),     # 좌상 약간 아래
        (0.1, 0.25),        # 하단 약간 우측
        (-0.15, 0.2),       # 좌하
        (0.22, -0.12),      # 우상 약간 아래
    ]
    
    # 얼굴 중심 좌표 계산
    face_center_x = x + w / 2
    face_center_y = y + h / 2
    
    # 최종 줌 위치 계산 - 정확히 최종 줌에서 사용하는 것과 동일하게
    final_translate_x = ((width / 2 - face_center_x) / (width / 2)) * 0.5
    final_translate_y = ((height / 2 - face_center_y) / (height / 2)) * 0.5
    
    # 마지막 패닝 위치는 최종 줌과 정확히 일치하도록
    pan_offsets.append((final_translate_x, final_translate_y))
    
    # 카메라 패닝 효과
    for i, (offset_x, offset_y) in enumerate(pan_offsets):
        if not is_running():
            return frame, None
            
        # 실시간 프레임 업데이트
        if animation_service and client_id and client_id in animation_service.last_frames:
            frame = animation_service.last_frames[client_id]
        
        # 패닝 중간에 target_locked 사운드 추가 (약 3번 정도)
        if i % 4 == 0 and i > 0:  # 4, 8, 12번째 패닝 시점에 재생
            await websocket.send_json({
                'type': 'play_sound',
                'sound': 'scanner_zoom/target_locked'
            })
        
        await websocket.send_json({
            'type': 'scanner_camera_pan',
            'face': selected_face,
            'offset_x': offset_x,
            'offset_y': offset_y,
            'stage': 'camera_panning',
            'progress': (i+1)*100//len(pan_offsets)
        })
        
        # 패닝 지연 시간 - 더 무작위적인 느낌을 주기 위해 약간의 변동성 추가
        delay = 0.4 + (random.random() * 0.2)  # 0.4 ~ 0.6초 사이의 랜덤한 시간
        
        # 마지막 위치로 이동할 때는 더 천천히 이동
        if i == len(pan_offsets) - 1:
            delay = 0.75  # 마지막 위치로 이동할 때는 더 긴 지연 시간
        
        await asyncio.sleep(delay)
    
    # 추가 분석 메시지
    # await websocket.send_json({
    #     'type': 'scanner_transition',
    #     'text': "의지력 측정 완료: 최종 심판을 시작합니다"
    # })
    
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'scanner_zoom/beep'
    })
    
    await asyncio.sleep(0.5)
    
    # 7단계: 최종 줌
    # 커튼과 동일한 줌 비율 계산 (화면 너비의 27% 차지)
    final_target_ratio = 0.27
    final_zoom_scale = final_target_ratio / max(face_ratio, 0.01)
    final_zoom_scale = max(1.0, min(5.0, final_zoom_scale))  # 줌 한도 설정
    
    for step in range(1, 6):
        if not is_running():
            return frame, None
            
        # 실시간 프레임 업데이트
        if animation_service and client_id and client_id in animation_service.last_frames:
            frame = animation_service.last_frames[client_id]
            
        current_zoom = zoom_scale + (final_zoom_scale - zoom_scale) * (step / 5)
        
        await websocket.send_json({
            'type': 'scanner_zoom',
            'face': selected_face,
            'zoom_scale': current_zoom,
            'stage': 'final_zoom',
            'progress': step * 20,
            'show_border': step == 5
        })
        
        await asyncio.sleep(0.2)
    
    # 스캔 사운드 중지
    await websocket.send_json({
        'type': 'stop_sound',
        'sound': 'scanner_zoom/scan_sweep'
    })
    
    # 8단계: 최종 결과
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'scanner_zoom/gollum'
    })
    
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'scanner_zoom/whistle'
    })
    
    await websocket.send_json({
        'type': 'scanner_result',
        'face': selected_face,
        'message': "한 명의 반지의 제왕만이 존재할 뿐..."
    })
    
    # 선택 완료 메시지 전송
    await websocket.send_json({
        'type': 'selection_complete',
        'mode': 'scanner'
    })
    
    return frame, selected_face
