import asyncio
import random
import numpy as np
import cv2
import dlib
from math import hypot, tanh
# YOLO 얼굴 감지 함수 임포트
from src.face_detection import detect_faces_yolo
import base64 # base64 인코딩을 위해 추가

# dlib 얼굴 랜드마크 감지기 초기화 (경로는 환경에 맞게 조정 필요)
try:
    predictor_path = "assets/models/shape_predictor_68_face_landmarks.dat"
    detector = dlib.get_frontal_face_detector()
    predictor = dlib.shape_predictor(predictor_path)
    dlib_available = True
except Exception as e:
    print(f"⚠️ Dlib 초기화 실패: {e}. 랜드마크 기반 기능이 제한됩니다.")
    dlib_available = False
    detector = None
    predictor = None

# 표정 점수 계산을 위한 클래스
class ExpressionDetector:
    def __init__(self):
        # EAR 계산을 위한 랜드마크 인덱스 정의
        self.L_EYE_START = 36
        self.L_EYE_END = 41
        self.R_EYE_START = 42
        self.R_EYE_END = 47
        # 윙크 및 기울기 관련 속성 제거

    # 함수 이름 변경 및 로직 수정: get_expression_change -> get_expression_score
    def get_expression_score(self, face_idx, landmarks, detection_mode):
        """표정 점수 계산 (지정된 모드 기준 절대 점수)"""
        if not dlib_available or landmarks is None:
            return 0.0 # dlib 사용 불가 또는 랜드마크 없으면 0점 반환

        current_score = 0.0
        if detection_mode == 'smile' or detection_mode == 'big_smile':
            current_score = self._measure_smile(landmarks)
        elif detection_mode == 'open_mouth':
            current_score = self._measure_mouth_openness(landmarks)
        elif detection_mode == 'surprise':
            current_score = self._measure_surprise(landmarks)
        elif detection_mode == 'ugly_face':
            current_score = self._measure_ugly_face(landmarks)
        # refreshing_wink 조건 분기 제거

        # 0~1 사이 값으로 정규화 (각 측정 함수의 반환값 범위 고려 필요)
        # 각 측정 함수에서 0~1 범위로 반환하도록 함
        current_score = min(1.0, max(0.0, current_score))

        return current_score

    # --- 표정 측정 함수들 (정규화 기준 변경 및 스케일링/가중치 재조정) ---
    def _calculate_iod(self, landmarks):
        """눈 사이 거리(Inter-Ocular Distance) 계산 (랜드마크 36, 45)"""
        if landmarks is None or len(landmarks) < 68: return 0.0
        eye_left = landmarks[36]
        eye_right = landmarks[45]
        dist = hypot(eye_right[0] - eye_left[0], eye_right[1] - eye_left[1])
        return dist if dist > 0 else 1.0 # 0 방지

    def _calculate_ear(self, landmarks, eye_start_idx, eye_end_idx):
        """눈 뜨기 비율 (Eye Aspect Ratio) 계산"""
        if landmarks is None or len(landmarks) < 68: return 0.0
        # 수직 거리 계산 (눈꺼풀 위아래 랜드마크 2쌍 사용)
        v1 = hypot(landmarks[eye_start_idx+1][0] - landmarks[eye_end_idx][0], landmarks[eye_start_idx+1][1] - landmarks[eye_end_idx][1])
        v2 = hypot(landmarks[eye_start_idx+2][0] - landmarks[eye_end_idx-1][0], landmarks[eye_start_idx+2][1] - landmarks[eye_end_idx-1][1])
        # 수평 거리 계산 (눈 양끝 랜드마크)
        h = hypot(landmarks[eye_start_idx][0] - landmarks[eye_start_idx+3][0], landmarks[eye_start_idx][1] - landmarks[eye_start_idx+3][1])
        if h == 0: return 0.0
        ear = (v1 + v2) / (2.0 * h)
        return ear

    def _measure_smile(self, landmarks):
        """미소 정도 측정 - IOD 정규화, 눈 감김 고려, 무표정 점수 개선"""
        if landmarks is None or len(landmarks) < 68: return 0.0
        iod = self._calculate_iod(landmarks)

        # 1. 입 특징 계산
        mouth_left = landmarks[48]; mouth_right = landmarks[54]; mouth_top = landmarks[51]
        mouth_width = hypot(mouth_right[0] - mouth_left[0], mouth_right[1] - mouth_left[1])
        corner_lift_raw = mouth_top[1] - (mouth_left[1] + mouth_right[1]) / 2
        normalized_width = mouth_width / iod
        normalized_corner_lift = corner_lift_raw / iod

        # 입 점수 스케일링 (튜닝 필요)
        mouth_score = (normalized_width * 0.6 + normalized_corner_lift * 0.4) * 1.3

        # 2. 눈 특징 계산 (눈 감김 정도) - EAR 사용
        left_ear = self._calculate_ear(landmarks, self.L_EYE_START, self.L_EYE_END)
        right_ear = self._calculate_ear(landmarks, self.R_EYE_START, self.R_EYE_END)
        avg_ear = (left_ear + right_ear) / 2.0

        # 눈 감김 점수 스케일링 (EAR 기반으로 변경, EAR이 작을수록 점수 높음)
        # (튜닝 필요) 평균 EAR 0.25 정도를 기준으로, 0.15 이하면 1점 가깝게
        eye_squint_score = max(0.0, min(1.0, (0.25 - avg_ear) * 10.0))

        # 3. 최종 점수 계산 (최종 스케일링 소폭 상향 조정)
        # 가중치: 입 70%, 눈 30% (유지)
        # (튜닝 필요)
        final_score = (mouth_score * 0.7 + eye_squint_score * 0.3) * 1.4

        return min(1.0, max(0.0, final_score)) # 0~1 범위 클램핑

    def _measure_mouth_openness(self, landmarks):
        """입 벌림 정도 측정 - IOD 정규화, tanh 함수 적용, 스케일링 추가 조정 (점수 소폭 상향)"""
        if landmarks is None or len(landmarks) < 68: return 0.0
        iod = self._calculate_iod(landmarks)

        # 입술 안쪽 랜드마크 사용 (61, 67 / 62, 66)
        inner_mouth_top = landmarks[62]
        inner_mouth_bottom = landmarks[66]
        mouth_height = hypot(inner_mouth_bottom[0] - inner_mouth_top[0], inner_mouth_bottom[1] - inner_mouth_top[1])

        # 정규화된 입 높이
        normalized_mouth_height = mouth_height / iod

        # tanh 함수 적용 (입력값 스케일링 미세 상향 조정)
        # (튜닝) 스케일링 팩터 증가: 2.8 -> 3.1
        score = tanh(normalized_mouth_height * 3.1) # 점수 올리기

        return min(1.0, max(0.0, score)) # 0~1 범위 클램핑

    def _measure_surprise(self, landmarks):
        """놀람 정도 측정 - IOD 정규화, 눈/눈썹 + 입 벌림 고려, 스케일링/가중치 미세 조정 (점수 소폭 상향)"""
        if landmarks is None or len(landmarks) < 68: return 0.0
        iod = self._calculate_iod(landmarks)

        # 1. 눈썹 & 눈 특징 계산
        # 눈썹-눈 거리 (눈썹 중앙과 눈동자 위쪽 랜드마크)
        left_brow_eye_dist = hypot(landmarks[19][0] - landmarks[37][0], landmarks[19][1] - landmarks[37][1]) # 19, 37
        right_brow_eye_dist = hypot(landmarks[24][0] - landmarks[43][0], landmarks[24][1] - landmarks[43][1]) # 24, 43
        # 눈 세로 크기 - EAR 활용
        left_ear = self._calculate_ear(landmarks, self.L_EYE_START, self.L_EYE_END)
        right_ear = self._calculate_ear(landmarks, self.R_EYE_START, self.R_EYE_END)

        avg_brow_dist = (left_brow_eye_dist + right_brow_eye_dist) / 2
        avg_ear = (left_ear + right_ear) / 2.0

        # 정규화 및 점수화 (스케일링 인자 유지, EAR 기준 조정)
        # (튜닝 필요) 눈썹-눈 거리가 멀어질수록 높은 점수
        brow_score = min(1.0, max(0.0, (avg_brow_dist / iod - 0.4) * 5.0 )) # 기준 0.4, 스케일 5
        # (튜닝 필요) 눈이 커질수록(EAR 증가) 높은 점수
        eye_score = min(1.0, max(0.0, (avg_ear - 0.25) * 6.0)) # 기준 0.25, 스케일 6

        # 눈/눈썹 점수 가중 합산 (가중치: 눈썹 40%, 눈 60% 유지)
        eye_brow_surprise_score = (brow_score * 0.4 + eye_score * 0.6)

        # 2. 입 벌림 특징 계산 (수정된 함수 사용)
        mouth_openness_score = self._measure_mouth_openness(landmarks)

        # 3. 최종 점수 계산 (최종 스케일링 소폭 상향 조정)
        # 가중치: 눈/눈썹 65%, 입 35% (유지)
        # (튜닝) 최종 스케일업 증가: 1.35 -> 1.4
        final_score = (eye_brow_surprise_score * 0.65 + mouth_openness_score * 0.35) * 1.4 # 점수 올리기

        return min(1.0, max(0.0, final_score)) # 0~1 범위 클램핑

    # --- 추가: 못난이/우스꽝스러움 측정 함수 (점수 추가 조정) ---
    def _measure_ugly_face(self, landmarks):
        """우스꽝스러운 표정(비대칭, 찌푸림 등) 측정 - 점수 추가 조정"""
        if landmarks is None or len(landmarks) < 68: return 0.0
        iod = self._calculate_iod(landmarks)
        if iod <= 0: return 0.0 # IOD 유효성 체크

        # 1. 눈 비대칭성 점수 (좌우 EAR 차이) - 민감도 추가 증가
        left_ear = self._calculate_ear(landmarks, self.L_EYE_START, self.L_EYE_END)
        right_ear = self._calculate_ear(landmarks, self.R_EYE_START, self.R_EYE_END)
        ear_diff = abs(left_ear - right_ear)
        # (튜닝) 스케일링 팩터 추가 증가: 6.0 -> 9.0
        eye_asymmetry_score = min(1.0, max(0.0, ear_diff * 9.0)) # 점수 올리기 1

        # 2. 입꼬리 비대칭성 점수 (Y좌표 차이 정규화) - 민감도 추가 증가
        mouth_left = landmarks[48]
        mouth_right = landmarks[54]
        corner_y_diff = abs(mouth_left[1] - mouth_right[1])
        normalized_corner_y_diff = corner_y_diff / iod
        # (튜닝) 스케일링 팩터 추가 증가: 6.0 -> 9.0
        mouth_asymmetry_score = min(1.0, max(0.0, normalized_corner_y_diff * 9.0)) # 점수 올리기 2

        # 3. 과도한 찌푸림 점수 (눈썹-눈 거리) - 민감도 추가 증가
        left_brow_eye_dist = hypot(landmarks[21][0] - landmarks[39][0], landmarks[21][1] - landmarks[39][1])
        right_brow_eye_dist = hypot(landmarks[24][0] - landmarks[42][0], landmarks[24][1] - landmarks[42][1])
        avg_brow_dist = (left_brow_eye_dist + right_brow_eye_dist) / 2
        normalized_brow_dist = avg_brow_dist / iod
        # (튜닝) 스케일링 팩터 추가 증가: 10.0 -> 16.0
        frown_score = min(1.0, max(0.0, (0.25 - normalized_brow_dist) * 16.0)) # 점수 올리기 3

        # 4. 종합 점수 계산 (가중치는 유지, 최종 스케일업 추가 증가)
        # 가중치: 눈 30%, 입 30%, 찌푸림 40%
        # (튜닝) 최종 스케일업 추가 증가: 1.2 -> 1.5
        total_score = (eye_asymmetry_score * 0.3 + mouth_asymmetry_score * 0.3 + frown_score * 0.4) * 1.5 # 점수 올리기 4

        # 5. 일반적인 표정 점수 감점 (선택적) - 필요시 주석 해제 및 튜닝
        # smile_score = self._measure_smile(landmarks)
        # surprise_score = self._measure_surprise(landmarks)
        # if smile_score > 0.4 or surprise_score > 0.5:
        #     total_score *= 0.5

        return min(1.0, max(0.0, total_score)) # 0~1 범위 클램핑

