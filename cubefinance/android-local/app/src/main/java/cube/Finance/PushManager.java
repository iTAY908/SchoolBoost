package cube.Finance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException;
import com.google.firebase.auth.FirebaseAuthInvalidUserException;
import com.google.firebase.auth.FirebaseAuthUserCollisionException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.functions.FirebaseFunctions;
import com.google.firebase.functions.FirebaseFunctionsException;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Server push for the two backend notifications (AI chat reply, monthly
 * income). Owns three things the web layer cannot do itself:
 *
 *  - the server identity: a Firebase Auth account with the same email and
 *    password as the app account, signed in when the user logs in, signed out
 *    on logout, so notifications always belong to the account on screen;
 *  - this install's FCM token, registered under that account and refreshed
 *    by CubeMessagingService.onNewToken;
 *  - the callable functions in firebase/functions — the only way the app
 *    talks to the backend (Firestore itself is closed to clients).
 *
 * Everything is inert while BuildConfig.PUSH_ENABLED is false.
 */
public final class PushManager {

    private static final String TAG = "CubeyPush";
    private static final String PREFS = "cubefinance_push";
    private static final String KEY_INSTALL_ID = "install_id";
    private static final String KEY_SEEN = "seen_ids";
    private static final String KEY_LOCAL_PREFS = "local_prefs";
    private static final String KEY_PERMISSION_ASKED = "permission_asked";
    private static final int SEEN_MAX = 200;

    static final String CHANNEL_CHAT = "chat_replies";
    static final String CHANNEL_INCOME = "income_updates";
    static final String TAG_CHAT = "push_chat";
    static final String TAG_INCOME = "push_income";

    /** Only these functions can be reached from the web layer. */
    private static final Set<String> CALLABLE = new HashSet<>(Arrays.asList(
            "chatSend", "chatGet", "chatDeleteConversation", "incomeSetSchedule", "incomeSync", "setPrefs",
            "deleteAccountData"));

    /** The page asks; the answer comes back through one of these. */
    interface Callback { void done(boolean ok, String json, String error); }

    /** Lets the service hand a push to the open app instead of the shade. */
    interface ForegroundListener { void onForegroundPush(String type, JSONObject data); }

    private static volatile boolean foreground = false;
    private static volatile String activeConversation = null;
    private static volatile ForegroundListener foregroundListener = null;
    private static volatile String pendingTarget = null;

    private PushManager() { }

    // ---- availability ---------------------------------------------------------

    static boolean isEnabled(Context ctx) {
        return BuildConfig.PUSH_ENABLED && !FirebaseApp.getApps(ctx).isEmpty();
    }

    private static FirebaseFunctions functions() {
        return FirebaseFunctions.getInstance(BuildConfig.FUNCTIONS_REGION);
    }

    static String installId(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String id = p.getString(KEY_INSTALL_ID, null);
        if (id == null) {
            id = UUID.randomUUID().toString().replace("-", "");
            p.edit().putString(KEY_INSTALL_ID, id).apply();
        }
        return id;
    }

    static String currentUid() {
        FirebaseUser u = FirebaseAuth.getInstance().getCurrentUser();
        return u == null ? null : u.getUid();
    }

    // ---- account link -----------------------------------------------------------

