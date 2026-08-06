#!/usr/bin/env node
'use strict';

/**
 * Answers one question: is this Green API instance actually linked to a
 * WhatsApp account right now?
 *
 * Usage:  node scripts/check-connection.js
 * Exits 0 when authorized, 1 otherwise — so it can gate a deploy.
 */

const { loadConfig } = require('../server/config');
const { GreenApiClient, GreenApiError } = require('../server/greenapi');

const EXPLANATIONS = {
  authorized: 'Linked to WhatsApp. Sending and receiving both work.',
  notAuthorized: 'Not linked. Scan the QR code in the Green API console.',
  blocked: 'Instance is blocked — check billing and the console for details.',
  sleepMode: 'Phone has been offline too long. Reconnect it to the internet.',
  starting: 'Instance is still starting. Retry in a few seconds.',
};

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  console.log(`Instance ${config.idInstance} at ${config.baseUrl}`);

  const client = new GreenApiClient(config);

  let state;
  try {
    state = await client.getStateInstance();
  } catch (err) {
    if (err instanceof GreenApiError) {
      console.error(`✗ Could not reach Green API — ${err.message}`);
      if (err.status === 401) {
        console.error('  The instance id or token is wrong, or the token was rotated.');
      } else if (err.status === 403) {
        console.error(
          '  Either the token is wrong, or an outbound proxy blocked the host.\n' +
            `  Check reachability first:  curl -I ${config.baseUrl}`
        );
      }
    } else {
      console.error(`✗ ${err.message}`);
    }
    process.exit(1);
  }

  const value = state?.stateInstance ?? 'unknown';
  const explanation = EXPLANATIONS[value] || 'Unrecognised state.';

  if (value === 'authorized') {
    console.log(`✓ connected — ${explanation}`);
    process.exit(0);
  }

  console.error(`✗ not connected (${value}) — ${explanation}`);
  process.exit(1);
}

main();
