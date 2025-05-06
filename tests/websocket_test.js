import ws from "k6/ws";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

// -----------------------------------------------------------------------------
// --- 기본 설정 변수 ---
// -----------------------------------------------------------------------------
const serverUrl = "wss://t-bot.site/ws/animation"; // 서버 주소 확인!
const baseFrameInterval = 150; // 프레임 전송 간격 (주기적 전송 모드용)
const baseAnimationDuration = 15000; // 기본 애니메이션 최대 지속 시간 (ms)
const frameSendingDurationCurtain = 5000; // 커튼 모드 프레임 전송 시간 (ms)
const frameSendingDurationOthers = 8000; // 스캐너/핸드픽 프레임 전송 시간 (ms)

// 얼굴 데이터
const faceData = { faces: [] };

// 프레임 데이터 로드
let frameData;
try {
  frameData = open("./base64_output.txt");
  if (!frameData || frameData.length < 1000) {
    throw new Error(
      "Failed to read valid base64 data from base64_output.txt or data is too short."
    );
  }
  console.log(`Successfully loaded frame data (length: ${frameData.length})`);
} catch (e) {
  console.error(
    `Error reading frame data file: ${e}. Test execution will be skipped if data is not loaded.`
  );
  frameData = null; // 실행 중단 플래그 역할
}

// -----------------------------------------------------------------------------
// --- k6 메트릭 정의 ---
// -----------------------------------------------------------------------------
// 각 메트릭에 scenario 태그가 자동으로 붙도록 설정
const connectTrend = new Trend("websocket_connect_time", true);
const firstMessageTrend = new Trend("websocket_first_message_time", true);
const sessionDurationTrend = new Trend("websocket_session_duration", true);

// -----------------------------------------------------------------------------
// --- k6 옵션 및 시나리오 정의 ---
// -----------------------------------------------------------------------------
export const options = {
  // thresholds는 모든 시나리오에 공통 적용 또는 시나리오별 적용 가능
  thresholds: {
    // 연결 시간 (95%가 1.5초 이내)
    "websocket_connect_time{scenario:roulette_scenario}": ["p(95)<1500"],
    "websocket_connect_time{scenario:slot_scenario}": ["p(95)<1500"],
    "websocket_connect_time{scenario:race_scenario}": ["p(95)<1500"],
    "websocket_connect_time{scenario:curtain_scenario}": ["p(95)<1500"],
    "websocket_connect_time{scenario:scanner_scenario}": ["p(95)<1500"],
    "websocket_connect_time{scenario:handpick_scenario}": ["p(95)<1500"],
    // 첫 메시지 수신 시간 (95%가 2.5초 이내 - CPU 부하 감안)
    "websocket_first_message_time{scenario:roulette_scenario}": ["p(95)<2500"],
    "websocket_first_message_time{scenario:slot_scenario}": ["p(95)<2500"],
    "websocket_first_message_time{scenario:race_scenario}": ["p(95)<2500"],
    "websocket_first_message_time{scenario:curtain_scenario}": ["p(95)<2500"],
    "websocket_first_message_time{scenario:scanner_scenario}": ["p(95)<2500"],
    "websocket_first_message_time{scenario:handpick_scenario}": ["p(95)<2500"],
    // WebSocket 연결 실패율 (각 시나리오별 1% 미만)
    "checks{scenario:roulette_scenario}": ["rate>0.99"],
    "checks{scenario:slot_scenario}": ["rate>0.99"],
    "checks{scenario:race_scenario}": ["rate>0.99"],
    "checks{scenario:curtain_scenario}": ["rate>0.99"],
    "checks{scenario:scanner_scenario}": ["rate>0.99"],
    "checks{scenario:handpick_scenario}": ["rate>0.99"],
  },

  scenarios: {
    // --- 모드별 시나리오 정의 ---
    roulette_scenario: {
      executor: "per-vu-iterations", // 각 VU가 1번씩 실행
      vus: 10, // 가상 사용자 10명
      iterations: 1, // 각 VU당 1번의 반복 실행
      maxDuration: "3s", // 시나리오 최대 지속 시간 (duration + 여유시간)
      exec: "runTest", // 실행할 함수 이름
      env: { ANIMATION_MODE: "roulette" }, // 환경 변수로 모드 전달
    },
    slot_scenario: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 1,
      maxDuration: "3s",
      exec: "runTest",
      env: { ANIMATION_MODE: "slot" },
    },
    race_scenario: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 1,
      maxDuration: "3s",
      exec: "runTest",
      env: { ANIMATION_MODE: "race" },
    },
    curtain_scenario: {
      executor: "per-vu-iterations",
      vus: 5,
      iterations: 1,
      maxDuration: "7s",
      exec: "runTest",
      env: { ANIMATION_MODE: "curtain" },
    },
    scanner_scenario: {
      executor: "per-vu-iterations",
      vus: 3,
      iterations: 1,
      maxDuration: "10s",
      exec: "runTest",
      env: { ANIMATION_MODE: "scanner" },
    },
    handpick_scenario: {
      executor: "per-vu-iterations",
      vus: 1, // 사용자 요청에 따라 1명으로 설정
      iterations: 1,
      maxDuration: "10s",
      exec: "runTest",
      env: { ANIMATION_MODE: "handpick" },
    },
    // --- 시나리오 정의 끝 ---
  },
};

