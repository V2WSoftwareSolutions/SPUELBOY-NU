import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  emailValidator,
  keepDigits,
  keepNameCharacters,
  nameValidator,
  phoneValidator,
} from './contact-validators';

const check = (validator: typeof nameValidator, value: string) => validator(new FormControl(value));

describe('contact form validators', () => {
  it('accepts names with letters, spaces, hyphens, apostrophes and accents', () => {
    for (const name of ['Sam Wirt', 'Anne-Marie', "O'Neil", 'Jürgen Müller', 'J. R. Ewing']) {
      expect(check(nameValidator, name), name).toBeNull();
    }
  });

  it('rejects names that carry digits or symbols', () => {
    for (const name of ['Sam1', 'Sam@Wirt', 'Sam_Wirt', '<b>Sam</b>', '-Sam', '#']) {
      expect(check(nameValidator, name), name).toEqual({ name: true });
    }
  });

  it('insists on a dotted domain in the e-mail address', () => {
    expect(check(emailValidator, 'sam@example.com')).toBeNull();
    expect(check(emailValidator, 'sam.wirt+quote@mail.example.co.uk')).toBeNull();
    for (const email of ['sam@example', 'sam@', '@example.com', 'sam example.com', 'sam@example.c']) {
      expect(check(emailValidator, email), email).toEqual({ email: true });
    }
  });

  it('takes an Indian mobile number as exactly ten digits starting 6 to 9', () => {
    for (const phone of ['9966879792', '6000000000', '']) {
      expect(check(phoneValidator, phone), phone).toBeNull();
    }
    for (const phone of ['+91 99668 79792', '919966879792', '09966879792', '996687979', '99668797921', '5966879792', '02026953200']) {
      expect(check(phoneValidator, phone), phone).toEqual({ phone: true });
    }
  });

  it('strips what the fields do not accept as the visitor types', () => {
    expect(keepDigits('+49 (0) 202 695 32-0')).toBe('490202695320');
    expect(keepNameCharacters('Sam W1rt!')).toBe('Sam Wrt');
    expect(keepNameCharacters('Jürgen Müller-Lüdenscheidt')).toBe('Jürgen Müller-Lüdenscheidt');
  });
});
