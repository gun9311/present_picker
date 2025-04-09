import React from "react";
import styled from "@emotion/styled";

const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  padding: 20px;
  background-color: #1a1a1a;
  border-radius: 10px;
  margin-bottom: 20px;
`;

const Logo = styled.img`
  width: 50px;
  height: 50px;
  margin-right: 20px;
`;

const Title = styled.h1`
  color: #ffffff;
  margin: 0;
  font-size: 24px;
`;

const Header: React.FC = () => {
  return (
    <HeaderContainer>
      <Logo src="/logo.png" alt="Presenter Picker" />
      <Title>SPOTLIGHT - 오늘의 랜덤 뽑기</Title>
    </HeaderContainer>
  );
};

export default Header;