# CPU 바운드 작업을 처리할 동기 함수 (dlib 예측)
def _run_dlib_prediction(frame_copy, face_x, face_y, face_w, face_h):
    """실제 dlib 랜드마크 예측을 수행하는 동기 함수"""
    if not dlib_available: return None
    try:
        # dlib은 그레이스케일 이미지를 사용
        gray = cv2.cvtColor(frame_copy, cv2.COLOR_BGR2GRAY)
        rect = dlib.rectangle(int(face_x), int(face_y), int(face_x + face_w), int(face_y + face_h))

        shape = predictor(gray, rect)
        coords = np.zeros((68, 2), dtype=int)

        for i in range(0, 68):
            coords[i] = (shape.part(i).x, shape.part(i).y)

        return coords
    except Exception as e:
        # 실제 운영 시 로깅 등으로 대체하는 것이 좋음
        print(f"랜드마크 감지 오류 (동기 함수 내): {e}")
        return None

# 기존 get_face_landmarks 함수를 async 함수로 변경
async def get_face_landmarks(frame, face_x, face_y, face_w, face_h):
    """dlib를 사용해 얼굴 랜드마크 추출 (비동기 실행)"""
    # 프레임 복사본 전달 (dlib 처리를 위해 필요할 수 있음)
    landmarks = await asyncio.to_thread(
        _run_dlib_prediction, frame.copy(), face_x, face_y, face_w, face_h
    )
    return landmarks

