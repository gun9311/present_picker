from abc import ABC, abstractmethod
from fastapi import WebSocket
import numpy as np
import cv2
import base64

class BaseAnimation(ABC):
    async def send_frame(self, websocket: WebSocket, frame: np.ndarray):
        _, buffer = cv2.imencode('.jpg', frame)
        base64_frame = base64.b64encode(buffer).decode('utf-8')
        await websocket.send_json({
            'type': 'animation_frame',
            'frame': base64_frame
        })

    async def send_sound(self, websocket: WebSocket, sound_name: str, options: dict = None):
        await websocket.send_json({
            'type': 'play_sound',
            'sound': sound_name,
            'options': options
        })

    async def send_text(self, websocket: WebSocket, text: str, position: dict, style: dict):
        await websocket.send_json({
            'type': 'show_text',
            'text': text,
            'position': position,
            'style': style
        })

    @abstractmethod
    async def animate(self, frame: np.ndarray, faces: np.ndarray, websocket: WebSocket):
        pass
