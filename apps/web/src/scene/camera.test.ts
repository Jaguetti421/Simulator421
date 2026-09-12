import { describe, expect, it } from "vitest";
import { applyCamera, CAMERA, cameraPosition, defaultCamera, normalizeYaw, parseCameraParam } from "./camera.js";

describe("the tabletop camera (GDD 14.2)", () => {
  it("defaults to a 45-degree pitch inside a 35-65 band", () => {
    expect(defaultCamera().pitchDeg).toBe(45);
    expect(CAMERA.minPitchDeg).toBe(35);
    expect(CAMERA.maxPitchDeg).toBe(65);
  });

  it("clamps pitch to the band instead of letting a caller leave it", () => {
    expect(applyCamera(defaultCamera(), { pitchDeg: 10 }).pitchDeg).toBe(35);
    expect(applyCamera(defaultCamera(), { pitchDeg: 89 }).pitchDeg).toBe(65);
  });

  it("orbits yaw fully: 370 degrees is 10, not a clamp", () => {
    expect(normalizeYaw(370)).toBe(10);
    expect(normalizeYaw(-90)).toBe(270);
    expect(applyCamera(defaultCamera(), { yawDeg: 725 }).yawDeg).toBe(5);
  });

  it("clamps zoom at both ends", () => {
    expect(applyCamera(defaultCamera(), { distanceM: 1 }).distanceM).toBe(CAMERA.minDistanceM);
    expect(applyCamera(defaultCamera(), { distanceM: 10_000 }).distanceM).toBe(CAMERA.maxDistanceM);
  });

  it("places the camera above and away from its target, and higher as pitch steepens", () => {
    const low = cameraPosition(applyCamera(defaultCamera(), { pitchDeg: 35 }));
    const high = cameraPosition(applyCamera(defaultCamera(), { pitchDeg: 65 }));
    expect(high[1]).toBeGreaterThan(low[1] as number);
    expect(low[1]).toBeGreaterThan(0);
  });

  it("parses a camera query parameter and clamps what it finds", () => {
    expect(parseCameraParam(null)).toEqual(defaultCamera());
    expect(parseCameraParam("55,90,200")).toMatchObject({ pitchDeg: 55, yawDeg: 90, distanceM: 200 });
    expect(parseCameraParam("5,400,99999")).toMatchObject({ pitchDeg: 35, yawDeg: 40, distanceM: CAMERA.maxDistanceM });
    expect(parseCameraParam("nonsense")).toEqual(defaultCamera());
  });
});
