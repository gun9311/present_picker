import React from "react";
import styled from "@emotion/styled";

const FooterContainer = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: #1a1a1a;
  border-radius: 10px;
  margin-top: 20px;
`;

const Button = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    opacity: 0.9;
  }
`;

const FeedbackButton = styled(Button)`
  background-color: #4a90e2;
  color: white;
`;

const ExitButton = styled(Button)`
  background-color: #e24a4a;
  color: white;
`;

const Footer: React.FC = () => {
  const handleFeedback = () => {
    // 나중에 피드백 기능 구현
    console.log("피드백 버튼 클릭");
  };

  const handleExit = () => {
    // Electron의 window 종료
    if (window.electron) {
      window.electron.close();
    }
  };

  return (
    <FooterContainer>
      <FeedbackButton onClick={handleFeedback}>💡 피드백 보내기</FeedbackButton>
      <ExitButton onClick={handleExit}>🚪 프로그램 종료</ExitButton>
    </FooterContainer>
  );
};

export default Footer;
