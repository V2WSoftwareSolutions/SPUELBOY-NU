import { NuAddon, NuOffice, NuProduct, NuSpecGroup } from '../models/product.model';

/**
 * Content source of truth for the landing page.
 *
 * Copy, highlights, certifications and the cleaning promises are taken from the
 * official "SPÜLBOY NU® image brochure (EN)".
 *
 * Outer dimensions, the counter cut-out and the brush pot diameter come from the
 * manufacturer dimension drawing and are mirrored by the 3D model in
 * `core/three/nu-model.factory.ts` — change them in both places together.
 *
 * The Neptun T2000 follows the CLASSIC & ECO Line page of the SPÜLBOY® product
 * catalogue and the manufacturer's parts diagram; its pot diameter, internal
 * glass height and outer dimensions are mirrored by
 * `core/three/neptun-model.factory.ts` in the same way.
 *
 * DATA TODO — the brochure does not publish figures for the following, so they
 * are marked "On request" / null until Schäfer Produkte GmbH confirms them:
 *   - list prices (`pricing.amount`)
 *   - weight, water volumes, article numbers
 * Replace the placeholders below; no component code has to change when you do.
 */

const ON_REQUEST = 'On request';

/** Specification groups shared by both devices (all brochure-verified). */
const sharedSpecs = (): NuSpecGroup[] => [
  {
    title: 'Cleaning principle',
    items: [
      { label: 'Method', value: 'Manual brush cleaning with cold fresh water — no electricity required' },
      {
        label: 'Rinsing mechanism',
        value: 'Double rinsing power with flexible telescope rinser',
        note: 'Cleans the bowl, the stem and the base — ideal for glasses with a handle and for jugs.',
      },
      {
        label: 'Head valve',
        value: 'Fresh-water circulation through the inside of the glass',
        note: 'The glass stays wet and cools down before it goes under the next tap.',
      },
      { label: 'Automatic refill', value: 'Every rinse triggers a fresh-water refill of the pre-rinse pot' },
      { label: 'Fresh-water button', value: 'Push the button — rapid first filling and top-up during service' },
      { label: 'Fine sieve', value: 'Optimal filtering of the incoming fresh water' },
      { label: 'Back-flow preventer', value: 'Hybrid back-flow preventer for guaranteed water separation' },
      { label: 'Glass types', value: 'Cleans all types of glasses' },
    ],
  },
  {
    title: 'Design & build',
    items: [
      { label: 'Construction', value: 'Sealed hygienic design with no corners, edges or indentations' },
      { label: 'Origin', value: '100% made in Germany' },
      {
        label: 'Maintenance',
        value: 'Dispenses with many individual and spare parts',
        note: 'In need, just change the brushes.',
      },
      { label: 'Connection', value: 'Quick connection — EASY CLIX® compatible' },
      {
        label: 'Outer dimensions (W × D × H)',
        value: '397 × 270 × 337 mm',
        note: 'Body 369 × 240 mm at the top, 222 mm across the base; 44 mm top cover.',
      },
      { label: 'Brush pot', value: 'Ø 167 mm, alongside the pre-rinse basin' },
      { label: 'Weight', value: ON_REQUEST, note: 'DATA TODO' },
      { label: 'Article number', value: ON_REQUEST, note: 'DATA TODO' },
    ],
  },
  {
    title: 'Certification & hygiene',
    items: [
      { label: 'Company certification', value: 'DIN EN ISO 9001:2015' },
      { label: 'Device certification', value: 'DIN 6653-3' },
      { label: 'Hygiene', value: '100% hygiene — tested by independent institutes' },
      {
        label: 'Antimicrobial protection',
        value: 'NU® pro Iceblue finish: highly effective against viruses, fungi and bacteria',
      },
      { label: 'Consumables', value: 'Original SPÜLBOY® tabs — highly effective and biodegradable' },
    ],
  },
  {
    title: 'Sustainability & economy',
    items: [
      { label: 'Cost saving', value: 'Up to 80% saving compared with an electric glasswasher' },
      { label: 'Energy', value: 'Cleaning without electricity' },
      { label: 'Water', value: '100% cleanliness with a minimum use of fresh water' },
      { label: 'Care', value: 'Gentle on glasses and decor, low detergent consumption' },
    ],
  },
];

