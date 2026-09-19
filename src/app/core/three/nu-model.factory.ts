import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { NuViewerVariant } from '../models/product.model';

/** The two NU® bodies this factory builds; the Neptun T2000 has its own factory. */
export type NuDeviceVariant = Exclude<NuViewerVariant, 'neptun'>;

/**
 * Procedural stand-in for the SPÜLBOY NU® devices.
 *
 * The shop needs a spinnable product long before the CAD team ships a GLB, so
 * the viewer builds the device from parametric geometry, following the official
 * product photography and the manufacturer dimension drawing:
 *
 *   - a tapered, seamless tub (397 × 270 × 337 mm overall, 369 × 240 mm at the
 *     top of the body, 222 mm across the base) with a fully rounded bottom edge.
 *     Seen from above the housing is a stadium — two semicircular ends joined
 *     by straight sides — and so is the deck field cut into the lid,
 *   - the NU® wordmark on the front of the tub and the SPÜLBOY® ORIGINAL logo
 *     on the front of the deck field, both taken from the product photos,
 *   - the orange sealing gasket where the tub meets the lid, the grey top cover
 *     and its orange seal ring — the NU® design language is a grey shell with
 *     orange sealing details, and nothing else,
 *   - the left pre-rinse basin, deep enough to hold its whole rinser assembly:
 *     the six-lobed orange valve on the floor and the tapered pole standing on
 *     it, centred, with its knurled pin tip still clear of the deck — nothing
 *     inside the device breaks the rim line — plus the two spray rails on the
 *     front and back walls, facing each other across the rinser: raised strips
 *     with a column of holes that spray the outside of the glass from both
 *     sides, each between two orange guide ribs, as on the real basin,
 *   - the right Ø167 mm brush pot and the three parts that lift out of it: the
 *     finned holder, the tall centre brush and the radial brush head,
 *   - the underside: four feet, the drain boss and the fresh-water inlet with
 *     its orange lever tap and the reinforced hose.
 *
 * The removable parts — holder, centre brush, brush head, rinser cone, rinser
 * pin and hose — are each their own group so `explode` can lift them out of the
 * body, which itself never comes apart.
 *
 * Everything is built from two reusable primitives — `createSweptShell` lofts a
 * rounded-rectangle cross-section through a list of rings, `extrudeFlat` stamps
 * a flat plate or frame — which is what keeps the stadium silhouette of the real
 * housing consistent from the base up to the seal ring.
 *
 * Materials are named so a real GLB can drop in later re-using the same names
 * (`NU_Housing`, `NU_Deck`, `NU_Accent`, ...).
 *
 * The geometry primitives, the cleaning-demo props and choreography and the
 * exploded-view bookkeeping are exported: `neptun-model.factory.ts` builds the
 * CLASSIC & ECO Line device from the same parts, so every stage on the page
 * behaves the same way.
 */

export interface NuModel {
  root: THREE.Group;
  /** Objects that pulse/animate each frame; driven by the viewer's clock. */
  tick(elapsed: number): void;
  /**
   * Fans the removable assemblies apart into an exploded view.
   * `0` is fully assembled, `1` fully apart; anything between is a pose on the
   * way, so the caller owns the timing.
   */
  explode(amount: number): void;
  /**
   * Runs the glass-cleaning demonstration: a dirty tea glass is scrubbed on
   * the brushes, then clear-rinsed on the rinser. `progress` runs 0 → 1 across
   * the whole show; `null` puts the props away. Timing is the caller's.
   */
  clean(progress: number | null): void;
  dispose(): void;
}

// ------------------------------------------------------------------- palette
// The device only ever wears the two production colours: the moulded grey of
// the housing and the SPÜLBOY orange of every seal, ring, valve and tap.
const GREY_BODY = '#8f959c';
const GREY_DECK = '#6f757c';
const GREY_DARK = '#43484e';
/** Darker than the basin wall, so a spray hole reads as an opening through it. */
const SLOT_SHADOW = '#23272b';
const GREY_LIGHT = '#c2c7cc';
const ORANGE = '#e2571e';
const BRUSH_BLACK = '#22252a';
const METAL = '#aeb3b8';
const HOSE_GREY = '#cdd2d6';
/** The rinse water: blue-white beads with a faint glow, so they show on white. */
const WATER_BLUE = '#b8dcff';
const WATER_GLOW = '#4d9fe0';

// ---------------------------------------------------------------- dimensions
// Millimetres from the official NU® dimension drawing, expressed in metres.
const BODY_H = 0.293; // tub height
const BODY_TOP_HALF_W = 0.1845; // 369 mm
const BODY_TOP_HALF_D = 0.12; // 240 mm
const BODY_BOTTOM_HALF_W = 0.176;
const BODY_BOTTOM_HALF_D = 0.111; // 222 mm
// A stadium outline: the corner radius equals the half-depth, so each end is
// one semicircle and only the long sides are straight.
const BODY_TOP_R = BODY_TOP_HALF_D;
const BODY_BOTTOM_R = BODY_BOTTOM_HALF_D;

const DECK_HALF_W = 0.1985; // 397 mm overall width
const DECK_HALF_D = 0.135; // 270 mm overall depth
const DECK_R = DECK_HALF_D;
const DECK_TOP = 0.337; // 337 mm overall height
/** Top face of the recessed deck field the two openings are cut into. */
const DECK_FIELD_Y = 0.3335;

// Basins, taken from the top view: a Ø167 mm brush pot on the right and the
// round pre-rinse basin on the left, a touch wider. Both sit on z = 0 and are
// placed so that their orange rings stay clear of the edge of the deck field.
const POT_X = 0.094;
const POT_R = 0.0835;
const POT_FLOOR_Y = 0.1995;

const BASIN_X = -0.093;
/** The basin is a circle: a ring whose half-widths equal its corner radius. */
const BASIN_R = 0.085;
/** Deep enough that the whole rinser pole stands inside the basin. */
const BASIN_FLOOR_Y = 0.205;

/** Width of the orange ring stamped around each opening. */
const OPENING_RING = 0.007;

/** Outline of the recessed deck field the openings are cut into. */
const FIELD_HALF_W = 0.1885;
const FIELD_HALF_D = 0.125;
const FIELD_R = FIELD_HALF_D;

const FOOT_H = 0.016;
/** Worktop height for the built-in variant; the tub hangs below it. */
const COUNTER_Y = 0.34;

/** Where the fresh-water inlet leaves the housing, in device-local space. */
const INLET = { x: -0.1675, y: 0.045, z: 0.055 };

// ------------------------------------------------------------------ geometry

export interface ShellRing {
  y: number;
  halfW: number;
  halfD: number;
  radius: number;
}

const CORNER_SEGMENTS = 14;
/** Four quarter-arcs, both endpoints included, joined by the straight edges. */
const PERIMETER_POINTS = (CORNER_SEGMENTS + 1) * 4;

/**
 * Samples one rounded-rectangle cross-section. Every ring uses the same
 * parameterisation, so any two rings can be stitched to each other no matter
 * how much the housing tapers between them.
 */
function perimeter(ring: ShellRing): THREE.Vector2[] {
  const r = Math.max(0.001, Math.min(ring.radius, ring.halfW, ring.halfD));
  const cx = ring.halfW - r;
  const cz = ring.halfD - r;
  const centres: Array<[number, number]> = [
    [cx, cz],
    [-cx, cz],
    [-cx, -cz],
    [cx, -cz],
  ];

  const points: THREE.Vector2[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const [ox, oz] = centres[corner];
    const start = (corner * Math.PI) / 2;
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const angle = start + (i / CORNER_SEGMENTS) * (Math.PI / 2);
      points.push(new THREE.Vector2(ox + Math.cos(angle) * r, oz + Math.sin(angle) * r));
    }
  }
  return points;
}

/** A stadium cross-section: the ends are full semicircles of the half-depth. */
function stadiumRing(y: number, halfW: number, halfD: number): ShellRing {
  return { y, halfW, halfD, radius: halfD };
}

