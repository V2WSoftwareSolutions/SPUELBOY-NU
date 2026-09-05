import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { NuViewerConfig } from '../models/product.model';
import { NuModel } from './nu-model.factory';
import { createProductModel } from './product-model.factory';

/**
 * Framework-agnostic 3D product stage.
 *
 * Deliberately free of Angular imports: the Angular component owns the DOM and
 * the lifecycle, this class owns WebGL. That keeps SSR trivial (nothing here is
 * ever imported on the server — the component lazy-loads it in the browser
 * only) and makes the renderer reusable for other pages later.
 */

/** Where a hotspot label should be drawn, in CSS pixels relative to the canvas. */
export interface HotspotProjection {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  /** False while the point is behind the device or off-screen. */
  visible: boolean;
}

export interface ProductViewerCallbacks {
  /** Fired every frame the hotspot layout changes. */
  onHotspots?(projections: HotspotProjection[]): void;
  /** Fired when the viewing angle crosses into a new named sector. */
  onOrientationChange?(label: string): void;
  /** Fired once the first frame with real content has been presented. */
  onReady?(): void;
  /** Fired when a showcase sequence has finished and the device is back to rest. */
  onSequenceEnd?(sequence: ViewerSequence): void;
  /** Fired when WebGL is unavailable or the context is lost for good. */
  onUnavailable?(reason: string): void;
}

export interface ProductViewerOptions {
  canvas: HTMLCanvasElement;
  config: NuViewerConfig;
  /** Disables auto-rotation and damping easing for `prefers-reduced-motion`. */
  reducedMotion: boolean;
  callbacks?: ProductViewerCallbacks;
}

/** The two showcase animations the stage can play, one at a time. */
export type ViewerSequence = 'exploded' | 'cleaning';

/**
 * Seconds for the exploded-view sequence: fan apart, hold so the internals can
 * actually be read, then reassemble. Roughly 2.6 s end to end.
 */
const EXPLODE_TIMELINE = { apart: 0.9, hold: 0.8, together: 0.9 };

/** Seconds for the full glass-cleaning demonstration. */
const CLEANING_DURATION = 5;

/**
 * How far the camera pulls back and how far its target rises for each sequence.
 * Without this the parts — or the raised glass — simply leave the frame.
 */
const SEQUENCE_CAMERA: Record<ViewerSequence, { dolly: number; rise: number }> = {
  exploded: { dolly: 0.5, rise: 0.12 },
  cleaning: { dolly: 0.42, rise: 0.14 },
};

/** Smoothstep, so the parts ease out of and back into the housing. */
function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

const ORIENTATION_SECTORS = [
  { label: 'Front view', centre: 0 },
  { label: 'Front-right view', centre: 45 },
  { label: 'Right side view', centre: 90 },
  { label: 'Back-right view', centre: 135 },
  { label: 'Back view', centre: 180 },
  { label: 'Back-left view', centre: 225 },
  { label: 'Left side view', centre: 270 },
  { label: 'Front-left view', centre: 315 },
];

export class ProductViewer {
  private readonly canvas: HTMLCanvasElement;
  private readonly config: NuViewerConfig;
  private readonly callbacks: ProductViewerCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private environment: THREE.Texture | null = null;
  private model: NuModel | null = null;
  private gltfRoot: THREE.Object3D | null = null;

  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly projected = new THREE.Vector3();
  private frameHandle = 0;
  private running = false;
  private destroyed = false;
  private hotspotFrame = 0;
  private lastOrientation = '';
  private ready = false;

  /** The showcase sequence currently playing, if any, and how far into it. */
  private sequence: ViewerSequence | null = null;
  private sequenceElapsed = 0;
  private sequenceDistance = 0;
  private sequenceTargetY = 0;
  private readonly sequenceOffset = new THREE.Vector3();

  /** Auto-rotate is suspended while the user is interacting or motion is reduced. */
  private autoRotateEnabled: boolean;

  constructor(options: ProductViewerOptions) {
    this.canvas = options.canvas;
    this.config = options.config;
    this.callbacks = options.callbacks ?? {};
    this.autoRotateEnabled = !options.reducedMotion;

    try {
      this.initScene(options.reducedMotion);
    } catch (error) {
      this.callbacks.onUnavailable?.(error instanceof Error ? error.message : 'WebGL is unavailable');
      throw error;
    }
  }

  // ---------------------------------------------------------------- lifecycle

  private initScene(reducedMotion: boolean): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas.addEventListener('webglcontextlost', this.onContextLost);

    this.scene = new THREE.Scene();

