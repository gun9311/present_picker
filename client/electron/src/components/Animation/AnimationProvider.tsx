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

  // 컴포넌트 언마운트 시 모든 오디오 요소 정리
  useEffect(() => {
    return () => {
      const audioElements = audioElementsRef.current;
      audioElements.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      audioElements.clear();
    };
  }, []);

  // 모드가 변경될 때마다 상태 초기화
  useEffect(() => {
    setStatus("");
    setIsSelecting(false);
    // 필요하다면 다른 상태들도 초기화
  }, [mode]);

  const playSound = useCallback(
    (sound: string, options?: { loop?: boolean }) => {
      if (!isSoundEnabled) return;

      try {
        const audioElements = audioElementsRef.current;
        const [mode, soundName] = sound.split("/");
        const soundPath = `assets/sounds/${mode}/${soundName}.wav`;

        let audio = audioElements.get(sound);

        if (!audio) {
          audio = new Audio(soundPath);
          audio.volume = 0.5;
          audioElements.set(sound, audio);
        }

        if (options?.loop) {
          audio.loop = true;
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Sound play error:", error, "Path:", soundPath);
            setTimeout(() => {
              const retryAudio = audioElements.get(sound);
              if (retryAudio) {
                retryAudio
                  .play()
                  .catch((e) => console.error("Retry failed:", e));
              }
            }, 100);
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
      }}
    >
      {children}
    </AnimationContext.Provider>
  );
};