/** Lofts the rounded-rectangle cross-section through every ring, bottom up. */
export function createSweptShell(
  rings: ShellRing[],
  caps: { bottom?: boolean; top?: boolean } = {},
): THREE.BufferGeometry {
  const n = PERIMETER_POINTS;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const ring of rings) {
    for (const point of perimeter(ring)) positions.push(point.x, ring.y, point.y);
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const a = r * n + j;
      const b = r * n + k;
      const c = (r + 1) * n + k;
      const d = (r + 1) * n + j;
      indices.push(a, c, b, a, d, c);
    }
  }

  if (caps.bottom) {
    const centre = positions.length / 3;
    positions.push(0, rings[0].y, 0);
    for (let j = 0; j < n; j++) indices.push(centre, j, (j + 1) % n);
  }

  if (caps.top) {
    const base = (rings.length - 1) * n;
    const centre = positions.length / 3;
    positions.push(0, rings[rings.length - 1].y, 0);
    for (let j = 0; j < n; j++) indices.push(centre, base + ((j + 1) % n), base + j);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function roundedRectContour(
  halfW: number,
  halfD: number,
  radius: number,
  path: THREE.Path,
  offsetX = 0,
): void {
  const r = Math.max(0.0005, Math.min(radius, halfW, halfD));
  path.moveTo(offsetX + halfW, halfD - r);
  path.absarc(offsetX + halfW - r, halfD - r, r, 0, Math.PI / 2, false);
  path.absarc(offsetX - halfW + r, halfD - r, r, Math.PI / 2, Math.PI, false);
  path.absarc(offsetX - halfW + r, -halfD + r, r, Math.PI, Math.PI * 1.5, false);
  path.absarc(offsetX + halfW - r, -halfD + r, r, Math.PI * 1.5, Math.PI * 2, false);
  path.closePath();
}

export function roundedRectShape(halfW: number, halfD: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  roundedRectContour(halfW, halfD, radius, shape);
  return shape;
}

/**
 * Openings are cut at their own x offset — shapes are authored in the XY plane
 * and rotated into XZ by `extrudeFlat`, and both openings sit on z = 0, so an x
 * offset is the only one ever needed here.
 */
export function roundedRectHole(halfW: number, halfD: number, radius: number, offsetX = 0): THREE.Path {
  const path = new THREE.Path();
  roundedRectContour(halfW, halfD, radius, path, offsetX);
  return path;
}

function circleHole(radius: number, offsetX = 0): THREE.Path {
  const path = new THREE.Path();
  path.absarc(offsetX, 0, radius, 0, Math.PI * 2, true);
  return path;
}

/** Extrudes a flat outline into the XZ plane with its **top** face at y = 0. */
export function extrudeFlat(shape: THREE.Shape, thickness: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    // The round brush-pot opening is cut from a full-circle curve, so this has
    // to be fine enough that the deck cut-out matches the 48-sided pot wall.
    curveSegments: 32,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness, 0);
  return geometry;
}

// ----------------------------------------------------------------- materials

/**
 * The cleaning demo's props. `depthWrite: false` on all three keeps the stain
 * and the water legible through the glass instead of z-fighting it. Every
 * device plays the same demo, so they live apart from the housing palette.
 */
export interface DemoMaterials {
  glass: THREE.MeshPhysicalMaterial;
  /** The handle is thick, solid glass, so it reads denser than the thin wall. */
  handle: THREE.MeshPhysicalMaterial;
  stain: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
}

/** How much of the wall of the demo glass shows; the fade multiplies these. */
export const GLASS_WALL_OPACITY = 0.36;
export const GLASS_SOLID_OPACITY = 0.6;

/** `pose.stain` at its dirtiest; the residue texture is drawn for that state. */
const STAIN_FULL = 0.7;

/** Opacity of the residue film for a pose: full on the unwashed glass, gone when clean. */
export function stainOpacity(pose: CleaningPose): number {
  return Math.min(1, pose.stain / STAIN_FULL) * pose.fade;
}

/** A tiny seeded generator, so the dirt is the same on every visit. */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The inside of an unwashed tea glass, as a texture for the residue film:
 * `u` runs round the glass, `v` from the floor (0) up to the rim (1). Dregs
 * sit dense on the floor and thin out up the wall, a dark tide line marks
 * where the tea stood, drips run down from it, and spots lie in between.
 */
function createTeaStainTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const row = (v: number): number => (1 - v) * h;
  const random = seededRandom(7);

  // A faint film over everything.
  ctx.fillStyle = 'rgba(120, 80, 36, 0.22)';
  ctx.fillRect(0, 0, w, h);

  // Dregs: dense on the floor, fading out a third of the way up the wall.
  const dregs = ctx.createLinearGradient(0, row(0), 0, row(0.5));
  dregs.addColorStop(0, 'rgba(70, 38, 12, 1)');
  dregs.addColorStop(0.5, 'rgba(90, 52, 20, 0.8)');
  dregs.addColorStop(1, 'rgba(110, 70, 30, 0)');
  ctx.fillStyle = dregs;
  ctx.fillRect(0, row(0.5), w, row(0) - row(0.5));

  // The tide line, slightly wavy.
  const tide = 0.84;
  ctx.strokeStyle = 'rgba(60, 32, 10, 0.95)';
  ctx.lineWidth = 11;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const y = row(tide) + Math.sin(x / 17) * 2.5 + Math.sin(x / 5.3) * 1.2;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Drips running down from the tide line towards the floor.
  for (let i = 0; i < 16; i++) {
    const x = random() * w;
    const length = (0.12 + random() * 0.4) * (row(0.3) - row(tide));
    const width = 3 + random() * 6;
    const drip = ctx.createLinearGradient(0, row(tide), 0, row(tide) + length);
    drip.addColorStop(0, 'rgba(80, 44, 16, 0.75)');
    drip.addColorStop(1, 'rgba(88, 50, 18, 0)');
    ctx.fillStyle = drip;
    ctx.fillRect(x, row(tide), width, length);
  }

  // Spots and splashes in between.
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(80, 46, 16, ${0.35 + random() * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(random() * w, row(0.3 + random() * 0.55), 2 + random() * 6, 1.5 + random() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function createDemoMaterials(): DemoMaterials {
  return {
    // Clear pressed glass: a mirror-smooth clearcoat over a faint blue-white
    // tint, the room reflected strongly in it, and a whisper of iridescence
    // where thick glass splits the light. Alpha-blended rather than refractive,
    // so the stain and the water inside stay visible through the wall.
    glass: new THREE.MeshPhysicalMaterial({
      name: 'NU_Glass',
      color: new THREE.Color('#eef5fa'),
      metalness: 0,
      roughness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.2,
      specularIntensity: 1.2,
      iridescence: 0.2,
      iridescenceIOR: 1.3,
      sheen: 0.35,
      sheenRoughness: 0.25,
      sheenColor: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: GLASS_WALL_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // The handle and the foot are solid glass, so they read denser than the wall.
    handle: new THREE.MeshPhysicalMaterial({
      name: 'NU_GlassHandle',
      color: new THREE.Color('#e3edf4'),
      metalness: 0,
      roughness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.2,
      specularIntensity: 1.2,
      iridescence: 0.12,
      iridescenceIOR: 1.3,
      transparent: true,
      opacity: GLASS_SOLID_OPACITY,
      depthWrite: false,
    }),
    // The tea residue inside the glass: dregs on the floor, a tide line where
    // the tea stood and drips between — painted once to a canvas.
    stain: new THREE.MeshStandardMaterial({
      name: 'NU_Stain',
      map: createTeaStainTexture(),
      color: new THREE.Color('#ffffff'),
      metalness: 0,
      roughness: 0.7,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // Water: glossy beads whose opacity follows the strength of the rinse.
    water: new THREE.MeshPhysicalMaterial({
      name: 'NU_Water',
      color: new THREE.Color(WATER_BLUE),
      emissive: new THREE.Color(WATER_GLOW),
      emissiveIntensity: 0.5,
      metalness: 0,
      roughness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  };
}

interface NuMaterials extends DemoMaterials {
  /** The SPÜLBOY® ORIGINAL artwork, served from public/, on the deck field. */
  logo: THREE.MeshStandardMaterial;
  /** The NU® wordmark on the front of the tub, drawn to a canvas. */
  wordmark: THREE.MeshStandardMaterial;
  body: THREE.MeshPhysicalMaterial;
  deck: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  button: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  slot: THREE.MeshStandardMaterial;
  brush: THREE.MeshStandardMaterial;
  accessory: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  hose: THREE.MeshPhysicalMaterial;
  counter: THREE.MeshPhysicalMaterial;
}

function createMaterials(): NuMaterials {
  const accent = new THREE.MeshPhysicalMaterial({
    name: 'NU_Accent',
    color: new THREE.Color(ORANGE),
    metalness: 0.04,
    roughness: 0.38,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
  });

  // The push button breathes on its own, so it cannot share the accent material.
  const button = accent.clone();
  button.name = 'NU_Button';
  button.side = THREE.FrontSide;
  button.emissive = new THREE.Color(ORANGE);
  button.emissiveIntensity = 0.06;

  return {
    accent,
    button,
    logo: createDecalMaterial('NU_Logo', loadLogoTexture()),
    wordmark: createDecalMaterial('NU_Wordmark', createWordmarkTexture()),
    body: new THREE.MeshPhysicalMaterial({
      name: 'NU_Housing',
      color: new THREE.Color(GREY_BODY),
      metalness: 0.05,
      roughness: 0.42,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
    }),
    deck: new THREE.MeshPhysicalMaterial({
      name: 'NU_Deck',
      color: new THREE.Color(GREY_DECK),
      metalness: 0.05,
      roughness: 0.5,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
    }),
    interior: new THREE.MeshStandardMaterial({
      name: 'NU_Interior',
      color: new THREE.Color(GREY_DARK),
      metalness: 0.1,
      roughness: 0.55,
      side: THREE.DoubleSide,
    }),
    slot: new THREE.MeshStandardMaterial({
      name: 'NU_Slots',
      color: new THREE.Color(SLOT_SHADOW),
      metalness: 0.05,
      roughness: 0.8,
    }),
    brush: new THREE.MeshStandardMaterial({
      name: 'NU_Brush',
      color: new THREE.Color(BRUSH_BLACK),
      metalness: 0.02,
      roughness: 0.88,
    }),
    accessory: new THREE.MeshStandardMaterial({
      name: 'NU_Accessory',
      color: new THREE.Color(GREY_LIGHT),
      metalness: 0.04,
      roughness: 0.45,
    }),
    metal: new THREE.MeshStandardMaterial({
      name: 'NU_Metal',
      color: new THREE.Color(METAL),
      metalness: 0.85,
      roughness: 0.28,
    }),
    hose: new THREE.MeshPhysicalMaterial({
      name: 'NU_Hose',
      color: new THREE.Color(HOSE_GREY),
      metalness: 0.02,
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
    counter: new THREE.MeshPhysicalMaterial({
      name: 'NU_Counter',
      color: new THREE.Color(GREY_DARK),
      metalness: 0.25,
      roughness: 0.5,
      clearcoat: 0.2,
    }),

    ...createDemoMaterials(),
  };
}

// ---------------------------------------------------------------- artwork

/** A flat print on the housing: the texture decides where the surface shows through. */
function createDecalMaterial(name: string, map: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    name,
    map,
    transparent: true,
    alphaTest: 0.02,
    metalness: 0,
    roughness: 0.55,
    // Sits a hair above the surface it is printed on, without z-fighting it.
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/** The official SPÜLBOY® ORIGINAL lock-up, the same file the header shows. */
function loadLogoTexture(): THREE.Texture {
  const texture = new THREE.TextureLoader().load('/spulboy-logo.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Width : height of the logo file, so the print keeps its proportions. */
const LOGO_ASPECT = 760 / 433;

/**
 * The "NU® standard" wordmark printed on the front of the tub: heavy capitals
 * with the small "standard" spaced out beneath, in the moulding's dark grey.
 */
function createWordmarkTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#2a2e33';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = '900 300px "Inter", "Arial Black", Arial, sans-serif';
  ctx.fillText('NU', size / 2 - 14, 330);
  const nuWidth = ctx.measureText('NU').width;
  ctx.font = '700 44px "Inter", Arial, sans-serif';
  ctx.fillText('®', size / 2 - 14 + nuWidth / 2 + 26, 120);

  ctx.font = '700 58px "Inter", Arial, sans-serif';
  ctx.letterSpacing = '12px';
  ctx.fillText('standard', size / 2 + 4, 410);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// -------------------------------------------------------------------- housing

/**
 * The tub: a straight taper from the 222 mm base to the 369 × 240 mm top, with
 * a generous fillet where the walls roll into the floor.
 */
function tubRings(): ShellRing[] {
  const ringAt = (y: number, shrink: number): ShellRing => {
    const t = y / BODY_H;
    return {
      y,
      halfW: THREE.MathUtils.lerp(BODY_BOTTOM_HALF_W, BODY_TOP_HALF_W, t) - shrink,
      halfD: THREE.MathUtils.lerp(BODY_BOTTOM_HALF_D, BODY_TOP_HALF_D, t) - shrink,
      radius: THREE.MathUtils.lerp(BODY_BOTTOM_R, BODY_TOP_R, t) - shrink,
    };
  };

  const rings: ShellRing[] = [];
  const fillet = 0.022;
  for (let i = 0; i <= 5; i++) {
    const angle = (i / 5) * (Math.PI / 2);
    rings.push(ringAt(fillet * (1 - Math.cos(angle)), fillet * (1 - Math.sin(angle))));
  }
  for (const y of [0.07, 0.15, 0.23, BODY_H]) rings.push(ringAt(y, 0));
  return rings;
}

function buildHousing(device: THREE.Group, lid: THREE.Group, materials: NuMaterials): void {
  // Open at the top on purpose: both vessels hang *through* that plane, so a
  // cap here would slice straight across the basin and the brush pot. Nothing
  // can see into the tub anyway — the collar closes the perimeter, the deck
  // field closes the rest, and both openings are plugged by closed vessels.
  const tub = new THREE.Mesh(createSweptShell(tubRings(), { bottom: true }), materials.body);
  tub.name = 'NU_Tub';
  device.add(tub);

  // The NU® wordmark, printed high on the flat middle of the front wall. The
  // wall leans outwards as it rises, so the print leans with it.
  const markY = 0.225;
  const lean = Math.atan2(BODY_TOP_HALF_D - BODY_BOTTOM_HALF_D, BODY_H);
  const wordmark = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.052), materials.wordmark);
  wordmark.name = 'NU_Wordmark';
  wordmark.rotation.x = lean;
  wordmark.position.set(0, markY, THREE.MathUtils.lerp(BODY_BOTTOM_HALF_D, BODY_TOP_HALF_D, markY / BODY_H) + 0.0004);
  device.add(wordmark);

  // Orange sealing gasket, proud of both the tub and the lid above it.
  const gasket = new THREE.Mesh(
    createSweptShell([
      stadiumRing(0.278, 0.185, 0.1205),
      stadiumRing(0.285, 0.1915, 0.127),
      stadiumRing(0.296, 0.1915, 0.127),
      stadiumRing(0.302, 0.1875, 0.123),
    ]),
    materials.accent,
  );
  gasket.name = 'NU_Gasket';
  lid.add(gasket);

  // Grey lid band, rolling inwards at the top into the recessed deck field.
  const collar = new THREE.Mesh(
    createSweptShell([
      stadiumRing(0.294, 0.189, 0.1255),
      stadiumRing(0.301, DECK_HALF_W, DECK_HALF_D),
      stadiumRing(0.331, DECK_HALF_W, DECK_HALF_D),
      stadiumRing(DECK_TOP, 0.194, 0.1305),
      // Ends *below* the deck field so the plate covers the open rim.
      stadiumRing(0.33, FIELD_HALF_W - 0.0005, FIELD_HALF_D - 0.0005),
    ]),
    materials.deck,
  );
  collar.name = 'NU_Collar';
  lid.add(collar);

  // Orange seal bead around the rolled lip — the line you see from above.
  const sealRing = new THREE.Mesh(
    createSweptShell([
      stadiumRing(0.3325, 0.1928, 0.1293),
      stadiumRing(0.3368, 0.1945, 0.131),
      stadiumRing(0.3378, 0.1925, 0.129),
      stadiumRing(0.3345, 0.1895, 0.126),
    ]),
    materials.accent,
  );
  sealRing.name = 'NU_SealRing';
  lid.add(sealRing);
}

/** Recessed deck field with the two openings cut out of it. */
function buildDeck(lid: THREE.Group, materials: NuMaterials): void {
  const field = roundedRectShape(FIELD_HALF_W, FIELD_HALF_D, FIELD_R);
  field.holes.push(
    circleHole(BASIN_R, BASIN_X),
    circleHole(POT_R, POT_X),
  );

  const plate = new THREE.Mesh(extrudeFlat(field, 0.012), materials.deck);
  plate.name = 'NU_DeckField';
  plate.position.y = DECK_FIELD_Y;
  lid.add(plate);

  // Orange ring around each opening, flush on the deck field.
  const basinFrame = new THREE.Shape();
  basinFrame.absarc(0, 0, BASIN_R + OPENING_RING, 0, Math.PI * 2, false);
  basinFrame.holes.push(circleHole(BASIN_R));
  const basinRing = new THREE.Mesh(extrudeFlat(basinFrame, 0.005), materials.accent);
  basinRing.name = 'NU_BasinRing';
  basinRing.position.set(BASIN_X, DECK_FIELD_Y + 0.0022, 0);
  lid.add(basinRing);

  const potFrame = new THREE.Shape();
  potFrame.absarc(0, 0, POT_R + OPENING_RING, 0, Math.PI * 2, false);
  potFrame.holes.push(circleHole(POT_R));
  const potRing = new THREE.Mesh(extrudeFlat(potFrame, 0.005), materials.accent);
  potRing.name = 'NU_PotRing';
  potRing.position.set(POT_X, DECK_FIELD_Y + 0.0022, 0);
  lid.add(potRing);

  // SPÜLBOY® ORIGINAL logo printed on the front of the deck field, between
  // the two openings and the rim, as on the real lid.
  const logoWidth = 0.04;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(logoWidth, logoWidth / LOGO_ASPECT), materials.logo);
  logo.name = 'NU_Logo';
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, DECK_FIELD_Y + 0.0006, 0.107);
  lid.add(logo);
}

// -------------------------------------------------------------------- basins

/** A circular cross-section: `perimeter` draws a ring whose half-widths equal its radius as a full circle. */
const circleRing = (y: number, radius: number): ShellRing => ({ y, halfW: radius, halfD: radius, radius });

/** Funnel profile of the round pre-rinse basin, floor first. */
const BASIN_RINGS: ShellRing[] = [
  circleRing(BASIN_FLOOR_Y, 0.056),
  circleRing(0.22, 0.059),
  circleRing(0.25, 0.064),
  circleRing(0.285, 0.072),
  circleRing(0.312, 0.08),
  circleRing(0.3345, BASIN_R),
];

// The spray rails on the front and back walls of the basin — the fresh water
// rises inside them and their columns of holes spray the outside of the glass
// standing over the rinser from both sides, as on the real basin. Two orange
// ribs flank each rail as guides.
const RAIL_PHIS = [Math.PI / 2, (Math.PI * 3) / 2]; // the front wall, the back wall
/** The rail runs from just above the floor to just under the rim. */
const RAIL_BOTTOM_Y = 0.216;
const RAIL_TOP_Y = 0.331;
const RAIL_WIDTH = 0.013;
const RAIL_DEPTH = 0.0035;
/** How far the rail stands proud of the wall, into the basin. */
const RAIL_PROUD = 0.0015;
/** The wider, rounded head at the top of the rail. */
const RAIL_HEAD_WIDTH = 0.023;
const RAIL_HEAD_HEIGHT = 0.02;
const RAIL_HOLES = 10;
const RAIL_HOLE_BOTTOM_Y = 0.226;
const RAIL_HOLE_TOP_Y = 0.302;
const RAIL_HOLE_R = 0.0011;
/** The guide ribs either side of the rail, in radians round the basin. */
const RIB_OFFSET = 0.2;
const RIB_WIDTH = 0.0028;
const RIB_DEPTH = 0.003;

/** Cross-section of the funnel at an arbitrary height, for placing fittings. */
function interpolateRing(rings: ShellRing[], y: number): ShellRing {
  const last = rings.length - 1;
  if (y <= rings[0].y) return { ...rings[0], y };
  if (y >= rings[last].y) return { ...rings[last], y };

  const upper = rings.findIndex((ring) => ring.y >= y);
  const a = rings[upper - 1];
  const b = rings[upper];
  const t = (y - a.y) / (b.y - a.y);
  return {
    y,
    halfW: THREE.MathUtils.lerp(a.halfW, b.halfW, t),
    halfD: THREE.MathUtils.lerp(a.halfD, b.halfD, t),
    radius: THREE.MathUtils.lerp(a.radius, b.radius, t),
  };
}

/**
 * Point and outward normal on a ring at angle `phi`, using the same four-arc
 * construction as `perimeter` — so anything placed this way lands exactly on
 * the swept surface rather than near it.
 */
function ringPointAt(ring: ShellRing, phi: number): { x: number; z: number; nx: number; nz: number } {
  const r = Math.max(0.001, Math.min(ring.radius, ring.halfW, ring.halfD));
  const cx = ring.halfW - r;
  const cz = ring.halfD - r;
  const wrapped = ((phi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const corner = Math.min(3, Math.floor(wrapped / (Math.PI / 2)));
  const nx = Math.cos(wrapped);
  const nz = Math.sin(wrapped);
  return {
    x: (corner === 0 || corner === 3 ? cx : -cx) + nx * r,
    z: (corner === 0 || corner === 1 ? cz : -cz) + nz * r,
    nx,
    nz,
  };
}

/**
 * A frame lying on the basin wall between two heights at angle `phi`: its
 * origin is midway up, +y runs up the wall (following the slope of the
 * funnel), +z points out through the wall and -z into the basin. Fittings are
 * built in that frame, so they hug the wall wherever it is.
 */
function wallFrame(phi: number, bottomY: number, topY: number): { group: THREE.Group; length: number } {
  const lower = interpolateRing(BASIN_RINGS, bottomY);
  const upper = interpolateRing(BASIN_RINGS, topY);
  const a = ringPointAt(lower, phi);
  const b = ringPointAt(upper, phi);
  const bottom = new THREE.Vector3(a.x, lower.y, a.z);
  const top = new THREE.Vector3(b.x, upper.y, b.z);

  const axis = top.clone().sub(bottom);
  const length = axis.length();
  axis.divideScalar(length);
  // Square the wall normal against the axis, then build the frame from both.
  const outward = new THREE.Vector3(b.nx, 0, b.nz).normalize();
  outward.addScaledVector(axis, -outward.dot(axis)).normalize();
  const across = new THREE.Vector3().crossVectors(axis, outward);

  const group = new THREE.Group();
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, axis, outward));
  group.position.lerpVectors(bottom, top, 0.5);
  group.updateMatrixWorld(true);
  return { group, length };
}

/** Height of the i-th spray hole, bottom up. */
function railHoleY(i: number): number {
  return RAIL_HOLE_BOTTOM_Y + (i / (RAIL_HOLES - 1)) * (RAIL_HOLE_TOP_Y - RAIL_HOLE_BOTTOM_Y);
}

/**
 * The funnel wall curves outwards as it rises, so one straight strip between
 * two heights would sink into it halfway up. Anything tall is built in
 * segments split at the basin's profile rings, each in its own wall frame.
 */
function wallSegments(phi: number, bottomY: number, topY: number): Array<{ group: THREE.Group; length: number; bottomY: number; topY: number }> {
  const bounds = [bottomY, ...BASIN_RINGS.map((ring) => ring.y).filter((y) => y > bottomY && y < topY), topY];
  const segments = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    segments.push({ ...wallFrame(phi, bounds[i], bounds[i + 1]), bottomY: bounds[i], topY: bounds[i + 1] });
  }
  return segments;
}

/** A point at height `y` on the wall at angle `phi`, offset into the basin by `proud`, and the frame it sits in. */
function wallPointAt(phi: number, y: number, proud: number): { point: THREE.Vector3; quaternion: THREE.Quaternion } {
  const below = BASIN_RINGS.filter((ring) => ring.y < y).pop() ?? BASIN_RINGS[0];
  const above = BASIN_RINGS.find((ring) => ring.y > y) ?? BASIN_RINGS[BASIN_RINGS.length - 1];
  const { group, length } = wallFrame(phi, below.y, above.y);
  const along = ((y - (below.y + above.y) / 2) * length) / (above.y - below.y);
  return { point: group.localToWorld(new THREE.Vector3(0, along, -proud)), quaternion: group.quaternion.clone() };
}

/** The spray holes of both rails, in basin-local space — where the rinse water leaves. */
function railHolePoints(): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const phi of RAIL_PHIS) {
    for (let i = 0; i < RAIL_HOLES; i++) points.push(wallPointAt(phi, railHoleY(i), RAIL_PROUD + 0.0002).point);
  }
  return points;
}

/** A strip hugging the wall between two heights, in segments that follow its curve. */
function addWallStrip(
  into: THREE.Group,
  phi: number,
  bottomY: number,
  topY: number,
  width: number,
  depth: number,
  proud: number,
  material: THREE.Material,
): { group: THREE.Group; length: number } {
  const segments = wallSegments(phi, bottomY, topY);
  for (const segment of segments) {
    // A hair longer than its span, so neighbouring segments overlap at the joints.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, segment.length + 0.0012, depth), material);
    bar.position.z = depth / 2 - proud;
    segment.group.add(bar);
    into.add(segment.group);
  }
  return segments[segments.length - 1];
}

/**
 * The spray rails: on the front and the back wall, a grey strip standing a
 * little proud of the wall from the floor to just under the rim, widening into
 * a rounded head at the top, with its column of dark holes facing the rinser
 * and an orange guide rib either side. Fixed to the basin — nothing here comes
 * off.
 */
function createSprayRails(materials: NuMaterials): THREE.Group {
  const rails = new THREE.Group();
  rails.name = 'NU_SprayRails';
  for (const phi of RAIL_PHIS) rails.add(createSprayRail(phi, materials));
  return rails;
}

/** One spray rail on the wall at angle `phi`. */
function createSprayRail(phi: number, materials: NuMaterials): THREE.Group {
  const rail = new THREE.Group();
  rail.name = 'NU_SprayRail';

  const top = addWallStrip(rail, phi, RAIL_BOTTOM_Y, RAIL_TOP_Y, RAIL_WIDTH, RAIL_DEPTH, RAIL_PROUD, materials.deck);
  const inset = RAIL_DEPTH / 2 - RAIL_PROUD;

  // The head: a wider plate at the top of the strip with a half-round crown.
  const headR = RAIL_HEAD_WIDTH / 2;
  const headBody = RAIL_HEAD_HEIGHT - headR;
  const head = new THREE.Mesh(new THREE.BoxGeometry(RAIL_HEAD_WIDTH, headBody, RAIL_DEPTH), materials.deck);
  head.position.set(0, top.length / 2 - headR - headBody / 2, inset);
  top.group.add(head);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(headR, headR, RAIL_DEPTH, 24), materials.deck);
  crown.rotation.x = Math.PI / 2;
  crown.position.set(0, top.length / 2 - headR, inset);
  top.group.add(crown);

  // The column of holes, on the face that looks at the rinser.
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(RAIL_HOLE_R, 12), materials.slot, RAIL_HOLES);
  holes.name = 'NU_RailHoles';
  const dummy = new THREE.Object3D();
  const facing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  for (let i = 0; i < RAIL_HOLES; i++) {
    const { point, quaternion } = wallPointAt(phi, railHoleY(i), RAIL_PROUD + 0.0002);
    dummy.position.copy(point);
    dummy.quaternion.copy(quaternion).multiply(facing);
    dummy.updateMatrix();
    holes.setMatrixAt(i, dummy.matrix);
  }
  holes.instanceMatrix.needsUpdate = true;
  rail.add(holes);

  // The orange guide ribs either side of the rail.
  for (const side of [-1, 1]) {
    addWallStrip(rail, phi + side * RIB_OFFSET, RAIL_BOTTOM_Y + 0.004, RAIL_TOP_Y, RIB_WIDTH, RIB_DEPTH, 0.0012, materials.accent);
  }

  return rail;
}

/**
 * Left pre-rinse basin: funnel walls with a spray rail on the front and the
 * back wall, the orange rinser valve on the floor and the pole standing on it.
 */
function buildRinseBasin(lid: THREE.Group, materials: NuMaterials): void {
  const basin = new THREE.Group();
  basin.name = 'NU_RinseBasin';
  basin.position.x = BASIN_X;

  const walls = new THREE.Mesh(createSweptShell(BASIN_RINGS, { bottom: true }), materials.interior);
  basin.add(walls);
  basin.add(createSprayRails(materials));

  // Six-lobed orange rinser valve: press the glass down and the water rises.
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.045, 0.007, 40), materials.interior);
  seat.position.y = BASIN_FLOOR_Y + 0.0035;
  basin.add(seat);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.023, 0.016, 32), materials.accent);
  hub.position.y = BASIN_FLOOR_Y + 0.015;
  basin.add(hub);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 20, 14), materials.accent);
    lobe.scale.set(1, 0.62, 1);
    lobe.position.set(Math.cos(angle) * 0.028, BASIN_FLOOR_Y + 0.016, Math.sin(angle) * 0.028);
    basin.add(lobe);
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.008, 24), materials.accessory);
  cap.position.y = BASIN_FLOOR_Y + 0.026;
  basin.add(cap);

  basin.add(createRinserCone(materials));
  basin.add(createRinserPin(materials));
  lid.add(basin);
}

