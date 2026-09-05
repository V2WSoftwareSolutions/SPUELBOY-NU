import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ContactService, NuContactRequest } from './contact.service';

const request: NuContactRequest = {
  name: 'Sam Wirt',
  company: 'Zum Anker',
  email: 'sam@example.com',
  phone: '',
  interest: 'nu-portable',
  interestLabel: 'SPÜLBOY NU® PORTABLE',
  message: 'Please send a quote for two portable devices.',
};

describe('ContactService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('posts the enquiry to the configured endpoint, label and all', async () => {
    const service = TestBed.inject(ContactService);
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(service.submit(request));
    const call = http.expectOne(environment.contactEndpoint);

    expect(call.request.method).toBe('POST');
    expect(call.request.body).toMatchObject({
      name: 'Sam Wirt',
      email: 'sam@example.com',
      interest: 'nu-portable',
      interestLabel: 'SPÜLBOY NU® PORTABLE',
    });

    call.flush({ reference: 'NU-260905-4F2A' });
    expect(await result).toEqual({ reference: 'NU-260905-4F2A', delivered: true });
    http.verify();
  });

  it('fails loudly when the server cannot deliver, rather than claiming success', async () => {
    const service = TestBed.inject(ContactService);
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(service.submit(request));
    http
      .expectOne(environment.contactEndpoint)
      .flush({ error: 'The enquiry could not be delivered.' }, { status: 502, statusText: 'Bad Gateway' });

    await expect(result).rejects.toBeTruthy();
    http.verify();
  });
});
