/**
 * The Three.js tabletop scene (W0-10; TP v2.0 §13).
 *
 * Actors are drawn from the procedural kit as primitives, one `InstancedMesh`
 * per primitive **shape** (box, sphere, cylinder, cone) with per-instance colour
 * and transform. TP v2.0 says one instanced mesh per kit part; grouping by shape
 * is the same idea one level coarser and is what lets a body, a head and a helm
 * share a draw call. When the kit becomes rigged meshes this is where that
 * changes, and no recipe data changes with it.
 *
 * Rendering creates no gameplay effects (Addendum D06) and the camera never
 * touches simulation state (GDD 14.2).
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Mesh,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { assembleRecipe, PROTOTYPE8_RECIPES } from "../kit/recipe.js";
import type { AssembledRecipe } from "../kit/recipe.js";
import { cameraPosition, CAMERA } from "./camera.js";
import type { CameraState } from "./camera.js";

export const ENVELOPE_M = 800;
const MM_TO_M = 1 / 1000;

export interface SceneActorState {
  readonly id: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly recipeIndex: number;
}

type Shape = "box" | "sphere" | "cylinder" | "cone";

function geometryFor(shape: Shape): BoxGeometry | SphereGeometry | CylinderGeometry | ConeGeometry {
  if (shape === "box") return new BoxGeometry(1, 1, 1);
  if (shape === "sphere") return new SphereGeometry(0.5, 10, 8);
  if (shape === "cone") return new ConeGeometry(0.5, 1, 8);
  return new CylinderGeometry(0.5, 0.5, 1, 10);
}

export interface TabletopScene {
  render: (actors: readonly SceneActorState[], camera: CameraState) => void;
  /**
   * How many of the given actors project inside the viewport after the last
   * render. A capture whose subjects are all off-screen is not evidence of
   * anything, and until 14 September 2026 this build produced exactly that.
   */
  projectedInsideViewport: (actors: readonly SceneActorState[]) => number;
  /** Instance counts per shape — recorded so a test can assert what was actually drawn. */
  stats: () => Readonly<Record<Shape, number>>;
  dispose: () => void;
}

export function createTabletopScene(canvas: HTMLCanvasElement, options: { width: number; height: number }): TabletopScene {
  const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(options.width, options.height, false);
  renderer.setClearColor(new Color("#12161c"), 1);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 260, 90);
  scene.add(sun);

  const ground = new Mesh(new PlaneGeometry(ENVELOPE_M, ENVELOPE_M), new MeshLambertMaterial({ color: new Color("#1b2028") }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(ENVELOPE_M / 2, 0, ENVELOPE_M / 2);
  scene.add(ground);

  const camera = new PerspectiveCamera(CAMERA.fovDeg, options.width / options.height, 0.5, 4000);
  const assembled: readonly AssembledRecipe[] = PROTOTYPE8_RECIPES.map(assembleRecipe);
  const shapes: Shape[] = ["box", "sphere", "cylinder", "cone"];
  const counts: Record<Shape, number> = { box: 0, sphere: 0, cylinder: 0, cone: 0 };

  const MAX_INSTANCES = 4096;
  const meshes = new Map<Shape, InstancedMesh>();
  for (const shape of shapes) {
    const mesh = new InstancedMesh(geometryFor(shape), new MeshLambertMaterial(), MAX_INSTANCES);
    mesh.count = 0;
    scene.add(mesh);
    meshes.set(shape, mesh);
  }

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const color = new Color();

  return {
    render(actors, cameraState) {
      for (const shape of shapes) counts[shape] = 0;
      for (const actor of actors) {
        const recipe = assembled[actor.recipeIndex % assembled.length];
        if (recipe === undefined) continue;
        for (const part of recipe.parts) {
          const shape = part.shape;
          const mesh = meshes.get(shape);
          const index = counts[shape];
          if (mesh === undefined || index >= MAX_INSTANCES) continue;
          position.set(
            actor.xMm * MM_TO_M + (part.offsetMm[0] as number) * MM_TO_M,
            (part.offsetMm[1] as number) * MM_TO_M,
            actor.yMm * MM_TO_M + (part.offsetMm[2] as number) * MM_TO_M,
          );
          scale.set((part.sizeMm[0] as number) * MM_TO_M, (part.sizeMm[1] as number) * MM_TO_M, (part.sizeMm[2] as number) * MM_TO_M);
          matrix.compose(position, rotation, scale);
          mesh.setMatrixAt(index, matrix);
          mesh.setColorAt(index, color.set(part.color));
          counts[shape] = index + 1;
        }
      }
      for (const shape of shapes) {
        const mesh = meshes.get(shape);
        if (mesh === undefined) continue;
        mesh.count = counts[shape];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
      }

      const [cx, cy, cz] = cameraPosition(cameraState);
      camera.position.set(cx, cy, cz);
      camera.lookAt(cameraState.targetM[0] as number, cameraState.targetM[1] as number, cameraState.targetM[2] as number);
      renderer.render(scene, camera);
    },
    projectedInsideViewport(actors) {
      let inside = 0;
      for (const actor of actors) {
        position.set(actor.xMm * MM_TO_M, 0.9, actor.yMm * MM_TO_M);
        position.project(camera);
        if (position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z <= 1) inside += 1;
      }
      return inside;
    },
    stats: () => ({ ...counts }),
    dispose: () => {
      renderer.dispose();
    },
  };
}