export const NU_PRODUCTS: NuProduct[] = [
  {
    id: 'nu-portable',
    slug: 'nu-portable',
    name: 'SPÜLBOY NU® PORTABLE',
    eyebrow: 'The NU® generation',
    tagline: 'All over ready for use — without a sink.',
    summary:
      'Place the drain hose at the water outlet and wash independently, anywhere. The robust, easy-care all-rounder: no event without NU®.',
    highlights: [
      'Works without a sink — connect, drain, wash',
      'Robust construction, quick connection, perfect performance',
      'Transportable and space-saving — short distances at any location',
      'Push the button for extra fresh water at any moment',
      'Simplest maintenance: in need, just change the brushes',
    ],
    includedInBox: [
      'NU® PORTABLE device with Sanitized® brush set',
      'Drain hose and quick connection',
      'Fine sieve and hybrid back-flow preventer',
      'Original SPÜLBOY® glass washing tabs (starter bundle)',
    ],
    specGroups: [
      ...sharedSpecs(),
      {
        title: 'Installation',
        items: [
          { label: 'Setup', value: 'Free-standing — no sink and no cut-out required' },
          { label: 'Drainage', value: 'Drain hose placed at the water outlet' },
          {
            label: 'Mobility',
            value: 'Transportable; pairs with the NU on Tour® glass washing table with foldable legs',
          },
          { label: 'Fresh-water supply', value: ON_REQUEST, note: 'DATA TODO — hose length and connector thread.' },
        ],
      },
    ],
    pricing: {
      currency: 'EUR',
      // DATA TODO — set the net list price to switch off the "price on request" treatment.
      amount: null,
      unit: 'per device, net',
      note: 'Includes the brush set, the supply hose and the quick connection.',
      quoteOnly: true,
    },
    viewer: {
      variant: 'portable',
      // Drop a CAD export at `public/models/nu-portable.glb` and point this at it.
      modelUrl: null,
      posterUrl: null,
      // Positions are in metres on the model, whose deck sits at y = 0.35.
      cameraTargetY: 0.19,
      hotspots: [
        {
          id: 'brushes',
          label: 'Sanitized® brush set',
          description: 'Move the glass over the brushes 3–5 times with rapid up-and-down movements. Don’t turn.',
          position: [0.094, 0.362, 0],
        },
        {
          id: 'rinser',
          label: 'Telescope rinser',
          description: 'Double rinsing power — cleans bowl, stem and base, then cools the glass.',
          position: [-0.093, 0.345, 0],
        },
        {
          id: 'button',
          label: 'Fresh-water button',
          description: 'Push the button for the first filling in the morning and for a rapid top-up during service.',
          position: [0.004, 0.362, -0.064],
        },
        {
          id: 'hose',
          label: 'Supply hose & tap',
          description: 'No sink needed: connect the hose, place the drain at any water outlet and wash independently.',
          position: [-0.19, 0.055, 0.09],
        },
      ],
    },
  },
  {
    id: 'nu-built-in',
    slug: 'nu-built-in',
    name: 'SPÜLBOY NU® BUILT-IN',
    eyebrow: 'The NU® generation',
    tagline: 'Less space? One sink only? NU® builds straight in.',
    summary:
      'Create a cut-out with the help of our template and hang in the NU®. The same hygienic cleaning performance, flush with your counter.',
    highlights: [
      'Drops into an existing counter or sink run',
      'Cut-out template supplied — no custom fabrication needed',
      'Flush, sealed rim with no corners, edges or indentations',
      'Frees the second sink for service while glasses are washed',
      'Available in the antimicrobial NU® pro Iceblue finish',
    ],
    includedInBox: [
      'NU® BUILT-IN device with Sanitized® brush set',
      'Cut-out template for the counter',
      'Fine sieve and hybrid back-flow preventer',
      'Original SPÜLBOY® glass washing tabs (starter bundle)',
    ],
    specGroups: [
      ...sharedSpecs(),
      {
        title: 'Installation',
        items: [
          { label: 'Mounting', value: 'Hangs into a counter cut-out made with the supplied template' },
          {
            label: 'Counter cut-out (W × D)',
            value: 'approx. 379 × 250 mm',
            note: 'Body 369 × 240 mm plus fitting clearance — always cut with the supplied template.',
          },
          {
            label: 'Rim on the worktop (W × D)',
            value: '397 × 270 mm',
            note: 'The sealed top cover overlaps the cut-out on every side.',
          },
          { label: 'Required depth below counter', value: 'at least 293 mm' },
          { label: 'Drainage', value: 'Connects to the existing sink drainage' },
          { label: 'Custom fabrication', value: 'Custom-made built-in versions available on request' },
        ],
      },
    ],
    pricing: {
      currency: 'EUR',
      // DATA TODO — set the net list price to switch off the "price on request" treatment.
      amount: null,
      unit: 'per device, net',
      note: 'Built-in versions are custom made; the quote includes the cut-out template and the fitting notes.',
      quoteOnly: true,
    },
    viewer: {
      variant: 'built-in',
      // Drop a CAD export at `public/models/nu-built-in.glb` and point this at it.
      modelUrl: null,
      posterUrl: null,
      // The worktop sits at y = 0.34; the device deck rises to y = 0.38.
      cameraTargetY: 0.26,
      hotspots: [
        {
          id: 'rim',
          label: 'Flush counter rim',
          description: 'The sealed rim sits on the worktop — no corners, edges or indentations to trap soil.',
          position: [0.2, 0.355, 0.11],
        },
        {
          id: 'cutout',
          label: 'Template cut-out',
          description: 'Create the opening with our template, then simply hang in the NU®.',
          position: [-0.27, 0.348, 0.17],
        },
        {
          id: 'brushes',
          label: 'Sanitized® brush set',
          description: 'The same brush generation as the portable device — change periodically for best hygiene.',
          position: [0.094, 0.393, 0],
        },
        {
          id: 'rinser',
          label: 'Telescope rinser',
          description: 'Clear-rinsing from the in- and outside for 2–3 seconds, then draining over the pot.',
          position: [-0.093, 0.376, 0],
        },
      ],
    },
  },
  {
    id: 'neptun-t2000',
    slug: 'neptun-t2000',
    name: 'Neptun T2000',
    eyebrow: 'CLASSIC & ECO Line',
    tagline: 'Legendary! The open rinsing system for the sink.',
    summary:
      'With an open rinsing system, this in-sink model is ideal for anyone who wants to wash glasses economically and easily: three suction feet hold it on the sink floor, the brush pot pre-washes and the 2-step head valve clear-rinses.',
    highlights: [
      'Open rinsing system — the rinse water drains straight into the sink',
      'In-sink model: three suction feet hold it firmly on the sink floor',
      'Ø 18 cm brush pot with brush strip, bayonet middle brush and brush head',
      '2-step head valve and two perforated spray poles — the glass is rinsed inside and all round',
      'Cleans without electricity — original SPÜLBOY® tabs for 100% bacteria- and 99.9% virus-free glasses',
    ],
    includedInBox: [
      'Neptun T2000 device with glass protection ring and both perforated spray poles',
      'CLASSIC & ECO brush strip, bayonet middle brush and brush head',
      '2-step head valve with valve tube',
      'Down tube with back-flow preventer',
      'Connection hose easy clix® with angle connection',
      'Three suction feet with screws',
    ],
    specGroups: [
      {
        title: 'Cleaning principle',
        items: [
          { label: 'Method', value: 'Manual brush cleaning with cold fresh water — no electricity required' },
          {
            label: 'Rinsing system',
            value: 'Open rinsing system',
            note: 'In-sink model: the rinse water drains freely into the sink — there is no pre-rinse basin to empty.',
          },
          {
            label: 'Head valve',
            value: '2-step head valve with valve tube',
            note: 'Guarantees perfect fresh-water rinsing — press the glass onto the valve and the water rises.',
          },
          {
            label: 'Spray poles',
            value: 'Two perforated spray poles — on the flank of the pot and on the far side of the rinsing cone',
            note: 'Spray the outside of the glass from both sides while the head valve rinses the inside.',
          },
          { label: 'Water inlet', value: 'Down tube with back-flow preventer' },
          { label: 'Brushes', value: 'CLASSIC & ECO brush strip, bayonet middle brush and standard brush head' },
          { label: 'Glass protection', value: 'Glass protection ring rolled over the pot rim' },
          { label: 'Internal glass height', value: '23.5 cm' },
        ],
      },
      {
        title: 'Design & build',
        items: [
          { label: 'Line', value: 'CLASSIC & ECO Line' },
          { label: 'Brush pot', value: 'Ø 18 cm' },
          { label: 'Dimensions (L × W × H)', value: '33 × 19 × 33 cm' },
          {
            label: 'Mounting',
            value: 'Three suction feet with screw',
            note: 'Stands in the sink — the suction feet hold it on the sink floor.',
          },
          { label: 'Connection', value: 'CLASSIC standard hose with easy clix® and angle connection easy clix®' },
          { label: 'Origin', value: '100% made in Germany' },
          { label: 'Weight', value: ON_REQUEST, note: 'DATA TODO' },
          { label: 'Article number', value: ON_REQUEST, note: 'DATA TODO' },
        ],
      },
      {
        title: 'Certification & hygiene',
        items: [
          { label: 'Company certification', value: 'DIN EN ISO 9001:2015' },
          { label: 'Device certification', value: 'DIN 6653-3' },
          {
            label: 'Cleaning result',
            value: 'Original SPÜLBOY® glass washing tabs — 100% bacteria- and 99.9% virus-free glasses',
          },
          { label: 'Brush care', value: 'CLASSIC brush sanitizer powder — beer slime remover for the brushes' },
        ],
      },
      {
        title: 'Spare parts & accessories',
        items: [
          {
            label: 'Brush set',
            value: 'CLASSIC brush set — brush strip & middle brush',
            note: 'Fits the Neptun T2000 and the Twin-Go T.',
          },
          { label: 'Brush head', value: 'Brush head standard — pack of 10' },
          { label: 'Consumables', value: 'CLASSIC glass washing tablets & brush sanitizer powder' },
          { label: 'Hoses', value: 'CLASSIC standard hose with easy clix® and CLASSIC drain hose' },
          { label: 'Head valve', value: '2-step head valve — guarantees perfect fresh-water rinsing' },
        ],
      },
      {
        title: 'Sustainability & economy',
        items: [
          { label: 'Energy', value: 'Cleaning without electricity' },
          { label: 'Water', value: 'Cold fresh-water rinse only — no hot water, no dishwasher cycle' },
          { label: 'Economy', value: 'Wash economically and easily — the legendary open system of the CLASSIC & ECO Line' },
        ],
      },
    ],
    pricing: {
      currency: 'EUR',
      // DATA TODO — set the net list price to switch off the "price on request" treatment.
      amount: null,
      unit: 'per device, net',
      note: 'Includes the brush set, the head valve, the down tube and the connection hose with easy clix®.',
      quoteOnly: true,
    },
    viewer: {
      variant: 'neptun',
      // Drop a CAD export at `public/models/neptun-t2000.glb` and point this at it.
      modelUrl: null,
      posterUrl: null,
      // The pot rim sits at y = 0.33; the pot stands 70 mm left of the origin so
      // the tongue with the two cones balances it.
      cameraTargetY: 0.17,
      hotspots: [
        {
          id: 'brushes',
          label: 'Brush head & bayonet middle brush',
          description:
            'The radial head cleans the rim, the bayonet middle brush the inside and the brush strip round the wall the outside — 3–5 rapid strokes, don’t turn.',
          position: [-0.07, 0.325, 0.02],
        },
        {
          id: 'ring',
          label: 'Glass protection ring',
          description: 'The charcoal ring rolled over the Ø 18 cm pot rim cushions the glass on its way in and out.',
          position: [-0.07, 0.328, 0.095],
        },
        {
          id: 'valve',
          label: '2-step head valve',
          description:
            'Press the glass onto the valve at the tip of the rinsing cone: fresh water rises through the inside of the glass and drains straight into the sink.',
          position: [0.072, 0.246, 0],
        },
        {
          id: 'spray-pipe',
          label: 'Perforated spray pipe',
          description:
            'Fresh water rises through the perforated pipe on the flank of the pot and sprays the outside of the glass — the tall pole opposite does the same from the other side.',
          position: [0.031, 0.2, 0.006],
        },
        {
          id: 'pole',
          label: 'Tall spray pole',
          description:
            'The tall perforated pole on the far side of the rinsing cone sprays the outside of the glass from the opposite direction, so it is rinsed all round.',
          position: [0.13, 0.2, 0.016],
        },
        {
          id: 'inlet',
          label: 'Down tube with back-flow preventer',
          description:
            'Fresh water enters through the hole below the rim and runs down the tube into the pot; the back-flow preventer keeps the supply line separated.',
          position: [-0.139, 0.275, -0.069],
        },
        {
          id: 'feet',
          label: 'Suction feet with screw',
          description: 'Three suction feet hold the Neptun firmly on the sink floor — no cut-out, no plumbing.',
          position: [-0.122, 0.012, 0.085],
        },
        {
          id: 'hose',
          label: 'Connection hose easy clix®',
          description:
            'Connect the hose to the tap with the easy clix® quick coupling; the angle connection under the base takes the other end.',
          position: [-0.26, 0.02, 0.13],
        },
      ],
    },
  },
];

