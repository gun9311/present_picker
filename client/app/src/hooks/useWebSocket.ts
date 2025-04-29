import { useState, useEffect, useCallback, useRef } from "react";

interface WebSocketHook {
  sendMessage: (message: any) => void;
  lastMessage: any;
  connectionStatus: "connecting" | "connected" | "disconnected";
  websocket: WebSocket | null;
}

export const useWebSocket = (
  url: string,
  connect: boolean = true
): WebSocketHook => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

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
      setConnectionStatus("connecting");

      const websocket = new WebSocket(url);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log("WebSocket Connected");
        setConnectionStatus("connected");
        setWs(websocket);
      };

      websocket.onclose = () => {
        console.log("WebSocket Disconnected");
        setConnectionStatus("disconnected");
        setWs(null);
        wsRef.current = null;
      };

      websocket.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setConnectionStatus("disconnected");
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setConnectionStatus("disconnected");
      wsRef.current = null;
    }
  }, [url]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      console.log("Closing WebSocket connection");
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
      setConnectionStatus("disconnected");
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

  return {
    sendMessage,
    lastMessage,
    connectionStatus,
    websocket: ws,
  };
};