const CONE_BOTTOM = BASIN_FLOOR_Y + 0.024; // seats over the valve star
const CONE_TOP = CONE_BOTTOM + 0.056;
/** Tip of the rinser pin — where the fresh water leaves for the glass. */
const PIN_TOP = CONE_TOP + 0.035;

/**
 * The rinsing cone, mounted over the valve on the basin axis. It and the pin
 * are separate parts — they come apart in the hand, and in the exploded
 * drawing — but assembled they stack into one pole that stays below the rim.
 */
function createRinserCone(materials: NuMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'NU_RinserCone';

  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.028, CONE_TOP - CONE_BOTTOM, 32),
    materials.accessory,
  );
  cone.position.y = (CONE_BOTTOM + CONE_TOP) / 2;
  group.add(cone);

  return group;
}

/** The thin knurled pin that seats into the top of the cone. */
function createRinserPin(materials: NuMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'NU_RinserPin';

  const bottom = CONE_TOP - 0.002;
  const top = PIN_TOP;

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0052, top - bottom, 20), materials.accessory);
  pin.position.y = (bottom + top) / 2;
  group.add(pin);

  // Knurled grip just under the tip.
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0022, 16), materials.accessory);
    rib.position.y = top - 0.0145 + i * 0.0035;
    group.add(rib);
  }

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 20, 14), materials.accessory);
  tip.position.y = top;
  group.add(tip);

  return group;
}

