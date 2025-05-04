import React, { useState, useMemo, useCallback } from "react";
import styled from "@emotion/styled";
import ModeCard from "./ModeCard";
import { modes } from "../../constants/modes";
import { useWebSocket } from "../../hooks/useWebSocket";
import AnimationModal from "../Modal/AnimationModal";

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 20px 20px 0;
`;

const ModeGrid: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [connectToWebSocket, setConnectToWebSocket] = useState(false);

  // const WS_URL = import.meta.env.VITE_WS_URL;
  // const WS_URL = "wss://t-bot.site/ws/animation";
  const WS_URL = "ws://localhost:8000/ws/animation";

  if (!WS_URL) {
    throw new Error("VITE_WS_URL is not defined in .env file");
  }

  const { connectionStatus, websocket } = useWebSocket(
    WS_URL,
    connectToWebSocket
  );

  // handleModeSelect를 useCallback으로 래핑하여 안정적인 함수 참조 생성
  const handleModeSelect = useCallback((modeId: string) => {
    setSelectedMode(modeId);
    setConnectToWebSocket(true); // 모드 선택 시 웹소켓 연결 시작
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMode(null);
    setConnectToWebSocket(false); // 모달 닫을 때 웹소켓 연결 중단
  };

  const getModeName = (modeId: string | null) => {
    return modes.find((mode) => mode.id === modeId)?.name || "";
  };

  // 모드 데이터를 useMemo로 최적화
  const modeItems = useMemo(() => {
    return modes.map((mode) => (
      <ModeCard
        key={mode.id}
        {...mode}
        connectionStatus="connected"
        onClick={() => handleModeSelect(mode.id)}
      />
    ));
  }, [handleModeSelect]); // 의존성 배열에 안정적인 함수 참조 추가

  return (
    <>
      <GridContainer>{modeItems}</GridContainer>

      <AnimationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        websocket={websocket}
        modeName={getModeName(selectedMode)}
        connectionStatus={connectionStatus}
      />
    </>
  );
};

export default ModeGrid;
