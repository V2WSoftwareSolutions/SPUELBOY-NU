import * as THREE from 'three';

import {
  bristleGeometry,
  cleaningPose,
  CleaningStations,
  collectExplodeParts,
  createDemoGlass,
  createDemoMaterials,
  createSweptShell,
  createWaterBeads,
  createWaterScratch,
  DemoMaterials,
  ExplodeOffsets,
  extrudeFlat,
  NuModel,
  placeWaterBeads,
  roundedRectHole,
  roundedRectShape,
  ShellRing,
  WaterScene,
  WaterStream,
} from './nu-model.factory';

/**
 * Procedural stand-in for the SPÜLBOY® Neptun T2000 — the in-sink glass washer
 * of the CLASSIC & ECO Line.
 *
 * Built to the product photography, the catalogue figures (pot Ø 18 cm,
 * 23.5 cm internal glass height, 33 × 19 × 33 cm overall) and the
 * manufacturer's parts diagram:
 *
 *   - the keyhole-shaped charcoal base plate — a round platform under the pot
 *     and a tongue reaching out to the right that carries both cones — standing
 *     on three suction feet,
 *   - the white Ø 180 mm brush pot with its charcoal bottom collar, the
 *     SPÜLBOY® badge on the front, the perforated spray pipe on its flank that
 *     rinses the outside of the glass, and the glass protection ring rolled
 *     over the rim,
 *   - inside the pot, the brush parts in the order the diagram stacks them: the
 *     brush strip lining the wall, the bayonet middle brush and the radial
 *     brush head at the mouth — plus the down tube with its back-flow
 *     preventer, hooked out through the inlet hole just below the rim,
 *   - on the tongue, the two-step rinsing cone with the 2-step head valve and
 *     its valve tube at the tip, and the tall perforated spray pole opposite
 *     the pipe, so the glass over the cone is sprayed from both sides,
 *   - underneath, the drain, the angle connection easy clix® and the
 *     connection hose.
 *
 * Every part that comes off in the hand — strip, ring, middle brush, down
 * tube, brush head, head valve and hose — is its own group so `explode` can
 * lift it out; the pot, the cones, the base and the feet never come apart.
 *
 * The cleaning demo plays where the Neptun belongs: a matte stainless sink
 * rises around the device, both poles spray the glass over the cone with
 * beads of water running down it, and the sink sinks away again at the end.
 *
 * Primitives, demo props and the cleaning choreography are shared with
 * `nu-model.factory.ts`, so the Neptun plays exactly the same showcase as the
 * NU® devices. Materials are prefixed `NEP_` so a CAD export can reuse them.
 */

// ------------------------------------------------------------------- palette
// White enamelled pot, charcoal mouldings and black bristles — plus the orange
// of the SPÜLBOY® badge and the easy clix® coupling, and nothing else. The
// demo sink adds brushed stainless, a white worktop and the blue-white of water.
const POT_WHITE = '#f3f4f2';
const CHARCOAL = '#4a4f56';
const CHARCOAL_DEEP = '#2f3338';
const BRUSH_BLACK = '#22252a';
const FOOT_CREAM = '#e9e6dd';
const TUBE_GREY = '#d9dcdf';
const METAL = '#aeb3b8';
const HOSE_GREY = '#cdd2d6';
const ORANGE = '#e2571e';
const COUNTER_WHITE = '#eef0f1';
const STEEL = '#c5c9cd';

// ---------------------------------------------------------------- dimensions
// Metres, from the catalogue: pot Ø 18 cm, 23.5 cm internal glass height,
// 33 × 19 × 33 cm overall. The device is authored with the pot on the origin
// and then shifted as a whole, so the pot and the tongue balance on the stage.
const FOOT_H = 0.024;
const BASE_T = 0.018;
const BASE_TOP = FOOT_H + BASE_T;
const PLATE_R = 0.095; // 190 mm across
const TONGUE_TIP_CX = 0.195;
const TONGUE_TIP_R = 0.04; // tip at +235 mm: 330 mm overall with the pot

const POT_R = 0.09; // Ø 180 mm
const POT_INNER_R = 0.0845;
const COLLAR_TOP = 0.066;
const POT_TOP = 0.305;
const RING_BOTTOM = 0.302;
const RING_TOP = 0.33; // 330 mm overall height
const RING_INNER_R = 0.08;
/** 235 mm below the rim — the internal glass height from the catalogue. */
const POT_FLOOR_Y = RING_TOP - 0.235;
const BADGE_Y = 0.215;

const STRIP_BOTTOM = POT_FLOOR_Y + 0.006;
const STRIP_TOP = 0.236;
const BRUSH_BOTTOM = POT_FLOOR_Y + 0.003;
const BRUSH_TOP = 0.3;

const RINSE_X = 0.142;
/** The tall spray pole: a cone tapering from its base to its tip, with holes. */
const POLE_X = 0.2;
const POLE_BASE_R = 0.02;
const POLE_TIP_R = 0.0045;
const POLE_BASE_Y = BASE_TOP + 0.006;
const POLE_TIP_Y = 0.316;
const POLE_HOLES = 12;
const POLE_HOLE_BOTTOM = 0.11;
const POLE_HOLE_TOP = 0.28;
/** Tip of the rinsing cone, where the head valve seats. */
const RINSE_CONE_TOP = 0.222;
const VALVE_CAP_Y = RINSE_CONE_TOP + 0.016;
const VALVE_TOP = VALVE_CAP_Y + 0.0048;

