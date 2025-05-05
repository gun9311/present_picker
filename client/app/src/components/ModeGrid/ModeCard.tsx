import React from "react";
import styled from "@emotion/styled";

interface ModeCardProps {
  id: string;
  name: string;
  icon: string;
  color: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
  onClick: () => void;
}

const Card = styled.div<{ bgColor: string }>`
  background-color: ${(props) => props.bgColor};
  border-radius: 15px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 180px;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }
`;

const IconText = styled.span`
  font-size: 32px;
  margin-bottom: 10px;
`;

const ModeName = styled.h3`
  color: white;
  margin: 0;
  text-align: center;
  font-size: 18px;
`;

const StatusText = styled.span`
  color: white;
  font-size: 14px;
  margin-top: 10px;
`;

const ModeCard: React.FC<ModeCardProps> = ({
  id,
  name,
  icon,
  color,
  connectionStatus,
  onClick,
}) => {
  return (
    <Card bgColor={color} onClick={onClick}>
      <IconText>{icon}</IconText>
      <ModeName>{name}</ModeName>
      {/* {connectionStatus === "connecting" && <StatusText>연결 중...</StatusText>} */}
    </Card>
  );
};

export default ModeCard;
