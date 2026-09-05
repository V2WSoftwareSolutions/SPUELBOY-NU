import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ContactService } from '../../core/services/contact.service';
import { NU_COMPANY, NU_OFFICES, NU_PRODUCTS } from '../../core/data/nu-products.data';
import { NuConfigurationRequest } from '../../landing/product-showcase/product-showcase';
import { NuSelect, NuSelectOption } from '../nu-select/nu-select';
import { emailValidator, keepDigits, keepNameCharacters, nameValidator, phoneValidator } from './contact-validators';

type SubmitState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Footer with the contact / quote form.
 *
 * The whole storefront is one page, so this *is* the contact page: the header's
 * "Contact" link and every product CTA scroll here, and a CTA that came from a
 * product panel arrives with the visitor's 3D configuration prefilled.
 */
@Component({
  selector: 'app-footer',
  imports: [ReactiveFormsModule, NuSelect],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  /** Set when the visitor pressed "Configure & request quote" on a product. */
  readonly prefill = input<NuConfigurationRequest | null>(null);

  protected readonly company = NU_COMPANY;
  protected readonly products = NU_PRODUCTS;

  /** The "I am interested in" choices: every device, then the two catch-alls. */
  protected readonly interests: NuSelectOption[] = [
    ...NU_PRODUCTS.map((product) => ({ value: product.id, label: product.name })),
    { value: 'several', label: 'Several devices' },
    { value: 'accessories', label: 'Tabs, brushes & accessories' },
  ];

  /** Both offices, shown side by side in the grey band under the form. */
  protected readonly offices = NU_OFFICES;

  private readonly fb = inject(FormBuilder);
  private readonly contact = inject(ContactService);

  protected readonly state = signal<SubmitState>('idle');
  protected readonly year = new Date().getFullYear();

  protected dismissStatus(): void {
    this.state.set('idle');
  }

  // The patterns live in contact-validators.ts; the name and phone fields
  // also filter keystrokes and pastes down to those characters (see sanitize).
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), nameValidator]],
    company: ['', Validators.maxLength(120)],
    email: ['', [Validators.required, Validators.maxLength(120), emailValidator]],
    phone: ['', phoneValidator],
    interest: ['nu-portable', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    consent: [false, Validators.requiredTrue],
  });

  constructor() {
    // A quote request from a product panel arrives with that device selected
    // and a message the visitor only has to add their details to.
    effect(() => {
      const request = this.prefill();
      if (!request) return;

      this.form.patchValue({
        interest: request.productId,
        message: `Please send me a quote for the ${request.productName}.`,
      });
      this.state.set('idle');
    });
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  /** Drops characters a field does not take the moment they are typed or pasted. */
  protected sanitize(control: 'name' | 'phone', event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = control === 'phone' ? keepDigits(input.value) : keepNameCharacters(input.value);
    if (clean !== input.value) this.form.controls[control].setValue(clean);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.state.set('error');
      return;
    }

    const value = this.form.getRawValue();
    this.state.set('sending');

    this.contact
      .submit({
        name: value.name,
        company: value.company,
        email: value.email,
        phone: value.phone,
        interest: value.interest,
        interestLabel: this.interests.find((option) => option.value === value.interest)?.label ?? value.interest,
        message: value.message,
        product: this.prefill()?.productName,
      })
      .subscribe({
        next: () => {
          this.state.set('sent');
          this.form.reset({ interest: value.interest, consent: false });
        },
        error: () => this.state.set('error'),
      });
  }
}
