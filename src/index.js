import { config, log } from './config.js';
import { Telegram } from './telegram.js';
import { Store } from './storage.js';
import { Router, BOT_COMMANDS } from './router.js';
import { Scheduler } from './scheduler.js';

async function main() {
  if (!config.token) {
    log.error('חסר TELEGRAM_BOT_TOKEN. העתק את .env.example ל-.env ומלא את הטוקן מ-@BotFather.');
    process.exit(1);
  }

  const tg = new Telegram(config.token, { apiBase: config.apiBase });
  const store = new Store(config.dataFile, config.tz);
  const router = new Router({ tg, store, tz: config.tz });
  const scheduler = new Scheduler({ tg, store, tz: config.tz });

  const me = await tg.getMe();
  tg.me = me;
  log.info(`מחובר כ-@${me.username} (${me.first_name})`);

  // אם היה מוגדר webhook, long polling ייכשל עם 409
  await tg.deleteWebhook().catch(() => {});
  await tg.setMyCommands(BOT_COMMANDS).catch((err) => log.warn('setMyCommands נכשל:', err.message));

  scheduler.start();

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`התקבל ${signal}, סוגר בצורה מסודרת…`);
    scheduler.stop();
    tg.stop();
    store.close();
    setTimeout(() => process.exit(0), 300).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => log.error('Promise שנדחה ללא טיפול:', err));

  log.info('מאזין לעדכונים…');
  await tg.startPolling((update) => router.handleUpdate(update));

  store.close();
  log.info('להתראות 👋');
}

main().catch((err) => {
  log.error('הבוט נעצר:', err?.stack || err);
  process.exit(1);
});
