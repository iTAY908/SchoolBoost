package cube.Finance;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AccountIdentifiers;
import com.android.billingclient.api.Purchase;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The single owner of the AI Premium entitlement (AI chat + ad removal) and of
 * the ad gate. Lives in CubeApp so the App Open ad — which can fire before any
 * Activity exists — is gated from the very first frame.
 *
 * It collects the inputs (Play purchases, the signed-in app account, server
 * verdicts), runs EntitlementResolver on every change, persists what has to
 * survive a restart, and tells two kinds of listeners:
 *  - ad surfaces: allowed or not (PENDING counts as not — nothing is
 *    requested or shown while a purchaser might be waiting on the answer);
 *  - the page: is the signed-in account entitled, and why.
 */
final class EntitlementManager {

    private static final String TAG = "CubeyBilling";
    private static final String PREFS = "cubefinance_entitlement";
    private static final String KEY_CACHED_ACCOUNT = "cached_account";
    private static final String KEY_CACHED_AT = "cached_at";
    private static final String KEY_LEGACY_PREFIX = "legacy_";
    private static final String KEY_COMPL_ACCOUNT = "compl_account";
    private static final String KEY_COMPL_AT = "compl_at";
    private final java.util.concurrent.ExecutorService net = java.util.concurrent.Executors.newSingleThreadExecutor();
    /** Non-purchasers see ads again at most this long after launch, if Play is slow. */
    static final long STARTUP_WAIT_MS = 6_000;

    interface AdsListener { void onAdsAllowed(boolean allowed); }

    interface EntitlementListener {
        /** email of the account this verdict is for; entitled null = unknown. */
        void onEntitlement(@Nullable String email, @Nullable Boolean entitled, @NonNull String reason);
    }

    /** Server check of one purchase token; done(null) = can't tell right now. */
    interface ServerVerifier {
        void verify(@NonNull String purchaseToken, @NonNull String email, @NonNull VerifyCallback done);
    }
    interface VerifyCallback { void done(@Nullable Boolean valid, @Nullable String state); }

    private final SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<AdsListener> adsListeners = new CopyOnWriteArrayList<>();
    @Nullable private EntitlementListener listener;
    @Nullable private ServerVerifier verifier;
    @Nullable private Runnable recheckHook;

    private final EntitlementResolver.Input in = new EntitlementResolver.Input();
    private final Map<String, String> tokens = new HashMap<>();     // tokenHash -> raw token (memory only)
    private final Set<String> serverAsked = new HashSet<>();
    @Nullable private String email;
    private EntitlementResolver.Result last;
    private EntitlementResolver.Ads lastAds = null;
    private Boolean lastEntitled = null;
    private String lastReportKey = null;

    EntitlementManager(Context ctx) {
        prefs = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        in.cachedAccount = prefs.getString(KEY_CACHED_ACCOUNT, null);
        in.cachedAt = prefs.getLong(KEY_CACHED_AT, 0);
        in.complimentaryAccount = prefs.getString(KEY_COMPL_ACCOUNT, null);
        in.complimentaryAt = prefs.getLong(KEY_COMPL_AT, 0);
        for (Map.Entry<String, ?> e : prefs.getAll().entrySet()) {
            if (e.getKey().startsWith(KEY_LEGACY_PREFIX) && e.getValue() instanceof String) {
                in.legacyOwners.put(e.getKey().substring(KEY_LEGACY_PREFIX.length()), (String) e.getValue());
            }
        }
        recompute();
        main.postDelayed(() -> { in.timedOut = true; recompute(); }, STARTUP_WAIT_MS);
    }

    // ---- identity -------------------------------------------------------------------

    /** The value sent to Play as obfuscatedAccountId: SHA-256, no personal data. Same formula as the server. */
    static String accountKey(@NonNull String email) {
        return sha256("cubefinance:" + email.trim().toLowerCase());
    }

    static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder(64);
            for (byte x : d) b.append(String.format("%02x", x));
            return b.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Key for the signed-in account, or null (nobody signed in / not reported yet). */
    @Nullable String currentAccountKey() { return in.accountKnown ? in.account : null; }

    // ---- inputs -----------------------------------------------------------------------

    /**
     * From the page on login, session restore, account switch and logout
     * (email null). hadLocalPremium / anyLocalPremium let a purchase made
     * before this update find its owner: the account that already had Premium
     * on this device, or — on a fresh install — the first account to sign in.
     */
    void setAccount(@Nullable String newEmail, boolean hadLocalPremium, boolean anyLocalPremium) {
        main.post(() -> {
            String key = newEmail == null || newEmail.trim().isEmpty() ? null : accountKey(newEmail);
            boolean changed = !in.accountKnown || (key == null ? in.account != null : !key.equals(in.account));
            in.accountKnown = true;
            in.account = key;
            email = key == null ? null : newEmail.trim().toLowerCase();
            in.legacyClaimAllowed = hadLocalPremium || !anyLocalPremium;
            if (changed) { serverAsked.clear(); in.serverValid.clear(); lastReportKey = null; }
            if (key == null || (in.complimentaryAccount != null && !in.complimentaryAccount.equals(key))) clearComplimentary();
            recompute();
        });
    }

