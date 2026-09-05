import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

export interface NuContactRequest {
  name: string;
  company: string;
  email: string;
  phone: string;
  /** The chosen option's id, e.g. `nu-portable`. */
  interest: string;
  /** That option's label, so the e-mail reads as the visitor saw it. */
  interestLabel: string;
  message: string;
  /** Product the visitor was looking at when they asked for the quote. */
  product?: string;
}

export interface NuContactResult {
  reference: string;
  delivered: boolean;
}

/**
 * Sends contact / quote requests.
 *
 * By default this posts to the app's own `/api/contact`, which e-mails the
 * enquiry to the sales mailbox. With `environment.contactEndpoint` empty the
 * request resolves locally and is flagged `delivered: false`, so a build with
 * no backend never pretends a message was actually sent.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  submit(request: NuContactRequest): Observable<NuContactResult> {
    const reference = this.buildReference();

    if (!environment.contactEndpoint) {
      return of({ reference, delivered: false }).pipe(delay(600));
    }

    return this.http.post<{ reference?: string }>(environment.contactEndpoint, request).pipe(
      map((response) => ({ reference: response?.reference ?? reference, delivered: true })),
      catchError((error: unknown) => throwError(() => error)),
    );
  }

  private buildReference(): string {
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `NU-${stamp}-${random}`;
  }
}
