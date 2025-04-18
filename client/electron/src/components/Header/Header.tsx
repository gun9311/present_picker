import React, { useState } from "react";
import styled from "@emotion/styled";
import FeedbackModal from "./FeedbackModal";

const HeaderContainer = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 25px;
  background-color: #1a1a1a;
  border-radius: 10px;
  margin-bottom: 20px;
`;

const LogoTitleWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const Logo = styled.img`
  width: 45px;
  height: 45px;
  margin-right: 15px;
`;

const Title = styled.h1`
  color: #e0e0e0;
  margin: 0;
  font-size: 22px;
  font-weight: 1000;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
`;

const FeedbackButton = styled.button`
  background-color: #3a3a3a;
  color: #b0b0b0;
  border: none;
  border-radius: 6px;
  padding: 8px 15px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background-color: #4a4a4a;
    color: #ffffff;
  }
`;

const Header: React.FC = () => {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleFeedbackClick = () => {
    setIsFeedbackModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsFeedbackModalOpen(false);
  };

  return (
    <>
      <HeaderContainer>
        <LogoTitleWrapper>
          <Logo src="/logo.png" alt="Presenter Picker" />
          <Title>SPOTLIGHT - 오늘의 랜덤 뽑기</Title>
        </LogoTitleWrapper>
        <FeedbackButton onClick={handleFeedbackClick}>
          💡 의견 보내기
        </FeedbackButton>
      </HeaderContainer>

      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={handleCloseModal} />
    </>
  );
};

export default Header;
