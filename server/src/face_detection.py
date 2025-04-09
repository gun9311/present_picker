##face_detection.py

import os
import cv2
import numpy as np
from ultralytics import YOLO
import torch
import sys

# 프로젝트 루트 디렉토리 경로 설정
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    # server/src에서 두 단계 위로 올라가 프로젝트 루트로 이동
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # server/

MODEL_PATH = os.path.join(BASE_DIR, "assets", "models", "yolov8n-face.pt")

# YOLO 모델 로드
face_model = YOLO(MODEL_PATH)  

def detect_people(frame):
    """ 얼굴, 상반신, 전신 감지 """

    faces = detect_faces_yolo(frame)  # YOLO 얼굴 감지
    return faces

def detect_faces_yolo(frame):
    """해상도에 따라 적응적으로 조정되는 얼굴 감지"""
    height, width = frame.shape[:2]
    
    # 해상도에 따른 축소 비율 조정
    if width >= 1920:  # 1080p
        scale_factor = 0.4  # 더 큰 축소율
    else:  # 720p
        scale_factor = 0.5  # 기존 축소율
        
    # 최소 감지 크기도 해상도에 따라 조정
    min_face_size = int(width * 0.05)  # 화면 너비의 5%
    
    small_frame = cv2.resize(frame, (int(width * scale_factor), 
                                   int(height * scale_factor)))
    
    results = face_model.predict(
        small_frame, 
        verbose=False,
        device="cuda" if torch.cuda.is_available() else "cpu",
        conf=0.5,  # 신뢰도 임계값
        imgsz=max(small_frame.shape[:2])  # 입력 크기 최적화
    )

    faces = []

    if isinstance(results, list):
        for r in results:
            if hasattr(r, "boxes"):
                for box in r.boxes:
                    x, y, x2, y2 = box.xyxy[0].tolist()
                    conf = box.conf[0].item()
                    if conf > 0.5:
                        # 좌표를 원본 크기로 변환
                        x, y, x2, y2 = int(x * 2), int(y * 2), int(x2 * 2), int(y2 * 2)
                        faces.append((x, y, x2 - x, y2 - y))

    return np.array(faces)

def enhance_contrast(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    
    lab = cv2.merge((l, a, b))
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