    /** Every Premium purchase Play reports for this Google account (purchased and pending). */
    void onPlayPurchases(@NonNull List<Purchase> purchases) {
        main.post(() -> {
            List<EntitlementResolver.Purchase> list = new ArrayList<>();
            for (Purchase p : purchases) {
                String th = sha256(p.getPurchaseToken());
                tokens.put(th, p.getPurchaseToken());
                AccountIdentifiers ids = p.getAccountIdentifiers();
                String acct = ids == null ? null : ids.getObfuscatedAccountId();
                int st = p.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? EntitlementResolver.STATE_PURCHASED
                        : p.getPurchaseState() == Purchase.PurchaseState.PENDING ? EntitlementResolver.STATE_PENDING
                        : EntitlementResolver.STATE_OTHER;
                list.add(new EntitlementResolver.Purchase(th, acct == null || acct.isEmpty() ? null : acct, st));
            }
            in.purchases = list;
            in.playKnown = true;
            recompute();
        });
    }

    // ---- complimentary (creator) access ----------------------------------------------
    //
    // Never decided here or by the page: the BACKEND says it, for the verified
    // email in a Supabase session (cf2_my_entitlements). The page hands over
    // the session's access token; this class makes the call itself and takes
    // the email from the server's answer, so a page cannot simply claim it.

    /** Ask the backend, with this account's Supabase access token. */
    void verifyComplimentary(@Nullable String accessToken) {
        if (accessToken == null || accessToken.isEmpty()) return;
        main.post(() -> askComplimentary(accessToken, in.account));   // read the account on the main thread
    }

