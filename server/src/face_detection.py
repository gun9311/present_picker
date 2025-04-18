##face_detection.py

import os
import cv2
import numpy as np
from ultralytics import YOLO
import torch
import sys
import asyncio

# 프로젝트 루트 디렉토리 경로 설정
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    # server/src에서 두 단계 위로 올라가 프로젝트 루트로 이동
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # server/

MODEL_PATH = os.path.join(BASE_DIR, "assets", "models", "yolov8n-face.pt")

# YOLO 모델 로드
face_model = YOLO(MODEL_PATH)

# CPU 바운드 작업을 처리할 동기 함수
def _run_yolo_prediction(frame_copy):
    """실제 YOLO 예측 및 후처리를 수행하는 동기 함수"""
    height, width = frame_copy.shape[:2]

    # 해상도에 따른 축소 비율 조정
    if width >= 1920:  # 1080p
        scale_factor = 0.4
    else:  # 720p
        scale_factor = 0.5

    small_frame = cv2.resize(frame_copy, (int(width * scale_factor),
                                          int(height * scale_factor)))

    # 모델 예측 실행
    results = face_model.predict(
        small_frame,
        verbose=False,
        device="cuda" if torch.cuda.is_available() else "cpu",
        conf=0.5,
        imgsz=max(small_frame.shape[:2])
    )

    faces = []
    if isinstance(results, list):
        for r in results:
            if hasattr(r, "boxes"):
                for box in r.boxes:
                    x, y, x2, y2 = box.xyxy[0].tolist()
                    conf = box.conf[0].item()
                    if conf > 0.5:
                        # 원본 크기로 좌표 복원 시 scale_factor 역으로 적용
                        x, y, x2, y2 = int(x / scale_factor), int(y / scale_factor), int(x2 / scale_factor), int(y2 / scale_factor)
                        faces.append((x, y, x2 - x, y2 - y)) # (x, y, w, h) 형식으로 저장

    return np.array(faces)


# 기존 detect_faces_yolo 함수를 async 함수로 변경
async def detect_faces_yolo(frame):
    """해상도에 따라 적응적으로 조정되는 얼굴 감지 (비동기 실행)"""
    # 프레임 데이터가 스레드간 공유되지 않도록 복사본 전달 고려
    # 여기서는 OpenCV 객체 특성상 복사가 필요할 수 있으나,
    # NumPy 배열은 GIL 때문에 동시 수정 문제는 덜하지만 안전하게 복사본 사용 가능
    # 다만, 성능 영향 고려 필요. 여기서는 일단 직접 전달
    faces = await asyncio.to_thread(_run_yolo_prediction, frame.copy()) # frame.copy() 사용 고려
    return faces


# detect_people 함수도 async로 변경 필요 (detect_faces_yolo를 호출하므로)
async def detect_people(frame):
    """ 얼굴, 상반신, 전신 감지 (비동기) """
    faces = await detect_faces_yolo(frame)  # await 추가
    return faces


def enhance_contrast(frame):
    # 이 함수는 CPU 바운드 작업이지만, YOLO만큼 무겁지 않다면 비동기 처리 안해도 될 수 있음
    # 필요하다면 위와 유사하게 async 처리 가능
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)

    lab = cv2.merge((l, a, b))
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
