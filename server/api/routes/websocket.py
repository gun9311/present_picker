from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.animation_service import AnimationService
import logging # 로깅 추가

router = APIRouter()
animation_service = AnimationService()

# 최대 동시 접속자 수 정의
MAX_CONNECTIONS = 8

# 로거 설정 (선택 사항, 디버깅에 유용)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.websocket("/ws/animation")
async def animation_websocket(websocket: WebSocket):
    client_id = id(websocket)
    await websocket.accept()

    # 현재 연결 수 확인
    current_connections = len(animation_service.active_clients)
    logger.info(f"새 연결 시도: {client_id}, 현재 연결 수: {current_connections}")

    # 제한 확인
    if current_connections >= MAX_CONNECTIONS:
        logger.warning(f"연결 제한 도달 ({MAX_CONNECTIONS}). 클라이언트 {client_id} 연결 거부.")
        await websocket.send_json({
            'type': 'error',
            'message': '현재 서버가 혼잡하여 접속할 수 없습니다. 잠시 후 다시 시도해주세요.'
        })
        await websocket.close()
        return # 함수 종료

    # 연결 수 제한 내에 있으면 클라이언트 등록
    logger.info(f"클라이언트 {client_id} 연결 수락 및 등록.")
    animation_service.register_client(client_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            # 제한 초과 시 이미 연결된 클라이언트의 요청도 막을 수 있음 (선택 사항)
            # if len(animation_service.active_clients) > MAX_CONNECTIONS:
            #    await websocket.send_json({'type': 'error', 'message': '서버 혼잡으로 요청을 처리할 수 없습니다.'})
            #    continue
            await animation_service.handle_animation(websocket, data)
    except WebSocketDisconnect:
        # 클라이언트가 연결을 종료한 경우
        logger.info(f"클라이언트 연결 종료: {client_id}")
    except Exception as e:
        # 기타 예외 발생 시
        logger.error(f"WebSocket 에러 (클라이언트 {client_id}): {str(e)}", exc_info=True) # 에러 로그 강화
    finally:
        # 어떤 경우든 클라이언트 연결 종료 시 정리 작업 수행
        logger.info(f"클라이언트 {client_id} 리소스 정리 시작.")
        animation_service.cleanup_resources(client_id)
        logger.info(f"클라이언트 {client_id} 리소스 정리 완료. 현재 연결 수: {len(animation_service.active_clients)}")
        # 중요: 이미 닫힌 연결을 다시 닫으려고 시도하지 않도록 수정
        # 직접 close()를 호출하지 않고 정리 작업만 수행