/** A bristle: pivot at the root, so an instance scales outward along its length. */
export function bristleGeometry(rootRadius: number, tipRadius: number): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(rootRadius, tipRadius, 1, 5, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

/**
 * Right brush pot. The pot itself belongs to the lid; the three parts that lift
 * out of it — the finned holder, the tall centre brush and the radial brush
 * head — are each their own group, in the order the exploded drawing stacks
 * them.
 */
function buildBrushPot(lid: THREE.Group, materials: NuMaterials): void {
  const pot = new THREE.Group();
  pot.name = 'NU_BrushPot';
  pot.position.x = POT_X;

  const wallHeight = 0.3345 - POT_FLOOR_Y;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(POT_R, 0.074, wallHeight, 48, 1, true), materials.interior);
  wall.position.y = POT_FLOOR_Y + wallHeight / 2;
  pot.add(wall);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.074, 48), materials.interior);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = POT_FLOOR_Y;
  pot.add(floor);

  pot.add(createBrushHolder(materials));
  pot.add(createCentreBrush(materials));
  pot.add(createBrushHead(materials));
  lid.add(pot);
}

/** The finned holder insert the brushes drop into; lifts out of the pot. */
function createBrushHolder(materials: NuMaterials): THREE.Group {
  const holder = new THREE.Group();
  holder.name = 'NU_BrushHolder';

  const bottom = 0.21;
  const top = 0.302;
  const height = top - bottom;

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0745, 0.0705, height, 48, 1, true),
    materials.interior,
  );
  shell.position.y = bottom + height / 2;
  holder.add(shell);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0745, 0.0032, 10, 56), materials.interior);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = top;
  holder.add(rim);

  // Vertical fins standing off the inside of the shell.
  const finCount = 28;
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0035, height * 0.92, 0.014), materials.interior, finCount);
  fins.name = 'NU_HolderFins';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < finCount; i++) {
    const angle = (i / finCount) * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 0.0665, bottom + height / 2, Math.sin(angle) * 0.0665);
    dummy.rotation.set(0, -angle, 0);
    dummy.updateMatrix();
    fins.setMatrixAt(i, dummy.matrix);
  }
  fins.instanceMatrix.needsUpdate = true;
  holder.add(fins);

  return holder;
}

/**
 * The tall centre brush that cleans the inside of the glass. It stands down
 * inside the holder, so the assembled device only shows the head above it —
 * which is why it never appears in the top-down photography.
 */
function createCentreBrush(materials: NuMaterials): THREE.Group {
  const brush = new THREE.Group();
  brush.name = 'NU_CentreBrush';

  const bottom = 0.206;
  const top = 0.312;

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, top - bottom, 16), materials.brush);
  shaft.position.y = (bottom + top) / 2;
  brush.add(shaft);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.01, 24), materials.brush);
  foot.position.y = bottom + 0.005;
  brush.add(foot);

  const rings = 12;
  const perRing = 16;
  const bristles = new THREE.InstancedMesh(
    bristleGeometry(0.0016, 0.001),
    materials.brush,
    rings * perRing,
  );
  bristles.name = 'NU_CentreBristles';

  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let index = 0;

  for (let ring = 0; ring < rings; ring++) {
    const y = bottom + 0.014 + (ring / (rings - 1)) * (top - bottom - 0.024);
    for (let i = 0; i < perRing; i++) {
      // Half-step each ring so the bristles spiral instead of combing into rows.
      const angle = ((i + (ring % 2) * 0.5) / perRing) * Math.PI * 2;
      direction.set(Math.cos(angle), ring % 2 ? 0.16 : -0.16, Math.sin(angle)).normalize();
      dummy.quaternion.setFromUnitVectors(up, direction);
      dummy.position.set(direction.x * 0.006, y + direction.y * 0.006, direction.z * 0.006);
      dummy.scale.set(1, 0.026, 1);
      dummy.updateMatrix();
      bristles.setMatrixAt(index++, dummy.matrix);
    }
  }
  bristles.instanceMatrix.needsUpdate = true;
  brush.add(bristles);

  return brush;
}

/** The radial brush head: the black star that sits at the mouth of the pot. */
function createBrushHead(materials: NuMaterials): THREE.Group {
  const head = new THREE.Group();
  head.name = 'NU_BrushHead';

  const tiers = [
    { y: 0.316, tilt: 0.1, count: 56, length: 0.062 },
    { y: 0.322, tilt: 0.16, count: 56, length: 0.06 },
    { y: 0.327, tilt: 0.24, count: 48, length: 0.055 },
  ];
  const total = tiers.reduce((sum, tier) => sum + tier.count, 0);
  const spokes = new THREE.InstancedMesh(bristleGeometry(0.0019, 0.0011), materials.brush, total);
  spokes.name = 'NU_Bristles';

  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let index = 0;

  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      // The per-tier phase offset stops the three rings from combing into rows.
      const angle = (i / tier.count) * Math.PI * 2 + tier.y * 40;
      direction.set(Math.cos(angle), tier.tilt, Math.sin(angle)).normalize();
      dummy.quaternion.setFromUnitVectors(up, direction);
      dummy.position.set(direction.x * 0.014, tier.y + direction.y * 0.014, direction.z * 0.014);
      dummy.scale.set(1, tier.length, 1);
      dummy.updateMatrix();
      spokes.setMatrixAt(index++, dummy.matrix);
    }
  }
  spokes.instanceMatrix.needsUpdate = true;
  head.add(spokes);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.034, 6), materials.brush);
  hub.position.y = 0.327;
  head.add(hub);

  return head;
}

