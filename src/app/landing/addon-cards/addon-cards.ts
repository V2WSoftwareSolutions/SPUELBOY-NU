import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NU_ADDONS } from '../../core/data/nu-products.data';

/**
 * The consumables row under the last device: two small product cards, pictured
 * only. There is nothing to buy online, so the cards are neither links nor
 * buttons — the one thing they do is ease the photo in a little on hover.
 */
@Component({
  selector: 'app-addon-cards',
  templateUrl: './addon-cards.html',
  styleUrl: './addon-cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonCards {
  protected readonly addons = NU_ADDONS;
}
