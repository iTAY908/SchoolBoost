function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  infobip: {
    /** Your Infobip base URL, e.g. 8vn9v1.api.infobip.com (no scheme). */
    baseUrl: required("INFOBIP_BASE_URL").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    /** Infobip API key. Sent as `Authorization: App <key>`. */
    apiKey: required("INFOBIP_API_KEY"),
    /** The WhatsApp Business sender number, digits only, no leading +. */
    sender: required("INFOBIP_SENDER"),
    /** Template used to open a conversation outside the 24h service window. */
    templateName: optional("INFOBIP_TEMPLATE_NAME", "test_whatsapp_template_en"),
    templateLanguage: optional("INFOBIP_TEMPLATE_LANGUAGE", "en"),
  },
  anthropic: {
    /** Read by the SDK from ANTHROPIC_API_KEY; asserted here so it fails fast. */
    apiKey: required("ANTHROPIC_API_KEY"),
    model: optional("ANTHROPIC_MODEL", "claude-opus-5"),
  },
  server: {
    port: Number(optional("PORT", "3000")),
    /**
     * Shared secret for the inbound webhook. Infobip is configured to call
     * /webhook/whatsapp?token=<this>. Requests without it are rejected.
     */
    webhookToken: required("WEBHOOK_TOKEN"),
  },
  /** Turns kept per contact before the oldest are dropped. */
  historyTurns: Number(optional("HISTORY_TURNS", "20")),
} as const;