// -----------------------------------------------------------------------------
// --- 테스트 실행 로직 함수 ---
// -----------------------------------------------------------------------------
// export default function() { ... } 대신 명명된 함수 사용 (scenarios에서 지정)
export function runTest() {
  // 환경 변수에서 애니메이션 모드 가져오기
  const animationMode = __ENV.ANIMATION_MODE || "roulette"; // 기본값 설정
  // 현재 시나리오 이름을 메트릭 태그에 사용하기 위해 가져옴 (k6 v0.34.0 이상)
  // const currentScenario = exec.scenario.name || `${animationMode}_scenario`; // k6 버전 확인 필요
  const tags = { scenario: `${animationMode}_scenario` }; // 메트릭 태그 직접 생성

  // frameData 로드 실패 시 실행 중단
  if (!frameData) {
    console.error(
      `VU ${__VU} (${animationMode}): Frame data is not available. Skipping execution.`
    );
    // 실패로 기록 (선택적)
    check(false, { frame_data_loaded: (ok) => ok }, tags);
    return;
  }

  const url = serverUrl;
  let connectTime;
  let firstMessageTime;
  const startTime = Date.now();
  let intervalId = null; // 프레임 전송 인터벌 ID
  let frameSendingTimeoutId = null; // 프레임 전송 중단 타이머 ID

  console.log(`VU ${__VU} starting scenario: ${tags.scenario}`);

  const res = ws.connect(url, null, function (socket) {
    // 연결 시간 측정 (태그 포함)
    connectTime = Date.now() - startTime;
    connectTrend.add(connectTime, tags);

    socket.on("open", () => {
      console.log(`VU ${__VU} (${animationMode}): WebSocket connected.`);

      // 1. 연결 후 애니메이션 시작 메시지 전송 (모든 모드 공통)
      socket.send(
        JSON.stringify({
          type: "start_animation",
          mode: animationMode,
          options: {},
          frame: frameData, // 초기 프레임 전송
          face_data: faceData,
        })
      );

      // 첫 메시지 수신 처리
      const firstMessagePromise = new Promise((resolve) => {
        socket.on("message", (data) => {
          if (!firstMessageTime) {
            firstMessageTime = Date.now() - startTime;
            firstMessageTrend.add(firstMessageTime, tags); // 태그 포함
            // console.log(
            //   `VU ${__VU} (${animationMode}): First message received after ${firstMessageTime}ms.`
            // );
            resolve();
          }
          // 받은 메시지 처리 로직 (필요시 추가)
          // try { const msg = JSON.parse(data); console.log... } catch ...
        });
      });

      // --- 모드별 프레임 전송 로직 분기 ---
      if (
        animationMode === "curtain" ||
        animationMode === "scanner" ||
        animationMode === "handpick"
      ) {
        // 주기적 프레임 전송이 필요한 모드
        let frameSendDuration = frameSendingDurationOthers; // 기본 8초
        if (animationMode === "curtain") {
          frameSendDuration = frameSendingDurationCurtain; // 커튼은 5초
        }

        console.log(
          `VU ${__VU} (${animationMode}): Starting periodic frame sending for ${frameSendDuration}ms.`
        );
        intervalId = socket.setInterval(() => {
          // 프레임 데이터 전송
          socket.send(
            JSON.stringify({
              type: "frame_data",
              frame: frameData,
              face_data: faceData,
            })
          );
        }, baseFrameInterval);

        // 지정된 시간 후 프레임 전송 중단
        frameSendingTimeoutId = socket.setTimeout(() => {
          if (intervalId !== null) {
            console.log(
              `VU ${__VU} (${animationMode}): Stopping periodic frame sending.`
            );
            clearInterval(intervalId);
            intervalId = null;
          }
        }, frameSendDuration);
      } else {
        // 룰렛, 슬롯, 레이스: 프레임 한 번만 보내고 더 이상 보내지 않음
        console.log(
          `VU ${__VU} (${animationMode}): No periodic frame sending for this mode.`
        );
      }
      // --- 프레임 전송 로직 분기 끝 ---

      // 애니메이션 최대 지속 시간 후 종료 (모든 모드 공통)
      socket.setTimeout(() => {
        // console.log(
        //   `VU ${__VU} (${animationMode}): Animation duration timeout reached (${baseAnimationDuration}ms). Closing socket.`
        // );
        socket.close();
      }, baseAnimationDuration);

      // 첫 메시지 수신 후 추가 작업 (필요시)
      firstMessagePromise.then(() => {
        // console.log(`VU ${__VU} (${animationMode}): First message received. Interaction continues...`);
      });

      socket.on("close", (code) => {
        // console.log(`VU ${__VU} (${animationMode}): WebSocket disconnected with code ${code}.`);
        // 모든 타이머/인터벌 확실히 정리
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
        if (frameSendingTimeoutId !== null) {
          try {
            socket.clearTimeout(frameSendingTimeoutId);
          } catch (e) {
            /* old k6? */
          }
        }
        // 세션 지속 시간 기록 (태그 포함)
        const sessionDuration = Date.now() - startTime;
        sessionDurationTrend.add(sessionDuration, tags);
      });

      socket.on("error", (e) => {
        console.error(
          `VU ${__VU} (${animationMode}): WebSocket error - ${e.error()}`
        );
        // 에러 발생 시 실패 check (태그 포함)
        check(false, { [`websocket error`]: (ok) => ok }, tags);
      });
    });
  });

  // 연결 성공 여부 체크 (태그 포함)
  check(res, { [`websocket connected`]: (r) => r && r.status === 101 }, tags);

  // 각 VU가 iteration을 마치고 잠시 대기 후 다음 iteration (필요시)
  // sleep(1); // per-vu-iterations 에서는 보통 필요 없음
}
