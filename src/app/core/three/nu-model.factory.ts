import * as THREE from 'three';

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
 *     top of the body, 222 mm across the base) with a fully rounded bottom edge,
 *   - the orange sealing gasket where the tub meets the lid, the grey top cover
 *     and its orange seal ring — the NU® design language is a grey shell with
 *     orange sealing details, and nothing else,
 *   - the left pre-rinse basin, deep enough to hold its whole rinser assembly:
 *     the six-lobed orange valve on the floor and the tapered pole standing on
 *     it, centred, with its knurled pin tip still clear of the deck — nothing
 *     inside the device breaks the rim line — plus the vertical water slots
 *     louvred into the front and back walls that feed the basin,
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
   * Runs the glass-cleaning demonstration: a stained beer glass is scrubbed on
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
/** Darker than the basin wall, so a slot reads as an opening through it. */
const SLOT_SHADOW = '#23272b';
const GREY_LIGHT = '#c2c7cc';
const ORANGE = '#e2571e';
const BRUSH_BLACK = '#22252a';
/** Beer residue in the demo glass — the only warm tone that is not the brand orange. */
const BEER_STAIN = '#a8752b';
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
const BODY_TOP_R = 0.1;
const BODY_BOTTOM_R = 0.09;

const DECK_HALF_W = 0.1985; // 397 mm overall width
const DECK_HALF_D = 0.135; // 270 mm overall depth
const DECK_R = 0.107;
const DECK_TOP = 0.337; // 337 mm overall height
/** Top face of the recessed deck field the two openings are cut into. */
const DECK_FIELD_Y = 0.3335;

// Basins, taken from the top view: a Ø167 mm brush pot on the right, the
// pre-rinse basin on the left. Both sit on z = 0 and are placed so that their
// orange rings stay clear of the edge of the deck field.
const POT_X = 0.094;
const POT_R = 0.0835;
const POT_FLOOR_Y = 0.1995;

const BASIN_X = -0.093;
const BASIN_HALF_W = 0.082;
const BASIN_HALF_D = 0.089;
const BASIN_R = 0.07;
/** Deep enough that the whole rinser pole stands inside the basin. */
const BASIN_FLOOR_Y = 0.205;

/** Width of the orange ring stamped around each opening. */
const OPENING_RING = 0.007;

/** Outline of the recessed deck field the openings are cut into. */
const FIELD_HALF_W = 0.1885;
const FIELD_HALF_D = 0.125;
const FIELD_R = 0.0995;

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

