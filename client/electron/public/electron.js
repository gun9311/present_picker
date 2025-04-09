const { app, BrowserWindow } = require("electron");
const isDev = require("electron-is-dev");
const path = require("path");

function createWindow() {
  // 브라우저 창 생성
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // 로컬 리소스 접근 허용
    },
  });

  // 개발 모드일 때는 개발 서버에서, 프로덕션 모드일 때는 빌드된 파일을 로드
  win.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  // 개발 모드일 때는 개발자 도구 열기
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Electron 앱이 준비되면 창 생성
app.whenReady().then(createWindow);

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
