import React, { useState } from "react";
import styled from "@emotion/styled";
import { licenses } from "../../constants/licenses"; // 방금 만든 라이선스 데이터 가져오기

const TriggerText = styled.span`
  color: #aaa;
  cursor: pointer;
  text-decoration: underline;
  font-size: 12px;
  transition: color 0.2s;

  &:hover {
    color: #fff;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050; // AnimationModal보다 약간 높게 설정
`;

const ModalContent = styled.div`
  background-color: #3c3c3c;
  padding: 30px;
  border-radius: 8px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  color: #eee;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);

  h2 {
    margin-top: 0;
    color: #fff;
    border-bottom: 1px solid #555;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin-bottom: 15px;
    font-size: 14px;
    line-height: 1.6;
  }

  strong {
    color: #fff;
    font-weight: 600;
    display: block;
    margin-bottom: 3px;
  }

  a {
    color: #61dafb;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }

  button {
    background-color: #007bff;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-top: 20px;
    float: right; // 오른쪽 정렬

    &:hover {
      background-color: #0056b3;
    }
  }
`;

const LicenseInfo: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <TriggerText onClick={openModal}>Credits</TriggerText>

      {isModalOpen && (
        <ModalOverlay onClick={closeModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <h2>Licenses Info</h2>
            <ul>
              {licenses.map((license, index) => (
                <li key={index}>
                  <strong>
                    {license.type}: {license.name}
                  </strong>
                  <span>출처: {license.source}</span>
                  <br />
                  <span>라이선스: {license.license}</span>
                  {license.url && (
                    <>
                      <br />
                      <a
                        href={license.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        출처 링크
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <button onClick={closeModal}>닫기</button>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

export default LicenseInfo;
