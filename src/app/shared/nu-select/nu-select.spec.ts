import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NuSelect, NuSelectOption } from './nu-select';

const OPTIONS: NuSelectOption[] = [
  { value: 'nu-portable', label: 'SPÜLBOY NU® PORTABLE' },
  { value: 'nu-built-in', label: 'SPÜLBOY NU® BUILT-IN' },
  { value: 'several', label: 'Several devices' },
];

describe('NuSelect', () => {
  let fixture: ComponentFixture<NuSelect>;
  let select: NuSelect;

  const trigger = () => fixture.nativeElement.querySelector('button[role=combobox]') as HTMLButtonElement;
  const options = () => [...fixture.nativeElement.querySelectorAll('[role=option]')] as HTMLElement[];
  const press = (key: string) => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NuSelect] }).compileComponents();
    fixture = TestBed.createComponent(NuSelect);
    select = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('inputId', 'interest');
    fixture.componentRef.setInput('label', 'I am interested in');
    fixture.detectChanges();
  });

  it('shows the label of the value the form writes into it', () => {
    expect(trigger().textContent).toContain('Please choose');
    select.writeValue('nu-built-in');
    fixture.detectChanges();
    expect(trigger().textContent).toContain('SPÜLBOY NU® BUILT-IN');
  });

  it('opens on click, lists every option and marks the chosen one', () => {
    select.writeValue('several');
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((option) => option.textContent?.trim())).toEqual(OPTIONS.map((option) => option.label));
    expect(options()[2].getAttribute('aria-selected')).toBe('true');
  });

  it('lets the keyboard walk the list and pick with Enter, telling the form', () => {
    const onChange = vi.fn();
    select.registerOnChange(onChange);
    select.writeValue('nu-portable');
    fixture.detectChanges();

    press('ArrowDown'); // opens on the current value
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-activedescendant')).toBe('interest-option-0');

    press('ArrowDown');
    expect(trigger().getAttribute('aria-activedescendant')).toBe('interest-option-1');

    press('Enter');
    expect(onChange).toHaveBeenCalledWith('nu-built-in');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('SPÜLBOY NU® BUILT-IN');
  });

  it('closes on Escape and reports the touch to the form', () => {
    const onTouched = vi.fn();
    select.registerOnTouched(onTouched);
    trigger().click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(onTouched).toHaveBeenCalled();
  });

  it('stays shut while disabled', () => {
    select.setDisabledState(true);
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();
    expect(options()).toHaveLength(0);
  });
});
