export type FaceLandmark = { x: number; y: number; z?: number };

export type FaceMeshResults = {
  multiFaceLandmarks?: FaceLandmark[][];
};

export type FaceMeshInstance = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

export type CameraInstance = {
  start: () => Promise<void>;
  stop?: () => void;
};

declare global {
  interface Window {
    FaceMesh?: new (config: { locateFile: (file: string) => string }) => FaceMeshInstance;
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
