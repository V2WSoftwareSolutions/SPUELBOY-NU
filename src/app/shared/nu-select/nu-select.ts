import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface NuSelectOption {
  value: string;
  label: string;
}

/**
 * A single-choice dropdown that looks the same everywhere.
 *
 * A native <select> cannot style its open list, so this draws its own: a
 * panel under the trigger on desktop, a bottom sheet on phones. It plugs into
 * reactive forms like a native control (formControlName works), and follows
 * the combobox pattern — focus stays on the trigger, arrow keys walk the
 * options, Enter picks, Escape closes.
 */
@Component({
  selector: 'app-nu-select',
  templateUrl: './nu-select.html',
  styleUrl: './nu-select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NuSelect), multi: true }],
})
export class NuSelect implements ControlValueAccessor {
  readonly options = input.required<NuSelectOption[]>();
  /** Goes on the trigger, so a <label for="…"> reaches it. */
  readonly inputId = input.required<string>();
  /** Shown as the sheet's heading on phones. */
  readonly label = input('');
  readonly placeholder = input('Please choose');

  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  /** Index of the option the keyboard is on while the list is open. */
  protected readonly active = signal(0);

  /** Set when the panel has to hang above the field instead of below it. */
  protected readonly dropUp = signal(false);
  /** Height the list is allowed to take, measured against the space on screen. */
  protected readonly listMax = signal<string | null>(null);

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly selected = computed(() => this.options().find((option) => option.value === this.value()) ?? null);
  protected readonly selectedLabel = computed(() => this.selected()?.label ?? this.placeholder());

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ---- ControlValueAccessor

  writeValue(value: string | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  // ---- opening and closing

  protected toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  protected show(): void {
    if (this.disabled()) return;
    const current = this.options().findIndex((option) => option.value === this.value());
    this.active.set(current < 0 ? 0 : current);
    this.place();
    this.open.set(true);
  }

  /**
   * Decides which side of the field the panel hangs on and how tall it may be.
   *
   * Phones show the list as a sheet pinned to the bottom of the screen, so
   * there is nothing to measure there — the styles take over and the height
   * stays null.
   */
  private place(): void {
    // Optional call: jsdom, where the unit tests run, has no matchMedia.
    if (window.matchMedia?.('(max-width: 639px)').matches) {
      this.dropUp.set(false);
      this.listMax.set(null);
      return;
    }

    const rect = this.triggerRef().nativeElement.getBoundingClientRect();
    const margin = 16;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    // Roughly what the list wants: a row is about 3rem, plus the panel padding.
    const wanted = Math.min(this.options().length * 48 + 16, 304);

    const up = below < wanted && above > below;
    this.dropUp.set(up);
    this.listMax.set(`${Math.max(140, Math.floor(up ? above : below))}px`);
  }

  /** The panel is anchored to the field, so it only needs re-measuring. */
  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onViewportChange(): void {
    if (this.open()) this.place();
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  // ---- choosing

  protected choose(option: NuSelectOption): void {
    if (option.value !== this.value()) {
      this.value.set(option.value);
      this.onChange(option.value);
    }
    this.close();
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-option-${index}`;
  }

  /** The keyboard drives the list from the trigger; the options never take focus. */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    if (!count) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.show();
        else this.moveTo((this.active() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) this.show();
        else this.moveTo((this.active() - 1 + count) % count);
        break;
      case 'Home':
        if (!this.open()) return;
        event.preventDefault();
        this.moveTo(0);
        break;
      case 'End':
        if (!this.open()) return;
        event.preventDefault();
        this.moveTo(count - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.open()) this.choose(this.options()[this.active()]);
        else this.show();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private moveTo(index: number): void {
    this.active.set(index);
    // Optional call: jsdom, which the unit tests run in, has no scrollIntoView.
    document.getElementById(this.optionId(index))?.scrollIntoView?.({ block: 'nearest' });
  }
}
