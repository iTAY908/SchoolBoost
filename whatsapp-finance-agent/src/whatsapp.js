const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

/** שולח הודעת טקסט למשתמש בוואטסאפ דרך WhatsApp Cloud API */
export async function sendWhatsAppMessage(to, text) {
  const res = await fetch(
    `${GRAPH_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** מסמן הודעה כנקראה (שני וי כחולים) */
export async function markAsRead(messageId) {
  await fetch(
    `${GRAPH_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    }
  ).catch(() => {}); // לא קריטי אם נכשל
}
