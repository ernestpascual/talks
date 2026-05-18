"use client";

import { useFaceMeshTracking } from "@/lib/face-mesh/useFaceMeshTracking";
import { useCallback, useEffect, useState } from "react";
import CameraPreviewPanel from "./CameraPreviewPanel";
import GazeCircleOverlay from "./GazeCircleOverlay";
import type { TrackingStatus } from "./tracking-status";

type Slide6EyeTrackProps = {
  text: string;
};

export default function Slide6EyeTrack({ text }: Slide6EyeTrackProps) {
  const [mounted, setMounted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStatusChange = useCallback((next: TrackingStatus) => {
    if (next !== "error") setErrorMessage(null);
  }, []);

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-16 py-12">
        <p className="max-w-4xl text-center text-2xl font-light leading-relaxed sm:text-3xl md:text-4xl">
          {text}
        </p>
      </div>
    );
  }

  return (
    <Slide6EyeTrackActive
      text={text}
      errorMessage={errorMessage}
      onStatusChange={handleStatusChange}
      onError={handleError}
    />
  );
}

function Slide6EyeTrackActive({
  text,
  errorMessage,
  onStatusChange,
  onError,
}: {
  text: string;
  errorMessage: string | null;
  onStatusChange: (status: TrackingStatus) => void;
  onError: (message: string) => void;
}) {
  const { gaze, video, status } = useFaceMeshTracking({
    enabled: true,
    onStatusChange,
    onError,
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-16 py-12">
      <p className="relative z-10 max-w-4xl text-center text-2xl font-light leading-relaxed sm:text-3xl md:text-4xl">
        {text}
      </p>

      {gaze ? <GazeCircleOverlay gaze={gaze} /> : null}

      <CameraPreviewPanel video={video} status={status} />

      {errorMessage ? (
        <p className="fixed bottom-6 left-1/2 z-30 max-w-md -translate-x-1/2 text-center text-sm text-red-400">
          {errorMessage}
        </p>
      ) : status === "tracking" ? (
        <p className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 text-sm text-emerald-400/90">
          Move your head — the circle follows your eyes
        </p>
      ) : null}
    </div>
  );
}
