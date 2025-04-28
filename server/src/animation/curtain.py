import random
import asyncio
from src.face_detection import detect_faces_yolo


async def apply_curtain_effect(frame, faces, websocket, original_frame=None, is_running=lambda: True, animation_service=None, client_id=None):
    """커튼콜 애니메이션 실행하며 발표자 선정 (최신 프레임 활용)"""
    
    if faces is None or len(faces) == 0:
        print("❌ 감지된 얼굴이 없습니다. 커튼콜 실행 불가")
        return frame, None
    
    height, width, _ = frame.shape
    
    # 애니메이션 시작 알림
    await websocket.send_json({
        'type': 'animation_start',
        'mode': 'curtain'
    })
    
    # 인트로 사운드 재생
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'curtain/tada'
    })
    
    # 인트로 단계: 5초 카운트다운 알림
    await websocket.send_json({
        'type': 'curtain_intro',
        'duration': 5,
        'text': "🎭 커튼콜 타임! 🎭"
    })
    
    # 5초 대기
    for i in range(5, 0, -1):
        if not is_running():
            return frame, None
            
        await websocket.send_json({
            'type': 'curtain_countdown',
            'count': i
        })
        
        await asyncio.sleep(1)
    
    # 인트로 종료 메시지 추가
    await websocket.send_json({
        'type': 'curtain_intro_end'
    })
    
    # 참가자 선택 루프 (3-5회)
    num_selections = max(3, min(5, len(faces)))
    selected_face = None
    
    for selection in range(num_selections):
        if not is_running():
            return frame, None
        
        # 1. 커튼 닫기 애니메이션
        await websocket.send_json({
            'type': 'play_sound',
            'sound': 'curtain/curtain_close'
        })
        
        # 단계별 커튼 닫기 (12단계)
        steps = 12
        for i in range(steps, -1, -1):
            if not is_running():
                return frame, None
                
            curtain_pos = i / float(steps)  # 1.0(완전히 열림) -> 0.0(완전히 닫힘)
            
            await websocket.send_json({
                'type': 'curtain_update',
                'position': curtain_pos,
                'state': 'closing'
            })
            
            await asyncio.sleep(0.025)  # 부드러운 애니메이션을 위한 짧은 딜레이
        
        # 커튼이 완전히 닫힌 후 잠시 대기
        await asyncio.sleep(0.3)
        
        # 2. 참가자 선택 - 최신 프레임에서 얼굴 감지
        current_frame = None
        current_faces = []
        
        # animation_service가 전달되었고 client_id가 있으면 최신 프레임 사용
        if animation_service and client_id and client_id in animation_service.last_frames:
            current_frame = animation_service.last_frames[client_id]
            # 최신 프레임에서 얼굴 감지 (비동기 호출로 변경)
            current_faces = await detect_faces_yolo(current_frame) # await 추가
            # print(f"최신 프레임에서 얼굴 감지 결과: {current_faces}")
        
        # 최신 얼굴이 감지되었으면 그것을 사용, 아니면 초기 얼굴 사용
        if len(current_faces) > 0:
            print("최신 있음")
            selection_faces = current_faces
        else:
            print("최신 없음")
            selection_faces = faces
        
        # 랜덤 선택
        selected_idx = random.randrange(len(selection_faces))
        selected_face = selection_faces[selected_idx].tolist()
        
         # 얼굴 크기에 따른 세밀한 확대율 계산 (비율 기반)
        face_width = selected_face[2]
        face_ratio = face_width / width  # 화면 너비 대비 얼굴 비율
        target_ratio = 0.27

        zoom_scale = target_ratio / max(face_ratio, 0.01)  # 너무 작은 비율 방지
        zoom_scale = max(1.0, min(5.0, zoom_scale))  # 줌 한도 설정
        
        # 3. 선택된 얼굴 정보 전송 (줌 파라미터 추가)
        await websocket.send_json({
            'type': 'curtain_selection',
            'face': selected_face,
            'zoom_params': {
                'scale': zoom_scale,
                'duration': 0.8
            }
        })
        
        # 3. 커튼 열기 + 스포트라이트 효과
        await websocket.send_json({
            'type': 'play_sound',
            'sound': 'curtain/curtain_open'
        })
        
        # 단계별 커튼 열기 (12단계)
        for i in range(steps + 1):
            if not is_running():
                return frame, None
                
            curtain_pos = i / float(steps)  # 0.0(완전히 닫힘) -> 1.0(완전히 열림)
            
            await websocket.send_json({
                'type': 'curtain_update',
                'position': curtain_pos,
                'state': 'opening'
            })
            
            await asyncio.sleep(0.025)  # 부드러운 애니메이션을 위한 짧은 딜레이
        
        # 4. 선택된 인물 보여주기 (3초)
        await asyncio.sleep(3.0)
        
    # 최종 결과 - 타다 사운드 재생
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'curtain/tada'
    })
    
    # 최종 결과 메시지 전송 (줌 파라미터 추가)
    await websocket.send_json({
        'type': 'curtain_result',
        'face': selected_face,
        'text': "🎭 오늘의 주인공! 🎭",
        'zoom_params': {
            'scale': zoom_scale,
            'duration': 0.8
        }
    })
    
    # 선택 완료 메시지 전송
    await websocket.send_json({
        'type': 'selection_complete',
        'mode': 'curtain'
    })
    
    return frame, selected_face