async def apply_handpick_effect(frame, initial_faces, websocket, original_frame=None, is_running=lambda: True, animation_service=None, client_id=None):
    """표정 변화를 감지하여 발표자 선정 - 독립 프레임 방식"""
    if not dlib_available:
         await websocket.send_json({
            'type': 'error',
            'message': '❌ 얼굴 랜드마크 감지기(dlib)를 사용할 수 없습니다.'
        })
         return frame, None

    if len(initial_faces) == 0:
        await websocket.send_json({
            'type': 'error',
            'message': '❌ 감지된 얼굴이 없습니다.'
        })
        return frame, None

    await websocket.send_json({'type': 'animation_start', 'mode': 'handpick'})

    # detection_mode 리스트에서 "refreshing_wink" 제거
    detection_mode = random.choice(["open_mouth", "big_smile", "surprise", "ugly_face"])
    expression_detector = ExpressionDetector()

    await asyncio.sleep(1)
    await websocket.send_json({'type': 'handpick_start'})
    await websocket.send_json({'type': 'play_sound', 'sound': 'handpick/start'})

    # --- 카운트다운 ---
    for countdown in range(5, 0, -1):
        if not is_running(): return frame, None
        # await websocket.send_json({'type': 'play_sound', 'sound': 'handpick/countdown'})
        faces_for_countdown = [] # 카운트다운 중엔 얼굴 정보 불필요
        await websocket.send_json({
            'type': 'handpick_progress',
            'faces': faces_for_countdown,
            'stage': 'start',
            'progress': (5 - countdown) / 5.0,
            'countdown': countdown,
            'expression_mode': detection_mode
        })
        await asyncio.sleep(1)

    # --- 추가: 표정 감지 시작 시 배경음악 재생 ---
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'handpick/main',
        # 'options': {'loop': True} # 루프 여부는 필요시 활성화
    })
    # --- 추가 끝 ---

    # --- 보정 단계 (단순히 초기 프레임 가져오기) ---
    baseline_frame = None
    if animation_service and client_id and client_id in animation_service.last_frames:
        baseline_frame = animation_service.last_frames[client_id].copy()
    else:
        baseline_frame = frame.copy() # Fallback

    # 초기 얼굴 감지 (후속 감지 루프의 시작점) (비동기 호출로 변경)
    last_detected_faces = await detect_faces_yolo(baseline_frame) # await 추가
    if len(last_detected_faces) == 0:
        print("⚠️ 초기 프레임에서 얼굴 감지 실패. 핸드픽 로직 중단 가능성.")
        last_detected_faces = initial_faces # 일단 initial_faces로 시도

    await websocket.send_json({
        'type': 'handpick_calibration_complete', # 이름은 유지하되, 실제 보정은 없음
        'expression_mode': detection_mode,
        'measurement_time': 10 # 측정 시간 (초)
    })

    # --- 표정 변화 감지 루프 (10초) ---
    detection_time = 10
    start_time = asyncio.get_event_loop().time()
    # last_detected_faces 는 위에서 초기화됨
    last_time_notice = -1

    while asyncio.get_event_loop().time() - start_time < detection_time:
        if not is_running(): return frame, None

        current_time = asyncio.get_event_loop().time()
        elapsed = current_time - start_time
        remaining = max(0, detection_time - elapsed)
        current_second = int(remaining)

        # 남은 시간 알림
        if current_second <= 3 and current_second != last_time_notice:
            last_time_notice = current_second
            if current_second > 0:
                await websocket.send_json({'type': 'play_sound', 'sound': 'handpick/countdown'})

        # 최신 프레임 가져오기
        current_frame = None
        if animation_service and client_id and client_id in animation_service.last_frames:
            current_frame = animation_service.last_frames[client_id].copy()
        else:
             current_frame = baseline_frame # Fallback

        # 실시간 얼굴 감지 (비동기 호출로 변경)
        current_faces_in_loop = await detect_faces_yolo(current_frame) # await 추가

        if len(current_faces_in_loop) == 0: # 현재 프레임에 얼굴 없으면 스킵
            await websocket.send_json({
                'type': 'handpick_progress',
                'faces': [], # 얼굴 없음 표시
                'stage': 'waiting',
                'progress': min(1.0, elapsed / detection_time)
            })
            await asyncio.sleep(0.1)
            continue # 다음 루프 반복으로

        last_detected_faces = current_faces_in_loop # 유효한 얼굴 정보 업데이트

        # 얼굴별 표정 점수 계산 (현재 프레임 기준)
        face_data = []
        current_loop_max_score = 0.0
        current_loop_candidate_idx = -1
        has_candidates = False

        for idx, (x, y, w, h) in enumerate(current_faces_in_loop):
            # get_face_landmarks 비동기 호출로 변경
            landmarks = await get_face_landmarks(current_frame, int(x), int(y), int(w), int(h)) # await 추가
            score = 0.0
            if landmarks is not None:
                # 현재 프레임 점수 계산 (누적/스무딩 없음)
                score = expression_detector.get_expression_score(idx, landmarks, detection_mode)

                # 현재 루프 내 최고 점수 업데이트
                if score > current_loop_max_score:
                    current_loop_max_score = score
                    current_loop_candidate_idx = idx
                    has_candidates = True
            # else: score is 0.0

            # 클라이언트 전송 데이터 구성 (현재 프레임 정보만 사용)
            face_data.append({
                "face": current_faces_in_loop[idx].tolist(),
                "expression_score": int(score * 100), # 점수 스케일 0-100
                "is_candidate": idx == current_loop_candidate_idx
            })

        # 진행 상황 전송
        await websocket.send_json({
            'type': 'handpick_progress',
            'faces': face_data,
            'stage': 'detecting' if has_candidates else 'waiting',
            'progress': min(1.0, elapsed / detection_time)
        })

        await asyncio.sleep(0.1)

    # --- 루프 종료 후 최종 선정 로직 ---
    print("Handpick 루프 종료, 최종 점수 계산 시작")
    final_frame = None
    if animation_service and client_id and client_id in animation_service.last_frames:
        final_frame = animation_service.last_frames[client_id].copy()
    else:
        final_frame = current_frame if 'current_frame' in locals() else baseline_frame

    # final_frame 유효성 체크
    if final_frame is None:
         await websocket.send_json({'type': 'error', 'message': '❌ 최종 결과 프레임을 가져올 수 없습니다.'})
         return frame, None

    final_faces_for_ranking = last_detected_faces
    print(f"최종 프레임 얼굴 감지 결과: {len(final_faces_for_ranking)} 명")

    final_scores_calculated = {}

    if len(final_faces_for_ranking) == 0:
         await websocket.send_json({'type': 'error', 'message': '❌ 최종 선정 시점에 감지된 얼굴이 없습니다.'})
         return frame, None
    else:
        # 마지막 프레임 기준으로 점수 계산 (스무딩 없음)
        for idx, (x, y, w, h) in enumerate(final_faces_for_ranking):
            # get_face_landmarks 비동기 호출로 변경
            final_landmarks = await get_face_landmarks(final_frame, int(x), int(y), int(w), int(h)) # await 추가
            final_score = 0.0
            if final_landmarks is not None:
                final_score = expression_detector.get_expression_score(idx, final_landmarks, detection_mode)

            final_scores_calculated[idx] = final_score


    # 최종 점수 기반 순위 선정
    all_scores = [{"idx": idx, "score": score} for idx, score in final_scores_calculated.items()]
    all_scores.sort(key=lambda x: x["score"], reverse=True)

    selected_face_coords = None
    best_score = 0.0
    best_idx = -1

    # 선정 기준 점수 (튜닝 필요)
    MIN_VALID_SCORE = 0.2 # 우선 공통 기준 사용

    if all_scores and all_scores[0]["score"] >= MIN_VALID_SCORE:
        best_idx = all_scores[0]["idx"]
        best_score = all_scores[0]["score"]
        # 인덱스 유효성 검사 강화
        if best_idx < len(final_faces_for_ranking):
             selected_face_coords = final_faces_for_ranking[best_idx]
             print(f"최종 선정: 얼굴 #{best_idx}, 점수: {best_score:.2f}")
        else:
             best_idx = -1
             print(f"⚠️ 인덱스 오류 발생: best_idx={best_idx}, final_faces_for_ranking 길이={len(final_faces_for_ranking)}")


    # 기준 미달 또는 유효 선정자 없으면 랜덤 선택
    if selected_face_coords is None:
        print(f"유효 점수 미달 또는 선정자 없음 (최고점수: {all_scores[0]['score'] if all_scores else 'N/A'}). 랜덤 선정 실행.")
        if len(final_faces_for_ranking) > 0:
            best_idx = random.randrange(len(final_faces_for_ranking))
            selected_face_coords = final_faces_for_ranking[best_idx]
            # 랜덤 선택 시 점수를 0으로 설정하고 all_scores 업데이트
            for entry in all_scores:
                if entry["idx"] == best_idx: entry["score"] = 0.0
            else: all_scores.append({"idx": best_idx, "score": 0.0})
            all_scores.sort(key=lambda x: x["score"], reverse=True)
            print(f"랜덤 선정: 얼굴 #{best_idx}")
        else:
            await websocket.send_json({'type': 'error', 'message': '❌ 최종 선정 시점에 감지된 얼굴이 없습니다.'})
            return frame, None

    # --- 결과 전송 데이터 구성 ---
    expression_name = ""
    message = "🎭 연기대상 선정!"
    final_score_for_message = int(all_scores[0]["score"] * 100) if all_scores else 0

    if best_score >= MIN_VALID_SCORE: # 유효 점수로 선정된 경우
        if detection_mode == "smile" or detection_mode == "big_smile":
            expression_name = "밝은 미소"
            message = f"최고 점수: {final_score_for_message}점"
        elif detection_mode == "open_mouth":
            expression_name = "놀라운 한입"
            message = f"최고 점수: {final_score_for_message}점"
        elif detection_mode == "surprise":
            expression_name = "극적인 놀람"
            message = f"최고 점수: {final_score_for_message}점"
        elif detection_mode == "ugly_face":
            expression_name = "오늘의 못난이"
            message = f"최고 점수: {final_score_for_message}점"
    else: # 랜덤 선정된 경우
        expression_name = "랜덤 선정"
        message = "행운의 주인공!"


    # 상위 3명 순위 정보 구성 (수정: 5명 -> 3명)
    ranking_data = []
    for rank, entry in enumerate(all_scores[:3]):
        if entry["idx"] < len(final_faces_for_ranking):
            rank_info = {
                "face": final_faces_for_ranking[entry["idx"]].tolist(),
                "rank": rank + 1,
                "score": int(entry["score"] * 100) # 0-100 스케일
            }
            ranking_data.append(rank_info)

    # 최종 프레임 Base64 인코딩
    result_frame_base64 = None
    try:
        _, buffer = cv2.imencode('.jpg', final_frame)
        result_frame_base64 = base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        print(f"Error encoding final frame: {e}")

    # --- 추가: 결과 발표 전 배경음악 중지 ---
    await websocket.send_json({'type': 'stop_sound', 'sound': 'handpick/main'})
    # --- 추가 끝 ---
    # 결과 발표 사운드
    await websocket.send_json({'type': 'play_sound', 'sound': 'handpick/result'})

    # 최종 결과 전송
    await websocket.send_json({
        'type': 'handpick_result',
        'face': selected_face_coords.tolist() if selected_face_coords is not None else None,
        'expression_name': expression_name,
        'message': message,
        'ranking': ranking_data,
        'result_frame': result_frame_base64
    })

    await websocket.send_json({'type': 'selection_complete', 'mode': 'handpick'})

    return frame, selected_face_coords