    // Image-based lighting from the standard studio room: metal and clearcoat
    // need an environment to look like anything other than flat plastic.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
    this.applyDefaultCamera();

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(1.4, 2.2, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 6;
    key.shadow.camera.left = -0.7;
    key.shadow.camera.right = 0.7;
    key.shadow.camera.top = 0.7;
    key.shadow.camera.bottom = -0.7;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    // Neutral fill and ambient: the device is a grey-and-orange product, and a
    // tinted studio light would read as a tint in the housing itself.
    const rim = new THREE.DirectionalLight(0xffffff, 0.75);
    rim.position.set(-1.8, 1.2, -1.4);
    this.scene.add(rim);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.42));

    // Shadow catcher only — the CSS gradient behind the canvas is the backdrop,
    // and it is light now, so the contact shadow is kept soft.
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 64),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, this.config.cameraTargetY, 0);
    this.controls.enableDamping = !reducedMotion;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.7;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 2.4;
    // Keep the device above the horizon: no under-the-floor viewing angles.
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.autoRotate = this.autoRotateEnabled;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.addEventListener('start', this.onInteractionStart);
    this.controls.update();

    this.loadModel();
    this.resize();
  }

  /** Loads the GLB when configured, otherwise builds the procedural device. */
  private loadModel(): void {
    this.model = createProductModel(this.config.variant);
    this.scene.add(this.model.root);

    if (!this.config.modelUrl) return;

    // Lazy: the loader is only pulled into the bundle for products that ship a
    // real CAD export, and a failed fetch quietly keeps the procedural stand-in.
    import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(this.config.modelUrl as string))
      .then((gltf) => {
        if (this.destroyed) return;
        this.applyGltf(gltf.scene);
      })
      .catch(() => {
        /* Procedural model stays on screen — nothing to do. */
      });
  }

  private applyGltf(object: THREE.Object3D): void {
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose();
      this.model = null;
    }

    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Normalise: drop the export onto the floor and centre it on the origin.
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = 0.75 / Math.max(size.x, size.y, size.z);
    object.scale.setScalar(scale);
    object.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);

    this.gltfRoot = object;
    this.scene.add(object);
  }

  start(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.clock.getDelta();
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  dispose(): void {
    this.destroyed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.controls.removeEventListener('start', this.onInteractionStart);
    this.controls.dispose();
    this.model?.dispose();
    this.gltfRoot?.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
    this.environment?.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------- render

  private readonly tick = (): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.tick);

    const delta = this.clock.getDelta();
    this.model?.tick(this.clock.elapsedTime);
    this.controls.update(delta);
    // After `controls.update`, so the dolly is not undone by damping in the
    // same frame; it only changes the distance, leaving auto-rotate to spin.
    if (this.sequence) this.advanceSequence(delta);
    this.renderer.render(this.scene, this.camera);

    if (!this.ready) {
      this.ready = true;
      this.callbacks.onReady?.();
    }

    // Hotspot projection and occlusion are the expensive part of the frame;
    // a third of the frame rate is indistinguishable for DOM labels.
    if (++this.hotspotFrame % 3 === 0) {
      this.publishHotspots();
      this.publishOrientation();
    }
  };

  resize(): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    this.publishHotspots();
  }

  // ---------------------------------------------------------------- behaviour

  /** Rotates by screen-space deltas — used by the keyboard controls. */
  rotateBy(deltaAzimuthDeg: number, deltaPolarDeg: number): void {
    this.suspendAutoRotate();
    const spherical = new THREE.Spherical().setFromVector3(
      this.camera.position.clone().sub(this.controls.target),
    );
    spherical.theta += THREE.MathUtils.degToRad(deltaAzimuthDeg);
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + THREE.MathUtils.degToRad(deltaPolarDeg),
      this.controls.minPolarAngle,
      this.controls.maxPolarAngle,
    );
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
  }

  zoomBy(factor: number): void {
    this.suspendAutoRotate();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
    this.controls.update();
  }

  resetView(): void {
    this.applyDefaultCamera();
    this.controls.update();
  }

  /** Three-quarter hero framing, sized for the ~400 mm wide device. */
  private applyDefaultCamera(): void {
    this.camera.position.set(0.56, this.config.cameraTargetY + 0.33, 0.7);
    this.controls?.target.set(0, this.config.cameraTargetY, 0);
  }

  /**
   * Fans the device apart to show the parts inside, then reassembles it.
   * Returns false when there is nothing to play or a sequence is already going.
   */
  playExplodedView(): boolean {
    return this.startSequence('exploded');
  }

  /**
   * Runs the glass-cleaning demonstration: a stained glass is scrubbed on the
   * brushes, then clear-rinsed on the rinser.
   */
  playCleaningDemo(): boolean {
    return this.startSequence('cleaning');
  }

  /** Which showcase sequence is playing, if any. */
  playingSequence(): ViewerSequence | null {
    return this.sequence;
  }

  private startSequence(sequence: ViewerSequence): boolean {
    if (this.sequence || !this.model || this.destroyed) return false;

    this.sequence = sequence;
    this.sequenceElapsed = 0;
    this.sequenceDistance = this.camera.position.distanceTo(this.controls.target);
    this.sequenceTargetY = this.controls.target.y;
    this.start();
    return true;
  }

  /**
   * Advances whichever sequence is running and returns the device to rest when
   * it ends. `framing` is how far the camera should currently be pulled back.
   */
  private advanceSequence(delta: number): void {
    const sequence = this.sequence;
    if (!sequence) return;

    this.sequenceElapsed += delta;
    let framing: number;
    let finished = false;

    if (sequence === 'exploded') {
      const { apart, hold, together } = EXPLODE_TIMELINE;
      if (this.sequenceElapsed >= apart + hold + together) {
        framing = 0;
        finished = true;
      } else if (this.sequenceElapsed < apart) {
        framing = smoothstep(this.sequenceElapsed / apart);
      } else if (this.sequenceElapsed < apart + hold) {
        framing = 1;
      } else {
        framing = smoothstep(1 - (this.sequenceElapsed - apart - hold) / together);
      }
      this.model?.explode(framing);
    } else {
      const progress = this.sequenceElapsed / CLEANING_DURATION;
      finished = progress >= 1;
      this.model?.clean(finished ? null : progress);
      // Ease the framing in over the first sixth and back out over the last.
      framing = finished ? 0 : smoothstep(progress * 6) * smoothstep((1 - progress) * 6);
    }

    // Pull back far enough for the sequence to stay in frame, keeping whatever
    // direction the user (or the turntable) has the camera pointing.
    const { dolly, rise } = SEQUENCE_CAMERA[sequence];
    this.sequenceOffset.subVectors(this.camera.position, this.controls.target);
    this.sequenceOffset.setLength(this.sequenceDistance * (1 + dolly * framing));
    this.controls.target.y = this.sequenceTargetY + rise * framing;
    this.camera.position.copy(this.controls.target).add(this.sequenceOffset);

    if (finished) {
      this.sequence = null;
      this.callbacks.onSequenceEnd?.(sequence);
    }
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotateEnabled = enabled;
    this.controls.autoRotate = enabled;
  }

  isAutoRotating(): boolean {
    return this.autoRotateEnabled;
  }


  private readonly onInteractionStart = (): void => {
    this.suspendAutoRotate();
  };

  private suspendAutoRotate(): void {
    if (!this.controls.autoRotate) return;
    this.controls.autoRotate = false;
    this.autoRotateEnabled = false;
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    this.callbacks.onUnavailable?.('The 3D context was lost. Reload the page to try again.');
  };

  // ----------------------------------------------------------------- hotspots

  private publishHotspots(): void {
    const handler = this.callbacks.onHotspots;
    if (!handler || this.config.hotspots.length === 0) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const cameraPosition = this.camera.position;
    const occluders = this.gltfRoot ? [this.gltfRoot] : this.model ? [this.model.root] : [];

    const projections = this.config.hotspots.map((hotspot) => {
      const world = this.projected.set(...hotspot.position);
      const distance = cameraPosition.distanceTo(world);
      const screen = world.clone().project(this.camera);

      let visible = screen.z < 1 && Math.abs(screen.x) <= 1.05 && Math.abs(screen.y) <= 1.05;

      if (visible && occluders.length) {
        // Cheap occlusion test: anything hit noticeably in front of the point
        // means the housing is between the camera and the label.
        this.raycaster.set(cameraPosition, world.clone().sub(cameraPosition).normalize());
        const hit = this.raycaster.intersectObjects(occluders, true)[0];
        if (hit && hit.distance < distance - 0.06) visible = false;
      }

      return {
        id: hotspot.id,
        label: hotspot.label,
        description: hotspot.description,
        x: (screen.x * 0.5 + 0.5) * width,
        y: (-screen.y * 0.5 + 0.5) * height,
        visible,
      } satisfies HotspotProjection;
    });

    handler(projections);
  }

  private publishOrientation(): void {
    const handler = this.callbacks.onOrientationChange;
    if (!handler) return;

    const azimuth = THREE.MathUtils.radToDeg(this.controls.getAzimuthalAngle());
    const normalised = ((azimuth % 360) + 360) % 360;
    const sector = ORIENTATION_SECTORS.reduce((closest, candidate) => {
      const diff = Math.min(
        Math.abs(normalised - candidate.centre),
        360 - Math.abs(normalised - candidate.centre),
      );
      const closestDiff = Math.min(
        Math.abs(normalised - closest.centre),
        360 - Math.abs(normalised - closest.centre),
      );
      return diff < closestDiff ? candidate : closest;
    }, ORIENTATION_SECTORS[0]);

    if (sector.label !== this.lastOrientation) {
      this.lastOrientation = sector.label;
      handler(sector.label);
    }
  }
}
