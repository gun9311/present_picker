import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple"; // Simple mode 사용
import react from "@vitejs/plugin-react";
import renderer from "vite-plugin-electron-renderer"; // 렌더러 플러그인 추가

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 현재 모드(development/production)에 맞는 환경 변수 로드
  // process.cwd()는 프로젝트 루트 (client/app)
  const env = loadEnv(mode, process.cwd(), "");

  // TARGET_PLATFORM 환경 변수 가져오기 (스크립트에서 설정)
  const targetPlatform = process.env.TARGET_PLATFORM || "web";
  console.log(`Vite config: TARGET_PLATFORM=${targetPlatform}, mode=${mode}`);

  return {
    plugins: [
      react(), // React 플러그인
      electron({
        main: {
          // Electron 메인 프로세스 엔트리 파일
          entry: "public/electron.js", // 기존 electron.js 경로
        },
        preload: {
          // Preload 스크립트가 있다면 여기에 경로 지정
          // input: path.join(__dirname, 'electron/preload.js'),
        },
        // Optional: Use Node.js API in the Renderer-process
        // Node.js API를 렌더러에서 사용하기 위한 설정
        renderer: {}, // 이 옵션 대신 아래 별도 renderer 플러그인 사용 권장
      }),
      // Node.js 모듈 및 Electron API 사용을 위한 렌더러 플러그인 설정
      renderer({
        nodeIntegration: true, // nodeIntegration 활성화 (기존 설정 유지)
        optimizeDeps: {
          // 종속성 최적화 관련 설정 필요 시 추가
        },
      }),
    ],
    resolve: {
      alias: {
        // 경로 별칭 설정 (예: '@')
        "@": path.join(__dirname, "src"),
        // 플랫폼별 핸들러 별칭 (이 방식은 Vite에서 플러그인 없이 잘 안될 수 있음 - 다른 방법 고려)
        //'@/updateHandler': path.join(__dirname, `src/updateHandler.${process.env.TARGET_PLATFORM || 'web'}.ts`), // <-- 이 방식은 빌드 시점에 결정하기 어려움
      },
    },
    // 필요시 개발 서버 포트 설정 등 추가
    // server: {
    //   port: 3000,
    // },
    // 빌드 설정
    build: {
      // Electron 빌드 시 렌더러 결과물 저장 경로 등 설정 가능
      // outDir: 'dist/renderer',
    },
    define: {
      // 코드 내에서 import.meta.env.VITE_TARGET_PLATFORM 처럼 접근 가능하게 함
      "import.meta.env.VITE_TARGET_PLATFORM": JSON.stringify(targetPlatform),
    },
  };
});