/** The inlet hole through the pot wall sits back-left, just under the ring. */
const INLET_AZIMUTH = -Math.PI * 0.75;
const INLET_Y = 0.275;
/** Radius the down tube stands at inside the pot. */
const TUBE_RADIUS = 0.07;

/**
 * The perforated spray pipe stands on the flank of the pot, facing the rinsing
 * cone: fresh water rises through it and its row of holes sprays the outside
 * of the glass standing over the cone — the dotted line of the parts drawing.
 */
const PIPE_X = POT_R + 0.005;
const PIPE_R = 0.0055;
const PIPE_TOP = 0.292;
const PIPE_HOLES = 14;
const PIPE_HOLE_BOTTOM = 0.115;
const PIPE_HOLE_TOP = 0.27;

/** Two feet under the pot, one at the end of the tongue. */
const FEET: Array<[number, number]> = [
  [-0.052, 0.06],
  [-0.052, -0.06],
  [0.2, 0],
];
/** Where the angle connection hangs under the plate. */
const CONNECTION = { x: 0.03, z: 0.055 };

/** Shift of the whole device, so the pot and the tongue balance on the origin. */
const DEVICE_OFFSET_X = -0.07;

// The Neptun is an in-sink model, so the cleaning demo plays in one: a matte
// stainless basin let into a white counter, as on the trade-fair stand. In
// stage space, centred a little left of the device so the hose stays inside
// the basin.
const SINK_X = -0.03;
const SINK_DEPTH = 0.17;
const SINK_COUNTER_T = 0.03;
const SINK_HALF_W = 0.29;
const SINK_HALF_D = 0.215;
const SINK_R = 0.05;
/** How far below the floor the sink starts before it rises into place. */
const SINK_DROP = 0.26;
/** Beads per hole: a short flight onto the glass, then a run down it. */
const BEADS_PER_HOLE = 10;
/** Streams running down the inside of the glass from the head valve. */
const INSIDE_STREAMS = 8;
/** Just outside and just inside the wall of the demo glass, where water runs. */
const GLASS_OUTER_R = 0.038;
const GLASS_INNER_R = 0.031;
/** The Neptun rinses over the cone: the water vanishes on the basin floor. */
const NEPTUN_WATER: WaterScene = { glassX: RINSE_X, glassZ: 0, floorY: 0 };

/** The same routine as on the NU®: scrub in the pot, rinse over the head valve. */
const NEPTUN_STATIONS: CleaningStations = {
  hoverY: 0.42,
  scrub: { x: 0, z: 0, seatedY: 0.27, strokeY: 0.2 },
  rinse: { x: RINSE_X, z: 0, seatedY: 0.1, bob: 0.01 },
};

// ----------------------------------------------------------------- materials

interface NeptunMaterials extends DemoMaterials {
  pot: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  brush: THREE.MeshStandardMaterial;
  foot: THREE.MeshPhysicalMaterial;
  tube: THREE.MeshStandardMaterial;
  valve: THREE.MeshPhysicalMaterial;
  metal: THREE.MeshStandardMaterial;
  hose: THREE.MeshPhysicalMaterial;
  badge: THREE.MeshPhysicalMaterial;
  wordmark: THREE.MeshStandardMaterial;
  counter: THREE.MeshPhysicalMaterial;
  steel: THREE.MeshStandardMaterial;
}

function createMaterials(): NeptunMaterials {
  return {
    // Enamelled steel: whiter and glossier than the NU® mouldings.
    pot: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Pot',
      color: new THREE.Color(POT_WHITE),
      metalness: 0.12,
      roughness: 0.28,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
    }),
    // Base, collar, ring and cones: the charcoal mouldings. Double-sided, so
    // the lathed ring and cones read correctly from every angle.
    trim: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Trim',
      color: new THREE.Color(CHARCOAL),
      metalness: 0.05,
      roughness: 0.48,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
    }),
    interior: new THREE.MeshStandardMaterial({
      name: 'NEP_Interior',
      color: new THREE.Color(CHARCOAL_DEEP),
      metalness: 0.1,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
    brush: new THREE.MeshStandardMaterial({
      name: 'NEP_Brush',
      color: new THREE.Color(BRUSH_BLACK),
      metalness: 0.02,
      roughness: 0.88,
    }),
    foot: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Foot',
      color: new THREE.Color(FOOT_CREAM),
      metalness: 0,
      roughness: 0.35,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    }),
    tube: new THREE.MeshStandardMaterial({
      name: 'NEP_Tube',
      color: new THREE.Color(TUBE_GREY),
      metalness: 0.05,
      roughness: 0.4,
    }),
    // The cap of the head valve breathes on its own: "press the glass here".
    valve: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Valve',
      color: new THREE.Color(CHARCOAL),
      emissive: new THREE.Color(ORANGE),
      emissiveIntensity: 0.05,
      metalness: 0.05,
      roughness: 0.4,
      clearcoat: 0.4,
    }),
    metal: new THREE.MeshStandardMaterial({
      name: 'NEP_Metal',
      color: new THREE.Color(METAL),
      metalness: 0.85,
      roughness: 0.28,
    }),
    hose: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Hose',
      color: new THREE.Color(HOSE_GREY),
      metalness: 0.02,
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
    badge: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Badge',
      color: new THREE.Color(ORANGE),
      metalness: 0.04,
      roughness: 0.38,
      clearcoat: 0.45,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    }),
    wordmark: new THREE.MeshStandardMaterial({
      name: 'NEP_Wordmark',
      color: new THREE.Color(CHARCOAL_DEEP),
      metalness: 0.05,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
    // The demo sink: worktop and brushed stainless, seen from inside the basin.
    counter: new THREE.MeshPhysicalMaterial({
      name: 'NEP_Counter',
      color: new THREE.Color(COUNTER_WHITE),
      metalness: 0.02,
      roughness: 0.4,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    }),
    // Brushed, matte stainless: soft reflections, so the basin's rolled
    // corners read as one surface instead of mirroring the studio in facets.
    steel: new THREE.MeshStandardMaterial({
      name: 'NEP_Steel',
      color: new THREE.Color(STEEL),
      metalness: 0.45,
      roughness: 0.62,
      side: THREE.DoubleSide,
    }),
    ...createDemoMaterials(),
  };
}