    private void askComplimentary(String accessToken, @Nullable String forAccount) {
        if (forAccount == null) return;
        net.execute(() -> {
            String body = null;
            int code = 0;
            java.net.HttpURLConnection c = null;
            try {
                c = (java.net.HttpURLConnection) new java.net.URL(BuildConfig.SUPABASE_URL + "/rest/v1/rpc/cf2_my_entitlements").openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(10_000);
                c.setReadTimeout(10_000);
                c.setDoOutput(true);
                c.setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY);
                c.setRequestProperty("Authorization", "Bearer " + accessToken);
                c.setRequestProperty("Content-Type", "application/json");
                c.getOutputStream().write("{}".getBytes(StandardCharsets.UTF_8));
                code = c.getResponseCode();
                if (code == 200) {
                    java.io.InputStream is = c.getInputStream();
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                    byte[] buf = new byte[4096];
                    for (int n; (n = is.read(buf)) > 0; ) bo.write(buf, 0, n);
                    body = bo.toString("UTF-8");
                }
            } catch (Exception e) {
                Log.w(TAG, "complimentary check: no answer (" + e.getClass().getSimpleName() + ")");
            } finally {
                if (c != null) c.disconnect();
            }
            if (code != 200 && code != 0) Log.w(TAG, "complimentary check: HTTP " + code + " — nothing changed");
            final Verdict v = code == 200 ? parseEntitlements(body) : null;
            main.post(() -> applyComplimentary(v, forAccount));
        });
    }

    /** The server's answer: whose verified email, and is it complimentary. null = no usable answer. */
    static final class Verdict {
        final String accountKey; final boolean complimentary;
        Verdict(String accountKey, boolean complimentary) { this.accountKey = accountKey; this.complimentary = complimentary; }
    }

    @Nullable static Verdict parseEntitlements(@Nullable String json) {
        if (json == null) return null;
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            if (!o.optBoolean("ok", false)) return null;
            String email = o.optString("email", "");
            if (email.isEmpty()) return null;
            return new Verdict(accountKey(email), o.optBoolean("complimentary", false));
        } catch (Exception e) {
            return null;
        }
    }

    /** Apply only if the server's email is the account signed in now (and was when we asked). */
    void applyComplimentary(@Nullable Verdict v, @Nullable String askedFor) {
        if (v == null) return;                                   // offline / error: keep what we had
        if (in.account == null || !in.account.equals(askedFor) || !in.account.equals(v.accountKey)) {
            Log.w(TAG, "complimentary answer is for another account — ignored");
            return;
        }
        if (v.complimentary) {
            in.complimentaryAccount = v.accountKey;
            in.complimentaryAt = System.currentTimeMillis();
            prefs.edit().putString(KEY_COMPL_ACCOUNT, v.accountKey).putLong(KEY_COMPL_AT, in.complimentaryAt).apply();
            Log.i(TAG, "complimentary access confirmed by the server");
        } else if (v.accountKey.equals(in.complimentaryAccount)) {
            clearComplimentary();                                // removed on the server
        }
        recompute();
    }

    private void clearComplimentary() {
        if (in.complimentaryAccount == null && !prefs.contains(KEY_COMPL_ACCOUNT)) return;
        in.complimentaryAccount = null;
        in.complimentaryAt = 0;
        prefs.edit().remove(KEY_COMPL_ACCOUNT).remove(KEY_COMPL_AT).apply();
    }

    /** Server account now signed in (PushManager.link succeeded): verify what Play alone vouched for. */
    void onServerAvailable() {
        main.post(() -> { serverAsked.clear(); recompute(); });
    }

    /** A refund/revocation push arrived, or the user pressed "restore": ask everyone again. */
    void requestRecheck() {
        main.post(() -> {
            serverAsked.clear();
            in.serverValid.clear();
            if (recheckHook != null) recheckHook.run();
            recompute();
        });
    }

    void setRecheckHook(@Nullable Runnable hook) { recheckHook = hook; }
    void setServerVerifier(@Nullable ServerVerifier v) { verifier = v; }

    void setListener(@Nullable EntitlementListener l) {
        listener = l;
        lastReportKey = null;
        if (l != null) main.post(this::report);
    }

    void addAdsListener(AdsListener l) {
        adsListeners.add(l);
        l.onAdsAllowed(adsAllowed());
    }

    void removeAdsListener(AdsListener l) { adsListeners.remove(l); }

    // ---- outputs ------------------------------------------------------------------------

    /** Ads may be requested and shown. False while undecided and for entitled accounts. */
    boolean adsAllowed() { return lastAds == EntitlementResolver.Ads.ALLOWED; }

    /** The signed-in account owns a valid Premium purchase. */
    boolean isEntitled() { return Boolean.TRUE.equals(lastEntitled); }

    @Nullable String lastReason() { return last == null ? null : last.reason; }

    // ---- the work -----------------------------------------------------------------------

    private void recompute() {
        in.now = System.currentTimeMillis();
        EntitlementResolver.Result r = EntitlementResolver.resolve(in);
        last = r;

        if (!r.newLegacyOwners.isEmpty()) {
            SharedPreferences.Editor ed = prefs.edit();
            for (Map.Entry<String, String> e : r.newLegacyOwners.entrySet()) {
                in.legacyOwners.put(e.getKey(), e.getValue());
                ed.putString(KEY_LEGACY_PREFIX + e.getKey(), e.getValue());
                Log.i(TAG, "pre-update Premium purchase assigned to the signed-in app account");
            }
            ed.apply();
        }

        // Remember a confirmed purchaser so the next cold start hides ads at
        // once; forget it the moment Play/the server says otherwise.
        if (Boolean.TRUE.equals(r.entitled) && !"cache".equals(r.reason)) {
            in.cachedAccount = in.account;
            in.cachedAt = in.now;
            prefs.edit().putString(KEY_CACHED_ACCOUNT, in.account).putLong(KEY_CACHED_AT, in.now).apply();
        } else if (Boolean.FALSE.equals(r.entitled) && in.account != null && in.account.equals(in.cachedAccount)
                && !"signed_out".equals(r.reason)) {
            in.cachedAccount = null;
            prefs.edit().remove(KEY_CACHED_ACCOUNT).remove(KEY_CACHED_AT).apply();
        }

        if (r.ads != lastAds) {
            lastAds = r.ads;
            boolean allowed = r.ads == EntitlementResolver.Ads.ALLOWED;
            Log.i(TAG, "ads " + r.ads + " (" + r.reason + ")");
            for (AdsListener l : adsListeners) l.onAdsAllowed(allowed);
        }
        lastEntitled = r.entitled;
        report();
        maybeVerifyOnServer(r);
    }

    private void report() {
        if (listener == null || last == null || !in.accountKnown) return;
        String key = email + "|" + last.entitled + "|" + last.reason;
        if (key.equals(lastReportKey)) return;
        lastReportKey = key;
        listener.onEntitlement(email, last.entitled, last.reason);
    }

    /**
     * Play said PURCHASED for this account; where the backend is set up, have
     * the Play Developer API confirm it (and bind it to this account). The
     * entitlement stays on in the meantime — a "no" from the server takes it
     * away, "can't tell" leaves Play's answer standing.
     */
    private void maybeVerifyOnServer(EntitlementResolver.Result r) {
        if (verifier == null || email == null || r.tokenHash == null || !"play".equals(r.reason)) return;
        if (!serverAsked.add(r.tokenHash)) return;
        String token = tokens.get(r.tokenHash);
        if (token == null) return;
        final String th = r.tokenHash;
        final String forAccount = in.account;
        verifier.verify(token, email, (valid, state) -> main.post(() -> {
            if (forAccount == null || !forAccount.equals(in.account)) return;   // account switched meanwhile
            if (valid == null) { serverAsked.remove(th); return; }               // try again on the next trigger
            Log.i(TAG, "server verdict for Premium purchase: " + state);
            in.serverValid.put(th, valid);
            recompute();
        }));
    }
}
