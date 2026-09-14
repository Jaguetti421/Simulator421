/**
 * The perspective tabletop camera (W0-10; GDD 14.2).
 *
 * "A perspective 3D camera with near-orthographic tabletop framing, a default
 * 45-degree pitch, a 35–65-degree pitch band, full yaw orbit, and clamped zoom."
 * The numbers below are that sentence, not an invention; the clamps are enforced
 * here so no caller can quietly leave the band.
 *
 * Pure maths, so camera behaviour is asserted without a GPU. Camera changes never
 * alter perception or navigation — nothing here touches simulation state.
 */
export const CAMERA = {
  defaultPitchDeg: 45,
  minPitchDeg: 35,
  maxPitchDeg: 65,
  minDistanceM: 12,
  maxDistanceM: 420,
  defaultDistanceM: 140,
  fovDeg: 28,
} as const;

export interface CameraState {
  readonly pitchDeg: number;
  readonly yawDeg: number;
  readonly distanceM: number;
  readonly targetM: readonly [number, number, number];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Yaw orbits fully: 370° is 10°, not a clamp. */
export function normalizeYaw(yawDeg: number): number {
  return ((yawDeg % 360) + 360) % 360;
}

export function defaultCamera(targetM: readonly [number, number, number] = [0, 0, 0]): CameraState {
  return { pitchDeg: CAMERA.defaultPitchDeg, yawDeg: 0, distanceM: CAMERA.defaultDistanceM, targetM };
}

export function applyCamera(state: CameraState, change: Partial<Pick<CameraState, "pitchDeg" | "yawDeg" | "distanceM">>): CameraState {
  return {
    ...state,
    pitchDeg: clamp(change.pitchDeg ?? state.pitchDeg, CAMERA.minPitchDeg, CAMERA.maxPitchDeg),
    yawDeg: normalizeYaw(change.yawDeg ?? state.yawDeg),
    distanceM: clamp(change.distanceM ?? state.distanceM, CAMERA.minDistanceM, CAMERA.maxDistanceM),
  };
}

/** World position of the camera for a state, in metres. */
export function cameraPosition(state: CameraState): [number, number, number] {
  const pitch = (state.pitchDeg * Math.PI) / 180;
  const yaw = (state.yawDeg * Math.PI) / 180;
  const horizontal = Math.cos(pitch) * state.distanceM;
  return [
    (state.targetM[0] as number) + Math.sin(yaw) * horizontal,
    (state.targetM[1] as number) + Math.sin(pitch) * state.distanceM,
    (state.targetM[2] as number) + Math.cos(yaw) * horizontal,
  ];
}

/** Parse a `camera=` query value: `pitch,yaw,distance`. Invalid parts fall back to the default, clamped. */
export function parseCameraParam(raw: string | null, targetM: readonly [number, number, number] = [0, 0, 0]): CameraState {
  const base = defaultCamera(targetM);
  if (raw === null || raw.trim() === "") return base;
  const [pitch, yaw, distance] = raw.split(",").map((n) => Number(n.trim()));
  return applyCamera(base, {
    ...(Number.isFinite(pitch) ? { pitchDeg: pitch as number } : {}),
    ...(Number.isFinite(yaw) ? { yawDeg: yaw as number } : {}),
    ...(Number.isFinite(distance) ? { distanceM: distance as number } : {}),
  });
}