// ------------------------------------------------------------------ geometry

/**
 * Turns an (r, y) polyline into a solid lathed around the y axis. Author the
 * profile bottom-up on the outside and top-down on the inside, so the faces
 * point out of the solid everywhere.
 */
function lathe(profile: Array<[number, number]>, segments = 48): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

/**
 * Outline of the base plate: the round platform under the pot and the rounded
 * tip of the tongue, joined by their common tangents. Authored in XY for
 * `extrudeFlat`, which lays it flat with the tongue along +x.
 */
function keyholeShape(): THREE.Shape {
  const phi = Math.acos((PLATE_R - TONGUE_TIP_R) / TONGUE_TIP_CX);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, PLATE_R, phi, Math.PI * 2 - phi, false);
  shape.absarc(TONGUE_TIP_CX, 0, TONGUE_TIP_R, -phi, phi, false);
  shape.closePath();
  return shape;
}

// ---------------------------------------------------------------------- base

/** A suction foot: the cup, its neck and the screw boss up into the plate. */
function createSuctionFoot(materials: NeptunMaterials): THREE.Mesh {
  const foot = new THREE.Mesh(
    lathe(
      [
        [0, 0],
        [0.023, 0],
        [0.026, 0.003],
        [0.022, 0.008],
        [0.013, 0.013],
        [0.0095, 0.018],
        [0.0095, FOOT_H + 0.003],
        [0, FOOT_H + 0.003],
      ],
      32,
    ),
    materials.foot,
  );
  foot.name = 'NEP_Foot';
  return foot;
}

/** The base plate on its three feet, with the drain under the pot. */
function buildBase(device: THREE.Group, materials: NeptunMaterials): void {
  const plate = new THREE.Mesh(extrudeFlat(keyholeShape(), BASE_T), materials.trim);
  plate.name = 'NEP_BasePlate';
  plate.position.y = BASE_TOP;
  device.add(plate);

  // Drain boss under the pot — the Neptun stands in the sink and drains
  // straight through the plate. Sunk a hair into it so no faces share a plane.
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.011, 40), materials.trim);
  drain.name = 'NEP_Drain';
  drain.position.y = FOOT_H - 0.005;
  device.add(drain);

  for (const [x, z] of FEET) {
    const foot = createSuctionFoot(materials);
    foot.position.set(x, 0, z);
    device.add(foot);
  }
}

// ----------------------------------------------------------------------- pot

/** The SPÜLBOY® badge on the front of the pot: orange disc, dark wordmark. */
function createBadge(materials: NeptunMaterials): THREE.Group {
  const badge = new THREE.Group();
  badge.name = 'NEP_Badge';

  // A flat disc stands 2.5 mm proud at its centre and just clears the wall at
  // its edge — a raised badge, not a decal that sinks into the curve.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.021, 40), materials.badge);
  disc.position.set(0, BADGE_Y, POT_R + 0.0025);
  badge.add(disc);

  // The wordmark across the disc, and the mascot's cap above it.
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.0045, 0.0008), materials.wordmark);
  mark.position.set(0, BADGE_Y - 0.0015, POT_R + 0.0029);
  badge.add(mark);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.0035, 0.0008), materials.wordmark);
  cap.position.set(0, BADGE_Y + 0.0095, POT_R + 0.0029);
  badge.add(cap);

  return badge;
}

/** Height of the i-th hole in the spray pipe, bottom up. */
function pipeHoleY(i: number): number {
  return PIPE_HOLE_BOTTOM + (i / (PIPE_HOLES - 1)) * (PIPE_HOLE_TOP - PIPE_HOLE_BOTTOM);
}

/**
 * The perforated spray pipe: it stands on a boss on the base plate, in a
 * moulded channel on the pot wall, with a domed top just under the ring and a
 * row of holes facing the rinsing cone. Fixed to the pot — it is not one of
 * the parts that come off.
 */
