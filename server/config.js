'use strict';

/**
 * Configuration is read from the environment only. Nothing here is ever
 * committed — see .env.example for the list of variables and README.md for
 * how to supply them.
 */

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to .env and fill it in, or export it in your shell.'
    );
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

/**
 * Green API exposes each instance under its own regional host. The console
 * shows the host alongside the instance id — for instance 7107xxxxxx it is
 * https://7107.api.greenapi.com. Defaults to the shared host.
 */
function loadConfig() {
  return {
    idInstance: required('GREEN_API_ID_INSTANCE'),
    apiTokenInstance: required('GREEN_API_TOKEN_INSTANCE'),
    baseUrl: optional('GREEN_API_BASE_URL', 'https://api.green-api.com').replace(/\/+$/, ''),

    // Shared secret Green API sends back as `Authorization: Bearer <token>`
    // on every outgoing webhook. Configured in the console under
    // "Outgoing webhook token". Requests without it are rejected.
    webhookToken: optional('GREEN_API_WEBHOOK_TOKEN', ''),

    port: Number(optional('PORT', '3000')),

    // Default country code used when normalising local phone numbers.
    defaultCountryCode: optional('DEFAULT_COUNTRY_CODE', '972'),
  };
}

module.exports = { loadConfig };
