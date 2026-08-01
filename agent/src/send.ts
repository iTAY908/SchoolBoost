/**
 * One-off sender, for opening a conversation or smoke-testing credentials.
 *
 *   node dist/send.js 972584080951 --template Itay
 *   node dist/send.js 972584080951 "היי, הסוכן באוויר"
 *
 * Meta only delivers free-form text inside the 24-hour window that opens when
 * the contact messages the business. Outside it, use --template.
 */
import { config } from "./config.js";
import { sendTemplate, sendText } from "./infobip.js";

const [to, ...rest] = process.argv.slice(2);

if (!to) {
  console.error("Usage: node dist/send.js <phone-number> [--template <placeholders...> | <text>]");
  process.exit(1);
}

const isTemplate = rest[0] === "--template";

try {
  if (isTemplate) {
    await sendTemplate(to, rest.slice(1));
    console.log(`Template "${config.infobip.templateName}" sent to ${to}`);
  } else {
    const text = rest.join(" ");
    if (!text) {
      console.error("No message text given.");
      process.exit(1);
    }
    await sendText(to, text);
    console.log(`Text sent to ${to}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