    /**
     * Tie this install to the server account for `email`. With a password
     * (a fresh login, sign-up or password reset) it signs in, creating the
     * server account the first time. Without one (a remembered session) it
     * reuses the Firebase session only if it belongs to the same email.
     * Result json: {"uid":..., "prefs":{...}} or error code:
     *   needs_password | password_mismatch | network | disabled | failed
     */
    static void link(Context ctx, String email, String password, Callback cb) {
        if (!isEnabled(ctx)) { cb.done(false, null, "disabled"); return; }
        if (email == null || email.trim().isEmpty()) { cb.done(false, null, "failed"); return; }
        final String mail = email.trim().toLowerCase();
        FirebaseAuth auth = FirebaseAuth.getInstance();
        FirebaseUser u = auth.getCurrentUser();
        if (u != null && mail.equalsIgnoreCase(u.getEmail())) { registerToken(ctx, u, cb); return; }
        if (u != null) auth.signOut();   // a different account's session must not linger
        if (password == null || password.isEmpty()) { cb.done(false, null, "needs_password"); return; }

        auth.signInWithEmailAndPassword(mail, password).addOnCompleteListener(t -> {
            if (t.isSuccessful() && t.getResult().getUser() != null) { registerToken(ctx, t.getResult().getUser(), cb); return; }
            Exception e = t.getException();
            // With email-enumeration protection (the default), a missing
            // account and a wrong password look the same, so try to create it.
            if (e instanceof FirebaseAuthInvalidUserException || e instanceof FirebaseAuthInvalidCredentialsException) {
                auth.createUserWithEmailAndPassword(mail, password).addOnCompleteListener(c -> {
                    if (c.isSuccessful() && c.getResult().getUser() != null) { registerToken(ctx, c.getResult().getUser(), cb); return; }
                    Exception ce = c.getException();
                    Log.w(TAG, "create failed: " + ce);
                    // The server account exists with another password — e.g.
                    // the password was reset inside the app after linking.
                    cb.done(false, null, ce instanceof FirebaseAuthUserCollisionException ? "password_mismatch" : errorCode(ce));
                });
                return;
            }
            Log.w(TAG, "sign-in failed: " + e);
            cb.done(false, null, errorCode(e));
        });
    }

