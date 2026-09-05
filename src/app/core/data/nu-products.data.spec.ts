import { describe, expect, it } from 'vitest';

import { NU_ADDONS, NU_PRODUCTS } from './nu-products.data';

/**
 * The landing page is entirely data-driven, so these checks guard the contract
 * the components rely on rather than the copy itself.
 */
describe('NU_PRODUCTS', () => {
  it('lists the three devices the storefront sells, the NU® pair first and the Neptun below them', () => {
    expect(NU_PRODUCTS.map((product) => product.id)).toEqual(['nu-portable', 'nu-built-in', 'neptun-t2000']);
  });

  it('gives every product a unique slug used as its in-page anchor', () => {
    const slugs = NU_PRODUCTS.map((product) => product.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const product of NU_PRODUCTS) {
    describe(product.id, () => {
      it('has unique hotspot ids inside the device bounding box', () => {
        const ids = product.viewer.hotspots.map((spot) => spot.id);
        expect(new Set(ids).size).toBe(ids.length);

        // The NU® devices are 397 × 270 × 337 mm, the Neptun 330 × 190 × 330 mm;
        // hotspots hug them, and the supply hose is the only thing that reaches
        // noticeably beyond a housing.
        for (const spot of product.viewer.hotspots) {
          const [x, y, z] = spot.position;
          expect(Math.abs(x)).toBeLessThan(0.4);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(0.5);
          expect(Math.abs(z)).toBeLessThan(0.4);
        }
      });

      it('keeps the camera target inside the height of the device', () => {
        expect(product.viewer.cameraTargetY).toBeGreaterThan(0);
        expect(product.viewer.cameraTargetY).toBeLessThan(0.45);
      });

      it('carries at least one specification group with items', () => {
        expect(product.specGroups.length).toBeGreaterThan(0);
        for (const group of product.specGroups) {
          expect(group.items.length).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('NU_ADDONS', () => {
  it('lists the two consumables in catalogue order, below the devices', () => {
    expect(NU_ADDONS.map((addon) => addon.id)).toEqual(['glass-washing-tabs', 'brush-sanitizer']);
  });

  it('gives every card a photo under /addons/ and alt text', () => {
    for (const addon of NU_ADDONS) {
      expect(addon.image).toMatch(/^\/addons\/[a-z0-9-]+\.(png|webp)$/);
      expect(addon.alt.length).toBeGreaterThan(0);
    }
  });
});
