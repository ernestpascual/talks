export interface PersonDetection {
  bbox: [number, number, number, number];
  score: number;
}

export type ScanMode = "live" | "crowd" | "dense";
export type LowLightMode = "auto" | "on" | "off";

export interface ScanRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Overlapping crops give distant people more pixels in the detector's input.
export function scanRegions(
  width: number,
  height: number,
  mode: ScanMode,
): ScanRegion[] {
  const regions = [{ x: 0, y: 0, width, height }];
  if (mode === "live") return regions;
  const divisions = mode === "dense" ? 3 : 2;
  const cropWidth = Math.round(width * (divisions === 3 ? 0.45 : 0.62));
  const cropHeight = Math.round(height * (divisions === 3 ? 0.45 : 0.62));
  for (let row = 0; row < divisions; row++) {
    for (let column = 0; column < divisions; column++) {
      regions.push({
        x: Math.round(((width - cropWidth) * column) / (divisions - 1)),
        y: Math.round(((height - cropHeight) * row) / (divisions - 1)),
        width: cropWidth,
        height: cropHeight,
      });
    }
  }
  return regions;
}

export function mapDetection(
  detection: PersonDetection,
  region: ScanRegion,
  frameWidth: number,
  frameHeight: number,
): PersonDetection | null {
  const [x, y, width, height] = detection.bbox;
  if (
    ![x, y, width, height, detection.score].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  // Discard people cut by an internal crop edge; another overlapping view covers them.
  if (
    (region.x > 0 && x < 2) ||
    (region.y > 0 && y < 2) ||
    (region.x + region.width < frameWidth && x + width > region.width - 2) ||
    (region.y + region.height < frameHeight && y + height > region.height - 2)
  )
    return null;
  const left = Math.max(0, x + region.x);
  const top = Math.max(0, y + region.y);
  const right = Math.min(frameWidth, x + region.x + width);
  const bottom = Math.min(frameHeight, y + region.y + height);
  if (right <= left || bottom <= top) return null;
  return {
    score: detection.score,
    bbox: [
      left / frameWidth,
      top / frameHeight,
      (right - left) / frameWidth,
      (bottom - top) / frameHeight,
    ],
  };
}

export function mergeDetections(
  detections: PersonDetection[],
): PersonDetection[] {
  const kept: PersonDetection[] = [];
  for (const candidate of [...detections].sort((a, b) => b.score - a.score)) {
    const [x, y, width, height] = candidate.bbox;
    const duplicate = kept.some(
      ({ bbox: [otherX, otherY, otherWidth, otherHeight] }) => {
        const intersection =
          Math.max(
            0,
            Math.min(x + width, otherX + otherWidth) - Math.max(x, otherX),
          ) *
          Math.max(
            0,
            Math.min(y + height, otherY + otherHeight) - Math.max(y, otherY),
          );
        return (
          intersection /
            (width * height + otherWidth * otherHeight - intersection) >
          0.45
        );
      },
    );
    if (!duplicate) kept.push(candidate);
  }
  return kept.sort((a, b) => a.bbox[0] - b.bbox[0]);
}
