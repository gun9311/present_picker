import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import {
  AnimationProps,
  RaceCollisionMessage,
  RacePowerupMessage,
  WebSocketMessage,
} from "../types";
import { useAnimation } from "../useAnimation";

const RaceContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #333;
`;

const RaceCanvas = styled.canvas`
  position: absolute;
  width: 100%;
  height: 100%;
`;

// 카운트다운 오버레이 컴포넌트
const CountdownOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 120px;
  font-weight: bold;
  color: white;
  text-shadow: 0 0 10px #000;
  z-index: 10;
`;

// 승자 오버레이 컴포넌트
const WinnerOverlay = styled.div`
  position: absolute;
  top: 60px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 50px;
  font-weight: bold;
  color: gold;
  text-shadow: 0 0 10px #000;
  z-index: 10;
`;

// 레이스 애니메이션 컴포넌트
const RaceAnimation: React.FC<AnimationProps> = ({
  lastCapturedFrame,
  websocket,
}) => {
  const { getRaceState } = useAnimation(websocket);

  const {
    raceActive,
    raceTrackConfig,
    raceObstacles,
    racePowerups,
    racerPositions,
    raceWinner,
    raceCountdown,
    raceFaces,
    frozenFrame,
    raceCamera,
  } = getRaceState();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // 이미지 로딩 상태 관리
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  // 시각적 효과를 위한 상태들
  const [collisionEffects, setCollisionEffects] = useState<
    { id: number; duration: number; isShieldBreak?: boolean }[]
  >([]);
  const [powerupEffects, setPowerupEffects] = useState<
    { id: number; duration: number; type: number }[]
  >([]);

  // 카운트다운 표시 상태
  const [showCountdown, setShowCountdown] = useState<boolean>(true);

  // 줌 관련 상태 추가
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(1.0);
  const prevLeadRacerRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(Date.now());
  const zoomTransitionRef = useRef<{
    active: boolean;
    phase: number;
    startTime: number;
    fromLevel: number;
  }>({ active: false, phase: 0, startTime: 0, fromLevel: 1.0 });

  // +++ 추가: 제거 애니메이션 상태 +++
  const [eliminationAnimations, setEliminationAnimations] = useState<
    Map<number, { startTime: number; duration: number; x: number; y: number }>
  >(new Map());
  // +++ 추가 끝 +++

  // 이미지 로드 함수
  const loadImages = useCallback(() => {
    // --- 랜덤 트랙 이미지 선택 ---
    const randomTrackIndex = Math.floor(Math.random() * 3) + 1; // 1, 2, 3 중 랜덤 숫자 생성
    const randomTrackImage = `assets/images/race/race_track_${randomTrackIndex}.png`;
    // --- 랜덤 트랙 이미지 선택 끝 ---

    const imageUrls = {
      // 랜덤하게 선택된 트랙 이미지 사용
      track: randomTrackImage,
      obstacle1: "assets/images/race/obstacle1.png",
      obstacle2: "assets/images/race/obstacle2.png",
      powerup1: "assets/images/race/powerup1.png",
      powerup2: "assets/images/race/powerup2.png",
      finishLine: "assets/images/race/finish_line.png",
    };

    let loadedCount = 0;
    const totalImages = Object.keys(imageUrls).length;

    Object.entries(imageUrls).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          setImagesLoaded(true);
        }
      };
      imagesRef.current[key] = img;
    });
  }, []);

  // 우승자 결정 시 줌 효과 처리 (부드러운 줌인 및 줌아웃)
  useEffect(() => {
    if (raceWinner !== null) {
      // 부드러운 줌인 구현
      const targetZoom = 2.3; // 우승자 최종 줌 레벨
      const zoomInDuration = 1000; // 줌인에 걸리는 시간 (ms)
      const startZoom = currentZoomLevel; // 현재 줌 레벨에서 시작
      const startTime = Date.now();

      // 부드러운 줌인 효과를 위한 인터벌
      const zoomInInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / zoomInDuration, 1);

        // 이징 함수 적용 (easeOutQuad)
        const easeProgress = 1 - (1 - progress) * (1 - progress);

        // 새 줌 레벨 계산
        const newZoom = startZoom + (targetZoom - startZoom) * easeProgress;
        setCurrentZoomLevel(newZoom);

        // 줌인 완료 시 인터벌 정지
        if (progress >= 1) {
          clearInterval(zoomInInterval);

          // 줌인 완료 후 2초 대기 후 줌아웃 시작
          setTimeout(() => {
            const zoomOutStartTime = Date.now();
            const zoomOutDuration = 1500; // 줌아웃에 걸리는 시간 (ms)
            const zoomOutStartLevel = targetZoom;

            const zoomOutInterval = setInterval(() => {
              const elapsedOutTime = Date.now() - zoomOutStartTime;
              const outProgress = Math.min(elapsedOutTime / zoomOutDuration, 1);

              // 이징 함수 적용 (easeInOutQuad)
              const easeOutProgress =
                outProgress < 0.5
                  ? 2 * outProgress * outProgress
                  : 1 - Math.pow(-2 * outProgress + 2, 2) / 2;

              // 새 줌 레벨 계산 (1.0이 최종 목표)
              const newOutZoom =
                zoomOutStartLevel - (zoomOutStartLevel - 1.0) * easeOutProgress;
              setCurrentZoomLevel(newOutZoom);

              // 줌아웃 완료 시 인터벌 정지
              if (outProgress >= 1) {
                clearInterval(zoomOutInterval);
              }
            }, 16); // 약 60fps로 업데이트

            return () => clearInterval(zoomOutInterval);
          }, 2000);
        }
      }, 16); // 약 60fps로 업데이트

      return () => clearInterval(zoomInInterval);
    }
  }, [raceWinner]); // currentZoomLevel 의존성 제거

  // 선두 주자 변경 감지 및 줌 전환 효과
  useEffect(() => {
    if (!racerPositions.length || !raceActive) return;

    // 선두 주자 찾기
    const leadRacer = racerPositions.reduce((prev, current) =>
      prev.position > current.position ? prev : current
    );

    // 이전 선두 주자와 비교하여 변경 감지
    if (
      prevLeadRacerRef.current !== null &&
      prevLeadRacerRef.current !== leadRacer.id &&
      currentZoomLevel > 1.2
    ) {
      // 전환 효과 활성화
      zoomTransitionRef.current = {
        active: true,
        phase: 0, // 줌아웃 단계
        startTime: Date.now(),
        fromLevel: currentZoomLevel,
      };
    }

    // 현재 선두 주자 업데이트
    prevLeadRacerRef.current = leadRacer.id;
  }, [racerPositions, raceActive, currentZoomLevel]);

  // 카메라 위치에 따른 트랙 렌더링 구현
  const drawRace = useCallback(() => {
    if (!canvasRef.current || !imagesLoaded || !raceActive || !raceTrackConfig)
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 현재 시간 기록
    const now = Date.now();
    lastRenderTimeRef.current = now;

    // 캔버스 크기 설정
    if (
      canvas.width !== canvas.clientWidth ||
      canvas.height !== canvas.clientHeight
    ) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // 캔버스 지우기
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 선두 레이서 및 줌 중심점 찾기
    let centerX = canvas.width / 2;
    let centerY = canvas.height / 2;
    let leadRacer = null;

    if (racerPositions.length > 0) {
      leadRacer = racerPositions.reduce((prev, current) =>
        prev.position > current.position ? prev : current
      );

      // 보이는 영역 계산 (카메라 위치 기반)
      const visibleWidth =
        raceTrackConfig.visible_width || raceTrackConfig.width;

      // 스케일 계산 (서버 좌표를 캔버스 좌표로 변환)
      const scaleX = canvas.width / visibleWidth;

      // 선두 주자 위치 계산
      const racerX = (leadRacer.position - raceCamera) * scaleX;
      const laneHeight = canvas.height / raceTrackConfig.num_lanes;
      const racerY = leadRacer.lane * laneHeight + laneHeight / 2;

      // 화면 범위 내로 제한
      centerX = Math.max(0, Math.min(canvas.width, racerX));
      centerY = Math.max(0, Math.min(canvas.height, racerY));
    }

    // 줌 전환 효과 처리
    if (zoomTransitionRef.current.active) {
      const transitionTime = (now - zoomTransitionRef.current.startTime) / 1000;

      if (zoomTransitionRef.current.phase === 0) {
        // 줌아웃 단계
        if (transitionTime < 0.3) {
          // 0.3초 동안 1.1까지 줌아웃
          const targetZoom = 1.1;
          const progress = transitionTime / 0.3;
          setCurrentZoomLevel(
            zoomTransitionRef.current.fromLevel -
              (zoomTransitionRef.current.fromLevel - targetZoom) * progress
          );
        } else {
          // 줌아웃 완료, 줌인 단계로 전환
          zoomTransitionRef.current.phase = 1;
          zoomTransitionRef.current.startTime = now;
        }
      } else {
        // 줌인 단계
        if (transitionTime < 0.3) {
          // 0.3초 동안 원래 줌 레벨로 줌인
          let targetZoom = 1.1;

          // 결승선과의 거리에 따라 최종 줌 레벨 결정
          if (leadRacer && raceTrackConfig) {
            const finishLine = raceTrackConfig.width - 110;
            const distanceToFinish = finishLine - leadRacer.position;
            const visibleWidth =
              raceTrackConfig.visible_width || raceTrackConfig.width;

            if (distanceToFinish < visibleWidth * 0.2) {
              targetZoom = 1.5;
            } else if (distanceToFinish < visibleWidth * 0.3) {
              targetZoom = 1.3;
            }
          }

          const progress = transitionTime / 0.3;
          setCurrentZoomLevel(1.1 + (targetZoom - 1.1) * progress);
        } else {
          // 줌인 완료, 전환 효과 비활성화
          zoomTransitionRef.current.active = false;
        }
      }
    }

    // 보이는 영역 계산 (카메라 위치 기반)
    const visibleWidth = raceTrackConfig.visible_width || raceTrackConfig.width;
    const startX = raceCamera;
    const endX = startX + visibleWidth;

    // 줌 효과 적용 (현재 줌 레벨이 1.0과 충분히 다를 때만)
    if (Math.abs(currentZoomLevel - 1.0) > 0.01) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(currentZoomLevel, currentZoomLevel);
      ctx.translate(-centerX, -centerY);
    }

    // 스케일 계산 (서버 좌표를 캔버스 좌표로 변환)
    const scaleX = canvas.width / visibleWidth;
    const scaleY = canvas.height / raceTrackConfig.height;

    // 배경 그리기
    const trackImg = imagesRef.current.track;
    if (trackImg) {
      // 트랙 이미지를 스크롤 위치에 맞게 그리기
      const trackHeight = canvas.height;

      // 트랙 이미지를 반복해서 전체 트랙 길이를 채움
      const patternWidth = trackImg.width;
      const startPattern = Math.floor(startX / patternWidth) * patternWidth;

      // 화면에 보이는 모든 패턴 그리기
      for (let x = startPattern; x < endX + patternWidth; x += patternWidth) {
        const drawX = (x - startX) * scaleX;
        ctx.drawImage(trackImg, drawX, 0, patternWidth * scaleX, trackHeight);
      }
    }

    // 결승선 그리기
    const finishLineImg = imagesRef.current.finishLine;
    const finishLineLogicalPos = raceTrackConfig.width - 110;

    if (finishLineImg) {
      const finishLineCanvasX = (finishLineLogicalPos - startX) * scaleX;
      const finishLineWidth = finishLineImg.width * scaleX * 0.5;
      if (
        finishLineCanvasX + finishLineWidth > 0 &&
        finishLineCanvasX - finishLineWidth < canvas.width
      ) {
        ctx.drawImage(
          finishLineImg,
          finishLineCanvasX - finishLineWidth / 2,
          0,
          finishLineWidth,
          canvas.height
        );
      }
    }

    // 장애물 그리기 - 화면에 보이는 것만 렌더링
    raceObstacles.forEach((obstacle) => {
      if (!obstacle.active) return;

      // 화면에 보이는지 확인
      if (obstacle.position < startX || obstacle.position > endX) return;

      const obsImg = imagesRef.current[`obstacle${obstacle.type}`];
      if (obsImg) {
        const obstacleWidth = obstacle.width * scaleX;
        const obstacleHeight = obstacle.height * scaleY;
        const laneHeight = canvas.height / raceTrackConfig.num_lanes;

        const baseX = (obstacle.position - startX) * scaleX - obstacleWidth / 2;
        const baseY =
          obstacle.lane * laneHeight + (laneHeight - obstacleHeight) / 2;

        // +++ 추가: 장애물 회전 애니메이션 +++
        const angle = (Date.now() / 600 + obstacle.id * 0.5) % (2 * Math.PI); // 회전 속도 및 개별 오프셋 조정

        ctx.save();
        ctx.translate(baseX + obstacleWidth / 2, baseY + obstacleHeight / 2);
        ctx.rotate(angle);
        ctx.drawImage(
          obsImg,
          -obstacleWidth / 2,
          -obstacleHeight / 2,
          obstacleWidth,
          obstacleHeight
        );
        ctx.restore();
        // +++ 추가 끝 +++
      }
    });

    // 파워업 그리기 - 화면에 보이는 것만 렌더링
    racePowerups.forEach((powerup) => {
      if (!powerup.active) return;

      // 화면에 보이는지 확인
      if (powerup.position < startX || powerup.position > endX) return;

      const pwrImg = imagesRef.current[`powerup${powerup.type}`];
      if (pwrImg) {
        const powerupWidth = powerup.width * scaleX;
        const powerupHeight = powerup.height * scaleY;
        const laneHeight = canvas.height / raceTrackConfig.num_lanes;

        const x = (powerup.position - startX) * scaleX - powerupWidth / 2;
        const y = powerup.lane * laneHeight + (laneHeight - powerupHeight) / 2;

        // +++ 추가: 파워업 상하 움직임(Bobbing) 효과 추가 +++
        const bobbingFrequency = 180 + (powerup.id % 6) * 40; // 주기 조정
        const bobbingAmplitude = 4 * scaleY + (powerup.id % 4) * 1 * scaleY; // 진폭 조정
        const powerupBobOffset =
          Math.sin(now / bobbingFrequency) * bobbingAmplitude;

        ctx.drawImage(
          pwrImg,
          x,
          y + powerupBobOffset, // Y 좌표에 오프셋 적용
          powerupWidth,
          powerupHeight
        );
        // +++ 추가 끝 +++
      }
    });

    // +++ 추가: 완료된 제거 애니메이션 정리 +++
    const currentAnimations = eliminationAnimations; // 현재 상태 복사
    let animationsChanged = false;
    currentAnimations.forEach((anim, racerId) => {
      if (now >= anim.startTime + anim.duration) {
        currentAnimations.delete(racerId);
        animationsChanged = true;
      }
    });
    if (animationsChanged) {
      setEliminationAnimations(new Map(currentAnimations));
    }
    // +++ 추가 끝 +++

    // 레이서 그리기
    const frameToUse = frozenFrame || lastCapturedFrame;

    if (frameToUse && racerPositions.length > 0 && raceFaces.length > 0) {
      // 얼굴 이미지 생성
      const faceImg = new Image();
      faceImg.src = frameToUse;

      // 중요: 레이서들을 위치에 따라 정렬 (먼저 그릴 레이서가 뒤로 정렬되도록)
      // 위치가 같은 경우는 z-index를 기준으로 정렬
      const sortedRacers = [...racerPositions].sort((a, b) => {
        // 같은 레인에 있는 경우, 위치로 정렬 (뒤에 있는 레이서가 먼저 그려짐)
        if (a.lane === b.lane) {
          return a.position - b.position;
        }
        // 다른 레인에 있는 경우는 원래 순서 유지
        return 0;
      });

      // 정렬된 순서로 레이서 그리기
      sortedRacers.forEach((racer) => {
        // --- 변경: 제거 애니메이션 중에는 racer.eliminated가 true여도 그림 ---
        const activeEliminationAnim = eliminationAnimations.get(racer.id);
        if (racer.eliminated && !activeEliminationAnim) {
          // 제거됐고 애니메이션 없으면 그리지 않음
          return;
        }
        // --- 변경 끝 ---

        if (racer.id >= raceFaces.length) return;

        const face = raceFaces[racer.id];
        if (!face) return;

        // 화면에 보이는지 확인
        if (racer.position < startX - 100 || racer.position > endX + 100)
          return; // 렌더링 범위 약간 확장

        const [x, y, w, h] = face;

        // 레이서 위치 계산 - 카메라 위치 기반 조정
        const racerX = (racer.position - startX) * scaleX;
        const laneHeight = canvas.height / raceTrackConfig.num_lanes;
        const racerY =
          racer.lane * laneHeight +
          (laneHeight - 60 * scaleY) / 2 +
          30 * scaleY;

        // z-index에 따라 크기 조정 (기존 로직 유지)
        const zIndexScale =
          racer.z_index !== undefined ? 1 - racer.z_index * 0.05 : 1;
        const finalScale = Math.max(0.7, zIndexScale);

        // z-index에 따라 약간 상하 위치 조정 (기존 로직 유지)
        const zIndexYOffset =
          racer.z_index !== undefined ? -racer.z_index * 5 * scaleY : 0;

        // 호버링 효과 (기존 로직 유지)
        const hoverOffset = Math.sin(Date.now() / 150) * 6 * scaleY;

        // --- 색상 선택 로직 (기존 로직 유지) ---
        const ufoColors = [
          "#FF1493",
          "#32CD32",
          "#1E90FF",
          "#FFD700",
          "#FF6347",
          "#00FFFF",
          "#9400D3",
          "#FFA500",
          "#00FF7F",
          "#8A2BE2",
          "#FF00FF",
          "#ADFF2F",
          "#0000FF",
          "#F0F8FF",
          "#DDA0DD",
          "#20B2AA",
          "#FF4500",
          "#7FFFD4",
          "#E6E6FA",
          "#FFC0CB",
          "#87CEEB",
          "#FA8072",
          "#FFFF00",
          "#FF69B4",
        ];
        const racersInSameLane = racerPositions.filter(
          (r) => r.lane === racer.lane
        );
        const indexInLane = racersInSameLane.findIndex(
          (r) => r.id === racer.id
        );
        const colorIndex =
          (indexInLane * raceTrackConfig.num_lanes + racer.lane) %
          ufoColors.length;
        const ufoColor = ufoColors[colorIndex];
        const glowColor = ufoColor; // 글로우 색상은 UFO 색상과 동일하게 유지

        ctx.save();

        // --- 충돌 시 화면 흔들림 효과 ---
        const currentCollisionEffect = collisionEffects.find(
          (effect) => effect.id === racer.id && effect.duration > 0
        );
        if (currentCollisionEffect) {
          const intensity = currentCollisionEffect.isShieldBreak ? 4 : 8; // 보호막 깨짐은 약하게, 일반 충돌은 강하게
          ctx.translate(
            Math.random() * intensity - intensity / 2,
            Math.random() * intensity - intensity / 2
          );
        }

        // +++ 추가: 제거 애니메이션 처리 +++
        let currentAlpha = 1.0;
        let currentScale = 1.0;
        if (activeEliminationAnim) {
          const elapsedTime = now - activeEliminationAnim.startTime;
          const progress = Math.min(
            elapsedTime / activeEliminationAnim.duration,
            1
          );

          // 부드러운 종료를 위해 easeInQuad 사용
          const easedProgress = progress * progress;

          currentScale = 1.0 - easedProgress; // 점점 작아짐
          currentAlpha = 1.0 - easedProgress; // 점점 투명해짐

          if (currentScale <= 0.01) {
            // 거의 사라졌으면 그리기 중단 (애니메이션 정리 로직이 처리할 것임)
            ctx.restore();
            return;
          }

          // 알파값 적용
          ctx.globalAlpha = currentAlpha;

          // 스케일 적용 (UFO 중심 기준)
          const ufoBaseX = racerX;
          const ufoBaseY = racerY + hoverOffset + zIndexYOffset;
          ctx.translate(ufoBaseX, ufoBaseY);
          ctx.scale(currentScale, currentScale);
          ctx.translate(-ufoBaseX, -ufoBaseY);
        }
        // +++ 추가 끝 +++

        // --- UFO와 얼굴 그리기 (개선된 로직) ---
        try {
          const ufoBaseX = racerX;
          const ufoBaseY = racerY + hoverOffset + zIndexYOffset;
          const ufoWidth = 90 * scaleX * finalScale * 1.15; // 너비 약간 증가
          const ufoHeight = 60 * scaleY * finalScale * 1.15; // 높이 약간 증가
          const domeRadiusX = ufoWidth * 0.45;
          const domeRadiusY = ufoHeight * 0.35;
          const bodyRadiusX = ufoWidth * 0.5;
          const bodyRadiusY = ufoHeight * 0.2;
          const bodyOffsetY = ufoHeight * 0.15; // 하단부 위치 조정

          // --- 엔진 분사 효과 (부스트 시 강화 추가) ---
          const currentPowerupEffect = powerupEffects.find(
            (effect) =>
              effect.id === racer.id && effect.type === 1 && effect.duration > 0
          );
          const isBoosting = currentPowerupEffect !== undefined;
          const boostMultiplier = isBoosting ? 1.5 : 1.0; // 부스트 시 강화 배율

          if (racer.speed > 1.5 || isBoosting) {
            const engineGlowIntensity = Math.min(
              1,
              (racer.speed - 1.5) / 3.5 + (isBoosting ? 0.3 : 0) // 부스트 시 기본 강도 증가
            );
            const engineLength =
              (15 + 20 * engineGlowIntensity) *
              scaleY *
              finalScale *
              boostMultiplier; // 부스트 시 길이 증가
            const engineWidth =
              (20 + 10 * engineGlowIntensity) *
              scaleX *
              finalScale *
              boostMultiplier *
              1.1; // 부스트 시 너비 약간 증가

            const engineGradient = ctx.createLinearGradient(
              ufoBaseX,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5,
              ufoBaseX,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5 + engineLength
            );

            // 부스트 시 색상 더 밝게 (흰색에 가깝게)
            const engineColorStart = `rgba(${Math.min(
              255,
              100 + 155 * engineGlowIntensity + (isBoosting ? 50 : 0)
            )}, ${Math.min(
              255,
              200 + 55 * engineGlowIntensity + (isBoosting ? 50 : 0)
            )}, 255, ${
              0.6 + 0.3 * engineGlowIntensity + (isBoosting ? 0.1 : 0)
            })`;
            const engineColorEnd = `rgba(${Math.min(
              255,
              200 + 55 * engineGlowIntensity + (isBoosting ? 50 : 0)
            )}, ${Math.min(
              255,
              230 + 25 * engineGlowIntensity + (isBoosting ? 25 : 0)
            )}, 255, 0)`;

            engineGradient.addColorStop(0, engineColorStart);
            engineGradient.addColorStop(1, engineColorEnd);

            ctx.fillStyle = engineGradient;
            ctx.beginPath();
            ctx.moveTo(
              ufoBaseX - engineWidth / 2,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5
            );
            ctx.lineTo(
              ufoBaseX + engineWidth / 2,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5
            );
            ctx.lineTo(
              ufoBaseX + engineWidth * 0.2,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5 + engineLength
            );
            ctx.lineTo(
              ufoBaseX - engineWidth * 0.2,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5 + engineLength
            );
            ctx.closePath();
            ctx.fill();
          }

          // --- 글로우 효과 (기존 로직 개선) ---
          const glowRadius = domeRadiusX * 1.2; // 글로우 범위 약간 조정
          const glowGradient = ctx.createRadialGradient(
            ufoBaseX,
            ufoBaseY,
            0,
            ufoBaseX,
            ufoBaseY,
            glowRadius
          );
          glowGradient.addColorStop(0, glowColor + "60"); // 중앙은 약간 더 진하게
          glowGradient.addColorStop(0.7, glowColor + "30");
          glowGradient.addColorStop(1, "transparent");

          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(ufoBaseX, ufoBaseY, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // --- UFO 하단부 (개선: 그라데이션 적용) ---
          const bodyGradient = ctx.createLinearGradient(
            ufoBaseX,
            ufoBaseY + bodyOffsetY - bodyRadiusY,
            ufoBaseX,
            ufoBaseY + bodyOffsetY + bodyRadiusY
          );
          bodyGradient.addColorStop(0, "#555"); // 상단은 조금 더 밝게
          bodyGradient.addColorStop(1, "#222"); // 하단은 어둡게

          ctx.fillStyle = bodyGradient;
          ctx.beginPath();
          ctx.ellipse(
            ufoBaseX,
            ufoBaseY + bodyOffsetY,
            bodyRadiusX,
            bodyRadiusY,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          // 하단부 테두리 (디테일 추가)
          ctx.strokeStyle = "#777";
          ctx.lineWidth = 1 * finalScale;
          ctx.stroke();

          // --- UFO 돔 (개선: 그라데이션 적용) ---
          const domeGradient = ctx.createRadialGradient(
            ufoBaseX,
            ufoBaseY - domeRadiusY * 0.5,
            domeRadiusY * 0.1, // 그라데이션 중심을 약간 위로
            ufoBaseX,
            ufoBaseY,
            domeRadiusX * 1.1 // 그라데이션 범위 확장
          );
          // Hex 색상을 RGB로 변환하고 밝기 조절
          const hexToRgb = (hex: string) => {
            const bigint = parseInt(hex.slice(1), 16);
            return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
          };
          const rgbColor = hexToRgb(ufoColor);
          const lighterColor = `rgba(${Math.min(
            255,
            rgbColor[0] + 50
          )}, ${Math.min(255, rgbColor[1] + 50)}, ${Math.min(
            255,
            rgbColor[2] + 50
          )}, 1)`;
          const darkerColor = `rgba(${Math.max(
            0,
            rgbColor[0] - 30
          )}, ${Math.max(0, rgbColor[1] - 30)}, ${Math.max(
            0,
            rgbColor[2] - 30
          )}, 1)`;

          domeGradient.addColorStop(0, lighterColor); // 중앙 하이라이트
          domeGradient.addColorStop(0.8, ufoColor);
          domeGradient.addColorStop(1, darkerColor); // 가장자리 어둡게

          ctx.fillStyle = domeGradient;
          ctx.beginPath();
          // 반원이 아닌 위쪽이 더 둥근 형태로 수정
          ctx.ellipse(
            ufoBaseX,
            ufoBaseY,
            domeRadiusX,
            domeRadiusY,
            0,
            Math.PI,
            Math.PI * 2
          );
          ctx.fill();

          // --- UFO 창문 (개선: 반사광 효과 추가) ---
          const windowRadiusX = domeRadiusX * 0.92; // 창문 가로 비율 증가 (0.85 -> 0.92)
          const windowRadiusY = domeRadiusY * 0.88; // 창문 세로 비율 증가 (0.8 -> 0.88)
          const windowGradient = ctx.createLinearGradient(
            ufoBaseX - windowRadiusX,
            ufoBaseY - windowRadiusY,
            ufoBaseX + windowRadiusX,
            ufoBaseY + windowRadiusY * 0.5
          );
          windowGradient.addColorStop(0, "rgba(230, 240, 255, 0.7)"); // 밝은 반사광
          windowGradient.addColorStop(0.5, "rgba(200, 225, 255, 0.4)");
          windowGradient.addColorStop(1, "rgba(180, 210, 240, 0.6)"); // 약간 어두운 부분

          ctx.fillStyle = windowGradient;
          ctx.beginPath();
          ctx.ellipse(
            ufoBaseX,
            ufoBaseY,
            windowRadiusX,
            windowRadiusY,
            0,
            Math.PI,
            Math.PI * 2
          );
          ctx.fill();
          // 창문 테두리
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1 * finalScale;
          ctx.stroke();

          // --- 얼굴 이미지 그리기 (원형 클리핑 개선) ---
          const faceClipRadiusX = windowRadiusX * 0.9; // 얼굴 클리핑 가로 비율 증가 (0.85 -> 0.9)
          const faceClipRadiusY = windowRadiusY * 0.9; // 얼굴 클리핑 세로 비율 증가 (0.85 -> 0.9)
          const faceOffsetY = -domeRadiusY * 0.05; // 얼굴 위치 미세 조정 (창문 커짐에 따라 약간 위로)

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            ufoBaseX,
            ufoBaseY + faceOffsetY,
            faceClipRadiusX,
            faceClipRadiusY,
            0,
            0,
            Math.PI * 2
          );
          ctx.clip();

          // 얼굴 이미지 크기 및 위치 조정
          const faceDrawSize = Math.max(faceClipRadiusX, faceClipRadiusY) * 1.5; // 원래 비율 (1.5배) 로 복원
          ctx.drawImage(
            faceImg,
            x,
            y,
            w,
            h,
            ufoBaseX - faceDrawSize / 2,
            ufoBaseY + faceOffsetY - faceDrawSize / 2,
            faceDrawSize,
            faceDrawSize
          );
          ctx.restore(); // 클리핑 복원

          // --- 작은 UFO 불빛 (기존 로직 개선: 위치 조정) ---
          const lightPhase = (Date.now() / 200) % (2 * Math.PI);
          const lightRadius = 3 * scaleX * finalScale;
          const lightPositions = [-bodyRadiusX * 0.6, 0, bodyRadiusX * 0.6]; // 몸체 너비에 맞춰 위치 조정
          lightPositions.forEach((pos, idx) => {
            const thisLightIntensity = (Math.sin(lightPhase + idx * 2) + 1) / 2;
            ctx.fillStyle = `rgba(255, 255, 255, ${
              thisLightIntensity * 0.8 + 0.2
            })`;
            ctx.beginPath();
            ctx.arc(
              ufoBaseX + pos,
              ufoBaseY + bodyOffsetY + bodyRadiusY * 0.5, // 몸체 하단 라인에 위치
              lightRadius,
              0,
              Math.PI * 2
            );
            ctx.fill();
          });

          // --- 보호막 효과 (기존 로직 유지) ---
          if (racer.shield_active) {
            const shieldRadius = Math.max(domeRadiusX, bodyRadiusX) * 1.15; // UFO 크기에 맞게
            const shieldOpacity = Math.min(1, (racer.shield_timer || 0) / 60); // 남은 시간에 따라 투명도 조절 (0~1)
            const shieldPulse = Math.sin(Date.now() / 150) * 0.1 + 0.9; // 약하게 깜빡이는 효과

            const shieldGradient = ctx.createRadialGradient(
              ufoBaseX,
              ufoBaseY,
              shieldRadius * 0.5 * shieldPulse,
              ufoBaseX,
              ufoBaseY,
              shieldRadius * shieldPulse
            );
            shieldGradient.addColorStop(
              0,
              `rgba(100, 180, 255, ${0.1 * shieldOpacity})`
            ); // 중앙은 더 투명하게
            shieldGradient.addColorStop(
              0.8,
              `rgba(100, 180, 255, ${0.5 * shieldOpacity})`
            );
            shieldGradient.addColorStop(
              1,
              `rgba(150, 220, 255, ${0.8 * shieldOpacity})`
            ); // 가장자리는 더 진하게

            ctx.fillStyle = shieldGradient;
            ctx.beginPath();
            ctx.arc(
              ufoBaseX,
              ufoBaseY,
              shieldRadius * shieldPulse,
              0,
              Math.PI * 2
            );
            ctx.fill();

            // 보호막 테두리 (선택적)
            ctx.strokeStyle = `rgba(200, 230, 255, ${
              0.6 * shieldOpacity * shieldPulse
            })`;
            ctx.lineWidth = 2 * finalScale;
            ctx.stroke();
          }

          // --- 우승자 표시 (기존 로직 개선: 위치/크기 조정) ---
          if (raceWinner !== null && racer.id === raceWinner) {
            ctx.strokeStyle = "gold";
            ctx.lineWidth = 4 * finalScale; // 선 굵기 증가
            ctx.beginPath();
            ctx.arc(
              ufoBaseX,
              ufoBaseY, // UFO 중심 기준
              Math.max(domeRadiusX, bodyRadiusX) * 1.1, // UFO 전체 크기에 맞게 조정
              0,
              Math.PI * 2
            );
            ctx.stroke();

            // 우승 효과 (회전하는 별 - 기존 로직 유지, 위치/크기 조정)
            const time = Date.now() / 100;
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * 2 * Math.PI + time / 10;
              const starOrbitRadius = Math.max(domeRadiusX, bodyRadiusX) * 1.3; // 별 궤도 반경 조정
              const starRadius = 15 * scaleX * finalScale;
              const starX = ufoBaseX + Math.cos(angle) * starOrbitRadius;
              const starY = ufoBaseY + Math.sin(angle) * starOrbitRadius * 0.8; // Y축 궤도 약간 압축

              // 별 그리기 (기존 로직 유지)
              ctx.fillStyle = "gold";
              ctx.beginPath();
              for (let j = 0; j < 5; j++) {
                const starAngle = (j * 2 * Math.PI) / 5 - Math.PI / 2;
                const px = starX + Math.cos(starAngle) * starRadius;
                const py = starY + Math.sin(starAngle) * starRadius;
                if (j === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
                const innerX =
                  starX +
                  Math.cos(starAngle + Math.PI / 5) * (starRadius / 2.5);
                const innerY =
                  starY +
                  Math.sin(starAngle + Math.PI / 5) * (starRadius / 2.5);
                ctx.lineTo(innerX, innerY);
              }
              ctx.closePath();
              ctx.fill();
            }
          }

          // --- 속도선 효과 (부스트 시 강화) ---
          if (racer.speed > 2.5 || isBoosting) {
            const speedLineCount = Math.floor(
              racer.speed * (isBoosting ? 3 : 2)
            ); // 부스트 시 라인 증가
            ctx.strokeStyle = `rgba(255, 255, 255, ${isBoosting ? 0.9 : 0.7})`; // 부스트 시 더 밝게
            ctx.lineWidth = (isBoosting ? 2.5 : 2) * finalScale; // 부스트 시 약간 두껍게

            for (let i = 0; i < speedLineCount; i++) {
              const lineLength =
                (Math.random() * (isBoosting ? 30 : 20) +
                  (isBoosting ? 15 : 10)) * // 부스트 시 길이 증가
                scaleX *
                finalScale *
                (racer.speed / 3);
              const lineStartX =
                ufoBaseX -
                bodyRadiusX * (isBoosting ? 0.9 : 0.8) - // 부스트 시 조금 더 앞에서 시작
                Math.random() * bodyRadiusX * 0.5;
              const lineY = ufoBaseY + (Math.random() - 0.5) * ufoHeight * 0.8;
              ctx.beginPath();
              ctx.moveTo(lineStartX, lineY);
              ctx.lineTo(lineStartX - lineLength, lineY);
              ctx.stroke();
            }
          }

          // --- 충돌 효과 (개선) ---
          if (currentCollisionEffect) {
            const initialDuration = currentCollisionEffect.isShieldBreak
              ? 25
              : 20; // 초기 duration 값 참조
            const effectProgress = Math.max(
              0,
              currentCollisionEffect.duration / initialDuration
            ); // 진행률 계산 (0~1)

            if (currentCollisionEffect.isShieldBreak) {
              // 보호막 깨짐 효과 (날카로운 파편 + 섬광)
              // 섬광
              const flashOpacity = Math.max(0, effectProgress * 0.8); // 서서히 사라짐
              ctx.fillStyle = `rgba(180, 220, 255, ${flashOpacity})`;
              ctx.beginPath();
              ctx.arc(
                ufoBaseX,
                ufoBaseY,
                Math.max(domeRadiusX, bodyRadiusX) * 1.4,
                0,
                Math.PI * 2
              );
              ctx.fill();

              // 파편 (더 날카롭게, 빠르게)
              ctx.fillStyle = `rgba(100, 180, 255, ${
                0.6 + Math.random() * 0.4
              })`;
              const particleCount = 12; // 파티클 수 증가
              for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = (1 - effectProgress) * 40 + 10; // 빠르게 퍼져나감
                const dist = speed + Math.random() * 15; // 초기 거리 추가
                const size = (Math.random() * 2 + 1.5) * scaleX * finalScale; // 크기 약간 작게
                const px = ufoBaseX + Math.cos(angle) * dist;
                const py = ufoBaseY + Math.sin(angle) * dist * 0.8;

                // 파편 모양 (얇은 사각형)
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(angle);
                ctx.fillRect(-size * 1.5, -size / 2, size * 3, size); // 길쭉하게
                ctx.restore();
              }
            } else {
              // 일반 충돌 효과 (강한 흔들림 + 스파크 + UFO 깜빡임)

              // 스파크 효과
              ctx.fillStyle = `rgba(255, ${Math.random() * 150 + 50}, 0, ${
                0.7 + Math.random() * 0.3
              })`; // 주황~빨강
              const sparkCount = 10;
              for (let i = 0; i < sparkCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const sparkDist =
                  (Math.random() * 0.5 + 0.5) *
                  Math.max(domeRadiusX, bodyRadiusX) *
                  (1 + (1 - effectProgress) * 0.5); // 바깥으로 퍼짐
                const sparkSize = (Math.random() * 3 + 2) * scaleX * finalScale;
                const px = ufoBaseX + Math.cos(angle) * sparkDist;
                const py = ufoBaseY + Math.sin(angle) * sparkDist * 0.8;
                ctx.fillRect(
                  px - sparkSize / 2,
                  py - sparkSize / 2,
                  sparkSize,
                  sparkSize
                );
              }

              // UFO 깜빡임 (반투명 빨간색 오버레이)
              const blinkOpacity =
                Math.sin(effectProgress * Math.PI * 2) * 0.4 + 0.1; // 깜빡이는 효과 (2번)
              if (blinkOpacity > 0) {
                ctx.fillStyle = `rgba(255, 0, 0, ${blinkOpacity})`;
                // 돔 부분
                ctx.beginPath();
                ctx.ellipse(
                  ufoBaseX,
                  ufoBaseY,
                  domeRadiusX,
                  domeRadiusY,
                  0,
                  Math.PI,
                  Math.PI * 2
                );
                ctx.fill();
                // 하단부 부분
                ctx.beginPath();
                ctx.ellipse(
                  ufoBaseX,
                  ufoBaseY + bodyOffsetY,
                  bodyRadiusX,
                  bodyRadiusY,
                  0,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              }
            }
          }

          // --- 파워업 효과 (부스트 오라 개선) ---
          if (currentPowerupEffect) {
            const initialDuration = 60; // 부스트 초기 duration
            const powerupTimeRatio = Math.max(
              0,
              currentPowerupEffect.duration / initialDuration
            ); // 남은 시간 비율 (0~1)

            // 부스트 오라 (파동 추가)
            const baseAuraRadius = ufoWidth * 0.8;
            const pulse = Math.sin(Date.now() / 80) * baseAuraRadius * 0.15; // 부드러운 파동
            const auraRadius =
              (baseAuraRadius + pulse) * (0.5 + powerupTimeRatio * 0.5); // 시간에 따라 크기 감소

            const gradCenter = ctx.createRadialGradient(
              ufoBaseX,
              ufoBaseY,
              auraRadius * 0.1,
              ufoBaseX,
              ufoBaseY,
              auraRadius
            );
            const alpha = 0.6 + powerupTimeRatio * 0.3; // 시간에 따라 투명도 감소
            gradCenter.addColorStop(0, `rgba(0, 255, 255, ${alpha * 0.9})`);
            gradCenter.addColorStop(0.6, `rgba(0, 200, 255, ${alpha * 0.5})`);
            gradCenter.addColorStop(1, `rgba(0, 150, 255, 0)`);
            ctx.fillStyle = gradCenter;
            ctx.beginPath();
            ctx.arc(ufoBaseX, ufoBaseY, auraRadius, 0, Math.PI * 2);
            ctx.fill();

            // 부스트 파티클 (트레일 효과 일부 대체) - 선택적
            ctx.fillStyle = `rgba(0, 200, 255, ${
              0.3 + powerupTimeRatio * 0.4
            })`;
            const particleCount = 5;
            for (let i = 0; i < particleCount; i++) {
              const angle = Math.random() * Math.PI + Math.PI / 2; // 뒤쪽으로만
              const dist = Math.random() * ufoWidth * 0.5 + ufoWidth * 0.3;
              const size = Math.random() * 2 + 1;
              ctx.beginPath();
              ctx.arc(
                ufoBaseX + Math.cos(angle) * dist,
                ufoBaseY + Math.sin(angle) * dist * 0.5,
                size * finalScale,
                0,
                Math.PI * 2
              );
              ctx.fill();
            }
          }
        } catch (error) {
          console.error("Error drawing racer:", error);
        } finally {
          // 제거 애니메이션 알파 복원
          if (activeEliminationAnim) {
            ctx.globalAlpha = 1.0;
          }
          // 모든 변환 및 상태 복원
          ctx.restore();
        }
      });
    }

    // 줌 효과를 적용했으면 복원
    if (Math.abs(currentZoomLevel - 1.0) > 0.01) {
      ctx.restore();
    }

    // --- 상태 업데이트: 효과 지속 시간 감소 및 만료된 효과 제거 ---
    setCollisionEffects(
      (prevEffects) =>
        prevEffects
          .map((eff) => ({ ...eff, duration: eff.duration - 1 })) // 모든 효과의 duration 감소
          .filter((eff) => eff.duration > 0) // duration이 0보다 큰 효과만 남김
    );
    setPowerupEffects(
      (prevEffects) =>
        prevEffects
          .map((eff) => ({ ...eff, duration: eff.duration - 1 })) // 모든 효과의 duration 감소
          .filter((eff) => eff.duration > 0) // duration이 0보다 큰 효과만 남김
    );

    // 애니메이션 프레임 요청
    animationRef.current = requestAnimationFrame(drawRace);
  }, [
    imagesLoaded,
    raceActive,
    raceTrackConfig,
    raceObstacles,
    racePowerups,
    racerPositions,
    raceWinner,
    frozenFrame,
    lastCapturedFrame,
    raceFaces,
    collisionEffects,
    powerupEffects,
    raceCamera,
    currentZoomLevel,
    eliminationAnimations,
  ]);

  // 이펙트 처리 함수들
  const addCollisionEffect = useCallback(
    (racerId: number, isShieldBreak: boolean = false) => {
      setCollisionEffects((prev) =>
        prev.filter((effect) => effect.id !== racerId)
      );
      setCollisionEffects((prev) => [
        ...prev,
        { id: racerId, duration: isShieldBreak ? 40 : 35, isShieldBreak },
      ]);
    },
    []
  );

  const addPowerupEffect = useCallback((racerId: number, type: number) => {
    setPowerupEffects((prev) => prev.filter((effect) => effect.id !== racerId));
    setPowerupEffects((prev) => [
      ...prev,
      { id: racerId, duration: type === 1 ? 60 : 0, type },
    ]);
  }, []);

  // +++ 추가: 제거 애니메이션 시작 함수 +++
  const startEliminationAnimation = useCallback(
    (racerId: number) => {
      if (!canvasRef.current || !raceTrackConfig || !racerPositions) return;

      const racer = racerPositions.find((r) => r.id === racerId);
      if (!racer) return; // 제거 대상 레이서를 찾을 수 없음

      const canvas = canvasRef.current;
      const scaleX =
        canvas.width / (raceTrackConfig.visible_width || raceTrackConfig.width);
      const startX = raceCamera; // 현재 카메라 위치

      // 레이서의 현재 시각적 위치 계산 (drawRace 로직과 유사하게)
      const racerDrawX = (racer.position - startX) * scaleX;
      const laneHeight = canvas.height / raceTrackConfig.num_lanes;
      const racerDrawY = racer.lane * laneHeight + laneHeight / 2; // UFO 중심 Y좌표 근사치

      const duration = 500; // 0.5초 애니메이션

      setEliminationAnimations((prev) => {
        const next = new Map(prev);
        // 이미 애니메이션 중이면 시작하지 않음
        if (!next.has(racerId)) {
          next.set(racerId, {
            startTime: Date.now(),
            duration: duration,
            x: racerDrawX, // 시작 X 위치 (참고용, 현재는 사용 안 함)
            y: racerDrawY, // 시작 Y 위치 (참고용, 현재는 사용 안 함)
          });
        }
        return next;
      });
    },
    [racerPositions, raceTrackConfig, raceCamera] // 필요한 의존성 추가
  );
  // +++ 추가 끝 +++

  // 웹소켓 메시지 효과 처리
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        if (message.type === "race_collision" && raceActive) {
          const collisionMessage = message as RaceCollisionMessage;
          if (collisionMessage.is_elimination) {
            // --- 변경: 제거 애니메이션 시작 함수 호출 ---
            startEliminationAnimation(collisionMessage.racer_id);
            // --- 변경 끝 ---
          } else {
            addCollisionEffect(
              collisionMessage.racer_id,
              !!collisionMessage.shield_broken
            );
          }
        }
        if (message.type === "race_powerup" && raceActive) {
          const powerupMessage = message as RacePowerupMessage;
          if (powerupMessage.powerup_type === 1) {
            addPowerupEffect(powerupMessage.racer_id, 1);
          }
        }
      } catch (error) {
        console.error("Error handling websocket message:", error);
      }
    };

    websocket.addEventListener("message", handleMessage);

    return () => {
      websocket.removeEventListener("message", handleMessage);
    };
  }, [
    websocket,
    raceActive,
    addCollisionEffect,
    addPowerupEffect,
    startEliminationAnimation,
  ]);

  // 컴포넌트 마운트 시 이미지 로드
  useEffect(() => {
    if (raceActive) {
      loadImages();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [raceActive, loadImages]);

  // 이미지 로드 후 렌더링 시작
  useEffect(() => {
    if (imagesLoaded && raceActive) {
      drawRace();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [imagesLoaded, raceActive, drawRace]);

  // 컴포넌트 마운트 시 줌 초기화
  useEffect(() => {
    setCurrentZoomLevel(1.0);
  }, []);

  // 캔버스 크기 조정
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 카운트다운 관리 (계속)
  useEffect(() => {
    // raceCountdown이 변경될 때마다 실행
    if (raceCountdown !== null) {
      setShowCountdown(true);

      // "GO"일 때만 타이머 설정
      if (raceCountdown === "GO") {
        const timer = setTimeout(() => {
          setShowCountdown(false);
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [raceCountdown]);

  // 결승선 근처 줌 효과 관리
  useEffect(() => {
    if (!racerPositions.length || !raceTrackConfig || !raceActive) return;

    // 우승자가 결정되면 이 효과는 적용하지 않음 (우승자 줌 효과가 우선)
    if (raceWinner !== null) return;

    // 선두 주자 찾기
    const leadRacer = racerPositions.reduce((prev, current) =>
      prev.position > current.position ? prev : current
    );

    // 결승선 위치
    const finishLine = raceTrackConfig.width - 110;
    const distanceToFinish = finishLine - leadRacer.position;
    const visibleWidth = raceTrackConfig.visible_width || raceTrackConfig.width;

    // 결승선 근처에서 줌 효과 적용
    if (distanceToFinish < visibleWidth * 0.5) {
      let targetZoom = 1.0;

      if (distanceToFinish < visibleWidth * 0.2) {
        targetZoom = 1.5; // 결승선 매우 가까움
      } else if (distanceToFinish < visibleWidth * 0.3) {
        targetZoom = 1.3; // 결승선 가까움
      }

      // 줌 전환 효과가 진행 중이면 그것을 우선
      if (!zoomTransitionRef.current.active) {
        // 점진적으로 목표 줌 레벨로 변경
        if (Math.abs(targetZoom - currentZoomLevel) > 0.01) {
          setCurrentZoomLevel((prevZoom) => {
            return prevZoom + (targetZoom - prevZoom) * 0.05; // 5%씩 목표에 접근
          });
        }
      }
    } else if (currentZoomLevel > 1.01 && !zoomTransitionRef.current.active) {
      // 결승선에서 멀어졌을 때 원래 줌 레벨로 복귀
      setCurrentZoomLevel((prevZoom) => {
        return prevZoom + (1.0 - prevZoom) * 0.05; // 5%씩 1.0에 접근
      });
    }
  }, [
    racerPositions,
    raceTrackConfig,
    currentZoomLevel,
    raceWinner,
    raceActive,
  ]);

  if (!raceActive) return null;

  return (
    <RaceContainer>
      <RaceCanvas ref={canvasRef} />

      {raceCountdown && showCountdown && (
        <CountdownOverlay>{raceCountdown}</CountdownOverlay>
      )}

      {raceWinner !== null && <WinnerOverlay>🏆 우승!</WinnerOverlay>}
    </RaceContainer>
  );
};

export default RaceAnimation;