    private static void registerToken(Context ctx, FirebaseUser user, Callback cb) {
        ensureChannels(ctx);
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
            if (!t.isSuccessful() || t.getResult() == null) {
                Log.w(TAG, "no FCM token: " + t.getException());
                cb.done(false, null, "no_token");
                return;
            }
            Map<String, Object> args = new HashMap<>();
            args.put("installId", installId(ctx));
            args.put("token", t.getResult());
            functions().getHttpsCallable("registerDevice").call(args).addOnCompleteListener(r -> {
                if (!r.isSuccessful()) { cb.done(false, null, errorCode(r.getException())); return; }
                try {
                    JSONObject out = new JSONObject();
                    out.put("uid", user.getUid());
                    Object data = r.getResult().getData();
                    if (data instanceof Map) {
                        Object p = ((Map<?, ?>) data).get("prefs");
                        if (p != null) {
                            JSONObject prefs = (JSONObject) JSONObject.wrap(p);
                            out.put("prefs", prefs);
                            setLocalPrefs(ctx, prefs.toString());
                        }
                    }
                    cb.done(true, out.toString(), null);
                } catch (JSONException e) {
                    cb.done(false, null, "failed");
                }
            });
        });
    }

    /** Called by CubeMessagingService when FCM rotates this install's token. */
    static void onNewToken(Context ctx, String token) {
        if (!isEnabled(ctx)) return;
        FirebaseUser u = FirebaseAuth.getInstance().getCurrentUser();
        if (u == null) return;   // not linked — the next login registers it
        Map<String, Object> args = new HashMap<>();
        args.put("installId", installId(ctx));
        args.put("token", token);
        functions().getHttpsCallable("registerDevice").call(args)
                .addOnFailureListener(e -> Log.w(TAG, "token refresh not registered: " + e));
    }

    /**
     * Logout: unregister this install, drop the FCM token and the server
     * session, and clear the account's notifications from the shade — so the
     * next account on this phone never receives (or sees) the previous one's.
     */
    static void unlink(Context ctx, Runnable done) {
        cancelAll(ctx);
        pendingTarget = null;
        activeConversation = null;
        if (!isEnabled(ctx) || FirebaseAuth.getInstance().getCurrentUser() == null) { if (done != null) done.run(); return; }
        Map<String, Object> args = new HashMap<>();
        args.put("installId", installId(ctx));
        functions().getHttpsCallable("unregisterDevice").call(args).addOnCompleteListener(r -> {
            // Even if the server could not be reached, deleting the token makes
            // the old registration dead: FCM rejects it and the server prunes it.
            FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(d -> {
                FirebaseAuth.getInstance().signOut();
                if (done != null) done.run();
            });
        });
    }

    /** Server password out of sync after an in-app reset: Firebase mails a reset link. */
    static void sendServerPasswordReset(Context ctx, String email, Callback cb) {
        if (!isEnabled(ctx) || email == null) { cb.done(false, null, "disabled"); return; }
        FirebaseAuth.getInstance().sendPasswordResetEmail(email.trim().toLowerCase())
                .addOnCompleteListener(t -> cb.done(t.isSuccessful(), "{}", t.isSuccessful() ? null : errorCode(t.getException())));
    }

    // ---- purchase verification (AI Premium) ---------------------------------------

    /**
     * Server check of a Play purchase (Play Developer API, in
     * firebase/functions). done(null, ...) = can't tell right now: backend
     * off, server account not signed in as this email, network, or the Play
     * API not set up yet — the caller then keeps Play's own answer.
     */
    static void verifyPurchase(Context ctx, String productId, String token, String email,
                               EntitlementManager.VerifyCallback done) {
        if (!isEnabled(ctx)) { done.done(null, "disabled"); return; }
        FirebaseUser u = FirebaseAuth.getInstance().getCurrentUser();
        if (u == null || u.getEmail() == null || !u.getEmail().equalsIgnoreCase(email)) { done.done(null, "not_linked"); return; }
        Map<String, Object> args = new HashMap<>();
        args.put("productId", productId);
        args.put("purchaseToken", token);
        functions().getHttpsCallable("verifyPlayPurchase").call(args).addOnCompleteListener(t -> {
            if (!t.isSuccessful()) {
                Log.w(TAG, "verifyPlayPurchase: " + errorCode(t.getException()));
                done.done(null, errorCode(t.getException()));
                return;
            }
            Object data = t.getResult().getData();
            if (!(data instanceof Map)) { done.done(null, "bad_response"); return; }
            Object valid = ((Map<?, ?>) data).get("valid");
            Object state = ((Map<?, ?>) data).get("state");
            done.done(valid instanceof Boolean ? (Boolean) valid : null, state == null ? null : state.toString());
        });
    }

    // ---- callable functions -------------------------------------------------------

    static void call(Context ctx, String name, String jsonArgs, Callback cb) {
        if (!isEnabled(ctx)) { cb.done(false, null, "disabled"); return; }
        if (!CALLABLE.contains(name)) { cb.done(false, null, "forbidden"); return; }
        if (FirebaseAuth.getInstance().getCurrentUser() == null) { cb.done(false, null, "not_linked"); return; }
        Object args;
        try {
            args = jsonArgs == null || jsonArgs.isEmpty() ? new HashMap<String, Object>() : toJava(new JSONObject(jsonArgs));
        } catch (JSONException e) {
            cb.done(false, null, "bad_json");
            return;
        }
        functions().getHttpsCallable(name).call(args).addOnCompleteListener(t -> {
            if (!t.isSuccessful()) { cb.done(false, null, errorCode(t.getException())); return; }
            Object data = t.getResult().getData();
            Object wrapped = JSONObject.wrap(data);
            String json = wrapped == null ? "null"
                    : wrapped instanceof String ? JSONObject.quote((String) wrapped) : wrapped.toString();
            cb.done(true, json, null);
        });
    }

    private static Object toJava(Object v) throws JSONException {
        if (v instanceof JSONObject) {
            JSONObject o = (JSONObject) v;
            Map<String, Object> m = new HashMap<>();
            Iterator<String> it = o.keys();
            while (it.hasNext()) { String k = it.next(); m.put(k, toJava(o.get(k))); }
            return m;
        }
        if (v instanceof JSONArray) {
            JSONArray a = (JSONArray) v;
            List<Object> l = new ArrayList<>();
            for (int i = 0; i < a.length(); i++) l.add(toJava(a.get(i)));
            return l;
        }
        return v == JSONObject.NULL ? null : v;
    }

    private static String errorCode(Exception e) {
        if (e instanceof FirebaseFunctionsException) {
            FirebaseFunctionsException.Code c = ((FirebaseFunctionsException) e).getCode();
            switch (c) {
                case UNAVAILABLE: case DEADLINE_EXCEEDED: return "network";
                case RESOURCE_EXHAUSTED: return "quota";
                case UNAUTHENTICATED: return "not_linked";
                case INVALID_ARGUMENT: return "invalid";
                default: return "server";
            }
        }
        if (e instanceof com.google.firebase.FirebaseNetworkException) return "network";
        return "failed";
    }

    // ---- what the user is looking at ---------------------------------------------

    static void setForeground(boolean fg, ForegroundListener listener) {
        foreground = fg;
        foregroundListener = fg ? listener : null;
    }

    static void setActiveConversation(String conversationId) {
        activeConversation = conversationId == null || conversationId.isEmpty() ? null : conversationId;
    }

    /** True while the app is on screen with exactly this conversation open. */
    static boolean isViewing(String conversationId) {
        return foreground && conversationId != null && conversationId.equals(activeConversation);
    }

    static ForegroundListener foregroundListener() { return foreground ? foregroundListener : null; }

    // ---- notification taps -----------------------------------------------------------

    static void setPendingTarget(String json) { pendingTarget = json; }

    /** Hands the tapped notification's target to the page exactly once. */
    static String consumePendingTarget() {
        String t = pendingTarget;
        pendingTarget = null;
        return t;
    }

    // ---- local mirror of the settings (read by the service when the app is closed) ----

    static void setLocalPrefs(Context ctx, String json) {
        prefs(ctx).edit().putString(KEY_LOCAL_PREFS, json).apply();
    }

    static boolean localPref(Context ctx, String key, boolean dflt) {
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY_LOCAL_PREFS, "{}"));
            return o.optBoolean(key, dflt);
        } catch (JSONException e) {
            return dflt;
        }
    }

    // ---- de-duplication ----------------------------------------------------------------

    /**
     * Remembers the last SEEN_MAX notification ids. Returns false when `id`
     * was already shown — a redelivered or retried push is then dropped.
     */
    static synchronized boolean markSeen(Context ctx, String id) {
        SharedPreferences p = prefs(ctx);
        LinkedList<String> seen = new LinkedList<>(Arrays.asList(p.getString(KEY_SEEN, "").split("\n")));
        seen.remove("");
        if (seen.contains(id)) return false;
        seen.addLast(id);
        while (seen.size() > SEEN_MAX) seen.removeFirst();
        p.edit().putString(KEY_SEEN, String.join("\n", seen)).apply();
        return true;
    }

    // ---- permission bookkeeping -----------------------------------------------------------

    static void markPermissionAsked(Context ctx) { prefs(ctx).edit().putBoolean(KEY_PERMISSION_ASKED, true).apply(); }
    static boolean wasPermissionAsked(Context ctx) { return prefs(ctx).getBoolean(KEY_PERMISSION_ASKED, false); }

    // ---- channels / shade --------------------------------------------------------------------

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel chat = new NotificationChannel(CHANNEL_CHAT,
                ctx.getString(R.string.channel_chat_name), NotificationManager.IMPORTANCE_HIGH);
        chat.setDescription(ctx.getString(R.string.channel_chat_description));
        nm.createNotificationChannel(chat);
        NotificationChannel income = new NotificationChannel(CHANNEL_INCOME,
                ctx.getString(R.string.channel_income_name), NotificationManager.IMPORTANCE_HIGH);
        income.setDescription(ctx.getString(R.string.channel_income_description));
        nm.createNotificationChannel(income);
    }

    /** Clears this app's server notifications (chat + income) from the shade. */
    static void cancelAll(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        for (StatusBarNotification n : nm.getActiveNotifications()) {
            if (TAG_CHAT.equals(n.getTag()) || TAG_INCOME.equals(n.getTag())) nm.cancel(n.getTag(), n.getId());
        }
    }

    static void cancelTag(Context ctx, String tag) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        for (StatusBarNotification n : nm.getActiveNotifications()) {
            if (tag.equals(n.getTag())) nm.cancel(n.getTag(), n.getId());
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
