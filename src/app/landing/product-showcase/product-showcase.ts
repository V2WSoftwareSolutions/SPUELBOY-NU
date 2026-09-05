import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { NU_CATALOGUE } from '../../core/data/nu-products.data';
import { NuProduct } from '../../core/models/product.model';
import { ProductViewer3d } from '../product-viewer/product-viewer';

/** Which product the visitor asked us to quote, in a shape the form consumes. */
export interface NuConfigurationRequest {
  productId: string;
  productName: string;
}

type PanelId = 'specs' | 'included' | null;

@Component({
  selector: 'app-product-showcase',
  imports: [ProductViewer3d],
  templateUrl: './product-showcase.html',
  styleUrl: './product-showcase.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductShowcase {
  readonly product = input.required<NuProduct>();
  /** Flips the stage to the other side so consecutive products alternate. */
  readonly mirrored = input(false);

  readonly quoteRequested = output<NuConfigurationRequest>();

  /** The catalogue download offered in the price bar — the same for every product. */
  protected readonly catalogue = NU_CATALOGUE;

  /** Both panels start closed; they open only when the visitor asks for them. */
  protected readonly openPanel = signal<PanelId>(null);

  protected readonly priceLabel = computed(() => {
    const { amount, currency, quoteOnly } = this.product().pricing;
    if (amount === null || quoteOnly) return 'Price on request';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  });

  protected readonly hasListPrice = computed(() => {
    const { amount, quoteOnly } = this.product().pricing;
    return amount !== null && !quoteOnly;
  });

  protected togglePanel(panel: Exclude<PanelId, null>): void {
    this.openPanel.update((current) => (current === panel ? null : panel));
  }

  protected requestQuote(): void {
    const product = this.product();
    this.quoteRequested.emit({ productId: product.id, productName: product.name });
  }
}
