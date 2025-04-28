import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import Header from "./components/Header/Header";
import ModeGrid from "./components/ModeGrid/ModeGrid";
import LicenseInfo from "./components/Footer/LicenseInfo";

const AppContainer = styled.div`
  background-color: #2d2d2d;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ContentWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative; /* 알림 위치 기준 */
`;

const MainContent = styled.main`
  flex: 1;
  /* 필요시 ModeGrid 아래 여백 추가: padding-bottom: 10px; */
`;

const Footer = styled.footer`
  text-align: center;
  padding: 5px 0;
`;

// --- 업데이트 알림 스타일 추가 ---
const UpdateNotification = styled.div`
  position: fixed; /* 화면에 고정 */
  bottom: 20px;
  right: 20px;
  background-color: #007bff;
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  z-index: 1200; /* 다른 요소 위에 표시 */
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 350px; /* 너비 제한 */

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  a {
    color: #e0e0e0;
    text-decoration: underline;
    font-weight: bold;
    cursor: pointer;
    align-self: flex-start; /* 링크 왼쪽 정렬 */

    &:hover {
      color: white;
    }
  }

  button {
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 5px;
  }
`;
// --- 여기까지 추가 ---

interface UpdateInfo {
  latestVersion: string;
  message?: string;
  downloadUrl?: string;
}

function App() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    let cleanup = () => {}; // 클린업 함수 초기화

    // --- 동적 import로 변경 ---
    const loadUpdateHandler = async () => {
      // 빌드 시점에 결정된 환경 변수 사용
      const platform = import.meta.env.VITE_TARGET_PLATFORM;
      console.log("Loading update handler for platform:", platform);

      if (platform === "electron") {
        // Electron 타겟일 경우 electron 핸들러 로드
        const { setupUpdates } = await import("./updateHandler.electron"); // 경로 직접 지정
        cleanup = setupUpdates(setUpdateInfo, setShowUpdateNotification);
      } else {
        // 웹 타겟일 경우 web 핸들러 로드
        const { setupUpdates } = await import("./updateHandler.web"); // 경로 직접 지정
        cleanup = setupUpdates(setUpdateInfo, setShowUpdateNotification);
      }
    };

    loadUpdateHandler();
    // --- 여기까지 변경 ---

    // 비동기 로드 후 클린업 함수가 설정되므로, useEffect 반환값은 그대로 둠
    return () => {
      cleanup();
    };
  }, []); // 빈 의존성 배열 유지

  const handleCloseNotification = () => {
    setShowUpdateNotification(false);
  };

  return (
    <AppContainer>
      <ContentWrapper>
        <Header />
        <MainContent>
          <ModeGrid />
        </MainContent>
        <Footer>
          <LicenseInfo />
        </Footer>

        {/* 업데이트 알림 UI 추가 */}
        {showUpdateNotification && updateInfo && (
          <UpdateNotification>
            <button onClick={handleCloseNotification}>×</button>
            <p>
              <strong>새 버전 사용 가능: {updateInfo.latestVersion}</strong>
            </p>
            {updateInfo.message && <p>{updateInfo.message}</p>}
            {updateInfo.downloadUrl && (
              <a
                href={updateInfo.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                다운로드 페이지로 이동
              </a>
            )}
          </UpdateNotification>
        )}
        {/* 여기까지 추가 */}
      </ContentWrapper>
    </AppContainer>
  );
}

export default App;