/**
 * Fresh-water push button between the two openings. It sits in a shallow
 * recess, a few millimetres proud of the deck field but still below the rim.
 */
function buildPushButton(lid: THREE.Group, materials: NuMaterials): THREE.Mesh {
  const recess = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.004, 28), materials.interior);
  recess.position.set(0.004, DECK_FIELD_Y - 0.002, -0.064);
  lid.add(recess);

  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0125, 0.006, 28), materials.button);
  button.name = 'NU_PushButton';
  button.position.set(0.004, DECK_FIELD_Y + 0.0005, -0.064);
  lid.add(button);
  return button;
}

// ----------------------------------------------------------------- underside

/** Fresh-water inlet: pipe stub, orange lever tap and the hose fitting. */
function buildInlet(device: THREE.Group, materials: NuMaterials): void {
  const inlet = new THREE.Group();
  inlet.name = 'NU_Inlet';
  inlet.position.set(INLET.x, INLET.y, INLET.z);

  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.078, 20), materials.metal);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.x = -0.039;
  inlet.add(pipe);

  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.026, 24), materials.accent);
  tap.rotation.z = Math.PI / 2;
  tap.position.x = -0.045;
  inlet.add(tap);

  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.012), materials.accent);
  lever.position.set(-0.045, 0.021, 0);
  inlet.add(lever);

  const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.024, 20), materials.metal);
  fitting.rotation.z = Math.PI / 2;
  fitting.position.x = -0.0805;
  inlet.add(fitting);

  device.add(inlet);
}

/** The long, sweeping supply hose of the free-standing device. */
const PORTABLE_HOSE: Array<[number, number, number]> = [
  [-0.253, 0.045, 0.055],
  [-0.278, 0.03, 0.11],
  [-0.25, 0.014, 0.17],
  [-0.15, 0.01, 0.205],
  [-0.01, 0.01, 0.208],
  [0.12, 0.013, 0.175],
  [0.19, 0.018, 0.11],
  [0.205, 0.022, 0.055],
];

/** Built in, the hose simply drops away under the worktop. */
const BUILT_IN_HOSE: Array<[number, number, number]> = [
  [-0.253, 0.045, 0.055],
  [-0.288, 0.026, 0.082],
  [-0.3, 0.004, 0.062],
  [-0.286, -0.014, 0.022],
];

function createHose(points: Array<[number, number, number]>, materials: NuMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'NU_Hose';

  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0105, 14, false), materials.hose));

  const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.03, 20), materials.metal);
  fitting.position.copy(curve.getPointAt(1));
  fitting.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(1).normalize());
  group.add(fitting);

  return group;
}

/** Drain boss and outlet for both variants; feet only for the portable one. */
function buildUnderside(device: THREE.Group, materials: NuMaterials, variant: NuDeviceVariant): void {
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.029, 0.014, 32), materials.body);
  boss.position.y = -0.006;
  device.add(boss);

  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 20), materials.body);
  outlet.rotation.x = Math.PI / 2;
  outlet.position.set(0, -0.006, 0.042);
  device.add(outlet);

  if (variant !== 'portable') return;

  for (const [fx, fz] of [
    [-0.115, -0.062],
    [0.115, -0.062],
    [-0.115, 0.062],
    [0.115, 0.062],
  ] as Array<[number, number]>) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.023, FOOT_H, 24), materials.accessory);
    foot.position.set(fx, -FOOT_H / 2, fz);
    device.add(foot);
  }
}

/**
 * Worktop slab with a cut-out shaped to the tub, so the BUILT-IN device visibly
 * *hangs into* a counter rather than floating in space.
 */
function createCounter(materials: NuMaterials): THREE.Mesh {
  const slab = roundedRectShape(0.36, 0.27, 0.02);
  slab.holes.push(roundedRectHole(BODY_TOP_HALF_W + 0.005, BODY_TOP_HALF_D + 0.005, BODY_TOP_R + 0.004));

  const counter = new THREE.Mesh(extrudeFlat(slab, 0.032), materials.counter);
  counter.name = 'NU_Counter';
  counter.position.y = COUNTER_Y;
  return counter;
}

// -------------------------------------------------------- cleaning demo props

/** Rim height the glass hovers at between stations. */
const GLASS_HOVER_Y = 0.42;
/** Rim height with the glass seated over the brushes or the rinser. */
const GLASS_SEATED_Y = 0.3;
/** Deepest point of a scrubbing stroke. */
const GLASS_SCRUB_Y = 0.255;

// The demo glass is the faceted tea mug supplied as `faceted-glass-mug.glb`
// (served from public/models). The file is drawn upright in metres, base on
// y = 0 and 112 mm tall, with its handle along +x; it is scaled so its
// inside is GLASS_DEPTH deep, which keeps every station height below valid.
const GLASS_MODEL_URL = '/models/faceted-glass-mug.glb';
/** Height of the file's rim above its base. */
const GLASS_MODEL_HEIGHT = 0.112;
/** Depth of the file's inside, rim to floor. */
const GLASS_MODEL_DEPTH = 0.1004;
/** Depth of the inside of the demo glass, rim to floor. */
const GLASS_DEPTH = 0.085;
const GLASS_SCALE = GLASS_DEPTH / GLASS_MODEL_DEPTH;
/** Outer radius at the rim. */
const GLASS_RIM_R = 0.0425 * GLASS_SCALE;
/** Radius of the inside of the glass at mid-height. */
const GLASS_INNER_R = 0.03 * GLASS_SCALE;

/**
 * The demo glass, built **rim down** — the group origin is the rim and the
 * base rises to +y — because that is how a glass is held over the brushes,
 * and it makes the choreography below a matter of moving one rim height.
 *
 * The glass itself is the supplied GLB, loaded into the group as soon as it
 * arrives, re-dressed in the demo's glass materials (so it fades with the
 * rest of the prop) and turned rim down with its handle to +z, towards the
 * camera and clear of every rinser. Only the residue film is still drawn
 * here, fitted to the inside of that model.
 */
export function createDemoGlass(materials: DemoMaterials): THREE.Group {
  const glass = new THREE.Group();
  glass.name = 'NU_DemoGlass';

  // Rim down, handle to +z: the file is flipped about z, lifted so its rim
  // sits on the origin, then the whole thing is turned a quarter round y.
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2;
  glass.add(pivot);

  new GLTFLoader().load(GLASS_MODEL_URL, (gltf) => {
    const model = gltf.scene;
    model.name = 'NU_DemoGlassModel';
    model.scale.setScalar(GLASS_SCALE);
    model.rotation.z = Math.PI;
    model.position.y = GLASS_MODEL_HEIGHT * GLASS_SCALE;

    const drop: THREE.Object3D[] = [];
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name.toLowerCase();
      if (name.includes('tea')) {
        // The file comes filled; the demo brings its own dirt instead.
        drop.push(mesh);
        return;
      }
      // The thin wall shows through; the rim band and handle are solid glass.
      mesh.material = name.includes('rim') || name.includes('handle') ? materials.handle : materials.glass;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.raycast = () => undefined;
    });
    for (const mesh of drop) {
      mesh.removeFromParent();
      (mesh as THREE.Mesh).geometry.dispose();
    }
    pivot.add(model);
  });

  // The residue film: the inside of the mug, a hair inside its wall, rim
  // down. Its points are spaced evenly up the wall so the texture's v runs
  // straight from the floor to the rim.
  const film = [
    [0.0, 0.0843],
    [0.0221, 0.0826],
    [0.024, 0.0695],
    [0.0253, 0.0568],
    [0.0265, 0.044],
    [0.0278, 0.0313],
    [0.029, 0.0186],
    [0.031, 0.0059],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const stain = new THREE.Mesh(new THREE.LatheGeometry(film, 64), materials.stain);
  stain.name = 'NU_DemoGlassStain';
  // Drawn after the wall, so the dirt is not washed out by the glass over it.
  stain.renderOrder = 1;
  glass.add(stain);

  return glass;
}

/** One place the glass is worked at: where it sits, and how far its rim drops. */
export interface CleaningStation {
  x: number;
  z: number;
  /** Rim height with the glass seated at this station. */
  seatedY: number;
}

/**
 * Where a device keeps its two stations, so the one choreography below can
 * play on any of them. Heights are rim heights of the rim-down glass.
 */
export interface CleaningStations {
  /** Rim height the glass hovers at between stations. */
  hoverY: number;
  /** Over the brushes; strokeY is the deepest point of a scrubbing stroke. */
  scrub: CleaningStation & { strokeY: number };
  /** Over the rinser; bob is how far the glass works the valve while rinsing. */
  rinse: CleaningStation & { bob: number };
}

