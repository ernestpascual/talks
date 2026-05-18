"use client";

import type { TrackingStatus } from "./tracking-status";

const PREVIEW_WIDTH = 176;
const PREVIEW_HEIGHT = 132;

type CameraPreviewPanelProps = {
  video: HTMLVideoElement | null;
  status: TrackingStatus;
};

function statusLabel(status: TrackingStatus): string {
  switch (status) {
    case "loading-model":
      return "Loading face model…";
    case "loading-camera":
      return "Starting camera…";
    case "camera-ready":
      return "Camera on — look at the screen";
    case "tracking":
      return "Tracking active";
    case "error":
      return "Camera error";
    default:
      return "Initializing…";
  }
}

function statusColor(status: TrackingStatus): string {
  switch (status) {
    case "tracking":
      return "bg-emerald-500";
    case "camera-ready":
      return "bg-amber-400";
    case "error":
      return "bg-red-500";
    default:
      return "bg-white/40 animate-pulse";
  }
}

export default function CameraPreviewPanel({
  video,
  status,
}: CameraPreviewPanelProps) {
  const showVideo = video && status !== "loading-model" && status !== "error";

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex flex-col gap-2"
      style={{ width: PREVIEW_WIDTH }}
    >
      <div
        className="flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${statusColor(status)}`}
          aria-hidden
        />
        {statusLabel(status)}
      </div>

      <div
        className="overflow-hidden rounded-lg border-2 border-white/35 bg-black shadow-lg"
        style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
      >
        {showVideo ? (
          <video
            ref={(node) => {
              if (!node || !video?.srcObject) return;
              if (node.srcObject !== video.srcObject) {
                node.srcObject = video.srcObject;
              }
              void node.play().catch(() => undefined);
            }}
            muted
            playsInline
            autoPlay
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
            {status === "error" ? "No camera" : "Camera preview"}
          </div>
        )}
      </div>
    </div>
  );
}
