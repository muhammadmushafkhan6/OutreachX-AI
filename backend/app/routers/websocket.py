import logging
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.websocket.manager import ws_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_global(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_access_token(token)
    if not user_id:
        logger.warning("WebSocket connection rejected: invalid token")
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)
    logger.info("WebSocket connected: user=%s", user_id)
    try:
        while True:
            # We don't expect messages from client, but we must keep connection open
            # receive_text() blocks until client sends something or disconnects
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: user=%s", user_id)
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WebSocket error: user=%s, error=%s", user_id, e, exc_info=True)
        ws_manager.disconnect(websocket, user_id)


@router.websocket("/ws/jobs/{job_id}")
async def websocket_job(
    websocket: WebSocket,
    job_id: UUID,
    token: str = Query(...),
):
    user_id = decode_access_token(token)
    if not user_id:
        logger.warning("WebSocket job connection rejected: invalid token")
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id, str(job_id))
    logger.info("WebSocket job connected: user=%s, job=%s", user_id, job_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info("WebSocket job disconnected: user=%s, job=%s", user_id, job_id)
        ws_manager.disconnect(websocket, user_id, str(job_id))
    except Exception as e:
        logger.error("WebSocket job error: user=%s, job=%s, error=%s", user_id, job_id, e, exc_info=True)
        ws_manager.disconnect(websocket, user_id, str(job_id))
