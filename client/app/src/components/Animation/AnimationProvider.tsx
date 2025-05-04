import React, {
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { AnimationContext } from "./AnimationContext";
import { AnimationMode, TextOverlayData, OverlayData } from "./types";

interface AnimationProviderProps {
  children: ReactNode;
  mode: AnimationMode | null;
}

export const AnimationProvider: React.FC<AnimationProviderProps> = ({
  children,
  mode,
}) => {
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayData | null>(null);
  const [textOverlays, setTextOverlays] = useState<TextOverlayData[]>([]);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>());
  const preloadedAudioCacheRef = useRef(new Map<string, HTMLAudioElement>());

  // 컴포넌트 언마운트 시 모든 오디오 요소 정리
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      audioElementsRef.current.clear();
      preloadedAudioCacheRef.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      preloadedAudioCacheRef.current.clear();
    };
  }, []);

  // 모드가 변경될 때마다 상태 초기화
  useEffect(() => {
    setStatus("");
    setIsSelecting(false);
  }, [mode]);

  // isSoundEnabled 상태가 변경될 때 오디오 처리
  useEffect(() => {
    if (!isSoundEnabled) {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
  }, [isSoundEnabled]);

  const playSound = useCallback(
    (sound: string, options?: { loop?: boolean }) => {
      if (!isSoundEnabled) return;

      try {
        const activeAudioCache = audioElementsRef.current;
        const preloadedCache = preloadedAudioCacheRef.current;
        const [mode, soundName] = sound.split("/");
        const soundPathKey = `assets/sounds/${mode}/${soundName}.wav`;

        let audio: HTMLAudioElement | undefined =
          preloadedCache.get(soundPathKey);

        if (audio) {
          audio.currentTime = 0;
          audio.volume = 0.2;
          audio.loop = options?.loop ?? false;
          activeAudioCache.set(sound, audio);
        } else {
          console.warn(
            `[playSound] Audio not found in preload cache, creating new: ${soundPathKey}`
          );
          audio = new Audio(`${soundPathKey}`);
          audio.volume = 0.2;
          audio.loop = options?.loop ?? false;
          activeAudioCache.set(sound, audio);
          preloadedCache.set(soundPathKey, audio);
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (error.name === "AbortError") {
              // console.log(`Sound play aborted (likely intentional interruption): ${soundPathKey}`);
            } else {
              console.error("Sound play error:", error, "Path:", soundPathKey);
            }
          });
        }
      } catch (error) {
        console.error("Sound handling error:", error);
      }
    },
    [isSoundEnabled]
  );

  const stopSound = useCallback((sound: string) => {
    try {
      const audioToStop = audioElementsRef.current.get(sound);
      if (audioToStop) {
        audioToStop.pause();
        audioToStop.currentTime = 0;
      }
    } catch (error) {
      console.error("Stop sound error:", error);
    }
  }, []);

  const addTextOverlay = useCallback((newOverlay: TextOverlayData) => {
    setTextOverlays((prev) => [...prev, newOverlay]);
  }, []);

  return (
    <AnimationContext.Provider
      value={{
        currentMode: mode,
        isSelecting,
        setIsSelecting,
        status,
        setStatus,
        currentFrame,
        setCurrentFrame,
        overlay,
        setOverlay,
        textOverlays,
        setTextOverlays,
        addTextOverlay,
        playSound,
        stopSound,
        isSoundEnabled,
        setIsSoundEnabled,
        preloadedAudioCache: preloadedAudioCacheRef,
      }}
    >
      {children}
    </AnimationContext.Provider>
  );
};
