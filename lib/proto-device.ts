export interface DeviceDetails {
  colorDepth: number;
  deviceMemory: number;
  effectiveConnectionType: string;
  hardwareConcurrency: number;
  language: string;
  maxTouchPoints: number;
  online: boolean;
  pixelRatio: number;
  platform: string;
  screenHeight: number;
  screenOrientation: string;
  screenWidth: number;
  timeZone: string;
  userAgent: string;
  viewportHeight: number;
  viewportWidth: number;
}

export interface Vector3 {
  alpha?: number;
  beta?: number;
  gamma?: number;
  magnitude?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface MotionSnapshot {
  acceleration: Vector3;
  accelerationIncludingGravity: Vector3;
  interval: number;
  rotation: Vector3;
}

export interface PointerSnapshot {
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  height: number;
  isPrimary: boolean;
  offsetX: number;
  offsetY: number;
  pageX: number;
  pageY: number;
  pointerId: number;
  pointerType: string;
  pressure: number;
  screenX: number;
  screenY: number;
  tangentialPressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  width: number;
}

export const EMPTY_MOTION: MotionSnapshot = {
  acceleration: {},
  accelerationIncludingGravity: {},
  interval: 0,
  rotation: {},
};

export function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function vectorMagnitude(x: number, y: number, z: number) {
  return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
}

export function captureMotion(event: DeviceMotionEvent): MotionSnapshot {
  const acceleration = event.acceleration;
  const gravity = event.accelerationIncludingGravity;
  const rotation = event.rotationRate;
  const accelerationX = finiteNumber(acceleration?.x);
  const accelerationY = finiteNumber(acceleration?.y);
  const accelerationZ = finiteNumber(acceleration?.z);
  const gravityX = finiteNumber(gravity?.x);
  const gravityY = finiteNumber(gravity?.y);
  const gravityZ = finiteNumber(gravity?.z);
  const rotationAlpha = finiteNumber(rotation?.alpha);
  const rotationBeta = finiteNumber(rotation?.beta);
  const rotationGamma = finiteNumber(rotation?.gamma);

  return {
    acceleration: {
      x: accelerationX,
      y: accelerationY,
      z: accelerationZ,
      magnitude: vectorMagnitude(accelerationX, accelerationY, accelerationZ),
    },
    accelerationIncludingGravity: {
      x: gravityX,
      y: gravityY,
      z: gravityZ,
      magnitude: vectorMagnitude(gravityX, gravityY, gravityZ),
    },
    interval: finiteNumber(event.interval),
    rotation: {
      alpha: rotationAlpha,
      beta: rotationBeta,
      gamma: rotationGamma,
      magnitude: vectorMagnitude(rotationAlpha, rotationBeta, rotationGamma),
    },
  };
}

export function captureOrientation(event: DeviceOrientationEvent): Vector3 {
  return {
    alpha: finiteNumber(event.alpha),
    beta: finiteNumber(event.beta),
    gamma: finiteNumber(event.gamma),
  };
}

export function capturePointer(event: React.PointerEvent<HTMLElement>): PointerSnapshot {
  return {
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    height: event.height,
    isPrimary: event.isPrimary,
    offsetX: event.nativeEvent.offsetX,
    offsetY: event.nativeEvent.offsetY,
    pageX: event.pageX,
    pageY: event.pageY,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    pressure: event.pressure,
    screenX: event.screenX,
    screenY: event.screenY,
    tangentialPressure: event.tangentialPressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
    width: event.width,
  };
}

export function getDeviceDetails(): DeviceDetails {
  const browserNavigator = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };

  return {
    colorDepth: window.screen.colorDepth,
    deviceMemory: browserNavigator.deviceMemory ?? 0,
    effectiveConnectionType: browserNavigator.connection?.effectiveType ?? "unavailable",
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    language: navigator.language,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    online: navigator.onLine,
    pixelRatio: window.devicePixelRatio,
    platform: navigator.platform,
    screenHeight: window.screen.height,
    screenOrientation: window.screen.orientation?.type ?? "unavailable",
    screenWidth: window.screen.width,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: navigator.userAgent,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
}

export function persistentDeviceId(storageKey: string, prefix: string) {
  const stored = window.localStorage.getItem(storageKey);
  if (stored) return stored;

  const randomPart = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const id = `${prefix}-${randomPart}`;
  window.localStorage.setItem(storageKey, id);
  return id;
}

export type PermissionMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<PermissionState>;
};
