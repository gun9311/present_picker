/**
 * 웹 버전에서는 Electron 업데이트 확인 기능이 없으므로 아무 작업도 하지 않습니다.
 * @param setUpdateInfo 업데이트 정보 상태 변경 함수 (사용 안 함)
 * @param setShowUpdateNotification 알림 표시 상태 변경 함수 (사용 안 함)
 * @returns 빈 클린업 함수
 */
export const setupUpdates = (
    setUpdateInfo: (info: any | null) => void,
    setShowUpdateNotification: (show: boolean) => void
): (() => void) => {
    // 웹 환경에서는 콘솔에 메시지만 출력하거나 아무것도 안 함
    // console.log("[Web Version] Update check setup skipped.");
    return () => {}; // 빈 클린업 함수 반환
};