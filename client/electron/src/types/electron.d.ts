declare global {
  interface Window {
    electron?: {
      close: () => void;
    };
  }
}

export {};
