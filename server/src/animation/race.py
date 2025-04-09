import random
import asyncio

async def apply_race_effect(frame, faces, websocket, original_frame=None, is_running=lambda: True, animation_service=None, client_id=None):
    """레이스 애니메이션 실행 (WebSocket 통신 방식)"""
    if faces is None or len(faces) == 0:
        print("❌ 감지된 얼굴이 없습니다. 레이스 실행 불가")
        return frame, None

    height, width, _ = frame.shape
    
    # 애니메이션 시작 알림
    await websocket.send_json({
        'type': 'animation_start',
        'mode': 'race'
    })
    
    # 기본 설정 및 참가자 정보 초기화
    max_lanes = 6  # 최대 레인 수는 6개로 유지
    num_participants = min(len(faces), 24)  # 최대 24명으로 확장
    visible_width = 1000  # 화면에 보이는 영역의 너비
    track_length = visible_width * 2.13  # 화면 너비의 3배로 설정
    
    # 참가자 얼굴 및 ID 선택
    selected_indices = list(range(len(faces)))
    if len(faces) > num_participants:
        selected_indices = random.sample(selected_indices, num_participants)
    
    selected_faces = [faces[i].tolist() for i in selected_indices]
    
    # 레인별 참가자 수 계산 (최대한 균등하게 분배)
    racers_per_lane = [0] * max_lanes
    for i in range(num_participants):
        lane_idx = i % max_lanes
        racers_per_lane[lane_idx] += 1
    
    # 참가자 초기 설정 - 초기 속도와 위치를 다양하게 설정
    racers = []
    racer_counter = 0
    
    for lane in range(max_lanes):
        for j in range(racers_per_lane[lane]):
            # 같은 레인의 참가자들은 약간 다른 위치에서 시작
            position_offset = j * 40  # 40픽셀 간격으로 배치
            
            racers.append({
                "id": racer_counter,
                "position": position_offset,  # 출발선 위치에 오프셋 적용
                "speed": random.uniform(1.6, 2.6),  # 초기 속도 감소 및 다양화
                "lane": lane,  # 레인 번호
                "face_index": selected_indices[racer_counter],  # 원래 얼굴 인덱스
                "powerup_timer": 0,  # 파워업 지속 시간
                "z_index": j  # z-index로 같은 레인 내 앞뒤 관계 표시 (0이 가장 앞)
            })
            racer_counter += 1
    
    # 트랙 설정 전송 - 카메라 위치 및 레인별 참가자 수 정보 추가
    await websocket.send_json({
        'type': 'init_race',
        'frame': original_frame,
        'faces': selected_faces,
        'face_indices': selected_indices,
        'track_config': {
            'width': track_length,
            'height': max_lanes * 60 + 50,  # 트랙 높이 (레인 간격 60픽셀)
            'num_lanes': max_lanes,
            'racers_per_lane': racers_per_lane,  # 레인별 참가자 수 추가
            'visible_width': visible_width,
            'camera_position': 0  # 초기 카메라 위치 (출발선)
        }
    })
    
    # 장애물 생성 - 더 많이, 더 넓게 분포
    obstacles = []
    for i in range(num_participants * 3):  # 참가자 수에 비례하여 장애물 생성
        obstacle_type = random.randint(1, 2)  # 장애물 유형 (1 또는 2)
        obstacle_position = random.randint(200, track_length - 200)  # 전체 트랙에 분포
        obstacle_lane = random.randint(0, max_lanes - 1)  # 장애물 레인
        
        obstacles.append({
            "id": i,
            "type": obstacle_type,
            "position": obstacle_position,
            "lane": obstacle_lane,
            "width": 40,
            "height": 40,
            "active": True  # 충돌 전에는 활성 상태
        })
    
    # 파워업 생성 - 더 많이, 더 넓게 분포
    powerups = []
    for i in range(num_participants * 2):  # 참가자 수에 비례하여 파워업 생성
        powerup_type = random.randint(1, 2)  # 파워업 유형 (1 또는 2)
        powerup_position = random.randint(200, track_length - 200)  # 전체 트랙에 분포
        powerup_lane = random.randint(0, max_lanes - 1)  # 파워업 레인
        
        powerups.append({
            "id": i,
            "type": powerup_type,
            "position": powerup_position,
            "lane": powerup_lane,
            "width": 30,
            "height": 30,
            "active": True  # 획득 전에는 활성 상태
        })
    
    # 장애물 및 파워업 정보 전송
    await websocket.send_json({
        'type': 'race_items',
        'obstacles': obstacles,
        'powerups': powerups
    })
    
    # 레이스 사운드 시작
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'race/race_loop',
        'options': {
            'loop': True
        }
    })
    
    # 카운트다운 및 레이스 시작
    for count in [3, 2, 1, "GO"]:
        if not is_running():
            return frame, None
            
        await websocket.send_json({
            'type': 'race_countdown',
            'count': count
        })
        
        if count == "GO":
            await websocket.send_json({
                'type': 'play_sound',
                'sound': 'race/race_start'
            })
        else:
            await websocket.send_json({
                'type': 'play_sound',
                'sound': 'race/beep'
            })
            
        await asyncio.sleep(1)
    
    # 레이스 메인 루프
    race_finished = False
    winner = None
    finish_line = track_length - 70  # 결승선 위치
    
    while not race_finished and is_running():
        # 현재 선두 위치 및 꼴등 위치 파악
        positions = [r["position"] for r in racers]
        lead_position = max(positions)
  
        # 카메라 위치 계산 - 참가자들의 평균 위치 기준
        avg_position = sum(positions) / len(positions)
        camera_position = max(0, min(avg_position - visible_width * 0.3, track_length - visible_width))
        
        # 같은 레인 내 참가자 간 z-index 업데이트 (위치 기반)
        # 각 레인별로 참가자들을 위치순으로 정렬
        for lane in range(max_lanes):
            lane_racers = [r for r in racers if r["lane"] == lane]
            # 위치순으로 정렬
            sorted_lane_racers = sorted(lane_racers, key=lambda r: r["position"], reverse=True)
            # z-index 재할당 (0이 가장 앞)
            for z_idx, racer in enumerate(sorted_lane_racers):
                racer["z_index"] = z_idx
        
        # 각 레이서 업데이트
        for racer in racers:
            # 이미 결승선을 통과한 경우 속도를 0으로 설정
            if racer["position"] >= finish_line:
                racer["speed"] = 0
                continue
                
            # 파워업 타이머 감소
            if racer["powerup_timer"] > 0:
                racer["powerup_timer"] -= 1
                # 파워업 효과 종료 시 속도 조정
                if racer["powerup_timer"] == 0:
                    racer["speed"] *= 0.7  # 파워업 종료 시 속도 감소
            
            # 무작위 속도 변동 (더 넓은 범위로 설정)
            racer["speed"] += random.uniform(-0.2, 0.25)
            racer["speed"] = max(1.0, min(5.0, racer["speed"]))  # 속도 범위 제한 조정
            
            # 고무줄 효과: 인원수에 따라 강도 조절
            if racer["position"] < lead_position * 0.6:  # 선두의 60% 이하 위치면
                rubber_band = (lead_position - racer["position"]) / lead_position  # 선두와의 거리 비율
                
                # 참가자 수에 따른 고무줄 효과 강도 조절
                rubber_band_strength = 0.15  # 기본 강도
                
                if num_participants > 6:
                    # 레이스 진행 상황에 따라 고무줄 효과 강도 감소
                    race_progress = lead_position / finish_line  # 레이스 진행률 (0~1)
                    
                    # 인원이 많을수록, 레이스가 진행될수록 고무줄 효과 감소
                    participant_factor = min(1.0, 6 / num_participants)  # 인원수에 따른 계수 (6명 초과시 감소)
                    progress_factor = 1.0 - race_progress * 0.7  # 레이스 진행에 따른 계수 (결승점 가까워질수록 최대 70%까지 감소)
                    
                    rubber_band_strength *= participant_factor * progress_factor
                
                racer["speed"] += rubber_band * rubber_band_strength  # 조정된 추가 속도 부여
            
            # 선두 효과: 선두는 약간 감속 (인원수가 많을수록 감소)
            if racer["position"] >= lead_position * 0.95:  # 선두 근처면
                slow_factor = 0.995  # 기본 감속 계수
                
                if num_participants > 6:
                    # 인원이 많을수록 선두 감속 효과 감소 (더 빨리 달릴 수 있게)
                    slow_factor = 0.995 + (1.0 - 0.995) * min(1.0, (num_participants - 6) / 18)
                
                racer["speed"] *= slow_factor
            
            # 위치 업데이트
            racer["position"] += racer["speed"]
            
            # 같은 레인의 참가자 간 충돌 검사
            same_lane_racers = [r for r in racers if r["lane"] == racer["lane"] and r["id"] != racer["id"]]
            for other_racer in same_lane_racers:
                # 앞에 있는 racer와의 거리 계산
                distance = other_racer["position"] - racer["position"]
                
                # 추월 로직 개선: 앞 주자가 있을 때
                if distance > 0 and distance < 100:  # 거리 범위 확대 (100픽셀 이내)
                    if distance < 30:  # 매우 근접했을 때
                        # 속도 차이에 따른 다양한 행동
                        speed_diff = racer["speed"] - other_racer["speed"]
                        
                        if speed_diff > 0.8:  # 충분히 빠르면 추월 가능성 높임
                            # 추월 시도 - 확률 25%로 증가
                            if random.random() < 0.25:
                                racer["speed"] *= 1.15  # 추월을 위한 가속 15%
                                # 추월 특수 효과 추가 가능 (선택 사항)
                                # await websocket.send_json({
                                #     'type': 'race_overtake',
                                #     'racer_id': racer["id"],
                                #     'target_id': other_racer["id"]
                                # })
                            else:
                                # 추월 실패 시 약간만 감속
                                racer["speed"] *= 0.97
                        elif speed_diff > 0:  # 조금 더 빠른 경우
                            # 약간 감속하지만 너무 심하지 않게
                            racer["speed"] *= 0.98
                        else:  # 앞 차가 더 빠른 경우
                            # 더 많이 감속
                            racer["speed"] *= 0.95
                    elif distance < 60:  # 적당한 거리일 때
                        # 드래프팅(drafting) 효과: 앞 차를 따라가며 약간 가속
                        if random.random() < 0.3:  # 30% 확률
                            racer["speed"] *= 1.03  # 약간 가속
                    
                    # 추가: 레인 변경 시도 (자연스러운 추월을 위함)
                    # 사용 가능한 인접 레인으로 변경 시도
                    if distance < 50 and racer["speed"] > other_racer["speed"] * 1.1 and random.random() < 0.03:
                        possible_lanes = []
                        current_lane = racer["lane"]
                        
                        # 위/아래 레인 확인
                        if current_lane > 0:
                            possible_lanes.append(current_lane - 1)  # 위쪽 레인
                        if current_lane < max_lanes - 1:
                            possible_lanes.append(current_lane + 1)  # 아래쪽 레인
                        
                        # 가능한 레인이 있으면 변경
                        if possible_lanes:
                            # 레인 무작위 선택
                            new_lane = random.choice(possible_lanes)
                            
                            # 변경할 레인에 너무 가까운 다른 레이서가 있는지 확인
                            lane_clear = True
                            for check_racer in racers:
                                if check_racer["lane"] == new_lane and abs(check_racer["position"] - racer["position"]) < 60:
                                    lane_clear = False
                                    break
                            
                            # 레인이 비어있으면 변경
                            if lane_clear:
                                racer["lane"] = new_lane
                                # 레인 변경 시 약간 감속
                                racer["speed"] *= 0.95
            
            # 장애물 충돌 검사
            for obstacle in obstacles:
                if (obstacle["active"] and 
                    obstacle["lane"] == racer["lane"] and
                    abs(obstacle["position"] - racer["position"]) < 20):
                    
                    # 충돌 처리 - 더 큰 감속 효과
                    obstacle["active"] = False
                    racer["speed"] *= 0.6  # 더 큰 감속 효과
                    
                    # 충돌 이벤트 전송
                    await websocket.send_json({
                        'type': 'race_collision',
                        'racer_id': racer["id"],
                        'item_id': obstacle["id"]
                    })
                    
                    # 충돌 소리 재생
                    await websocket.send_json({
                        'type': 'play_sound',
                        'sound': 'race/crash'
                    })
            
            # 파워업 획득 검사
            for powerup in powerups:
                if (powerup["active"] and 
                    powerup["lane"] == racer["lane"] and
                    abs(powerup["position"] - racer["position"]) < 20):
                    
                    # 파워업 처리 - 지속 시간 추가
                    powerup["active"] = False
                    racer["speed"] *= 2.0  # 속도 증가 효과는 그대로
                    racer["powerup_timer"] = 60  # 약 3초간 지속
                    
                    # 파워업 이벤트 전송
                    await websocket.send_json({
                        'type': 'race_powerup',
                        'racer_id': racer["id"],
                        'item_id': powerup["id"]
                    })
                    
                    # 파워업 소리 재생
                    await websocket.send_json({
                        'type': 'play_sound',
                        'sound': 'race/powerup'
                    })
            
            # 결승선 도달 확인
            if racer["position"] >= finish_line and winner is None:
                winner = racer["id"]
                race_finished = True
                
                # 승리 이벤트 전송
                await websocket.send_json({
                    'type': 'race_result',
                    'winner_id': winner,
                    'winner_index': racer["face_index"]
                })
                
                # 레이스 사운드 중지
                await websocket.send_json({
                    'type': 'stop_sound',
                    'sound': 'race/race_loop'
                })
                
                # 승리 사운드 재생
                await websocket.send_json({
                    'type': 'play_sound',
                    'sound': 'race/win'
                })
                
                break
        
        # 현재 상태 업데이트 전송
        await websocket.send_json({
            'type': 'race_update',
            'racers': racers,
            'obstacles': [obs for obs in obstacles if obs["active"]],
            'powerups': [pwr for pwr in powerups if pwr["active"]],
            'camera_position': camera_position
        })
        
        await asyncio.sleep(0.04)  # 업데이트 간격 (20fps)
    
    await websocket.send_json({
        'type': 'selection_complete',
    })
    
    # 선택된 얼굴 반환
    selected_face = faces[racers[winner]["face_index"]] if winner is not None else None
    return frame, selected_face