/** A flat frame: an outer rounded rectangle with a rounded-rectangle opening. */
function roundedRectFrame(
  halfW: number,
  halfD: number,
  radius: number,
  width: number,
): THREE.Shape {
  const shape = roundedRectShape(halfW + width, halfD + width, radius + width);
  shape.holes.push(roundedRectHole(halfW, halfD, radius));
  return shape;
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

export function createDemoMaterials(): DemoMaterials {
  return {
    glass: new THREE.MeshPhysicalMaterial({
      name: 'NU_Glass',
      color: new THREE.Color('#eaf1f6'),
      metalness: 0,
      roughness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    handle: new THREE.MeshPhysicalMaterial({
      name: 'NU_GlassHandle',
      color: new THREE.Color('#dce8f0'),
      metalness: 0,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
    stain: new THREE.MeshStandardMaterial({
      name: 'NU_Stain',
      color: new THREE.Color(BEER_STAIN),
      metalness: 0,
      roughness: 0.65,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // Water: glossy beads whose opacity follows the strength of the rinse.
    water: new THREE.MeshPhysicalMaterial({
      name: 'NU_Water',
      color: new THREE.Color(WATER_BLUE),
      emissive: new THREE.Color(WATER_GLOW),
      emissiveIntensity: 0.35,
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

  // Orange sealing gasket, proud of both the tub and the lid above it.
  const gasket = new THREE.Mesh(
    createSweptShell([
      { y: 0.278, halfW: 0.185, halfD: 0.1205, radius: 0.1005 },
      { y: 0.285, halfW: 0.1915, halfD: 0.127, radius: 0.1045 },
      { y: 0.296, halfW: 0.1915, halfD: 0.127, radius: 0.1045 },
      { y: 0.302, halfW: 0.1875, halfD: 0.123, radius: 0.1015 },
    ]),
    materials.accent,
  );
  gasket.name = 'NU_Gasket';
  lid.add(gasket);

  // Grey lid band, rolling inwards at the top into the recessed deck field.
  const collar = new THREE.Mesh(
    createSweptShell([
      { y: 0.294, halfW: 0.189, halfD: 0.1255, radius: 0.1025 },
      { y: 0.301, halfW: DECK_HALF_W, halfD: DECK_HALF_D, radius: DECK_R },
      { y: 0.331, halfW: DECK_HALF_W, halfD: DECK_HALF_D, radius: DECK_R },
      { y: DECK_TOP, halfW: 0.194, halfD: 0.1305, radius: 0.1025 },
      // Ends *below* the deck field so the plate covers the open rim.
      { y: 0.33, halfW: FIELD_HALF_W - 0.0005, halfD: FIELD_HALF_D - 0.0005, radius: FIELD_R },
    ]),
    materials.deck,
  );
  collar.name = 'NU_Collar';
  lid.add(collar);

  // Orange seal bead around the rolled lip — the line you see from above.
  const sealRing = new THREE.Mesh(
    createSweptShell([
      { y: 0.3325, halfW: 0.1928, halfD: 0.1293, radius: 0.1018 },
      { y: 0.3368, halfW: 0.1945, halfD: 0.131, radius: 0.1035 },
      { y: 0.3378, halfW: 0.1925, halfD: 0.129, radius: 0.1015 },
      { y: 0.3345, halfW: 0.1895, halfD: 0.126, radius: 0.0985 },
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
    roundedRectHole(BASIN_HALF_W, BASIN_HALF_D, BASIN_R, BASIN_X),
    circleHole(POT_R, POT_X),
  );

  const plate = new THREE.Mesh(extrudeFlat(field, 0.012), materials.deck);
  plate.name = 'NU_DeckField';
  plate.position.y = DECK_FIELD_Y;
  lid.add(plate);

  // Orange ring around each opening, flush on the deck field.
  const basinRing = new THREE.Mesh(
    extrudeFlat(roundedRectFrame(BASIN_HALF_W, BASIN_HALF_D, BASIN_R, OPENING_RING), 0.005),
    materials.accent,
  );
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

  // Brand badge on the front of the deck field.
  const badge = new THREE.Mesh(extrudeFlat(roundedRectShape(0.026, 0.0065, 0.0055), 0.0018), materials.accent);
  badge.name = 'NU_Badge';
  badge.position.set(0, DECK_FIELD_Y + 0.0018, 0.109);
  lid.add(badge);
}

// -------------------------------------------------------------------- basins

/** Funnel profile of the pre-rinse basin, floor first. */
const BASIN_RINGS: ShellRing[] = [
  { y: BASIN_FLOOR_Y, halfW: 0.052, halfD: 0.059, radius: 0.044 },
  { y: 0.22, halfW: 0.055, halfD: 0.062, radius: 0.046 },
  { y: 0.25, halfW: 0.06, halfD: 0.067, radius: 0.051 },
  { y: 0.285, halfW: 0.068, halfD: 0.075, radius: 0.057 },
  { y: 0.312, halfW: 0.077, halfD: 0.084, radius: 0.065 },
  { y: 0.3345, halfW: BASIN_HALF_W, halfD: BASIN_HALF_D, radius: BASIN_R },
];

// The louvred water slots on the basin wall — the fresh water passes through
// these into the basin. They sit on the front and back walls, as in the photo.
const SLOT_BOTTOM_Y = 0.294;
const SLOT_TOP_Y = 0.326;
const SLOT_WIDTH = 0.0032;
const SLOT_DEPTH = 0.004;
const SLOTS_PER_GROUP = 5;
const SLOT_PITCH = 0.26; // radians between neighbouring slots

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
 * The vertical water slots louvred into the basin wall. Each one follows the
 * slope of the funnel and stands a fraction of a millimetre proud of it on the
 * inside, so it reads as a cut rather than as a rib.
 */
function createWallSlots(materials: NuMaterials): THREE.InstancedMesh {
  const lower = interpolateRing(BASIN_RINGS, SLOT_BOTTOM_Y);
  const upper = interpolateRing(BASIN_RINGS, SLOT_TOP_Y);
  const groups = [Math.PI / 2, (Math.PI * 3) / 2]; // front wall and back wall

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    materials.slot,
    groups.length * SLOTS_PER_GROUP,
  );
  mesh.name = 'NU_BasinSlots';

  const dummy = new THREE.Object3D();
  const bottom = new THREE.Vector3();
  const top = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const across = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  let index = 0;

  for (const centre of groups) {
    for (let i = 0; i < SLOTS_PER_GROUP; i++) {
      const phi = centre + (i - (SLOTS_PER_GROUP - 1) / 2) * SLOT_PITCH;
      const a = ringPointAt(lower, phi);
      const b = ringPointAt(upper, phi);

      bottom.set(a.x, lower.y, a.z);
      top.set(b.x, upper.y, b.z);
      axis.subVectors(top, bottom);
      const length = axis.length();
      axis.divideScalar(length);

      // Square the wall normal against the slot axis, then build the frame.
      outward.set(b.nx, 0, b.nz).normalize();
      outward.addScaledVector(axis, -outward.dot(axis)).normalize();
      across.crossVectors(axis, outward);
      basis.makeBasis(across, axis, outward);

      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.position.lerpVectors(bottom, top, 0.5).addScaledVector(outward, SLOT_DEPTH / 2 - 0.0003);
      dummy.scale.set(SLOT_WIDTH, length, SLOT_DEPTH);
      dummy.updateMatrix();
      mesh.setMatrixAt(index++, dummy.matrix);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * Left pre-rinse basin: funnel walls with their water slots, the orange rinser
 * valve on the floor and the pole standing on it.
 */
function buildRinseBasin(lid: THREE.Group, materials: NuMaterials): void {
  const basin = new THREE.Group();
  basin.name = 'NU_RinseBasin';
  basin.position.x = BASIN_X;

  const walls = new THREE.Mesh(createSweptShell(BASIN_RINGS, { bottom: true }), materials.interior);
  basin.add(walls);
  basin.add(createWallSlots(materials));

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

/**
 * A half-litre beer glass, built **rim down** — the group origin is the rim and
 * the base rises to +y — because that is how a glass is held over the brushes,
 * and it makes the choreography below a matter of moving one rim height.
 */
export function createDemoGlass(materials: DemoMaterials): THREE.Group {
  const glass = new THREE.Group();
  glass.name = 'NU_DemoGlass';

  const wall = [
    [0.0, 0.155],
    [0.024, 0.155],
    [0.029, 0.1525],
    [0.0305, 0.148],
    [0.0325, 0.115],
    [0.0345, 0.075],
    [0.036, 0.035],
    [0.0372, 0.004],
    [0.0368, 0.0],
    [0.0338, 0.004],
    [0.0326, 0.035],
    [0.0311, 0.075],
    [0.0291, 0.115],
    [0.0268, 0.14],
    [0.0235, 0.1465],
    [0.0, 0.1485],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const body = new THREE.Mesh(new THREE.LatheGeometry(wall, 48), materials.glass);
  body.name = 'NU_DemoGlassBody';
  glass.add(body);

  // The residue film: the inner surface only, sitting just inside the wall.
  const film = [
    [0.0, 0.148],
    [0.023, 0.146],
    [0.0263, 0.1395],
    [0.0286, 0.115],
    [0.0306, 0.075],
    [0.0321, 0.035],
    [0.0333, 0.006],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const stain = new THREE.Mesh(new THREE.LatheGeometry(film, 48), materials.stain);
  stain.name = 'NU_DemoGlassStain';
  glass.add(stain);

  // The handle: a C on the side, like a tea glass — out from just below the
  // rim, round, and back in at mid-body. It points to +z, towards the camera
  // and clear of every rinser, and starts and ends inside the wall so it
  // reads as one piece with the glass.
  const handle = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.016, 0.034),
        new THREE.Vector3(0, 0.026, 0.058),
        new THREE.Vector3(0, 0.055, 0.067),
        new THREE.Vector3(0, 0.084, 0.055),
        new THREE.Vector3(0, 0.096, 0.031),
      ]),
      32,
      0.0045,
      10,
      false,
    ),
    materials.handle,
  );
  handle.name = 'NU_DemoGlassHandle';
  glass.add(handle);

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
  /** Opacity of the beer residue, 0.7 filthy down to 0 clean. */
  stain: number;
  /** Strength of the rinse jet. */
  spray: number;
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
    stain: 0.7,
    spray: 0,
    press: 0,
    fade: 1,
  };

  if (progress < 0.14) {
    // A dirty glass appears over the brush pot.
    pose.fade = smoothstep(progress / 0.14, 0, 1);
  } else if (progress < 0.22) {
    // Lower it onto the brushes.
    pose.rimY = lerp(hoverY, scrub.seatedY, smoothstep((progress - 0.14) / 0.08, 0, 1));
    pose.press = smoothstep((progress - 0.14) / 0.08, 0, 1);
  } else if (progress < 0.5) {
    // Pre-wash: rapid up-and-down strokes over the brush, never turning.
    const k = (progress - 0.22) / 0.28;
    const stroke = 0.5 - 0.5 * Math.cos(k * Math.PI * 8);
    pose.rimY = lerp(scrub.seatedY, scrub.strokeY, stroke);
    pose.stain = lerp(0.7, 0.25, k);
    pose.press = 1;
  } else if (progress < 0.6) {
    // Lift out and carry across to the rinser.
    const k = smoothstep((progress - 0.5) / 0.1, 0, 1);
    pose.rimY = lerp(scrub.seatedY, hoverY, Math.min(1, k * 2));
    pose.x = lerp(scrub.x, rinse.x, k);
    pose.z = lerp(scrub.z, rinse.z, k);
    pose.stain = 0.25;
    pose.press = Math.max(0, 1 - k * 3);
  } else if (progress < 0.68) {
    // Lower it onto the rinser.
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.rimY = lerp(hoverY, rinse.seatedY, smoothstep((progress - 0.6) / 0.08, 0, 1));
    pose.stain = 0.25;
  } else if (progress < 0.86) {
    // Clear-rinsing: fresh water through the inside of the glass.
    const k = (progress - 0.68) / 0.18;
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.rimY = rinse.seatedY - rinse.bob * (0.5 - 0.5 * Math.cos(k * Math.PI * 4));
    pose.stain = lerp(0.25, 0, Math.min(1, k * 1.4));
    pose.spray = Math.min(1, k * 5) * Math.min(1, (1 - k) * 5);
  } else if (progress < 0.94) {
    // Lift the clean glass clear.
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.rimY = lerp(rinse.seatedY, hoverY, smoothstep((progress - 0.86) / 0.08, 0, 1));
    pose.stain = 0;
  } else {
    // Hold it up clean, then let it go.
    pose.x = rinse.x;
    pose.z = rinse.z;
    pose.stain = 0;
    pose.fade = 1 - smoothstep((progress - 0.94) / 0.06, 0, 1);
  }

  return pose;
}

// ---------------------------------------------------------------- rinse water

/** Interior height of the demo glass, rim to base. */
export const GLASS_INSIDE_HEIGHT = 0.148;

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
  for (let i = 0; i < 10; i++) {
    const theta = i * 2.399963;
    const to = new THREE.Vector3(BASIN_X + 0.031 * Math.cos(theta), 0, 0.031 * Math.sin(theta));
    streams.push({
      // Six streams rise off the pin; four more simply run down the wall.
      from: i < 6 ? new THREE.Vector3(BASIN_X, PIN_TOP, 0) : to.clone(),
      to,
      wallRadius: 0.031,
      drift: -0.2,
      beads: 12,
      landsOnBase: true,
    });
  }
  return streams;
}

/** The NU® rinses over the basin: the water vanishes on its floor. */
const NU_WATER: WaterScene = { glassX: BASIN_X, glassZ: 0, floorY: BASIN_FLOOR_Y };

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
  demo.add(glass, water);
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
      materials.glass.opacity = 0.3 * pose.fade;
      materials.handle.opacity = 0.62 * pose.fade;
      materials.stain.opacity = pose.stain * pose.fade;
      materials.water.opacity = 0.92 * pose.spray * pose.fade;

      const rinsing = pose.spray > 0.001;
      water.visible = rinsing;
      if (rinsing) placeWaterBeads(water, streams, NU_WATER, pose.rimY, time, pose.spray, scratch);

      // The bristles give way under the glass instead of spearing through it.
      const splay = 1 - 0.55 * pose.press;
      brushHead?.scale.set(splay, 1 - 0.25 * pose.press, splay);
    },

    dispose(): void {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