/**
 * The two consumables shown as small cards under the devices, from the
 * catalogue's add-ons page. The pictures are the product photos in
 * `public/addons/` with the studio background cut out, so the can sits on
 * the card's spotlight; a replacement photo needs a transparent background.
 */
export const NU_ADDONS: NuAddon[] = [
  {
    id: 'glass-washing-tabs',
    name: 'NU® glass washing tabs',
    description: '500 g can (100 pieces) for 100 fillings',
    image: '/addons/nu-glass-washing-tabs.webp',
    alt: 'White 500 g can of NU® glass washing tabs with a green label and three tablets in front of it',
  },
  {
    id: 'brush-sanitizer',
    name: 'NU® brush sanitizer',
    description: '750 g beer slime remover for approx. 30 applications',
    image: '/addons/nu-brush-sanitizer.webp',
    alt: 'White 750 g can of NU® brush sanitizer with a green label, its black cap and a heap of powder beside it',
  },
];

/** The four-step cleaning routine, straight from the brochure. */
export const NU_CLEANING_STEPS = [
  { step: 1, phase: 'Pre-washing', text: 'Place one original SPÜLBOY® washing tablet in the brush pot.' },
  {
    step: 2,
    phase: 'Pre-washing',
    text: 'Move the glass completely over the brush at least 3–5 times with rapid up-and-down movements. Don’t turn!',
  },
  {
    step: 3,
    phase: 'Clear-rinsing',
    text: 'Rinse thoroughly from the in- and outside for 2–3 seconds, then allow draining over the pre-wash pot.',
  },
  {
    step: 4,
    phase: 'Daily care',
    text: 'Cleanse the brushes and the device itself daily — that guarantees hygienic cleaning of your glasses.',
  },
];

