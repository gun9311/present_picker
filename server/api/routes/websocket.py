from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.animation_service import AnimationService

router = APIRouter()
animation_service = AnimationService()

@router.websocket("/ws/animation")
async def animation_websocket(websocket: WebSocket):
    client_id = id(websocket)
    await websocket.accept()
    
    # 연결 성공 시 서비스에 웹소켓 등록
    animation_service.register_client(client_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            await animation_service.handle_animation(websocket, data)
    except WebSocketDisconnect:
        # 클라이언트가 연결을 종료한 경우
        print(f"클라이언트 연결 종료: {client_id}")
    except Exception as e:
        # 기타 예외 발생 시
        print(f"WebSocket 에러: {str(e)}")
    finally:
        # 어떤 경우든 클라이언트 연결 종료 시 정리 작업 수행
        animation_service.cleanup_resources(client_id)
        # 중요: 이미 닫힌 연결을 다시 닫으려고 시도하지 않도록 수정
        # 직접 close()를 호출하지 않고 정리 작업만 수행
