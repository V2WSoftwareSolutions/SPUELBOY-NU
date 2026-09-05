import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { EMAIL_PATTERN, NAME_PATTERN, PHONE_PATTERN } from '../../../shared/contact-rules';

/**
 * The contact form's field validators.
 *
 * The patterns themselves live in `src/shared/contact-rules.ts`, which the
 * server imports too — so the browser and the endpoint accept exactly the same
 * values. They are re-exported here for the components and tests that use them.
 */
export { EMAIL_PATTERN, NAME_PATTERN, PHONE_PATTERN };

/** Empty passes: whether a field is required is decided separately. */
function matches(pattern: RegExp, error: string): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (!value) return null;
    return pattern.test(value) ? null : { [error]: true };
  };
}

export const nameValidator = matches(NAME_PATTERN, 'name');
export const emailValidator = matches(EMAIL_PATTERN, 'email');
export const phoneValidator = matches(PHONE_PATTERN, 'phone');

/** What the phone field lets through as the visitor types or pastes. */
export const keepDigits = (value: string): string => value.replace(/\D+/g, '');

/** What the name field lets through as the visitor types or pastes. */
export const keepNameCharacters = (value: string): string => value.replace(/[^\p{L}\p{M}' .-]+/gu, '');
