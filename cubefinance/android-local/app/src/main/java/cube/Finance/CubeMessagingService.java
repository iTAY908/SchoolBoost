package cube.Finance;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.util.Map;

/**
 * Receives the backend's data-only pushes and decides what reaches the shade.
 * The server always sends data messages (never "notification" messages), so
 * this runs whether the app is open, in the background or closed — which is
 * what lets it:
 *   - drop a push for an account that is no longer signed in on this phone,
 *   - drop a push it has already shown (retries, redelivery),
 *   - skip the system notification when the user is already reading that
 *     conversation, and hand the reply to the open chat instead,
 *   - honour the on/off and hide-content settings even if the server's copy
 *     of them is stale.
 */
public class CubeMessagingService extends FirebaseMessagingService {

    static final String EXTRA_TYPE = "push_type";
    static final String EXTRA_UID = "push_uid";
    static final String EXTRA_CONVERSATION = "push_conversation";
    static final String EXTRA_MESSAGE = "push_message";
    static final String EXTRA_ENTRY = "push_entry";

    @Override
    public void onNewToken(@NonNull String token) {
        PushManager.onNewToken(getApplicationContext(), token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Context ctx = getApplicationContext();
        if (!PushManager.isEnabled(ctx)) return;
        Map<String, String> d = message.getData();
        String type = d.get("type");
        String uid = d.get("uid");
        String me = PushManager.currentUid();
        if (type == null || uid == null || !uid.equals(me)) return;   // not this account (anymore)

        if ("chat".equals(type)) handleChat(ctx, d);
        else if ("income".equals(type)) handleIncome(ctx, d);
        // Silent: an AI Premium purchase was refunded/revoked — re-check now
        // instead of at the next launch (nothing is shown to the user).
        else if ("entitlement".equals(type)) ((CubeApp) getApplication()).getEntitlements().requestRecheck();
    }

    private void handleChat(Context ctx, Map<String, String> d) {
        String cid = d.get("conversationId");
        String mid = d.get("messageId");
        if (cid == null || mid == null) return;
        if (!PushManager.markSeen(ctx, "chat:" + mid)) return;
        if (!PushManager.localPref(ctx, "chatPush", true)) return;

        // Already reading this conversation: no system notification, the
        // chat shows the reply itself.
        if (PushManager.isViewing(cid)) {
            forward("chat", d);
            return;
        }
        boolean hide = PushManager.localPref(ctx, "hideSensitive", false);
        String title = nonEmpty(d.get("title"), ctx.getString(R.string.push_chat_title));
        String body = hide ? ctx.getString(R.string.push_chat_generic) : nonEmpty(d.get("body"), ctx.getString(R.string.push_chat_generic));

        Intent open = new Intent(ctx, MainActivity.class)
                .setAction("cube.Finance.OPEN_CHAT." + mid)
                .putExtra(EXTRA_TYPE, "chat")
                .putExtra(EXTRA_UID, d.get("uid"))
                .putExtra(EXTRA_CONVERSATION, cid)
                .putExtra(EXTRA_MESSAGE, mid);
        post(ctx, PushManager.CHANNEL_CHAT, PushManager.TAG_CHAT, mid, title, body,
                ctx.getString(R.string.push_chat_generic), open, NotificationCompat.CATEGORY_MESSAGE);
        forward("chat", d);   // app in the background but alive: let the page sync
    }

    private void handleIncome(Context ctx, Map<String, String> d) {
        String entry = d.get("entryId");
        if (entry == null) return;
        if (!PushManager.markSeen(ctx, "income:" + entry)) return;
        if (!PushManager.localPref(ctx, "incomePush", true)) return;

        boolean hide = PushManager.localPref(ctx, "hideSensitive", false);
        String title = nonEmpty(d.get("title"), ctx.getString(R.string.push_income_title));
        String body = hide ? ctx.getString(R.string.push_income_generic) : nonEmpty(d.get("body"), ctx.getString(R.string.push_income_generic));

        Intent open = new Intent(ctx, MainActivity.class)
                .setAction("cube.Finance.OPEN_INCOME." + entry)
                .putExtra(EXTRA_TYPE, "income")
                .putExtra(EXTRA_UID, d.get("uid"))
                .putExtra(EXTRA_ENTRY, entry);
        post(ctx, PushManager.CHANNEL_INCOME, PushManager.TAG_INCOME, "income_" + entry, title, body,
                ctx.getString(R.string.push_income_generic), open, NotificationCompat.CATEGORY_STATUS);
        forward("income", d);
    }

    private static void forward(String type, Map<String, String> d) {
        PushManager.ForegroundListener l = PushManager.foregroundListener();
        if (l != null) l.onForegroundPush(type, new JSONObject(d));
    }

    private static void post(Context ctx, String channel, String tag, String id, String title, String body,
                             String publicBody, Intent open, String category) {
        PushManager.ensureChannels(ctx);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id.hashCode(), open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // What the lock screen shows when "hide sensitive notification content"
        // is on at the system level: never the amount or the reply.
        NotificationCompat.Builder publicVersion = new NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(publicBody);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setCategory(category)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion.build())
                .setContentIntent(pi)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(ctx).notify(tag, id.hashCode(), b.build());
        } catch (SecurityException ignored) {
            // Permission denied: nothing is shown, and nothing else breaks —
            // the reply is in the chat and the income is in the ledger.
        }
    }

    private static String nonEmpty(String v, String fallback) {
        return v == null || v.trim().isEmpty() ? fallback : v;
    }
}
