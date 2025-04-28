// Electron의 ipcRenderer를 가져옵니다. 웹에서는 오류가 날 수 있으므로 try-catch 사용 가능
let ipcRendererInstance: Electron.IpcRenderer | null = null;
try {
  // 'window.require'는 Electron 환경에서만 사용 가능합니다.
  ipcRendererInstance = window.require("electron").ipcRenderer;
} catch (e) {
  // 웹 환경 등에서 실행될 경우 오류가 날 수 있습니다.
  // console.error("ipcRenderer load failed. Not in Electron environment?", e);
}

// App.tsx에서 사용하던 UpdateInfo 타입을 동일하게 정의 (또는 types.ts 같은 공통 파일로 옮겨도 좋습니다)
interface UpdateInfo {
  latestVersion: string;
  message?: string;
  downloadUrl?: string;
}

/**
 * Electron 환경에서 업데이트 관련 IPC 리스너를 설정하고
 * 메인 프로세스에 준비 완료 메시지를 보냅니다.
 * @param setUpdateInfo 업데이트 정보 상태 변경 함수
 * @param setShowUpdateNotification 알림 표시 상태 변경 함수
 * @returns 클린업 함수
 */
export const setupUpdates = (
  setUpdateInfo: (info: UpdateInfo | null) => void,
  setShowUpdateNotification: (show: boolean) => void
): (() => void) => {
  // 반환 타입을 명시적으로 지정 (클린업 함수)
  if (ipcRendererInstance) {
    console.log(
      "[Renderer Process] Setting up update-available listener (electron)"
    );

    // 업데이트 가능 이벤트 핸들러
    const handleUpdateAvailable = (
      event: Electron.IpcRendererEvent,
      info: UpdateInfo
    ) => {
      console.log(
        "[Renderer Process] <<< update-available message received >>>",
        info
      );
      setUpdateInfo(info);
      setShowUpdateNotification(true);
    };

    // 리스너 등록
    ipcRendererInstance.on("update-available", handleUpdateAvailable);
    console.log("[Renderer Process] update-available listener registered");

    // 메인 프로세스로 렌더러 준비 완료 메시지 전송
    console.log("[Renderer Process] >>> Sending renderer-ready message >>>");
    ipcRendererInstance.send("renderer-ready");

    // 컴포넌트 언마운트 시 리스너 제거를 위한 클린업 함수 반환
    return () => {
      console.log("[Renderer Process] Removing update-available listener");
      // 리스너 제거 시 null 체크 추가
      ipcRendererInstance?.removeListener(
        "update-available",
        handleUpdateAvailable
      );
    };
  } else {
    console.warn(
      "[Renderer Process] ipcRenderer is not available. Skipping update listener setup."
    );
    // ipcRenderer가 없는 경우에도 빈 클린업 함수 반환 (useEffect 반환 타입 일치)
    return () => {};
  }
};