function createSprayPipe(materials: NeptunMaterials): THREE.Group {
  const pipe = new THREE.Group();
  pipe.name = 'NEP_SprayPipe';

  // The channel: a slim charcoal strip on the wall, just wider than the pipe.
  const channelTop = PIPE_TOP - 0.008;
  const channel = new THREE.Mesh(
    new THREE.BoxGeometry(0.003, channelTop - BASE_TOP, PIPE_R * 2 + 0.005),
    materials.trim,
  );
  channel.position.set(POT_R + 0.0005, (BASE_TOP + channelTop) / 2, 0);
  pipe.add(channel);

  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.014, 20), materials.trim);
  boss.position.set(PIPE_X, BASE_TOP + 0.0065, 0);
  pipe.add(boss);

  const tubeBottom = BASE_TOP + 0.012;
  const tubeTop = PIPE_TOP - PIPE_R;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_R, PIPE_R, tubeTop - tubeBottom, 20), materials.tube);
  tube.position.set(PIPE_X, (tubeBottom + tubeTop) / 2, 0);
  pipe.add(tube);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(PIPE_R, 20, 14), materials.tube);
  dome.position.set(PIPE_X, tubeTop, 0);
  pipe.add(dome);

  // The row of holes, on the face that looks at the rinsing cone.
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0013, 12), materials.interior, PIPE_HOLES);
  holes.name = 'NEP_PipeHoles';
  const dummy = new THREE.Object3D();
  dummy.rotation.y = Math.PI / 2;
  for (let i = 0; i < PIPE_HOLES; i++) {
    dummy.position.set(PIPE_X + PIPE_R + 0.0002, pipeHoleY(i), 0);
    dummy.updateMatrix();
    holes.setMatrixAt(i, dummy.matrix);
  }
  holes.instanceMatrix.needsUpdate = true;
  pipe.add(holes);

  return pipe;
}

/** The inlet hole just under the ring: a grommet round a dark opening. */
function createInletGrommet(materials: NeptunMaterials): THREE.Group {
  const grommet = new THREE.Group();
  grommet.name = 'NEP_InletGrommet';
  const nx = Math.sin(INLET_AZIMUTH);
  const nz = Math.cos(INLET_AZIMUTH);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0018, 10, 28), materials.trim);
  ring.position.set(POT_R * nx, INLET_Y, POT_R * nz);
  ring.rotation.y = INLET_AZIMUTH;
  grommet.add(ring);

  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 24), materials.interior);
  hole.position.set((POT_R + 0.0005) * nx, INLET_Y, (POT_R + 0.0005) * nz);
  hole.rotation.y = INLET_AZIMUTH;
  grommet.add(hole);

  return grommet;
}

/**
 * The Ø 180 mm brush pot: charcoal bottom collar, white enamelled shell and the
 * dark interior the brushes stand in. Returns the group so the removable parts
 * can be dropped into it.
 */
function buildPot(device: THREE.Group, materials: NeptunMaterials): THREE.Group {
  const pot = new THREE.Group();
  pot.name = 'NEP_Pot';

  // A closed cylinder: its top cap hides inside the shell, below the floor.
  const collarBottom = BASE_TOP - 0.0005;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0915, 0.093, COLLAR_TOP - collarBottom, 64),
    materials.trim,
  );
  collar.name = 'NEP_Collar';
  collar.position.y = (collarBottom + COLLAR_TOP) / 2;
  pot.add(collar);

  const shellBottom = COLLAR_TOP - 0.004;
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(POT_R, POT_R, POT_TOP - shellBottom, 64, 1, true),
    materials.pot,
  );
  shell.name = 'NEP_Shell';
  shell.position.y = (shellBottom + POT_TOP) / 2;
  pot.add(shell);

  const wallHeight = POT_TOP - POT_FLOOR_Y;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(POT_INNER_R, POT_INNER_R - 0.002, wallHeight, 64, 1, true),
    materials.interior,
  );
  wall.position.y = POT_FLOOR_Y + wallHeight / 2;
  pot.add(wall);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(POT_INNER_R - 0.002, 64), materials.interior);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = POT_FLOOR_Y;
  pot.add(floor);

  pot.add(createBadge(materials), createSprayPipe(materials), createInletGrommet(materials));
  device.add(pot);
  return pot;
}

/** The glass protection ring rolled over the rim of the pot. */
function createGlassRing(materials: NeptunMaterials): THREE.Mesh {
  const ring = new THREE.Mesh(
    lathe(
      [
        [RING_INNER_R, RING_BOTTOM],
        [0.0905, RING_BOTTOM],
        [0.0965, RING_BOTTOM + 0.005],
        [0.097, RING_BOTTOM + 0.018],
        [0.094, RING_TOP - 0.002],
        [0.087, RING_TOP],
        [0.082, RING_TOP - 0.003],
        [RING_INNER_R, RING_TOP - 0.01],
        [RING_INNER_R, RING_BOTTOM],
      ],
      64,
    ),
    materials.trim,
  );
  ring.name = 'NEP_GlassRing';
  return ring;
}

// ------------------------------------------------------------------- brushes

/**
 * The brush strip: a coil of bristles lining the pot wall that scrubs the
 * outside of the glass. Its seam is left open where the down tube runs.
 */
