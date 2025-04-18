import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import Header from "./components/Header/Header";
import ModeGrid from "./components/ModeGrid/ModeGrid";
import LicenseInfo from "./components/Footer/LicenseInfo";

// --- IPC 통신 위한 코드 추가 ---
let ipcRendererInstance: Electron.IpcRenderer | null = null;
try {
  ipcRendererInstance = window.require("electron").ipcRenderer;
} catch (e) {
  console.error(
    "ipcRenderer 로드 실패. Electron 환경이 아니거나 nodeIntegration이 꺼져있을 수 있습니다.",
    e
  );
}
// --- 여기까지 추가 ---

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
  // --- 상태 및 useEffect 추가 ---
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    if (ipcRendererInstance) {
      console.log("[Renderer Process] update-available 리스너 등록 시도");

      const handleUpdateAvailable = (
        event: Electron.IpcRendererEvent,
        info: UpdateInfo
      ) => {
        console.log(
          "[Renderer Process] <<< update-available 메시지 수신! >>>",
          info
        );
        setUpdateInfo(info);
        setShowUpdateNotification(true);
      };

      // 리스너 등록
      ipcRendererInstance.on("update-available", handleUpdateAvailable);
      console.log("[Renderer Process] update-available 리스너 등록 완료");

      // --- 추가: 메인 프로세스로 준비 완료 메시지 전송 ---
      console.log("[Renderer Process] >>> renderer-ready 메시지 전송 >>>");
      ipcRendererInstance.send("renderer-ready");
      // --- 여기까지 추가 ---

      // 컴포넌트 언마운트 시 리스너 제거
      return () => {
        console.log("[Renderer Process] update-available 리스너 제거");
        ipcRendererInstance?.removeListener(
          "update-available",
          handleUpdateAvailable
        );
      };
    } else {
      console.warn(
        "[Renderer Process] ipcRenderer 사용 불가, 리스너 등록 실패"
      );
    }
  }, []); // 빈 배열: 마운트 시 한 번만 실행

  const handleCloseNotification = () => {
    setShowUpdateNotification(false);
  };
  // --- 여기까지 추가 ---

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
