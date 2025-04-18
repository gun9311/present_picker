import { createContext, useContext, RefObject } from "react";
import { AnimationMode, TextOverlayData, OverlayData } from "./types";

interface AnimationContextType {
  currentMode: AnimationMode | null;
  isSelecting: boolean;
  setIsSelecting: (value: boolean) => void;
  status: string;
  setStatus: (value: string) => void;
  currentFrame: string | null;
  setCurrentFrame: (frame: string | null) => void;
  overlay: OverlayData | null;
  setOverlay: (overlay: OverlayData | null) => void;
  textOverlays: TextOverlayData[];
  setTextOverlays: (overlays: TextOverlayData[]) => void;
  addTextOverlay: (overlay: TextOverlayData) => void;
  playSound: (sound: string, options?: { loop?: boolean }) => void;
  stopSound: (sound: string) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  preloadedAudioCache: RefObject<Map<string, HTMLAudioElement>>;
}

export const AnimationContext = createContext<AnimationContextType | null>(
  null
);

export const useAnimationContext = () => {
  const context = useContext(AnimationContext);
  if (!context)
    throw new Error(
      "useAnimationContext must be used within AnimationProvider"
    );
  return context;
};
