import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { NU_CLEANING_STEPS, NU_PRODUCTS } from '../core/data/nu-products.data';
import { Footer } from '../shared/footer/footer';
import { GlassDoodle } from '../shared/glass-doodle/glass-doodle';
import { AddonCards } from './addon-cards/addon-cards';
import { NuConfigurationRequest, ProductShowcase } from './product-showcase/product-showcase';

/**
 * The single landing page: hero, the two NU® devices and the Neptun T2000 in
 * 3D, the add-on cards, the cleaning routine and the contact footer.
 */
@Component({
  selector: 'app-landing',
  imports: [ProductShowcase, AddonCards, Footer, GlassDoodle],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly products = NU_PRODUCTS;
  protected readonly steps = NU_CLEANING_STEPS;

  protected readonly quoteRequest = signal<NuConfigurationRequest | null>(null);

  protected readonly stats = [
    { value: '5–8 sec', label: 'per glass' },
    { value: '0 kWh', label: 'no electricity' },
    { value: 'up to 80%', label: 'cost saving' },
    { value: '100%', label: 'tested hygiene' },
  ];

  protected onQuoteRequested(request: NuConfigurationRequest): void {
    this.quoteRequest.set(request);
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus lands on the first field so keyboard and screen-reader users arrive
    // in the form, not merely near it.
    window.setTimeout(() => document.getElementById('contact-name')?.focus({ preventScroll: true }), 600);
  }
}
