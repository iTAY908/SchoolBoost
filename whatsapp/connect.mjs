#!/usr/bin/env node
// Links this Green API instance to a WhatsApp account, or reports that it
// already is. Run:  node whatsapp/connect.mjs
//
// While the instance is notAuthorized this polls for the login QR code and
// writes it to whatsapp/qr.png (rewritten every few seconds as the code
// rotates) — open that file and scan it from
// WhatsApp → Settings → Linked devices → Link a device.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GreenApi, GreenApiError } from './green-api.mjs';

const QR_PATH = join(dirname(fileURLToPath(import.meta.url)), 'qr.png');
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 3 * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reportAuthorized(api) {
  console.log('✅ Instance is authorized — WhatsApp is connected.');
  try {
    const wa = await api.getWaSettings();
    if (wa?.phone) console.log(`   Linked number: +${wa.phone}`);
    if (wa?.stateInstance) console.log(`   State: ${wa.stateInstance}`);
  } catch (err) {
    console.log(`   (could not read account details: ${err.message})`);
  }
}

async function waitForScan(api) {
  console.log('📱 Instance is not authorized yet — fetching a login QR code.');
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const qr = await api.getQr();

    if (qr?.type === 'alreadyLogged') {
      console.log('\n✅ Linked.');
      return true;
    }

    if (qr?.type === 'qrCode' && qr.message) {
      await writeFile(QR_PATH, Buffer.from(qr.message, 'base64'));
      console.log(`   QR written to ${QR_PATH} — scan it (it refreshes every few seconds).`);
    } else if (qr?.type === 'error') {
      throw new GreenApiError(`Green API returned an error: ${qr.message}`);
    }

    await sleep(POLL_INTERVAL_MS);

    if ((await api.getStateInstance()) === 'authorized') {
      console.log('\n✅ Linked.');
      return true;
    }
  }

  console.error('\n⏱  Timed out waiting for the QR code to be scanned.');
  return false;
}

async function main() {
  const api = new GreenApi();

  const state = await api.getStateInstance();
  console.log(`Instance state: ${state}`);

  switch (state) {
    case 'authorized':
      await reportAuthorized(api);
      return 0;

    case 'notAuthorized':
      return (await waitForScan(api)) ? 0 : 1;

    case 'starting':
      console.log('⏳ Instance is still starting. Wait a few seconds and re-run.');
      return 1;

    case 'sleepMode':
      console.log('😴 Instance is in sleep mode — the phone is offline. Bring the phone online.');
      return 1;

    case 'blocked':
      console.log('🚫 Instance is blocked. Check the instance status in the Green API console.');
      return 1;

    default:
      console.log(`❓ Unexpected state: ${state}`);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof GreenApiError) {
      console.error(`❌ ${err.message}`);
      if (err.status === 401 || err.status === 403) {
        console.error('   The token or instance id looks wrong — re-check GREEN_API_* values.');
      }
    } else {
      console.error(`❌ ${err.stack || err.message}`);
    }
    process.exit(1);
  });
