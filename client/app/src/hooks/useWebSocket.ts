import { useState, useEffect, useCallback, useRef } from "react";

// 1. 새로운 connectionStatus 타입 추가
type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "server_busy"; // 'server_busy' 추가

interface WebSocketHook {
  sendMessage: (message: any) => void;
  lastMessage: any;
  connectionStatus: ConnectionStatus; // 타입 업데이트
  websocket: WebSocket | null;
}

export const useWebSocket = (
  url: string,
  connect: boolean = true
): WebSocketHook => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  // 2. 초기 상태 타입 업데이트
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  // 3. 특정 에러 메시지 저장을 위한 상태 추가
  const [specificError, setSpecificError] = useState<string | null>(null);

  // WebSocket 인스턴스를 ref로 관리
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    // 이미 연결이 있거나 연결 중인 상태이면 새로운 연결을 시도하지 않음
    if (connectionStatus === "connected" || connectionStatus === "connecting") {
      console.log("WebSocket connection already exists or in progress");
      return;
    }

    try {
      console.log("Initiating new WebSocket connection");
      // 4. 새 연결 시도 시 특정 에러 상태 초기화
      setSpecificError(null);
      setConnectionStatus("connecting");

      const websocket = new WebSocket(url);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log("WebSocket Connected");
        setConnectionStatus("connected");
        setWs(websocket);
        setSpecificError(null); // 연결 성공 시 에러 상태 초기화
      };

      // 5. onclose 핸들러에서 event 파라미터 사용
      websocket.onclose = (event) => {
        console.log(
          "WebSocket Disconnected. Close code:",
          event.code,
          "Reason:",
          event.reason
        );
        // 6. 연결 종료 시, 저장된 특정 에러가 있는지 확인
        if (specificError) {
          setConnectionStatus("server_busy"); // 특정 에러가 있으면 'server_busy' 상태로 변경
        } else {
          setConnectionStatus("disconnected"); // 없으면 일반 'disconnected' 상태
        }
        setWs(null);
        wsRef.current = null;
        // 상태 변경 후 specificError 초기화 (선택적, 다음 연결 시 초기화되므로)
        // setSpecificError(null);
      };

      websocket.onerror = (error) => {
        console.error("WebSocket Error:", error);
        // 7. onerror 발생 시에도 specificError 확인 가능성 고려 (선택적 개선)
        // 일반적으로 onclose가 항상 호출되므로 여기서 상태 변경은 보류
        // setConnectionStatus("disconnected");
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          // 8. 서버에서 보낸 에러 메시지 감지 및 저장
          if (data && data.type === "error" && data.message) {
            console.log("Received specific error message:", data.message);
            setSpecificError(data.message);
          }
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setConnectionStatus("disconnected");
      setSpecificError(null); // 에러 발생 시 초기화
      wsRef.current = null;
    }
    // 9. 의존성 배열에 connectionStatus 추가 (내부 로직에서 사용하므로)
  }, [url, connectionStatus]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      console.log("Closing WebSocket connection");
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
      setConnectionStatus("disconnected");
      setSpecificError(null); // 명시적 연결 해제 시 에러 초기화
    }
  }, []);

  // connect 플래그에 따라 연결 또는 연결 해제
  useEffect(() => {
    if (connect) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      // 컴포넌트 언마운트 시 또는 connect 플래그가 false로 변경될 때 정리
      if (wsRef.current) {
        // console.log("Cleaning up WebSocket connection on unmount or disconnect flag change");
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, connectWebSocket, disconnectWebSocket]);

  const sendMessage = useCallback(
    (message: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket is not connected. Message not sent.");
      }
    },
    [ws]
  );

  // 10. 반환값 타입 업데이트
  return {
    sendMessage,
    lastMessage,
    connectionStatus,
    websocket: ws,
  };
};