function createBrushStrip(materials: NeptunMaterials): THREE.Group {
  const strip = new THREE.Group();
  strip.name = 'NEP_BrushStrip';

  const height = STRIP_TOP - STRIP_BOTTOM;
  const backing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0815, 0.0815, height, 56, 1, true),
    materials.interior,
  );
  backing.position.y = STRIP_BOTTOM + height / 2;
  strip.add(backing);

  const rows = 12;
  const perRow = 44;
  const bristles = new THREE.InstancedMesh(bristleGeometry(0.0017, 0.001), materials.brush, rows * perRow);
  bristles.name = 'NEP_StripBristles';

  // The tube stands at (sin, cos) of its azimuth; bristles are placed by (cos, sin).
  const seam = Math.atan2(Math.cos(INLET_AZIMUTH), Math.sin(INLET_AZIMUTH));
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let index = 0;

  for (let row = 0; row < rows; row++) {
    const y = STRIP_BOTTOM + 0.008 + (row / (rows - 1)) * (height - 0.016);
    for (let i = 0; i < perRow; i++) {
      // Half-step alternate rows so the coil does not comb into columns.
      const angle = ((i + (row % 2) * 0.5) / perRow) * Math.PI * 2;
      const gap = Math.atan2(Math.sin(angle - seam), Math.cos(angle - seam));
      if (Math.abs(gap) < 0.2) continue;

      direction.set(-Math.cos(angle), row % 2 ? 0.12 : -0.12, -Math.sin(angle)).normalize();
      dummy.quaternion.setFromUnitVectors(up, direction);
      dummy.position.set(Math.cos(angle) * 0.0805, y, Math.sin(angle) * 0.0805);
      dummy.scale.set(1, 0.042, 1);
      dummy.updateMatrix();
      bristles.setMatrixAt(index++, dummy.matrix);
    }
  }
  bristles.count = index;
  bristles.instanceMatrix.needsUpdate = true;
  strip.add(bristles);

  return strip;
}

/**
 * The bayonet middle brush: the tall bottle brush that cleans the inside of
 * the glass, locked into the pot floor by its bayonet foot.
 */
function createMiddleBrush(materials: NeptunMaterials): THREE.Group {
  const brush = new THREE.Group();
  brush.name = 'NEP_MiddleBrush';

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, BRUSH_TOP - BRUSH_BOTTOM, 16),
    materials.brush,
  );
  shaft.position.y = (BRUSH_BOTTOM + BRUSH_TOP) / 2;
  brush.add(shaft);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.012, 24), materials.brush);
  foot.position.y = BRUSH_BOTTOM + 0.006;
  brush.add(foot);

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.004, 0.004), materials.brush);
    lug.position.set(side * 0.0135, BRUSH_BOTTOM + 0.009, 0);
    brush.add(lug);
  }

  const rings = 18;
  const perRing = 16;
  const bristles = new THREE.InstancedMesh(bristleGeometry(0.0016, 0.001), materials.brush, rings * perRing);
  bristles.name = 'NEP_MiddleBristles';

  const bottom = BRUSH_BOTTOM + 0.03;
  const top = BRUSH_TOP - 0.012;
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let index = 0;

  for (let ring = 0; ring < rings; ring++) {
    const y = bottom + (ring / (rings - 1)) * (top - bottom);
    for (let i = 0; i < perRing; i++) {
      const angle = ((i + (ring % 2) * 0.5) / perRing) * Math.PI * 2;
      direction.set(Math.cos(angle), ring % 2 ? 0.16 : -0.16, Math.sin(angle)).normalize();
      dummy.quaternion.setFromUnitVectors(up, direction);
      dummy.position.set(direction.x * 0.0055, y + direction.y * 0.0055, direction.z * 0.0055);
      dummy.scale.set(1, 0.03, 1);
      dummy.updateMatrix();
      bristles.setMatrixAt(index++, dummy.matrix);
    }
  }
  bristles.instanceMatrix.needsUpdate = true;
  brush.add(bristles);

  return brush;
}

/** The radial brush head at the mouth of the pot, seated on the middle brush. */
function createBrushHead(materials: NeptunMaterials): THREE.Group {
  const head = new THREE.Group();
  head.name = 'NEP_BrushHead';

  const tiers = [
    { y: 0.306, tilt: 0.1, count: 56, length: 0.066 },
    { y: 0.312, tilt: 0.16, count: 56, length: 0.064 },
    { y: 0.318, tilt: 0.24, count: 48, length: 0.058 },
  ];
  const total = tiers.reduce((sum, tier) => sum + tier.count, 0);
  const spokes = new THREE.InstancedMesh(bristleGeometry(0.0019, 0.0011), materials.brush, total);
  spokes.name = 'NEP_HeadBristles';

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

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.03, 6), materials.brush);
  hub.position.y = 0.314;
  head.add(hub);

  return head;
}

/**
 * The down tube with its back-flow preventer: it stands beside the middle
 * brush and hooks out through the inlet hole — that is where the fresh water
 * enters the pot.
 */
function createDownTube(materials: NeptunMaterials): THREE.Group {
  const tube = new THREE.Group();
  tube.name = 'NEP_DownTube';

  const nx = Math.sin(INLET_AZIMUTH);
  const nz = Math.cos(INLET_AZIMUTH);
  const x = TUBE_RADIUS * nx;
  const z = TUBE_RADIUS * nz;
  const bottom = POT_FLOOR_Y + 0.004;
  const bendStart = INLET_Y - 0.014;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, bendStart - bottom, 16), materials.tube);
  stem.position.set(x, (bottom + bendStart) / 2, z);
  tube.add(stem);

  // The back-flow preventer is the thicker section at the foot of the tube.
  const preventer = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.022, 20), materials.tube);
  preventer.position.set(x, bottom + 0.016, z);
  tube.add(preventer);

  const elbow = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x, bendStart, z),
        new THREE.Vector3(x, INLET_Y, z),
        new THREE.Vector3((POT_R + 0.008) * nx, INLET_Y, (POT_R + 0.008) * nz),
      ),
      16,
      0.0042,
      12,
      false,
    ),
    materials.tube,
  );
  tube.add(elbow);

  // Hex union on the outside, where the supply meets the tube.
  const union = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.006, 6), materials.metal);
  union.position.set((POT_R + 0.006) * nx, INLET_Y, (POT_R + 0.006) * nz);
  union.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz));
  tube.add(union);

  return tube;
}

