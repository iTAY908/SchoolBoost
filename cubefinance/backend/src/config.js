// Worker 3 — central config (env-driven, safe defaults)
require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Default to the latest capable Claude model for the chat buddy.
  chatModel: process.env.CHAT_MODEL || 'claude-sonnet-5',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