/** Manufacturer contact details from the brochure back page. */
export const NU_COMPANY = {
  name: 'Schäfer Produkte GmbH',
  street: 'Simonshöfchen 53',
  city: '42327 Wuppertal / Germany',
  phone: '+49 (0) 202 695 32-0',
  phoneHref: '+4920269532',
  email: 'info@spuelboy.de',
  website: 'www.spuelboy.de',
  websiteHref: 'https://www.spuelboy.de',
  claim: 'Save the Taste!',
};

/**
 * The two addresses in the footer. The Indian office comes first and is the
 * one shown by default; the German manufacturer is a tab away.
 */
export const NU_OFFICES: NuOffice[] = [
  {
    id: 'india',
    tab: 'India',
    badge: 'India office',
    country: 'IN',
    countryName: 'India',
    name: 'Chef Tree Enterprises P. Ltd',
    lines: ['#7, 1st Cross, 2nd Main,', 'Ganga Nagar,', 'Bengaluru 560 032,', 'Karnataka, India.'],
    phone: '+91 99668 79792',
    phoneHref: '+919966879792',
    // DATA TODO — e-mail for the Indian office.
    website: 'www.spulboy.in',
    websiteHref: 'https://www.spulboy.in',
  },
  {
    id: 'germany',
    tab: 'Germany',
    badge: 'Manufacturer',
    country: 'DE',
    countryName: 'Germany',
    name: NU_COMPANY.name,
    lines: [NU_COMPANY.street, NU_COMPANY.city],
    phone: NU_COMPANY.phone,
    phoneHref: NU_COMPANY.phoneHref,
    email: NU_COMPANY.email,
    website: NU_COMPANY.website,
    websiteHref: NU_COMPANY.websiteHref,
  },
];

/**
 * The printed product catalogue, offered for download beside every price.
 * The file lives in `public/`, so it is served from the site root.
 */
export const NU_CATALOGUE = {
  label: 'Product catalogue',
  /** On the button itself, so the three actions share one row. */
  shortLabel: 'Catalogue',
  href: '/spuelboy-product-catalogue.pdf',
  fileName: 'SPUELBOY-Product-Catalogue.pdf',
};
