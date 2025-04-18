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
    
    await websocket.send_json({
        'type': 'play_sound',
        'sound': 'race/race_loop',
        'options': {
            'loop': True
        }
    })
    
    # 기본 설정 및 참가자 정보 초기화
    max_lanes = 6  # 최대 레인 수는 6개로 유지
    num_participants = min(len(faces), 12)  # 최대 12명으로 확장
    visible_width = 1000  # 화면에 보이는 영역의 너비
    track_length = visible_width * 3  # 화면 너비의 3배로 설정
    
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
                "speed": random.uniform(1.3, 1.85),  # 초기 속도 범위 낮춤 (기존: 1.6, 2.6)
                "lane": lane,  # 레인 번호
                "face_index": selected_indices[racer_counter],  # 원래 얼굴 인덱스
                "powerup_timer": 0,  # 파워업 지속 시간 (부스트용)
                "shield_active": False, # 보호막 활성화 상태 추가
                "shield_timer": 0,    # 보호막 지속 시간 추가
                "z_index": j,  # z-index로 같은 레인 내 앞뒤 관계 표시 (0이 가장 앞)
                "eliminated": False # 제거 상태 플래그 추가
            })
            racer_counter += 1
    
    # 현재 카메라 위치 변수 추가 및 초기화
    current_camera_position = 0.0 
    camera_smoothing_factor = 0.1 # 카메라 이동 부드러움 정도 (0.0 ~ 1.0, 작을수록 부드러움)

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
            'camera_position': current_camera_position # 초기 카메라 위치
        }
    })
    
    # 장애물 생성 - 개수 조정 및 블랙홀 비율 제어
    obstacles = []
    # 참가자 수의 1.6배로 장애물 개수 유지
    num_total_obstacles = int(num_participants * 1.6)
    
    # 참가자 수에 따라 블랙홀 개수 동적 조정
    if num_participants < 12:
        num_blackholes = round(num_participants / 3) # 참가자의 약 1/3 (반올림)
    else:
        num_blackholes = round(num_participants / 2) # 참가자의 약 1/2 (반올림)
        
    # 총 장애물 개수를 넘지 않도록 보정 (블랙홀이 너무 많아지는 경우 방지)
    num_blackholes = min(num_blackholes, int(num_total_obstacles * 0.6)) # 최대 60%까지만 허용

    num_normal_obstacles = num_total_obstacles - num_blackholes
    # 일반 장애물이 음수가 되지 않도록 최소 1개 보장 (선택적)
    if num_normal_obstacles < 1 and num_total_obstacles > 0:
        num_normal_obstacles = 1
        num_blackholes = num_total_obstacles - 1

    obstacle_positions = set() # 위치 중복 방지

    obstacle_id_counter = 0
    # 일반 장애물 생성
    for _ in range(num_normal_obstacles):
        while True:
            pos = random.randint(200, track_length - 200)
            lane = random.randint(0, max_lanes - 1)
            if (pos, lane) not in obstacle_positions:
                obstacle_positions.add((pos, lane))
                obstacles.append({
                    "id": obstacle_id_counter,
                    "type": 1, # 일반 장애물 타입
                    "position": pos,
                    "lane": lane,
                    "width": 40,
                    "height": 40,
                    "active": True
                })
                obstacle_id_counter += 1
                break

    # 블랙홀 장애물 생성
    for _ in range(num_blackholes):
         while True:
            pos = random.randint(300, track_length - 300) # 시작/끝 지점과 조금 더 멀리
            lane = random.randint(0, max_lanes - 1)
            # 블랙홀은 다른 장애물과 최소 100픽셀 간격 유지
            is_too_close = False
            for obs_pos, obs_lane in obstacle_positions:
                if obs_lane == lane and abs(obs_pos - pos) < 100:
                    is_too_close = True
                    break
            if (pos, lane) not in obstacle_positions and not is_too_close:
                obstacle_positions.add((pos, lane))
                obstacles.append({
                    "id": obstacle_id_counter,
                    "type": 2, # 블랙홀 타입
                    "position": pos,
                    "lane": lane,
                    "width": 45, # 블랙홀 크기 약간 증가
                    "height": 45,
                    "active": True
                })
                obstacle_id_counter += 1
                break

    # 파워업 생성 - 개수 조정 및 타입 구분 (1: 부스트, 2: 보호막)
    powerups = []
    num_powerups = int(num_participants * 1.3)
    num_boosts = max(1, round(num_powerups * 0.6)) # 부스트 비율 약 60%
    num_shields = num_powerups - num_boosts

    powerup_positions = set() # 위치 중복 방지
    powerup_id_counter = 0

    for i in range(num_powerups):
        powerup_type = 1 if i < num_boosts else 2 # 타입 할당

        while True:
            pos = random.randint(200, track_length - 200)
            lane = random.randint(0, max_lanes - 1)
            # 파워업은 다른 아이템과 최소 50픽셀 간격 유지
            is_too_close = False
            for item_pos, item_lane in obstacle_positions | powerup_positions:
                 if item_lane == lane and abs(item_pos - pos) < 50:
                     is_too_close = True
                     break
            if (pos, lane) not in powerup_positions and not is_too_close:
                powerup_positions.add((pos, lane))
                powerups.append({
                    "id": powerup_id_counter,
                    "type": powerup_type, # 파워업 타입 지정 (1 또는 2)
                    "position": pos,
                    "lane": lane,
                    "width": 30,
                    "height": 30,
                    "active": True
                })
                powerup_id_counter += 1
                break

    # 장애물 및 파워업 정보 전송
    await websocket.send_json({
        'type': 'race_items',
        'obstacles': obstacles,
        'powerups': powerups
    })
    
    await websocket.send_json({
    'type': 'play_sound',
    'sound': 'race/race_start'
    })
    
    # 카운트다운 및 레이스 시작
    for count in [3, 2, 1, "GO"]:
        if not is_running():
            return frame, None
            
        await websocket.send_json({
            'type': 'race_countdown',
            'count': count
        })
        
        await asyncio.sleep(1)
    
    # 레이스 메인 루프
    race_finished = False
    winner = None
    finish_line = track_length - 70  # 결승선 위치
    active_racers_count = num_participants

    while not race_finished and is_running() and active_racers_count > 0:
        # 현재 활성 레이서들의 위치 및 선두 파악
        active_racers = [r for r in racers if not r["eliminated"]]
        if not active_racers: # 모든 레이서가 제거된 경우
             break
        positions = [r["position"] for r in active_racers]
        lead_position = max(positions) if positions else 0
  
        # 목표 카메라 위치 계산 - 활성 참가자들의 평균 위치 기준
        avg_position = sum(positions) / len(positions) if positions else 0
        target_camera_position = max(0, min(avg_position - visible_width * 0.3, track_length - visible_width))
        
        # 현재 카메라 위치를 목표 위치로 부드럽게 이동 (보간)
        current_camera_position += (target_camera_position - current_camera_position) * camera_smoothing_factor

        # 같은 레인 내 참가자 간 z-index 업데이트 (위치 기반)
        for lane in range(max_lanes):
            lane_racers = [r for r in active_racers if r["lane"] == lane]
            sorted_lane_racers = sorted(lane_racers, key=lambda r: r["position"], reverse=True)
            for z_idx, racer in enumerate(sorted_lane_racers):
                racer["z_index"] = z_idx
        
        # 각 레이서 업데이트
        eliminated_in_this_step = False
        for racer in racers:
            # 제거되었거나 이미 결승선을 통과한 경우 건너뜀
            if racer["eliminated"] or racer["position"] >= finish_line:
                continue
                
            # 부스트 파워업 타이머 감소
            if racer["powerup_timer"] > 0:
                racer["powerup_timer"] -= 1
                if racer["powerup_timer"] == 0:
                    racer["speed"] /= 1.8 # 부스트 효과 제거 (기존: 2.0)

            # 보호막 파워업 타이머 감소
            if racer["shield_timer"] > 0:
                racer["shield_timer"] -= 1
                if racer["shield_timer"] == 0:
                    racer["shield_active"] = False
            
            # 무작위 속도 변동
            racer["speed"] += random.uniform(-0.15, 0.185) # 변동 폭 줄임 (기존: -0.2, 0.25)
            racer["speed"] = max(0.8, min(4.0, racer["speed"])) # 최소/최대 속도도 약간 조정
            
            # --- 레이스 진행률 계산 ---
            race_progress = max(0, min(1, lead_position / finish_line)) if finish_line > 0 else 0

            # --- 고무줄 효과: 레이스 중반 이후 약화 ---
            if racer["position"] < lead_position * 0.7: # 적용 기준 약간 완화 (0.6 -> 0.7)
                rubber_band = (lead_position - racer["position"]) / lead_position
                base_strength = 0.15 # 기본 강도

                # 레이스 진행률에 따라 효과 감소시키는 계수 (중반 이후 급격히 감소)
                # progress < 0.4 이면 1.0, progress = 1.0 이면 0
                progress_reduction_factor = max(0, 1.0 - (race_progress - 0.4) / 0.6) if race_progress > 0.4 else 1.0
                # progress_reduction_factor = max(0, 1.0 - race_progress * 1.5) # 더 간단한 대안

                # 참가자 수에 따른 강도 조절 (기존 로직 약간 수정)
                participant_factor = 1.0
                if num_participants > 6:
                     # 인원이 많으면 효과 감소 (기존 로직 유지)
                    participant_factor = min(1.0, 6 / num_participants)

                # 최종 고무줄 효과 강도 계산
                rubber_band_strength = base_strength * participant_factor * progress_reduction_factor

                racer["speed"] += rubber_band * rubber_band_strength
            
            # --- 선두 효과: 레이스 중반 이후 약화 ---
            if racer["position"] >= lead_position * 0.95:
                # 레이스 진행률에 따라 기본 감속 계수 조절 (중반 이후 1.0에 가깝게)
                # progress < 0.4 이면 0.995, progress = 1.0 이면 1.0
                base_slow_factor = 0.995 + 0.005 * max(0, (race_progress - 0.4) / 0.6) if race_progress > 0.4 else 0.995
                # base_slow_factor = min(1.0, 0.995 + 0.005 * race_progress * 2) # 더 간단한 대안

                slow_factor = base_slow_factor
                if num_participants > 6:
                    # 인원이 많으면 감속 효과 감소 (1.0에 더 가깝게) - 기존 로직 조정
                    participant_modifier = (1.0 - base_slow_factor) * min(1.0, (num_participants - 6) / 18)
                    slow_factor = base_slow_factor + participant_modifier

                racer["speed"] *= slow_factor
            
            # 위치 업데이트
            racer["position"] += racer["speed"]
            
            # 같은 레인의 활성 참가자 간 충돌 및 추월 로직
            same_lane_active_racers = [r for r in active_racers if r["lane"] == racer["lane"] and r["id"] != racer["id"]]
            for other_racer in same_lane_active_racers:
                distance = other_racer["position"] - racer["position"]
                if distance > 0 and distance < 100:
                    if distance < 30:
                        speed_diff = racer["speed"] - other_racer["speed"]
                        if speed_diff > 0.8:
                            if random.random() < 0.25:
                                racer["speed"] *= 1.15  # 추월을 위한 가속 15%
                            else:
                                racer["speed"] *= 0.97
                        elif speed_diff > 0:
                            racer["speed"] *= 0.98
                        else:
                            racer["speed"] *= 0.95
                    elif distance < 60:
                        if random.random() < 0.3:  # 30% 확률
                            racer["speed"] *= 1.03  # 약간 가속
                    
                    # 레인 변경 시도
                    if distance < 50 and racer["speed"] > other_racer["speed"] * 1.1 and random.random() < 0.03:
                        possible_lanes = []
                        current_lane = racer["lane"]
                        if current_lane > 0: possible_lanes.append(current_lane - 1)
                        if current_lane < max_lanes - 1: possible_lanes.append(current_lane + 1)

                        if possible_lanes:
                            new_lane = random.choice(possible_lanes)
                            lane_clear = True
                            for check_racer in active_racers: # 활성 레이서만 확인
                                if check_racer["lane"] == new_lane and abs(check_racer["position"] - racer["position"]) < 60:
                                    lane_clear = False
                                    break
                            if lane_clear:
                                racer["lane"] = new_lane
                                racer["speed"] *= 0.95
            
            # 장애물 충돌 검사
            for obstacle in obstacles:
                if (obstacle["active"] and 
                    obstacle["lane"] == racer["lane"] and
                    abs(obstacle["position"] - racer["position"]) < 20):
                    
                    # 보호막 활성화 상태 확인
                    if racer["shield_active"]:
                        # 보호막으로 충돌 방어
                        racer["shield_active"] = False
                        racer["shield_timer"] = 0
                        obstacle["active"] = False # 장애물 비활성화
                        # 보호막 깨짐 사운드 전송 (새 사운드 필요)
                        await websocket.send_json({
                            'type': 'play_sound',
                            'sound': 'race/shield_break' # 예시 이름
                        })
                        # 클라이언트에 충돌 메시지 보내서 시각 효과 트리거 (shield_broken 플래그 추가)
                        await websocket.send_json({
                            'type': 'race_collision',
                            'racer_id': racer["id"],
                            'item_id': obstacle["id"],
                            'is_elimination': False, # 제거 아님
                            'shield_broken': True  # 보호막 깨짐 플래그 추가
                        })

                    else:
                        # 보호막 없을 때 기존 충돌 처리
                        if obstacle["type"] == 1: # 일반 장애물
                            racer["speed"] *= 0.6  # 감속
                            await websocket.send_json({
                                'type': 'race_collision',
                                'racer_id': racer["id"],
                                'item_id': obstacle["id"],
                                'is_elimination': False, # 제거 아님 플래그
                                'shield_broken': False # 보호막 안 깨짐
                            })
                            await websocket.send_json({
                                'type': 'play_sound',
                                'sound': 'race/crash'
                            })
                        elif obstacle["type"] == 2: # 블랙홀
                            racer["eliminated"] = True # 제거됨 상태로 변경
                            racer["speed"] = 0 # 속도 0
                            eliminated_in_this_step = True
                            await websocket.send_json({
                                'type': 'race_collision',
                                'racer_id': racer["id"],
                                'item_id': obstacle["id"],
                                'is_elimination': True, # 제거 플래그
                                'shield_broken': False # 보호막 안 깨짐 (제거됨)
                            })
                            # 블랙홀 사운드 재생 (새 사운드 필요)
                            await websocket.send_json({
                                'type': 'play_sound',
                                'sound': 'race/blackhole' # 예시 이름
                            })
                        
                        obstacle["active"] = False # 장애물 비활성화

                    break # 한 번 충돌/방어하면 더 이상 검사 안 함
            
            # 제거되지 않은 경우에만 파워업 획득 검사
            if not racer["eliminated"]:
                for powerup in powerups:
                    if (powerup["active"] and
                        powerup["lane"] == racer["lane"] and
                        abs(powerup["position"] - racer["position"]) < 20):

                        powerup["active"] = False # 파워업 비활성화

                        if powerup["type"] == 1: # 부스트 파워업
                            racer["speed"] *= 1.8 # 속도 1.5배 (기존: 2.0)
                            racer["powerup_timer"] = 90 # 부스트 지속 시간 (약 3.75초)
                            await websocket.send_json({
                                'type': 'play_sound',
                                'sound': 'race/powerup' # 기존 파워업 사운드
                            })
                        elif powerup["type"] == 2: # 보호막 파워업
                            racer["shield_active"] = True
                            racer["shield_timer"] = 120 # 보호막 지속 시간 (약 5초)
                            # 보호막 획득 사운드 전송 (새 사운드 필요)
                            await websocket.send_json({
                                'type': 'play_sound',
                                'sound': 'race/powerup' # 예시 이름
                            })

                        # 클라이언트에 파워업 획득 메시지 전송 (시각 효과용)
                        await websocket.send_json({
                            'type': 'race_powerup',
                            'racer_id': racer["id"],
                            'item_id': powerup["id"],
                            'powerup_type': powerup["type"] # 파워업 타입 정보 추가
                        })
                        break # 한 번 획득하면 더 이상 검사 안 함
            
            # 결승선 도달 확인 (제거되지 않은 레이서 중)
            if not racer["eliminated"] and racer["position"] >= finish_line and winner is None:
                winner = racer["id"]
                race_finished = True

                # 우승자 확정 시 다른 레이서들 정지
                for r in racers:
                    if r["id"] != winner:
                        r["speed"] = 0

                await websocket.send_json({
                    'type': 'race_result',
                    'winner_id': winner,
                    'winner_index': racer["face_index"]
                })
                break # 우승자 결정되면 레이서 업데이트 중단
        
        # 이번 스텝에서 제거된 레이서가 있으면 활성 레이서 수 업데이트
        if eliminated_in_this_step:
            active_racers_count = len([r for r in racers if not r["eliminated"]])
        
        # 현재 상태 업데이트 전송 (모든 레이서 정보 포함, 보호막 상태 추가)
        await websocket.send_json({
            'type': 'race_update',
            'racers': racers, # 모든 레이서 정보 전달 (클라에서 필터링)
            'obstacles': [obs for obs in obstacles if obs["active"]],
            'powerups': [pwr for pwr in powerups if pwr["active"]],
            'camera_position': current_camera_position # 보간된 카메라 위치 전송
        })
        
        await asyncio.sleep(0.033)  # 업데이트 간격 (30fps)
    
    # 레이스 종료 후 처리
    if not is_running(): # 중단된 경우
        print("레이스 중단됨")
        await websocket.send_json({'type': 'stop_sound', 'sound': 'race/race_loop'})

    elif winner is None and active_racers_count == 0: # 모든 레이서 탈락
        print("모든 레이서 탈락")
        await websocket.send_json({'type': 'stop_sound', 'sound': 'race/race_loop'})
        await websocket.send_json({
            'type': 'race_result', # 결과 메시지는 보내되, 우승자는 null
            'winner_id': None,
            'winner_index': None
        })
        # 모든 참가자 탈락 메시지 표시 필요 시 추가
        await websocket.send_json({
            'type': 'show_text',
            'text': '모든 참가자 탈락!',
            'position': {'x': 0.5, 'y': 0.5},
            'style': {'fontSize': 60, 'color': 'red'}
        })
        await asyncio.sleep(3) # 메시지 보여줄 시간

    await websocket.send_json({
        'type': 'selection_complete',
        'mode': 'race'
    })

    selected_face = faces[racers[winner]["face_index"]] if winner is not None and winner < len(racers) and "face_index" in racers[winner] else None
    return frame, selected_face