// -------------------------------------------------------------------- rinser

/** The two-step rinsing cone the glass is pressed down over. */
function createRinseCone(materials: NeptunMaterials): THREE.Mesh {
  const base = BASE_TOP - 0.0005;
  const cone = new THREE.Mesh(
    lathe([
      [0, base],
      [0.029, base],
      [0.028, BASE_TOP + 0.006],
      [0.0185, 0.158],
      [0.0185, 0.162],
      [0.0125, 0.165],
      [0.0072, RINSE_CONE_TOP - 0.004],
      [0.0062, RINSE_CONE_TOP],
      [0, RINSE_CONE_TOP],
    ]),
    materials.trim,
  );
  cone.name = 'NEP_RinseCone';
  cone.position.x = RINSE_X;
  return cone;
}

/** Radius of the tall spray pole at a height, following its taper. */
function poleRadiusAt(y: number): number {
  return THREE.MathUtils.lerp(POLE_BASE_R, POLE_TIP_R, (y - POLE_BASE_Y) / (POLE_TIP_Y - POLE_BASE_Y));
}

/** Height of the i-th hole in the tall spray pole, bottom up. */
function poleHoleY(i: number): number {
  return POLE_HOLE_BOTTOM + (i / (POLE_HOLES - 1)) * (POLE_HOLE_TOP - POLE_HOLE_BOTTOM);
}

/**
 * The tall spray pole at the end of the tongue: a slender cone whose row of
 * holes looks back at the rinsing cone, so the glass standing over it is
 * sprayed from the far side as well as from the pipe on the pot.
 */
function createSprayPole(materials: NeptunMaterials): THREE.Group {
  const pole = new THREE.Group();
  pole.name = 'NEP_SprayPole';
  pole.position.x = POLE_X;

  const base = BASE_TOP - 0.0005;
  const cone = new THREE.Mesh(
    lathe([
      [0, base],
      [0.021, base],
      [POLE_BASE_R, POLE_BASE_Y],
      [POLE_TIP_R, POLE_TIP_Y],
      [0.0028, 0.322],
      [0, 0.326],
    ]),
    materials.trim,
  );
  pole.add(cone);

  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0013, 12), materials.interior, POLE_HOLES);
  holes.name = 'NEP_PoleHoles';
  const dummy = new THREE.Object3D();
  dummy.rotation.y = -Math.PI / 2;
  for (let i = 0; i < POLE_HOLES; i++) {
    const y = poleHoleY(i);
    dummy.position.set(-(poleRadiusAt(y) + 0.0002), y, 0);
    dummy.updateMatrix();
    holes.setMatrixAt(i, dummy.matrix);
  }
  holes.instanceMatrix.needsUpdate = true;
  pole.add(holes);

  return pole;
}

/**
 * The 2-step head valve on the tip of the rinsing cone and the valve tube that
 * runs down inside it — hidden while assembled, revealed by the exploded view.
 */
function createHeadValve(materials: NeptunMaterials): THREE.Group {
  const valve = new THREE.Group();
  valve.name = 'NEP_HeadValve';
  valve.position.x = RINSE_X;

  const rodBottom = 0.06;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0025, RINSE_CONE_TOP - rodBottom, 12),
    materials.tube,
  );
  rod.position.y = (rodBottom + RINSE_CONE_TOP) / 2;
  valve.add(rod);

  // Seated a hair into the cone tip, so the two end caps never share a plane.
  const bodyBottom = RINSE_CONE_TOP - 0.001;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0068, 0.006, VALVE_CAP_Y - bodyBottom, 24),
    materials.tube,
  );
  body.position.y = (bodyBottom + VALVE_CAP_Y) / 2;
  valve.add(body);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 24, 16), materials.valve);
  cap.scale.set(1, 0.7, 1);
  cap.position.y = VALVE_CAP_Y;
  valve.add(cap);

  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.002, 16), materials.metal);
  stud.position.y = VALVE_TOP;
  valve.add(stud);

  return valve;
}

// -------------------------------------------------------------------- supply

/** From the angle connection under the plate, round the front of the pot to the tap. */
const HOSE_PATH: Array<[number, number, number]> = [
  [CONNECTION.x, 0.012, 0.078],
  [CONNECTION.x + 0.004, 0.012, 0.112],
  [-0.02, 0.012, 0.15],
  [-0.11, 0.012, 0.165],
  [-0.19, 0.012, 0.13],
  [-0.215, 0.012, 0.06],
  [-0.2, 0.012, -0.01],
];

