const { app, BrowserWindow, ipcMain } = require("electron");
const isDev = require("electron-is-dev");
const path = require("path");
const fs = require("fs");
const os = require("os");
const admin = require("firebase-admin");

// --- Firebase Admin SDK 초기화 ---
// !!! 경로 수정 !!!
const projectRoot = path.resolve(__dirname, "..", ".."); // 현재: client 폴더
const correctProjectRoot = path.resolve(projectRoot, ".."); // client 폴더 밖으로 한번 더 이동 -> presenter_picker 폴더
const serviceAccountPath = path.join(
  correctProjectRoot, // 수정된 프로젝트 루트 사용
  "config",
  "firebase",
  "service-account.json"
);
console.log(
  "[Main Process] 수정된 서비스 계정 키 경로 시도:",
  serviceAccountPath
); // 수정된 경로 확인

let db = null;
let mainWindow = null;
let isRendererReady = false; // --- 추가: 렌더러 준비 상태 플래그 ---
let pendingUpdateInfo = null; // --- 추가: 보류 중인 업데이트 정보 저장 ---

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath); // JSON 파일을 직접 require
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("[Main Process] Firebase Admin SDK 초기화 성공");
    } else {
      admin.app();
      console.log("[Main Process] Firebase Admin SDK 이미 초기화됨");
    }
    db = admin.firestore();
    // Firebase 초기화 후 바로 버전 체크 실행 (결과는 보류될 수 있음)
    checkAppVersion(); // <--- 호출 시점은 유지
  } else {
    console.warn(
      `[Main Process] 서비스 계정 키 파일을 찾을 수 없습니다: ${serviceAccountPath}`
    );
    console.warn(
      "[Main Process] Firebase 피드백 저장 기능이 작동하지 않습니다."
    );
  }
} catch (error) {
  console.error("[Main Process] Firebase Admin SDK 초기화 오류:", error);
  console.warn("[Main Process] Firebase 피드백 저장 기능이 작동하지 않습니다.");
}

// --- 버전 체크 함수 수정 ---
async function checkAppVersion() {
  if (!db) return;

  try {
    const currentVersion = app.getVersion();
    console.log(`[Main Process] 현재 앱 버전: ${currentVersion}`);

    const docRef = db.collection("app_info").doc("version");
    const doc = await docRef.get();

    if (!doc.exists) {
      console.warn(
        "[Main Process] Firestore에서 버전 정보를 찾을 수 없습니다."
      );
      return;
    }

    const latestVersionInfo = doc.data();
    const latestVersion = latestVersionInfo.latest_version;

    console.log(`[Main Process] Firestore 최신 버전: ${latestVersion}`);

    if (latestVersion && latestVersion > currentVersion) {
      console.log("[Main Process] 새로운 버전 발견.");
      const updateInfo = {
        // <--- 업데이트 정보 객체 생성
        latestVersion: latestVersion,
        message: latestVersionInfo.update_message,
        downloadUrl: latestVersionInfo.download_url,
      };

      // --- 수정: 렌더러 준비 상태 확인 후 전송 또는 보류 ---
      if (isRendererReady && mainWindow) {
        console.log("[Main Process] 렌더러 준비됨. 즉시 업데이트 알림 전송.");
        mainWindow.webContents.send("update-available", updateInfo);
      } else {
        console.log("[Main Process] 렌더러 미준비. 업데이트 정보 보류.");
        pendingUpdateInfo = updateInfo; // 정보를 변수에 저장
      }
      // --- 여기까지 수정 ---
    } else {
      console.log("[Main Process] 현재 버전이 최신 버전입니다.");
    }
  } catch (error) {
    console.error("[Main Process] 버전 체크 중 오류 발생:", error);
  }
}

function createWindow() {
  // 브라우저 창 생성
  mainWindow = new BrowserWindow({
    // mainWindow 변수에 할당
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // 로컬 리소스 접근 허용
    },
  });

  // 개발 모드일 때는 개발 서버에서, 프로덕션 모드일 때는 빌드된 파일을 로드
  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  // 개발 모드일 때는 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    // 창 닫힐 때 참조 해제
    mainWindow = null;
    isRendererReady = false; // --- 추가: 창 닫히면 준비 상태 리셋 ---
    pendingUpdateInfo = null; // --- 추가: 보류 정보 리셋 ---
  });

  // --- 추가: 웹 컨텐츠 로드가 완료된 후 renderer-ready 기다릴 준비 ---
  // 'did-finish-load' 이벤트는 HTML 로드는 완료되었지만 React 마운트 전일 수 있음
  // 하지만 renderer-ready 메시지를 기다리므로 괜찮음
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Main Process] mainWindow 웹 컨텐츠 로드 완료.");
    // 필요시 로드 완료 후 할 작업 추가
  });
}

// --- IPC 핸들러 추가 ---
ipcMain.on("send-feedback", async (event, feedbackText) => {
  console.log("[Main Process] 'send-feedback' 메시지 수신");

  if (!db) {
    console.error(
      "[Main Process] Firestore가 초기화되지 않아 피드백 저장 불가."
    );
    return; // 여기서 중단
  }
  if (typeof feedbackText !== "string" || !feedbackText.trim()) {
    console.warn("[Main Process] 비어있거나 유효하지 않은 피드백 텍스트 수신.");
    return; // 여기서 중단
  }

  try {
    // 사용자 ID는 아직 관리 로직이 없으므로 임시값 사용
    // TODO: UsageTracker.py 처럼 고유 ID 생성/관리 로직 추가 필요
    const userId = "temp_user_" + Math.random().toString(36).substring(2, 9);

    const feedbackData = {
      user_id: userId,
      feedback: feedbackText,
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Firestore 서버 시간 사용
      app_version: app.getVersion(), // Electron 앱 버전
      platform: `${os.platform()} ${os.release()}`, // OS 정보
    };
    const docRef = await db.collection("feedback").add(feedbackData);
    console.log("[Main Process] 피드백 저장 성공:", docRef.id);
    // 필요시 성공 응답을 렌더러로 보낼 수 있음
    // event.sender.send('feedback-sent-success', docRef.id);
  } catch (error) {
    console.error("[Main Process] Firestore 피드백 저장 중 오류:", error);
    // 필요시 오류 응답을 렌더러로 보낼 수 있음
    // event.sender.send('feedback-sent-error', error.message);
  }
});

// --- 추가: renderer-ready 메시지 핸들러 ---
ipcMain.on("renderer-ready", (event) => {
  console.log("[Main Process] <<< renderer-ready 메시지 수신! <<<");
  isRendererReady = true;

  // 보류 중인 업데이트 정보가 있으면 전송
  if (pendingUpdateInfo && mainWindow) {
    console.log("[Main Process] 보류된 업데이트 정보 전송.");
    mainWindow.webContents.send("update-available", pendingUpdateInfo);
    pendingUpdateInfo = null; // 전송 후 초기화
  }
});

// Electron 앱이 준비되면 창 생성
app.whenReady().then(() => {
  createWindow();
  // 앱 준비 완료 시점에는 버전 체크 로직 이미 실행됨 (Firebase 초기화 후)
});

// 모든 창이 닫히면 앱 종료
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
