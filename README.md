# SPÜLBOY NU® — 3D landing page

A single-page storefront for three SPÜLBOY® glass washers — NU® PORTABLE, NU® BUILT-IN and the
CLASSIC & ECO Line Neptun T2000 — built with the same stack as the Chantai platform: **Angular 21 (standalone, signals, SSR) + Tailwind CSS 4**, with **three.js** for the
interactive product view.

Content is taken from the official *SPÜLBOY NU® image brochure (EN)*; the Neptun T2000 follows the
CLASSIC & ECO Line page and the parts diagram of the *SPÜLBOY® product catalogue*.

The palette follows the printed product catalogue: white paper, the SPÜLBOY signal orange for every
heading and call to action, charcoal type, plus the catalogue's soft blue and green as secondary
accents. All of it lives as tokens in [`src/styles.css`](src/styles.css) — change a colour there and
the whole page follows, because no component hard-codes one.

## What the page does

| Area | Behaviour |
| --- | --- |
| Header | SPÜLBOY® lock-up, Home, the three products, Contact, quote CTA |
| Hero | Positioning copy plus the brochure's headline numbers |
| Products | Three: **NU® PORTABLE**, **NU® BUILT-IN** and the **CLASSIC & ECO Line Neptun T2000**, each on its own 3D stage |
| Add-ons | Two consumable cards under the devices (glass washing tabs, brush sanitizer) — not links, hover brings the can closer |
| 3D stage | Drag to spin a full 360°, scroll/pinch to zoom, auto-turntable, feature markers |
| Showcase | Two play buttons: the exploded view (~2.6 s) and the glass-cleaning demo (5 s) |
| Dropdowns | Specification and Delivery contents per product |
| Price | A slim bar driven by data; renders "Price on request" until list prices are entered, with the product catalogue PDF for download |
| Footer | The contact page: quote form prefilled with the product the visitor was viewing |

## Run it

```bash
npm install
npm start                 # dev server on http://localhost:4200
npm run build             # production build (browser + SSR)
npm test                  # unit tests (vitest)
npm run serve:ssr:spuelboy-nu   # serve the SSR build from dist/
```

`angular.json → build.options.security.allowedHosts` lists the hostnames the SSR server accepts.
`localhost` and `127.0.0.1` are allowed; **add the production hostname before deploying**, otherwise
Angular falls back to client-side rendering.

## Where to edit things

Everything a business user changes lives in one file:
[`src/app/core/data/nu-products.data.ts`](src/app/core/data/nu-products.data.ts).

- **Prices** — `pricing.amount` is `null` and `quoteOnly` is `true`, which renders the
  "Price on request" treatment. Set an amount and `quoteOnly: false` and the page formats and shows
  it automatically.
- **Specifications** — grouped `label`/`value` pairs. Anything the brochure does not publish
  (weight, article numbers, water volumes) is marked `On request` and tagged `DATA TODO` in a note.
  The outer dimensions, the counter cut-out and the brush-pot diameter come from the manufacturer
  dimension drawing and are mirrored by the constants at the top of
  [`core/three/nu-model.factory.ts`](src/app/core/three/nu-model.factory.ts) — change both together.
- **Add-ons** — `NU_ADDONS` lists the two consumable cards under the last device; the product photos
  live in `public/addons/`. The cards are small and static — hover only zooms the picture a little.
- **Offices** — `NU_OFFICES` holds the two footer addresses, the Indian office first (shown by default)
  and the German manufacturer behind a pill; a contact row appears only when its field is set.
- **Catalogue download** — `NU_CATALOGUE` points at `public/spuelboy-product-catalogue.pdf`; replace the
  file and update the size shown next to the link.
- **Brand marks** — the header lock-up is `public/spulboy-logo.png`, trimmed and resized from the
  master artwork in `assets/`; its height is set in `shared/header/header.css`. The site icons
  (`favicon.ico` at 16/32/48, `favicon-96x96.png`, `apple-touch-icon.png`) are the mascot mask on the
  brand orange, cut from the same artwork — regenerate all three together so the tab icon matches.
- **Hotspots** — the labelled markers on the 3D model; `position` is in metres, y-up, in model space.
  The NU® devices stand with their deck at y ≈ 0.35 (portable) / y ≈ 0.38 (built-in); the Neptun's
  pot rim is at y ≈ 0.33, with the pot 70 mm left of the origin so the tongue balances it.

## The 3D viewer

Two layers, deliberately separated:

- [`core/three/product-viewer.ts`](src/app/core/three/product-viewer.ts) — framework-free WebGL stage:
  renderer, IBL lighting from `RoomEnvironment`, `OrbitControls`, hotspot projection with an
  occlusion test, and the orientation announcements.
- [`landing/product-viewer/`](src/app/landing/product-viewer/) — the Angular component: DOM,
  accessibility, lifecycle. It imports three.js through a **dynamic import inside
  `afterNextRender`**, so the library never runs during SSR and lands in its own lazy chunk
  (~600 kB, loaded after the page is interactive).