/** The angle connection easy clix® under the plate, and the hose it takes. */
function buildSupply(device: THREE.Group, materials: NeptunMaterials): void {
  const connection = new THREE.Group();
  connection.name = 'NEP_AngleConnection';

  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 20), materials.trim);
  stub.position.set(CONNECTION.x, FOOT_H - 0.005, CONNECTION.z);
  connection.add(stub);

  const knee = new THREE.Mesh(new THREE.SphereGeometry(0.008, 20, 14), materials.trim);
  knee.position.set(CONNECTION.x, 0.012, CONNECTION.z);
  connection.add(knee);

  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 20), materials.trim);
  outlet.rotation.x = Math.PI / 2;
  outlet.position.set(CONNECTION.x, 0.012, CONNECTION.z + 0.01);
  connection.add(outlet);
  device.add(connection);

  const hose = new THREE.Group();
  hose.name = 'NEP_Hose';
  const curve = new THREE.CatmullRomCurve3(HOSE_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  hose.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0105, 14, false), materials.hose));

  // A metal fitting at either end; the tap end carries the orange easy clix® collar.
  const up = new THREE.Vector3(0, 1, 0);
  for (const t of [0, 1]) {
    const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 20), materials.metal);
    fitting.position.copy(curve.getPointAt(t));
    fitting.quaternion.setFromUnitVectors(up, curve.getTangentAt(t).normalize());
    hose.add(fitting);
  }
  const tapTangent = curve.getTangentAt(1).normalize();
  const clix = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.008, 20), materials.badge);
  clix.position.copy(curve.getPointAt(1)).addScaledVector(tapTangent, -0.02);
  clix.quaternion.setFromUnitVectors(up, tapTangent);
  hose.add(clix);

  device.add(hose);
}

// --------------------------------------------------------------------- model

/**
 * How far each removable part travels in the exploded view, in metres — in the
 * order of the parts diagram: the strip and the ring lift off the pot, the
 * middle brush and the down tube rise together above them and the brush head
 * tops the stack; the head valve lifts off its cone to show the valve tube,
 * and the hose unplugs to the side. The base, pot, cones and feet hold still.
 */
const EXPLODE_OFFSETS: ExplodeOffsets = [
  ['NEP_BrushStrip', [0, 0.16, 0]],
  ['NEP_GlassRing', [0, 0.12, 0]],
  ['NEP_MiddleBrush', [0, 0.36, 0]],
  ['NEP_DownTube', [0, 0.36, 0]],
  ['NEP_BrushHead', [0, 0.375, 0]],
  ['NEP_HeadValve', [0, 0.2, 0]],
  ['NEP_Hose', [-0.06, 0, 0.05]],
];


/** One hole of a spray pole: where it is, and which way it sprays (±x). */
interface SprayHole {
  x: number;
  y: number;
  dir: 1 | -1;
}

/** The holes of the pipe on the pot, spraying towards the rinsing cone. */
function pipeHoles(): SprayHole[] {
  return Array.from({ length: PIPE_HOLES }, (_, i): SprayHole => ({ x: PIPE_X + PIPE_R, y: pipeHoleY(i), dir: 1 }));
}

/** The holes of the tall pole, spraying back towards the rinsing cone. */
function poleHoles(): SprayHole[] {
  return Array.from({ length: POLE_HOLES }, (_, i): SprayHole => {
    const y = poleHoleY(i);
    return { x: POLE_X - poleRadiusAt(y), y, dir: -1 };
  });
}

/** Spread of the streams across the glass, per hole. */
function holeYaw(index: number): number {
  return ((index % 5) - 2) * 0.16;
}


/**
 * The Neptun's water: one stream per hole of both poles, flying the short gap
 * onto the outside of the glass and running down it, plus streams down the
 * inside from the base, fed by the head valve.
 */
function createWaterStreams(holes: SprayHole[]): WaterStream[] {
  const streams = holes.map((hole, h): WaterStream => {
    const yaw = holeYaw(h);
    // Where this stream lands, round the glass from the hole's side.
    const theta = (hole.dir > 0 ? Math.PI : 0) - hole.dir * yaw * 1.4;
    return {
      from: new THREE.Vector3(hole.x, hole.y, 0),
      to: new THREE.Vector3(
        RINSE_X + GLASS_OUTER_R * Math.cos(theta),
        hole.y - 0.003,
        GLASS_OUTER_R * Math.sin(theta),
      ),
      wallRadius: GLASS_OUTER_R,
      drift: 0.35,
      beads: BEADS_PER_HOLE,
      landsOnBase: false,
    };
  });

  for (let k = 0; k < INSIDE_STREAMS; k++) {
    const theta = k * 2.399963;
    const to = new THREE.Vector3(RINSE_X + GLASS_INNER_R * Math.cos(theta), 0, GLASS_INNER_R * Math.sin(theta));
    streams.push({ from: to.clone(), to, wallRadius: GLASS_INNER_R, drift: -0.2, beads: 10, landsOnBase: true });
  }
  return streams;
}

// ---------------------------------------------------------------------- sink

/** Basin rings, floor first, with a rolled fillet where the walls meet the floor. */
function basinRings(): ShellRing[] {
  const fillet = 0.03;
  const rings: ShellRing[] = [];
  for (let i = 0; i <= 8; i++) {
    const angle = (i / 8) * (Math.PI / 2);
    const shrink = fillet * (1 - Math.sin(angle));
    rings.push({
      y: 0.0005 + fillet * (1 - Math.cos(angle)),
      halfW: SINK_HALF_W - shrink,
      halfD: SINK_HALF_D - shrink,
      radius: SINK_R - shrink,
    });
  }
  rings.push({ y: 0.1, halfW: SINK_HALF_W, halfD: SINK_HALF_D, radius: SINK_R });
  rings.push({ y: SINK_DEPTH + SINK_COUNTER_T, halfW: SINK_HALF_W, halfD: SINK_HALF_D, radius: SINK_R });
  return rings;
}


/**
 * The sink the demo plays in: a stainless basin with a rolled floor, let into
 * a white counter with a stainless rim and a drain in the far corner. Its
 * floor sits a hair above the studio floor, so the device stands in it and its
 * shadow falls on the steel.
 */
