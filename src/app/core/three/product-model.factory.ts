import { NuViewerVariant } from '../models/product.model';
import { createNeptunModel } from './neptun-model.factory';
import { createNuModel, NuModel } from './nu-model.factory';

/**
 * Picks the procedural device for a viewer variant: the two NU® bodies come
 * from one factory, the CLASSIC & ECO Line Neptun T2000 from its own. Both
 * honour the same `NuModel` contract, so the stage never has to know which
 * one it is spinning.
 */
export function createProductModel(variant: NuViewerVariant): NuModel {
  return variant === 'neptun' ? createNeptunModel() : createNuModel(variant);
}
