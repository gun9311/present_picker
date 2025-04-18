import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";

// nodeIntegration: true 설정 덕분에 ipcRenderer를 직접 require 가능
let ipcRendererInstance: Electron.IpcRenderer | null = null;
try {
  // 'require'는 Node.js 환경에서 사용되므로, 렌더러 프로세스에서는 window 객체를 통해 접근 시도
  ipcRendererInstance = window.require("electron").ipcRenderer;
} catch (e) {
  console.error(
    "ipcRenderer 로드 실패. Electron 환경이 아니거나 nodeIntegration이 꺼져있을 수 있습니다.",
    e
  );
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
`;
const ModalContent = styled.div`
  background-color: #2d2d2d;
  padding: 30px;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
`;
const ModalTitle = styled.h2`
  color: white;
  margin: 0 0 10px 0;
  text-align: center;
  font-size: 20px;
`;
const FeedbackTextarea = styled.textarea`
  width: 100%;
  height: 150px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #555;
  background-color: #3a3a3a;
  color: #e0e0e0;
  font-size: 14px;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;
const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;
const StyledButton = styled.button<{ variant?: "primary" | "secondary" }>`
  background-color: ${(props) =>
    props.variant === "primary" ? "#007bff" : "#555"};
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    filter: brightness(1.1);
  }
  &:disabled {
    background-color: #444;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [feedbackText, setFeedbackText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ipcAvailable, setIpcAvailable] = useState(false);

  useEffect(() => {
    if (ipcRendererInstance) {
      setIpcAvailable(true);
    } else {
      console.warn("FeedbackModal: ipcRenderer 사용 불가.");
    }
  }, []);

  const handleSendFeedback = () => {
    if (!feedbackText.trim() || !ipcAvailable) return;
    setIsSending(true);

    if (ipcRendererInstance) {
      console.log("피드백 전송 시도:", feedbackText);
      ipcRendererInstance.send("send-feedback", feedbackText);
      setFeedbackText("");
      setIsSending(false);
      onClose();
      alert("소중한 의견 감사합니다!");
    } else {
      console.error("ipcRenderer 사용 불가로 피드백 전송 실패");
      alert("피드백 전송 기능에 문제가 발생했습니다.");
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalTitle>💡 소중한 의견을 보내주세요</ModalTitle>
        <FeedbackTextarea
          placeholder="앱 사용 중 불편했던 점이나 개선 아이디어를 자유롭게 적어주세요."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          disabled={isSending || !ipcAvailable}
        />
        <ButtonContainer>
          <StyledButton
            variant="secondary"
            onClick={onClose}
            disabled={isSending}
          >
            닫기
          </StyledButton>
          <StyledButton
            variant="primary"
            onClick={handleSendFeedback}
            disabled={isSending || !feedbackText.trim() || !ipcAvailable}
          >
            {isSending ? "보내는 중..." : "보내기"}
          </StyledButton>
        </ButtonContainer>
        {!ipcAvailable && (
          <p
            style={{
              color: "orange",
              fontSize: "12px",
              textAlign: "center",
              marginTop: "10px",
            }}
          >
            피드백 전송 기능을 사용할 수 없습니다.
          </p>
        )}
      </ModalContent>
    </ModalOverlay>
  );
};

// require 사용 위한 타입 정의 (선택적이지만 권장)
declare global {
  interface Window {
    require?: (module: "electron") => { ipcRenderer: Electron.IpcRenderer };
  }
}

export default FeedbackModal;
