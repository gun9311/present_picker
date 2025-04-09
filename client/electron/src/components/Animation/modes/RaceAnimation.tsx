import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { AnimationProps } from "../types";
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
  top: 20px;
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
    { id: number; duration: number }[]
  >([]);
  const [powerupEffects, setPowerupEffects] = useState<
    { id: number; duration: number }[]
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

  // 이미지 로드 함수
  const loadImages = useCallback(() => {
    const imageUrls = {
      track: "assets/images/race/race_track.png",
      obstacle1: "assets/images/race/obstacle1.png",
      obstacle2: "assets/images/race/obstacle2.png",
      powerup1: "assets/images/race/powerup1.png",
      powerup2: "assets/images/race/powerup2.png",
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
            const finishLine = raceTrackConfig.width - 70;
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

    // 배경 그리기
    const trackImg = imagesRef.current.track;
    if (trackImg) {
      // 트랙 이미지를 스크롤 위치에 맞게 그리기
      const trackHeight = canvas.height;

      // 트랙 이미지를 반복해서 전체 트랙 길이를 채움
      const patternWidth = trackImg.width;
      const startPattern = Math.floor(startX / patternWidth) * patternWidth;

      // 화면에 보이는 모든 패턴 그리기
      for (let x = startPattern; x < endX; x += patternWidth) {
        const drawX = x - startX;
        ctx.drawImage(trackImg, drawX, 0, patternWidth, trackHeight);
      }
    }

    // 스케일 계산 (서버 좌표를 캔버스 좌표로 변환)
    const scaleX = canvas.width / visibleWidth;
    const scaleY = canvas.height / raceTrackConfig.height;

    // 장애물 그리기 - 화면에 보이는 것만 렌더링
    raceObstacles.forEach((obstacle) => {
      if (!obstacle.active) return;

      // 화면에 보이는지 확인
      if (obstacle.position < startX || obstacle.position > endX) return;

      const obsImg = imagesRef.current[`obstacle${obstacle.type}`];
      if (obsImg) {
        const x =
          (obstacle.position - startX) * scaleX - (obstacle.width * scaleX) / 2;
        const y =
          obstacle.lane * (canvas.height / raceTrackConfig.num_lanes) +
          (canvas.height / raceTrackConfig.num_lanes -
            obstacle.height * scaleY) /
            2;

        ctx.drawImage(
          obsImg,
          x,
          y,
          obstacle.width * scaleX,
          obstacle.height * scaleY
        );
      }
    });

    // 파워업 그리기 - 화면에 보이는 것만 렌더링
    racePowerups.forEach((powerup) => {
      if (!powerup.active) return;

      // 화면에 보이는지 확인
      if (powerup.position < startX || powerup.position > endX) return;

      const pwrImg = imagesRef.current[`powerup${powerup.type}`];
      if (pwrImg) {
        const x =
          (powerup.position - startX) * scaleX - (powerup.width * scaleX) / 2;
        const y =
          powerup.lane * (canvas.height / raceTrackConfig.num_lanes) +
          (canvas.height / raceTrackConfig.num_lanes -
            powerup.height * scaleY) /
            2;

        // 파워업 회전 애니메이션
        const angle = (Date.now() / 500) % (2 * Math.PI);

        ctx.save();
        ctx.translate(
          x + (powerup.width * scaleX) / 2,
          y + (powerup.height * scaleY) / 2
        );
        ctx.rotate(angle);
        ctx.drawImage(
          pwrImg,
          (-powerup.width * scaleX) / 2,
          (-powerup.height * scaleY) / 2,
          powerup.width * scaleX,
          powerup.height * scaleY
        );
        ctx.restore();
      }
    });

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
        if (racer.id >= raceFaces.length) return;

        const face = raceFaces[racer.id];
        if (!face) return;

        // 화면에 보이는지 확인
        if (racer.position < startX - 50 || racer.position > endX + 50) return;

        const [x, y, w, h] = face;

        // 레이서 위치 계산 - 카메라 위치 기반 조정
        const racerX = (racer.position - startX) * scaleX;
        const laneHeight = canvas.height / raceTrackConfig.num_lanes;
        const racerY =
          racer.lane * laneHeight +
          (laneHeight - 60 * scaleY) / 2 +
          30 * scaleY;

        // z-index에 따라 크기 조정 (뒤에 있는 참가자는 더 작게 표시)
        const zIndexScale =
          racer.z_index !== undefined ? 1 - racer.z_index * 0.05 : 1;
        // 최소 크기 제한 (70% 이하로는 작아지지 않도록)
        const finalScale = Math.max(0.7, zIndexScale);

        // z-index에 따라 약간 상하 위치 조정 (뒤에 있는 참가자는 약간 위로)
        const zIndexYOffset =
          racer.z_index !== undefined ? -racer.z_index * 5 * scaleY : 0;

        // 호버링 효과 (위아래 움직임)
        const hoverOffset = Math.sin(Date.now() / 150) * 6 * scaleY;

        // 캐릭터마다 다른 색상 지정 (ID 기반)
        // 다양한 UFO 색상 팔레트 (네온 느낌의 밝은 색상들)
        const ufoColors = [
          "#FF1493", // 딥 핑크
          "#32CD32", // 라임 그린
          "#1E90FF", // 도지 블루
          "#FFD700", // 골드
          "#FF6347", // 토마토
          "#00FFFF", // 시안
          "#9400D3", // 다크 바이올렛
          "#FFA500", // 오렌지
          "#00FF7F", // 스프링 그린
          "#8A2BE2", // 블루 바이올렛
          "#FF00FF", // 마젠타
          "#ADFF2F", // 그린 옐로우
          "#0000FF", // 블루
          "#F0F8FF", // 엘리스 블루
          "#DDA0DD", // 플럼
          "#20B2AA", // 라이트 시 그린
          "#FF4500", // 오렌지 레드
          "#7FFFD4", // 아쿠아마린
          "#E6E6FA", // 라벤더
          "#FFC0CB", // 핑크
          "#87CEEB", // 스카이 블루
          "#FA8072", // 샐몬
          "#FFFF00", // 옐로우
          "#FF69B4", // 핫 핑크
        ];

        // 색상 선택 방법 변경 - 같은 레인에 있는 레이서들이 더 잘 구분되도록
        // 레이서의 위치에 따라 색상을 선택 (같은 레인에 있는 레이서들은 서로 다른 색상 가지도록)
        // 각 레인에 있는 레이서들을 찾아서 해당 레인 내에서의 순서 결정
        const racersInSameLane = racerPositions.filter(
          (r) => r.lane === racer.lane
        );
        const indexInLane = racersInSameLane.findIndex(
          (r) => r.id === racer.id
        );

        // 레인 내에서의 순서와 전체 레인 수를 고려하여 색상 인덱스 결정
        // 이렇게 하면 같은 레인에 있는 레이서들은 색상 팔레트에서 간격을 두고 색상이 선택됨
        const colorIndex =
          (indexInLane * raceTrackConfig.num_lanes + racer.lane) %
          ufoColors.length;
        const ufoColor = ufoColors[colorIndex];

        // UFO 글로우 효과 색상 (약간 더 밝게)
        const glowColor = ufoColor;

        ctx.save();

        // UFO와 얼굴 그리기
        try {
          // 글로우 효과
          const gradientRadius = 50 * scaleX * finalScale;
          const glowGradient = ctx.createRadialGradient(
            racerX,
            racerY + hoverOffset + zIndexYOffset,
            0,
            racerX,
            racerY + hoverOffset + zIndexYOffset,
            gradientRadius
          );
          glowGradient.addColorStop(0, glowColor + "80"); // 반투명
          glowGradient.addColorStop(1, "transparent");

          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(
            racerX,
            racerY + hoverOffset + zIndexYOffset,
            gradientRadius,
            0,
            Math.PI * 2
          );
          ctx.fill();

          // UFO 하단부 (타원)
          ctx.fillStyle = "#333";
          ctx.beginPath();
          ctx.ellipse(
            racerX,
            racerY + 10 * scaleY * finalScale + hoverOffset + zIndexYOffset,
            35 * scaleX * finalScale * 1.15,
            15 * scaleY * finalScale * 1.15,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          // UFO 돔 (반원)
          ctx.fillStyle = ufoColor;
          ctx.beginPath();
          ctx.arc(
            racerX,
            racerY + hoverOffset + zIndexYOffset,
            45 * scaleX * finalScale * 1.15,
            Math.PI,
            Math.PI * 2
          );
          ctx.fill();

          // UFO 창문/투명 돔
          ctx.fillStyle = "rgba(200, 225, 255, 0.5)";
          ctx.beginPath();
          ctx.arc(
            racerX,
            racerY + hoverOffset + zIndexYOffset,
            40 * scaleX * finalScale * 1.15,
            Math.PI,
            Math.PI * 2
          );
          ctx.fill();

          // 얼굴 이미지 그리기 (원형으로 클리핑)
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            racerX,
            racerY - 5 * scaleY * finalScale + hoverOffset + zIndexYOffset,
            35 * scaleX * finalScale,
            30 * scaleY * finalScale,
            0,
            0,
            Math.PI * 2
          );
          ctx.clip();

          // 얼굴 이미지 - 크기와 위치 조정
          ctx.drawImage(
            faceImg,
            x,
            y,
            w,
            h,
            racerX - 25 * scaleX * finalScale,
            racerY - 30 * scaleY * finalScale + hoverOffset + zIndexYOffset,
            50 * scaleX * finalScale,
            50 * scaleY * finalScale
          );
          ctx.restore();

          // 빛/광선 효과 (UFO 밑에서 나오는 빛)
          const lightGradient = ctx.createLinearGradient(
            racerX,
            racerY + 10 * scaleY * finalScale + hoverOffset + zIndexYOffset,
            racerX,
            racerY + 30 * scaleY * finalScale + hoverOffset + zIndexYOffset
          );
          lightGradient.addColorStop(0, ufoColor + "80"); // 반투명
          lightGradient.addColorStop(1, "transparent");

          ctx.fillStyle = lightGradient;
          ctx.beginPath();
          ctx.moveTo(
            racerX - 20 * scaleX * finalScale,
            racerY + 10 * scaleY * finalScale + hoverOffset + zIndexYOffset
          );
          ctx.lineTo(
            racerX + 20 * scaleX * finalScale,
            racerY + 10 * scaleY * finalScale + hoverOffset + zIndexYOffset
          );
          ctx.lineTo(
            racerX + 35 * scaleX * finalScale,
            racerY + 30 * scaleY * finalScale + hoverOffset + zIndexYOffset
          );
          ctx.lineTo(
            racerX - 35 * scaleX * finalScale,
            racerY + 30 * scaleY * finalScale + hoverOffset + zIndexYOffset
          );
          ctx.fill();

          // 작은 UFO 불빛 (깜빡이는 효과)
          const lightPhase = (Date.now() / 200) % (2 * Math.PI);
          const lightRadius = 3 * scaleX * finalScale;

          // 3개의 작은 불빛
          const lightPositions = [-25, 0, 25];
          lightPositions.forEach((pos, idx) => {
            // 각 불빛마다 약간 다른 깜빡임 위상
            const thisLightIntensity = (Math.sin(lightPhase + idx * 2) + 1) / 2;

            ctx.fillStyle = `rgba(255, 255, 255, ${
              thisLightIntensity * 0.8 + 0.2
            })`;
            ctx.beginPath();
            ctx.arc(
              racerX + pos * scaleX * finalScale,
              racerY + 10 * scaleY * finalScale + hoverOffset + zIndexYOffset,
              lightRadius,
              0,
              Math.PI * 2
            );
            ctx.fill();
          });

          // 우승자 표시
          if (raceWinner !== null && racer.id === raceWinner) {
            ctx.strokeStyle = "gold";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(
              racerX,
              racerY + hoverOffset + zIndexYOffset,
              60 * scaleX * finalScale,
              0,
              Math.PI * 2
            );
            ctx.stroke();

            // 우승 효과 (회전하는 별)
            const time = Date.now() / 100;
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * 2 * Math.PI + time / 10;
              const starRadius = 15 * scaleX * finalScale;
              const starX = racerX + Math.cos(angle) * 80 * scaleX * finalScale;
              const starY =
                racerY +
                hoverOffset +
                zIndexYOffset +
                Math.sin(angle) * 70 * scaleY * finalScale;

              // 별 그리기
              ctx.fillStyle = "gold";
              ctx.beginPath();
              for (let j = 0; j < 5; j++) {
                const starAngle = (j * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = starX + Math.cos(starAngle) * starRadius;
                const y = starY + Math.sin(starAngle) * starRadius;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);

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

          // 속도선 효과 (빠르게 달릴 때)
          if (racer.speed > 2.5) {
            const speedLineCount = Math.floor(racer.speed * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctx.lineWidth = 2;

            for (let i = 0; i < speedLineCount; i++) {
              const lineX =
                racerX -
                50 * scaleX * finalScale -
                Math.random() * 40 * scaleX * finalScale;
              const lineY =
                racerY +
                hoverOffset +
                zIndexYOffset +
                (Math.random() - 0.5) * 20 * scaleY * finalScale;
              const lineLength =
                Math.random() * 20 * scaleX * finalScale +
                10 * scaleX * finalScale;

              ctx.beginPath();
              ctx.moveTo(lineX, lineY);
              ctx.lineTo(lineX - lineLength, lineY);
              ctx.stroke();
            }
          }

          // 충돌 효과
          if (collisionEffects.some((effect) => effect.id === racer.id)) {
            const intensity = Math.random() * 5 * scaleX * finalScale;
            ctx.translate(
              Math.random() * intensity - intensity / 2,
              Math.random() * intensity - intensity / 2
            );

            // 충돌 별 효과
            ctx.fillStyle = "red";
            const starCount = 3;
            for (let i = 0; i < starCount; i++) {
              const starX =
                racerX + (Math.random() - 0.5) * 40 * scaleX * finalScale;
              const starY =
                racerY +
                hoverOffset +
                zIndexYOffset +
                (Math.random() - 0.5) * 40 * scaleY * finalScale;

              ctx.beginPath();
              ctx.moveTo(starX, starY);

              for (let j = 0; j < 6; j++) {
                const angle = (Math.PI * 2 * j) / 6;
                const radius =
                  j % 2 === 0
                    ? 10 * scaleX * finalScale
                    : 5 * scaleX * finalScale;
                ctx.lineTo(
                  starX + Math.cos(angle) * radius,
                  starY + Math.sin(angle) * radius
                );
              }

              ctx.closePath();
              ctx.fill();
            }
          }

          // 파워업 효과
          if (powerupEffects.some((effect) => effect.id === racer.id)) {
            // 파워업 오라 효과
            const gradCenter = ctx.createRadialGradient(
              racerX,
              racerY + hoverOffset + zIndexYOffset,
              5 * scaleX * finalScale,
              racerX,
              racerY + hoverOffset + zIndexYOffset,
              70 * scaleX * finalScale
            );

            gradCenter.addColorStop(0, "rgba(0, 255, 255, 0.8)");
            gradCenter.addColorStop(1, "rgba(0, 255, 255, 0)");

            ctx.fillStyle = gradCenter;
            ctx.beginPath();
            ctx.arc(
              racerX,
              racerY + hoverOffset + zIndexYOffset,
              70 * scaleX * finalScale,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        } catch (error) {
          console.error("Error drawing racer:", error);
        }

        ctx.restore();
      });
    }

    // 줌 효과를 적용했으면 복원
    if (Math.abs(currentZoomLevel - 1.0) > 0.01) {
      ctx.restore();
    }

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
  ]);

  // 이펙트 처리 함수들
  const addCollisionEffect = useCallback((racerId: number) => {
    setCollisionEffects((prev) => [...prev, { id: racerId, duration: 10 }]);

    // 일정 시간 후 효과 제거
    setTimeout(() => {
      setCollisionEffects((prev) =>
        prev.filter((effect) => effect.id !== racerId)
      );
    }, 500);
  }, []);

  const addPowerupEffect = useCallback((racerId: number) => {
    setPowerupEffects((prev) => [...prev, { id: racerId, duration: 20 }]);

    // 일정 시간 후 효과 제거
    setTimeout(() => {
      setPowerupEffects((prev) =>
        prev.filter((effect) => effect.id !== racerId)
      );
    }, 1000);
  }, []);

  // 웹소켓 메시지 효과 처리
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // 충돌 효과 처리
        if (message.type === "race_collision" && raceActive) {
          addCollisionEffect(message.racer_id);
        }

        // 파워업 효과 처리
        if (message.type === "race_powerup" && raceActive) {
          addPowerupEffect(message.racer_id);
        }
      } catch (error) {
        console.error("Error handling websocket message:", error);
      }
    };

    websocket.addEventListener("message", handleMessage);

    return () => {
      websocket.removeEventListener("message", handleMessage);
    };
  }, [websocket, raceActive, addCollisionEffect, addPowerupEffect]);

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
    const finishLine = raceTrackConfig.width - 70;
    const distanceToFinish = finishLine - leadRacer.position;
    const visibleWidth = raceTrackConfig.visible_width || raceTrackConfig.width;

    // 결승선 근처에서 줌 효과 적용
    if (distanceToFinish < visibleWidth * 0.5) {
      let targetZoom = 1.0;

      if (distanceToFinish < visibleWidth * 0.2) {
        targetZoom = 1.5; // 결승선 매우 가까움
      } else if (distanceToFinish < visibleWidth * 0.3) {
        targetZoom = 1.3; // 결승선 가까움
      } else {
        targetZoom = 1.1; // 결승선 약간 가까움
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
