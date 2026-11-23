import json
import logging
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections for realtime job updates."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}
        self.user_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, job_id: str | None = None):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

        if job_id:
            key = f"job:{job_id}"
            if key not in self.active:
                self.active[key] = []
            self.active[key].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str, job_id: str | None = None):
        if user_id in self.user_connections:
            self.user_connections[user_id] = [
                ws for ws in self.user_connections[user_id] if ws != websocket
            ]
        if job_id:
            key = f"job:{job_id}"
            if key in self.active:
                self.active[key] = [ws for ws in self.active[key] if ws != websocket]

    async def broadcast_job(self, job_id: UUID, payload: dict):
        key = f"job:{job_id}"
        message = json.dumps(payload, default=str)
        
        # Get connections for this job
        connections = self.active.get(key, [])
        if not connections:
            # If no direct listeners, the global user connections will still get it
            pass

        # Send to job-specific listeners
        for ws in list(connections):
            try:
                await ws.send_text(message)
            except Exception:
                if ws in connections:
                    connections.remove(ws)

        # Also broadcast to all user connections listening globally
        for user_id, user_ws_list in self.user_connections.items():
            for ws in list(user_ws_list):
                try:
                    await ws.send_text(message)
                except Exception:
                    if ws in user_ws_list:
                        user_ws_list.remove(ws)


ws_manager = ConnectionManager()
