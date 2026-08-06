// Login flow: polls Green API for the rotating QR code and writes it to a PNG
// until the instance reports `authorized`.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GreenApiError } from './green-api.mjs';

export const QR_PATH = join(dirname(fileURLToPath(import.meta.url)), 'qr.png');

const POLL_INTERVAL_MS = 4_000;
const DEFAULT_TIMEOUT_MS = 3 * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @returns {Promise<boolean>} true once the instance is authorized.
 */
export async function waitForScan(api, { timeoutMs = DEFAULT_TIMEOUT_MS, log = console.log } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const qr = await api.getQr();

    if (qr?.type === 'alreadyLogged') return true;

    if (qr?.type === 'qrCode' && qr.message) {
      await writeFile(QR_PATH, Buffer.from(qr.message, 'base64'));
      log(`   QR written to ${QR_PATH} — scan it (it refreshes every few seconds).`);
    } else if (qr?.type === 'error') {
      throw new GreenApiError(`Green API returned an error: ${qr.message}`);
    }

    await sleep(POLL_INTERVAL_MS);

    if ((await api.getStateInstance()) === 'authorized') return true;
  }

  return false;
}
