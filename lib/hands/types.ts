export type HandLandmark = { x: number; y: number; z?: number };

export type HandResults = {
  multiHandLandmarks?: HandLandmark[][];
};

export type HandsInstance = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: HandResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

export type CameraInstance = {
  start: () => Promise<void>;
  stop?: () => void;
};

declare global {
  interface Window {
    Hands?: new (config: { locateFile: (file: string) => string }) => HandsInstance;
    Camera?: new (
      video: HTMLVideoElement,
      config: {
        onFrame: () => Promise<void>;
        width?: number;
        height?: number;
      },
    ) => CameraInstance;
  }
}