function createSink(materials: NeptunMaterials): THREE.Group {
  const sink = new THREE.Group();
  sink.name = 'NEP_Sink';
  sink.position.x = SINK_X;

  const basin = new THREE.Mesh(createSweptShell(basinRings(), { bottom: true }), materials.steel);
  basin.name = 'NEP_Basin';
  sink.add(basin);

  const counterTop = SINK_DEPTH + SINK_COUNTER_T;
  // The cut-out clears the basin by a few millimetres: coplanar with the wall
  // it flickered against it while turning. The rim covers the gap from above.
  const slab = roundedRectShape(0.62, 0.42, 0.04);
  slab.holes.push(roundedRectHole(SINK_HALF_W + 0.004, SINK_HALF_D + 0.004, SINK_R + 0.004));
  const counter = new THREE.Mesh(extrudeFlat(slab, SINK_COUNTER_T), materials.counter);
  counter.name = 'NEP_Counter';
  counter.position.y = counterTop;
  sink.add(counter);

  const rim = roundedRectShape(SINK_HALF_W + 0.018, SINK_HALF_D + 0.018, SINK_R + 0.018);
  rim.holes.push(roundedRectHole(SINK_HALF_W - 0.001, SINK_HALF_D - 0.001, SINK_R - 0.001));
  const rimMesh = new THREE.Mesh(extrudeFlat(rim, 0.004), materials.steel);
  rimMesh.name = 'NEP_SinkRim';
  rimMesh.position.y = counterTop + 0.004;
  sink.add(rimMesh);

  const drain = new THREE.Mesh(new THREE.CircleGeometry(0.02, 32), materials.interior);
  drain.rotation.x = -Math.PI / 2;
  drain.position.set(0.19, 0.0012, 0.12);
  sink.add(drain);
  const drainRing = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0025, 8, 40), materials.steel);
  drainRing.rotation.x = -Math.PI / 2;
  drainRing.position.set(0.19, 0.0015, 0.12);
  sink.add(drainRing);

  return sink;
}

/**
 * Builds the Neptun T2000. `root` is anchored on y = 0 so the viewer can drop
 * it straight onto the studio floor.
 */
export function createNeptunModel(): NuModel {
  const root = new THREE.Group();
  root.name = 'NEP_neptun';

  const materials = createMaterials();
  const device = new THREE.Group();
  device.name = 'NEP_Device';
  device.position.x = DEVICE_OFFSET_X;

  buildBase(device, materials);
  const pot = buildPot(device, materials);
  pot.add(
    createBrushStrip(materials),
    createMiddleBrush(materials),
    createBrushHead(materials),
    createDownTube(materials),
    createGlassRing(materials),
  );
  device.add(createRinseCone(materials), createSprayPole(materials), createHeadValve(materials));
  buildSupply(device, materials);

  // The demo sink belongs to the stage, not the device, and must never stand
  // between the camera and a hotspot — it only rises into view for the demo.
  const sink = createSink(materials);
  sink.visible = false;
  sink.traverse((object) => {
    object.raycast = () => undefined;
  });
  root.add(sink);

  root.add(device);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  // The demo props are added after the shadow pass: they are transient
  // stand-ins, not product, so they cast nothing and — via the no-op
  // `raycast` — never take part in hotspot occlusion either.
  const demo = new THREE.Group();
  demo.name = 'NEP_CleaningDemo';
  demo.visible = false;
  const glass = createDemoGlass(materials);
  const streams = createWaterStreams([...pipeHoles(), ...poleHoles()]);
  const water = createWaterBeads(materials.water, streams, 'NEP_WaterBeads');
  demo.add(glass, water);
  demo.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
    object.raycast = () => undefined;
  });
  device.add(demo);

  const exploded = collectExplodeParts(root, EXPLODE_OFFSETS);
  const brushHead = root.getObjectByName('NEP_BrushHead');
  const scratch = createWaterScratch();
  /** The viewer's clock, as of the last tick — the water runs on it. */
  let time = 0;

  return {
    root,

    tick(elapsed: number): void {
      time = elapsed;
      // The head valve breathes: press the glass onto it and the water rises.
      materials.valve.emissiveIntensity = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(elapsed * 2.1));
    },

    explode(amount: number): void {
      for (const part of exploded) {
        part.object.position.copy(part.assembled).addScaledVector(part.offset, amount);
      }
    },

    clean(progress: number | null): void {
      if (progress === null) {
        demo.visible = false;
        sink.visible = false;
        brushHead?.scale.set(1, 1, 1);
        return;
      }

      demo.visible = true;
      const pose = cleaningPose(THREE.MathUtils.clamp(progress, 0, 1), NEPTUN_STATIONS);

      // The sink rises into place as the glass appears and sinks away with it.
      sink.visible = true;
      sink.position.y = -SINK_DROP * (1 - pose.fade);

      glass.position.set(pose.x, pose.rimY, pose.z);
      materials.glass.opacity = 0.3 * pose.fade;
      materials.handle.opacity = 0.62 * pose.fade;
      materials.stain.opacity = pose.stain * pose.fade;
      materials.water.opacity = 0.92 * pose.spray * pose.fade;

      const rinsing = pose.spray > 0.001;
      water.visible = rinsing;
      if (rinsing) placeWaterBeads(water, streams, NEPTUN_WATER, pose.rimY, time, pose.spray, scratch);

      // The head gives way under the glass instead of spearing through it.
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