export interface CleaningPose {
  /** Where the glass is across the deck. */
  x: number;
  z: number;
  /** Height of the glass rim. */
  rimY: number;
  /** Opacity of the tea residue, 0.7 filthy down to 0 clean. */
  stain: number;
  /** Strength of the rinse jet. */
  spray: number;
  /** Strength of the wash water thrown up the glass on the brushes. */
  splash: number;
  /** How hard the glass is bearing down on the brush head. */
  press: number;
  /** Fades the whole prop in at the start and out at the end. */
  fade: number;
}

/** The NU® stations: brush pot on the right, rinser basin on the left. */
const NU_STATIONS: CleaningStations = {
  hoverY: GLASS_HOVER_Y,
  scrub: { x: POT_X, z: 0, seatedY: GLASS_SEATED_Y, strokeY: GLASS_SCRUB_Y },
  rinse: { x: BASIN_X, z: 0, seatedY: GLASS_SEATED_Y, bob: 0.012 },
};

/**
 * The four-step routine from the brochure, as one timeline: the stained glass
 * appears, is scrubbed over the brushes, carried across, clear-rinsed on the
 * rinser, then lifted out clean. `progress` runs 0 → 1 over the whole show.
 */
export function cleaningPose(progress: number, stations: CleaningStations): CleaningPose {
  const { lerp, smoothstep } = THREE.MathUtils;
  const { hoverY, scrub, rinse } = stations;
  const pose: CleaningPose = {
    x: scrub.x,
    z: scrub.z,
    rimY: hoverY,
    stain: STAIN_FULL,
    spray: 0,
    splash: 0,
    press: 0,
    fade: 1,
  };
  /** The brushes take 98.5 % of the residue; the rinse takes the last 1.5 %. */
  const scrubbed = STAIN_FULL * 0.015;

  if (progress < 0.06) {
    // A dirty glass appears over the brush pot.
    pose.fade = smoothstep(progress / 0.06, 0, 1);
  } else if (progress < 0.11) {
    // Lower it onto the brushes.
    const k = smoothstep((progress - 0.06) / 0.05, 0, 1);
    pose.rimY = lerp(hoverY, scrub.seatedY, k);
    pose.press = k;
  } else if (progress < 0.42) {
    // Pre-wash: six slow up-and-down strokes over the brush, never turning,
    // with the wash water thrown up the outside of the glass on every stroke.
    const k = (progress - 0.11) / 0.31;
    const stroke = 0.5 - 0.5 * Math.cos(k * Math.PI * 12);
    pose.rimY = lerp(scrub.seatedY, scrub.strokeY, stroke);
    pose.stain = lerp(STAIN_FULL, scrubbed, k);
    pose.press = 1;
    pose.splash = 0.55 + 0.45 * stroke;
  } else if (progress < 0.47) {
    // A moment's rest on the brushes, so the scrubbed glass can be seen.
    const k = (progress - 0.42) / 0.05;
    pose.rimY = scrub.seatedY;
    pose.stain = scrubbed;
    pose.press = 1;
    pose.splash = 0.35 * (1 - k);
  } else if (progress < 0.55) {
    // Lift out and carry across to the rinser.
    const k = smoothstep((progress - 0.47) / 0.08, 0, 1);
    pose.rimY = lerp(scrub.seatedY, hoverY, Math.min(1, k * 2));
    pose.x = lerp(scrub.x, rinse.x, k);
    pose.z = lerp(scrub.z, rinse.z, k);
    pose.stain = scrubbed;
    pose.press = Math.max(0, 1 - k * 3);
  } else if (progress < 0.6) {
    // Lower it onto the rinser.
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.rimY = lerp(hoverY, rinse.seatedY, smoothstep((progress - 0.55) / 0.05, 0, 1));
    pose.stain = scrubbed;
  } else if (progress < 0.86) {
    // Clear-rinsing: fresh water over and through the glass while it bobs on
    // the rinser, until the last of the residue is gone.
    const k = (progress - 0.6) / 0.26;
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.rimY = rinse.seatedY - rinse.bob * (0.5 - 0.5 * Math.cos(k * Math.PI * 6));
    pose.stain = lerp(scrubbed, 0, Math.min(1, k * 1.3));
    pose.spray = Math.min(1, k * 4) * Math.min(1, (1 - k) * 4);
  } else if (progress < 0.93) {
    // Lift the clean glass clear.
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.rimY = lerp(rinse.seatedY, hoverY, smoothstep((progress - 0.86) / 0.07, 0, 1));
    pose.stain = 0;
  } else {
    // Hold it up clean, then let it go.
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.stain = 0;
    pose.fade = 1 - smoothstep((progress - 0.93) / 0.07, 0, 1);
  }

  return pose;
}

// ---------------------------------------------------------------- rinse water

/** Interior height of the demo glass, rim to base. */
export const GLASS_INSIDE_HEIGHT = GLASS_DEPTH;

/**
 * One stream of water beads: a flight from `from` to where it lands on the
 * glass, then a run down the wall at `wallRadius` round the glass axis, and
 * past the rim a free drop drifting `drift` outwards (inwards if negative).
 */
export interface WaterStream {
  from: THREE.Vector3;
  /** Landing point; its height follows the glass when `landsOnBase`. */
  to: THREE.Vector3;
  wallRadius: number;
  drift: number;
  beads: number;
  landsOnBase: boolean;
}

/** Where a device rinses: the glass axis, and the floor the water vanishes at. */
export interface WaterScene {
  glassX: number;
  glassZ: number;
  floorY: number;
}

/** Reusable objects for `placeWaterBeads`, so a frame allocates nothing. */
export interface WaterScratch {
  dummy: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  velocity: THREE.Vector3;
  up: THREE.Vector3;
}

export function createWaterScratch(): WaterScratch {
  return {
    dummy: new THREE.Object3D(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  };
}

/** One instanced sphere for every bead of every stream. */
export function createWaterBeads(material: THREE.Material, streams: WaterStream[], name: string): THREE.InstancedMesh {
  const count = streams.reduce((sum, stream) => sum + stream.beads, 0);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), material, count);
  beads.name = name;
  // The beads move every frame, so a bounding sphere from any one frame is stale.
  beads.frustumCulled = false;
  return beads;
}

/** The fraction of a number — staggers beads without a random generator. */
function fract(value: number): number {
  return value - Math.floor(value);
}

/**
 * Moves every bead of every stream for the current moment. A bead flies from
 * the stream's source to where it lands on the glass — a share of its life in
 * proportion to the distance — then runs down the wall at the stream's radius,
 * gathering speed and wobbling a little, and past the rim drops free, drifting
 * out or in, until it reaches the floor and is reborn. Beads carry their own
 * size and phase, so the water shimmers instead of pulsing, and everything
 * scales with the strength of the rinse.
 */
export function placeWaterBeads(
  beads: THREE.InstancedMesh,
  streams: WaterStream[],
  scene: WaterScene,
  rimY: number,
  time: number,
  strength: number,
  scratch: WaterScratch,
): void {
  const { dummy, from, to, velocity, up } = scratch;
  const life = 1.1;
  const baseY = rimY + GLASS_INSIDE_HEIGHT - 0.01;
  let index = 0;

  const place = (size: number, stretch: number): void => {
    dummy.scale.set(size * strength, size * stretch * strength, size * strength);
    dummy.updateMatrix();
    beads.setMatrixAt(index++, dummy.matrix);
  };

  streams.forEach((stream, s) => {
    from.copy(stream.from);
    to.copy(stream.to);
    if (stream.landsOnBase) to.y = baseY;
    const theta = Math.atan2(to.z - scene.glassZ, to.x - scene.glassX);
    const flight = Math.min(0.4, from.distanceTo(to) * 14);
    velocity.subVectors(to, from);
    if (velocity.lengthSq() > 0) velocity.normalize();

    for (let j = 0; j < stream.beads; j++) {
      const seed = s * 37 + j;
      const t = fract(time / life + fract(seed * 0.6180339887));
      const size = 0.0016 + 0.0012 * fract(seed * 0.37);

      if (t < flight) {
        // In the air: a bead on its way, drooping a little unless it is rising.
        const u = t / flight;
        dummy.position.lerpVectors(from, to, u);
        dummy.position.y -= 0.004 * u * u * (1 - Math.abs(velocity.y));
        dummy.quaternion.setFromUnitVectors(up, velocity);
        place(size * 0.85, 1.6);
        continue;
      }

      // On the glass: running down the wall, then dropping off the rim.
      const run = (t - flight) * life;
      const wobble = theta + 0.12 * Math.sin(run * 9 + seed);
      let y = to.y - 0.16 * run - 0.7 * run * run;
      let r = stream.wallRadius;
      if (y < rimY) {
        r += (rimY - y) * stream.drift;
        y -= (rimY - y) * 0.6;
      }
      if (y < scene.floorY + 0.004) {
        place(0, 1);
        continue;
      }
      dummy.position.set(scene.glassX + r * Math.cos(wobble), y, scene.glassZ + r * Math.sin(wobble));
      dummy.quaternion.identity();
      place(size, 1.8);
    }
  });

  beads.instanceMatrix.needsUpdate = true;
}

