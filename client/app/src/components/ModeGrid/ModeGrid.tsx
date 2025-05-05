import React, { useState, useMemo, useCallback, useEffect } from "react";
import styled from "@emotion/styled";
import ModeCard from "./ModeCard";
import { modes } from "../../constants/modes";
import { useWebSocket } from "../../hooks/useWebSocket";
import AnimationModal from "../Modal/AnimationModal";
import { AnimationMode } from "../Animation/types";

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 20px 20px 0;
`;

// --- 추가: 알림 메시지 스타일 ---
const NotificationArea = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(255, 0, 0, 0.8); // 에러 배경색 (빨간색)
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  z-index: 2000; // 모달보다 위에 표시
  font-size: 16px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s ease-in-out;
  opacity: ${(props: { show: boolean }) => (props.show ? 1 : 0)};
  pointer-events: ${(props: { show: boolean }) =>
    props.show ? "auto" : "none"};
`;
// --- 스타일 추가 끝 ---

const ModeGrid: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [connectToWebSocket, setConnectToWebSocket] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null); // 입장 요청 보낼 모드 임시 저장
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  ); // 입장 불가 시 에러 메시지

  // const WS_URL = import.meta.env.VITE_WS_URL;
  // const WS_URL = "wss://t-bot.site/ws/animation";
  const WS_URL = "ws://localhost:8000/ws/animation";

  if (!WS_URL) {
    throw new Error("VITE_WS_URL is not defined in .env file");
  }

  const {
    connectionStatus,
    websocket,
    lastMessage,
    sendMessage,
  } = // lastMessage, sendMessage 추가
    useWebSocket(WS_URL, connectToWebSocket);

  // handleModeSelect 로직 수정
  const handleModeSelect = useCallback(
    (modeId: string) => {
      console.log(`[ModeGrid] 모드 선택됨: ${modeId}`);
      setAvailabilityError(null); // 이전 에러 메시지 초기화
      setSelectedMode(modeId); // 선택된 모드 ID 저장 (모달 제목 등에서 사용)
      setPendingMode(modeId); // 입장 확인 요청할 모드 저장
      setConnectToWebSocket(true); // 웹소켓 연결 시작/유지
      // setIsModalOpen(true); // <<-- 즉시 모달 열지 않음
    },
    [
      setAvailabilityError,
      setSelectedMode,
      setPendingMode,
      setConnectToWebSocket,
    ]
  );

  // 웹소켓 연결 완료 시 입장 가능 여부 확인 요청 보내기
  useEffect(() => {
    if (
      connectionStatus === "connected" &&
      pendingMode &&
      websocket &&
      websocket.readyState === WebSocket.OPEN
    ) {
      console.log(
        `[ModeGrid] 웹소켓 연결 완료, ${pendingMode} 모드 입장 가능 여부 확인 요청 전송`
      );
      const modeToSend = modes.find((m) => m.id === pendingMode)
        ?.id as AnimationMode; // 실제 모드 ID (enum 값) 추출
      if (modeToSend) {
        sendMessage({
          type: "check_availability",
          mode: modeToSend,
        });
      } else {
        console.error(`[ModeGrid] 유효하지 않은 모드 ID: ${pendingMode}`);
        setAvailabilityError("선택된 모드가 유효하지 않습니다.");
        setConnectToWebSocket(false); // 연결 끊기
      }
      setPendingMode(null); // 요청 보냈으므로 임시 상태 초기화
    }
  }, [connectionStatus, pendingMode, websocket, sendMessage]);

  // 서버로부터의 응답 처리
  useEffect(() => {
    if (lastMessage?.type === "availability_response") {
      console.log(
        `[ModeGrid] 입장 가능 여부 응답 수신: ${JSON.stringify(lastMessage)}`
      );
      const responseMode = modes.find((m) => m.id === lastMessage.mode)?.id; // 응답의 모드 ID 가져오기

      // 현재 사용자가 선택하려고 했던 모드에 대한 응답인지 확인
      if (responseMode && responseMode === selectedMode) {
        if (lastMessage.allowed) {
          console.log(
            `[ModeGrid] ${selectedMode} 모드 입장 허용됨. 모달 열기.`
          );
          setIsModalOpen(true); // 입장 허용 시 모달 열기
          setAvailabilityError(null); // 에러 메시지 없음
        } else {
          console.log(
            `[ModeGrid] ${selectedMode} 모드 입장 불가 (${lastMessage.reason}). 모달 닫고 연결 끊기.`
          );
          let errorMsg = "모드 입장에 실패했습니다.";
          if (lastMessage.reason === "limit_reached") {
            errorMsg = "해당 모드는 현재 참여 인원이 가득 찼습니다.";
          } else if (lastMessage.reason === "invalid_mode") {
            errorMsg = "선택한 모드를 서버에서 처리할 수 없습니다.";
          }
          setAvailabilityError(errorMsg); // 에러 메시지 설정
          setIsModalOpen(false); // 모달 열지 않음 (혹시 열렸다면 닫기)
          setConnectToWebSocket(false); // 웹소켓 연결 끊기
          setSelectedMode(null); // 선택된 모드 초기화 (중요)
        }
      } else {
        console.warn(
          `[ModeGrid] 현재 선택된 모드(${selectedMode})와 다른 모드(${responseMode})에 대한 응답 수신 무시.`
        );
      }
    }
  }, [
    lastMessage,
    selectedMode,
    setIsModalOpen,
    setAvailabilityError,
    setConnectToWebSocket,
    setSelectedMode,
  ]);

  // 에러 메시지 타임아웃 처리
  useEffect(() => {
    if (availabilityError) {
      const timer = setTimeout(() => {
        setAvailabilityError(null);
      }, 3000); // 3초 후 에러 메시지 숨김
      return () => clearTimeout(timer); // 컴포넌트 언마운트 또는 에러 변경 시 타이머 클리어
    }
  }, [availabilityError]);

  const handleCloseModal = useCallback(() => {
    console.log("[ModeGrid] 모달 닫기 요청");
    setIsModalOpen(false);
    setSelectedMode(null);
    setConnectToWebSocket(false); // 모달 닫을 때 웹소켓 연결 확실히 중단
    setAvailabilityError(null); // 에러 메시지 초기화
  }, [
    setIsModalOpen,
    setSelectedMode,
    setConnectToWebSocket,
    setAvailabilityError,
  ]);

  const getModeName = (modeId: string | null): string => {
    if (!modeId) return "";
    // 모드 ID ('slot', 'roulette' 등)를 실제 이름 ('슬롯머신' 등)으로 변환
    return modes.find((mode) => mode.id === modeId)?.name || modeId;
  };

  const modeItems = useMemo(() => {
    return modes.map((mode) => (
      <ModeCard
        key={mode.id}
        {...mode}
        connectionStatus={connectionStatus}
        onClick={() => handleModeSelect(mode.id)}
      />
    ));
  }, [handleModeSelect, connectionStatus]);

  return (
    <>
      {/* 에러 알림 표시 영역 */}
      <NotificationArea show={!!availabilityError}>
        {availabilityError}
      </NotificationArea>

      <GridContainer>{modeItems}</GridContainer>

      {/* 모달은 isModalOpen 상태에 따라 조건부 렌더링 */}
      {isModalOpen && (
        <AnimationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          websocket={websocket}
          modeName={getModeName(selectedMode)} // 선택된 모드 이름 전달
          connectionStatus={connectionStatus} // 연결 상태 전달
        />
      )}
    </>
  );
};

export default ModeGrid;