Performance: rendering is paused by an `IntersectionObserver` when a stage scrolls out of view and by
`visibilitychange` when the tab is hidden, device pixel ratio is capped at 2, and hotspots are
re-projected every third frame.

Accessibility: the canvas is focusable and fully keyboard-operable (arrows orbit, ↑/↓ change camera
height, `+`/`-` zoom, `Home` resets, `Shift` for bigger steps), the current viewing angle is announced
in a live region, every marker is a real button with a text description, auto-rotation and animation
respect `prefers-reduced-motion`, and if WebGL is missing the stage explains that the same details are
in the specification panel below.

### Swapping in real CAD models

The devices are currently **procedural geometry** — the NU® pair in `core/three/nu-model.factory.ts`,
built to the product photography and the dimension drawing (397 × 270 × 337 mm, Ø167 mm brush pot,
grey housing with orange sealing details), and the Neptun T2000 in
`core/three/neptun-model.factory.ts`, built to the catalogue photos and parts diagram (Ø 18 cm pot,
23.5 cm internal glass height, 33 × 19 × 33 cm) — but not CAD-accurate models. To use real exports:

1. Put the file in `public/models/`, e.g. `public/models/nu-portable.glb` or `neptun-t2000.glb`.
2. Set `viewer.modelUrl: '/models/nu-portable.glb'` in the data file.
3. Keep the material names used by the procedural model (`NU_Housing`, `NU_Deck`, `NU_Accent`,
   `NU_Brush`, … for the NU® devices; `NEP_Pot`, `NEP_Trim`, `NEP_Brush`, … for the Neptun) so
   the two stay interchangeable.

The GLB is loaded lazily and normalised (centred, dropped on the floor, scaled to ~0.75 m). If it
fails to load, the procedural model stays on screen — the page never goes blank.

## Contact form

`core/services/contact.service.ts` posts to `environment.contactEndpoint`, which points at this app's
own SSR server. `POST /api/contact` in [`src/server.ts`](src/server.ts) re-validates the enquiry and
e-mails it to the sales mailbox over SMTP; the visitor sees a short "our team will contact you soon"
note. Point `contactEndpoint` at an absolute URL to post to a different backend instead, or set it to
an empty string to resolve locally without sending anything.

### SMTP settings

Copy `.env.example` to `.env` in the project root and fill it in. That file holds a password, so it is
git-ignored and must never be committed.

| Variable | What it is |
| --- | --- |
| `SMTP_HOST` | the provider's outgoing mail server |
| `SMTP_PORT` | `587` for STARTTLS, `465` for implicit TLS — TLS is chosen from this |
| `SMTP_USERNAME` | the mailbox that logs in; **enquiries are sent to this address** |
| `SMTP_PASSWORD` | that mailbox's password or app password |
| `SMTP_FROM_ADDRESS` | the address mail is sent from; the account must be allowed to send as it |

`dotenv/config` loads the file from the working directory, so start the server from the project root,
and restart it after any change.

While any setting is blank the endpoint answers `503` and the form tells the visitor the request could
not be sent, rather than pretending it was delivered. If `SMTP_USERNAME` is a token rather than a
mailbox (SendGrid's `apikey`, for instance), enquiries go to `SMTP_FROM_ADDRESS` instead.

The e-mail carries every field the visitor filled in — name, company, e-mail, phone, the device they
chose, the one they were viewing, their message, a reference and a timestamp — with `Reply-To` set to
the visitor, so replying in the mail client answers the customer. The endpoint accepts five enquiries
per IP address per fifteen minutes.

The rules the form and the endpoint both enforce live in
[`src/shared/contact-rules.ts`](src/shared/contact-rules.ts), so the browser and the server accept
exactly the same values and a forged post is refused.

## Project layout

```
src/app/
  core/
    data/nu-products.data.ts      # ← all content, prices, specifications, hotspots
    models/product.model.ts       # typed contract for the above
    services/contact.service.ts   # quote / contact submissions
    three/                        # WebGL stage + procedural geometry (NU® and Neptun factories)
  landing/
    landing.*                     # the single page: hero, products, cleaning process
    product-showcase/             # one product: 3D stage + copy + dropdown panels
    addon-cards/                  # the consumables row: hover-to-zoom cards, not links
    product-viewer/               # Angular wrapper around the WebGL stage
  shared/
    header/                       # logo, nav, quote CTA
    nu-select/                    # the form's dropdown: styled list on desktop, bottom sheet on phones
    footer/                       # contact form + manufacturer details

src/shared/contact-rules.ts       # the contact rules the browser AND the server enforce
src/server/contact-mail.ts        # SMTP config, message composition, sending
src/server.ts                     # Express: static files, SSR, POST /api/contact
```