/**
 * The NU® rinse: the telescope rinser sends the fresh water up the inside of
 * the glass to its base, where it runs down the inside wall and off the rim
 * into the basin.
 */
function createNuWaterStreams(): WaterStream[] {
  const streams: WaterStream[] = [];

  // Every hole of both spray rails plays towards the glass over the rinser:
  // the ones above its rim wet the outside of the glass and run down it, the
  // lower ones spray in under the rim and fall away.
  const glassWall = GLASS_RIM_R + 0.0005;
  for (const hole of railHolePoints()) {
    const theta = Math.atan2(hole.z, hole.x);
    streams.push({
      from: new THREE.Vector3(BASIN_X + hole.x, hole.y, hole.z),
      to: new THREE.Vector3(BASIN_X + glassWall * Math.cos(theta), hole.y, glassWall * Math.sin(theta)),
      wallRadius: glassWall,
      drift: -0.2,
      beads: 6,
      landsOnBase: false,
    });
  }

  for (let i = 0; i < 10; i++) {
    const theta = i * 2.399963;
    const inner = GLASS_INNER_R;
    const to = new THREE.Vector3(BASIN_X + inner * Math.cos(theta), 0, inner * Math.sin(theta));
    streams.push({
      // Six streams rise off the pin; four more simply run down the wall.
      from: i < 6 ? new THREE.Vector3(BASIN_X, PIN_TOP, 0) : to.clone(),
      to,
      wallRadius: inner,
      drift: -0.2,
      beads: 12,
      landsOnBase: true,
    });
  }
  return streams;
}

/** The NU® rinses over the basin: the water vanishes on its floor. */
const NU_WATER: WaterScene = { glassX: BASIN_X, glassZ: 0, floorY: BASIN_FLOOR_Y };

/**
 * The wash water on the brushes: thrown up the outside of the glass from the
 * bristles all round it, it runs back down the wall and drops off the rim
 * into the pot — the splash of every scrubbing stroke.
 */
function createNuSplashStreams(): WaterStream[] {
  const streams: WaterStream[] = [];
  const outer = GLASS_RIM_R + 0.0008;
  for (let i = 0; i < 14; i++) {
    const theta = (i / 14) * Math.PI * 2 + 0.3;
    streams.push({
      from: new THREE.Vector3(POT_X + (outer - 0.004) * Math.cos(theta), 0.29, (outer - 0.004) * Math.sin(theta)),
      to: new THREE.Vector3(POT_X + outer * Math.cos(theta), 0.335, outer * Math.sin(theta)),
      wallRadius: outer,
      drift: 0.35,
      beads: 7,
      landsOnBase: false,
    });
  }
  return streams;
}

const NU_SPLASH: WaterScene = { glassX: POT_X, glassZ: 0, floorY: POT_FLOOR_Y };

// ------------------------------------------------------------------- exploded

export interface ExplodePart {
  object: THREE.Object3D;
  assembled: THREE.Vector3;
  offset: THREE.Vector3;
}

/** Named removable parts and how far each travels, in metres. */
export type ExplodeOffsets = Array<[string, [number, number, number]]>;

/**
 * How far each removable part travels in the exploded view, in metres.
 *
 * The **body stays whole** — tub, lid, both vessels, the feet and the inlet all
 * hold still, exactly as in the manufacturer's exploded drawing. Only the parts
 * you actually take out by hand travel, and they fan bottom-to-top in the order
 * you would lift them: holder, then centre brush, then the brush head; cone,
 * then pin; and the hose unplugs to the side.
 */
const EXPLODE_OFFSETS: ExplodeOffsets = [
  // The holder and the cone start deep in their vessels, so they need the
  // longest travel just to clear the deck they came out of.
  ['NU_BrushHolder', [0, 0.14, 0]],
  ['NU_CentreBrush', [0, 0.26, 0]],
  ['NU_BrushHead', [0, 0.34, 0]],
  ['NU_RinserCone', [0, 0.14, 0]],
  ['NU_RinserPin', [0, 0.25, 0]],
  ['NU_Hose', [-0.1, -0.03, 0]],
];

/** Finds each named part and remembers where it sits assembled. */
export function collectExplodeParts(root: THREE.Object3D, offsets: ExplodeOffsets): ExplodePart[] {
  const parts: ExplodePart[] = [];
  for (const [name, offset] of offsets) {
    const object = root.getObjectByName(name);
    if (!object) continue;
    parts.push({
      object,
      assembled: object.position.clone(),
      offset: new THREE.Vector3(...offset),
    });
  }
  return parts;
}

// --------------------------------------------------------------------- model

/**
 * Builds the full device for a variant. `root` is anchored on y = 0 so the
 * viewer can drop it straight onto the studio floor.
 */
export function createNuModel(variant: NuDeviceVariant): NuModel {
  const root = new THREE.Group();
  root.name = `NU_${variant}`;

  const materials = createMaterials();
  const device = new THREE.Group();
  device.name = 'NU_Device';

  // The cover and both vessels are one moulding on the tub. They are grouped
  // because that is what they are, not because they move: the exploded view
  // holds the whole body still and lifts only the removable parts out of it.
  const lid = new THREE.Group();
  lid.name = 'NU_Lid';
  device.add(lid);

  buildHousing(device, lid, materials);
  buildDeck(lid, materials);
  buildRinseBasin(lid, materials);
  buildBrushPot(lid, materials);
  const button = buildPushButton(lid, materials);
  buildInlet(device, materials);
  buildUnderside(device, materials, variant);

  if (variant === 'portable') {
    device.position.y = FOOT_H;
    device.add(createHose(PORTABLE_HOSE, materials));
  } else {
    device.position.y = COUNTER_Y - BODY_H;
    device.add(createHose(BUILT_IN_HOSE, materials));
    root.add(createCounter(materials));
  }

  root.add(device);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  // The cleaning demo's props are added after the shadow pass: they are
  // transient stand-ins, not product, so they cast nothing and — via the
  // no-op `raycast` — never take part in hotspot occlusion either.
  const demo = new THREE.Group();
  demo.name = 'NU_CleaningDemo';
  demo.visible = false;
  const glass = createDemoGlass(materials);
  const streams = createNuWaterStreams();
  const water = createWaterBeads(materials.water, streams, 'NU_WaterBeads');
  const splashStreams = createNuSplashStreams();
  const splash = createWaterBeads(materials.water, splashStreams, 'NU_SplashBeads');
  demo.add(glass, water, splash);
  demo.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
    object.raycast = () => undefined;
  });
  device.add(demo);

  const buttonRestY = button.position.y;
  const exploded = collectExplodeParts(root, EXPLODE_OFFSETS);
  const brushHead = root.getObjectByName('NU_BrushHead');
  const scratch = createWaterScratch();
  /** The viewer's clock, as of the last tick — the water runs on it. */
  let time = 0;

  return {
    root,

    tick(elapsed: number): void {
      time = elapsed;
      // A slow breathing highlight on the fresh-water button: "Push the button!"
      const pulse = 0.06 + 0.06 * (0.5 + 0.5 * Math.sin(elapsed * 2.1));
      materials.button.emissiveIntensity = pulse;
      button.position.y = buttonRestY - pulse * 0.0015;
    },

    explode(amount: number): void {
      for (const part of exploded) {
        part.object.position.copy(part.assembled).addScaledVector(part.offset, amount);
      }
    },

    clean(progress: number | null): void {
      if (progress === null) {
        demo.visible = false;
        brushHead?.scale.set(1, 1, 1);
        return;
      }

      demo.visible = true;
      const pose = cleaningPose(THREE.MathUtils.clamp(progress, 0, 1), NU_STATIONS);

      glass.position.set(pose.x, pose.rimY, pose.z);
      materials.glass.opacity = GLASS_WALL_OPACITY * pose.fade;
      materials.handle.opacity = GLASS_SOLID_OPACITY * pose.fade;
      materials.stain.opacity = stainOpacity(pose);
      materials.water.opacity = 0.92 * Math.max(pose.spray, pose.splash) * pose.fade;

      const rinsing = pose.spray > 0.001;
      water.visible = rinsing;
      if (rinsing) placeWaterBeads(water, streams, NU_WATER, pose.rimY, time, pose.spray, scratch);

      const splashing = pose.splash > 0.001;
      splash.visible = splashing;
      if (splashing) placeWaterBeads(splash, splashStreams, NU_SPLASH, pose.rimY, time, pose.splash, scratch);

      // The bristles give way under the glass instead of spearing through it.
      const splay = 1 - 0.55 * pose.press;
      brushHead?.scale.set(splay, 1 - 0.25 * pose.press, splay);
    },

    dispose(): void {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      materials.logo.map?.dispose();
      materials.wordmark.map?.dispose();
      materials.stain.map?.dispose();
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
