import 'dotenv/config';

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { buildReference, validateContactRequest } from './shared/contact-rules';
import { buildContactMail, readSmtpConfig, sendContactMail } from './server/contact-mail';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * The contact form posts here; the enquiry is e-mailed to the sales mailbox.
 *
 * SMTP settings come from the environment — `dotenv/config` above loads the
 * `.env` file in the working directory. With any of them missing the endpoint
 * answers 503 and the form says the request could not be sent, rather than
 * telling the visitor their message is on its way when it is not.
 */

/** A public endpoint that sends mail needs a lid on it: 5 enquiries per IP per 15 minutes. */
const RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const recentByIp = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const seen = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);
  if (seen.length >= RATE_LIMIT.max) {
    recentByIp.set(ip, seen);
    return true;
  }
  seen.push(now);
  recentByIp.set(ip, seen);
  // The map would otherwise grow for the life of the process.
  if (recentByIp.size > 5000) {
    for (const [key, times] of recentByIp) {
      if (!times.some((at) => now - at < RATE_LIMIT.windowMs)) recentByIp.delete(key);
    }
  }
  return false;
}

app.post('/api/contact', express.json({ limit: '32kb' }), async (req, res) => {
  if (rateLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many requests. Please try again later, or call us.' });
    return;
  }

  const validation = validateContactRequest(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: 'The enquiry is incomplete.', details: validation.errors });
    return;
  }

  const smtp = readSmtpConfig(process.env);
  if (!smtp.ok) {
    console.error('[contact] SMTP is not configured; missing:', smtp.missing.join(', '));
    res.status(503).json({ error: 'E-mail delivery is not configured on this server.' });
    return;
  }

  const reference = buildReference();
  try {
    await sendContactMail(buildContactMail(validation.value, smtp.config, reference), smtp.config);
    console.log(`[contact] ${reference} sent to ${smtp.config.to}`);
    res.status(200).json({ reference });
  } catch (error) {
    // The message is logged for the operator; the visitor only learns it failed.
    console.error(`[contact] ${reference} could not be sent:`, error);
    res.status(502).json({ error: 'The enquiry could not be delivered. Please call us instead.' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
