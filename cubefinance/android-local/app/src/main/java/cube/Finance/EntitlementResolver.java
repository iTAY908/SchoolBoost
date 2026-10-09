package cube.Finance;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Who gets AI Premium (AI chat + no ads) right now — pure logic, no Android,
 * so every case is unit-tested (EntitlementResolverTest).
 *
 * Inputs come from three places:
 *  - Google Play (BillingManager): the account's purchases of the Premium
 *    product, each with its state and the app account it was bought for
 *    (obfuscatedAccountId; absent on purchases made before this update);
 *  - the page: which app account is signed in (or nobody);
 *  - the server (optional): a verdict per purchase from the Play Developer API.
 *
 * The rule: a PURCHASED (never pending/cancelled) Premium purchase that
 * belongs to the signed-in app account, and that the server has not rejected.
 * The local cache only keeps ads hidden for a known purchaser while Play is
 * being asked — it never unlocks anything on its own beyond that.
 */
final class EntitlementResolver {

    static final int STATE_OTHER = 0;
    static final int STATE_PURCHASED = 1;
    static final int STATE_PENDING = 2;

    /** How long a confirmed entitlement may stand in when Play can't be reached at all. */
    static final long CACHE_MAX_MS = 30L * 24 * 60 * 60 * 1000;

    enum Ads {
        /** Not decided yet: request nothing, show nothing. */
        PENDING,
        ALLOWED,
        SUPPRESSED
    }

    static final class Purchase {
        final String tokenHash;
        /** obfuscatedAccountId, or null for a purchase made before purchases carried it. */
        final String accountKey;
        final int state;

        Purchase(String tokenHash, String accountKey, int state) {
            this.tokenHash = tokenHash;
            this.accountKey = accountKey;
            this.state = state;
        }
    }

    static final class Input {
        /** The page has said who is signed in (false on a cold start until it does). */
        boolean accountKnown;
        /** Signed-in app account key, or null when nobody is signed in. */
        String account;
        /** Play has answered the purchase query at least once this session. */
        boolean playKnown;
        List<Purchase> purchases = new ArrayList<>();
        /** Pre-update purchases already assigned to an app account on this device. */
        Map<String, String> legacyOwners = new HashMap<>();
        /** Server verdict per purchase; absent when not checked or the server can't tell. */
        Map<String, Boolean> serverValid = new HashMap<>();
        /** May an unassigned pre-update purchase go to this account? */
        boolean legacyClaimAllowed;
        /** Last account confirmed entitled on this device, and when. */
        String cachedAccount;
        long cachedAt;
        /**
         * The account the BACKEND confirmed as complimentary (creator access),
         * for the verified email in its session — and when it last said so.
         */
        String complimentaryAccount;
        long complimentaryAt;
        long now;
        /** The startup wait is over: stop holding ads for non-purchasers. */
        boolean timedOut;
    }

    static final class Result {
        /** null = unknown (leave the page's state alone). */
        Boolean entitled;
        Ads ads;
        String tokenHash;
        /** complimentary | play | server | cache | none | pending | other_account | server_rejected | signed_out | account_unknown | play_unknown */
        String reason;
        /** Pre-update purchases assigned to the signed-in account by this call. */
        final Map<String, String> newLegacyOwners = new HashMap<>();
    }

    private EntitlementResolver() { }

    static Result resolve(Input in) {
        Result r = new Result();
        boolean cacheFresh = in.cachedAccount != null && in.now - in.cachedAt <= CACHE_MAX_MS;
        boolean complFresh = in.complimentaryAccount != null && in.now - in.complimentaryAt <= CACHE_MAX_MS;

        if (!in.accountKnown) {
            // Cold start, before the page reports the account: a device whose
            // last account was a confirmed purchaser (or creator) shows no ads meanwhile.
            r.reason = "account_unknown";
            r.ads = cacheFresh || complFresh ? Ads.SUPPRESSED : (in.timedOut ? Ads.ALLOWED : Ads.PENDING);
            return r;
        }
        if (in.account == null) {
            r.entitled = false;
            r.reason = "signed_out";
            r.ads = Ads.ALLOWED;
            return r;
        }
        // Complimentary (creator) access comes first: no purchase check —
        // Play, a refund, the server's purchase verdict — can take it away.
        // Only for the account the backend confirmed; never for another one.
        if (complFresh && in.account.equals(in.complimentaryAccount)) {
            r.entitled = true;
            r.reason = "complimentary";
            r.ads = Ads.SUPPRESSED;
            return r;
        }
        if (!in.playKnown) {
            if (cacheFresh && in.account.equals(in.cachedAccount)) {
                r.entitled = true;
                r.reason = "cache";
                r.ads = Ads.SUPPRESSED;
            } else {
                r.reason = "play_unknown";
                r.ads = in.timedOut ? Ads.ALLOWED : Ads.PENDING;
            }
            return r;
        }

        boolean pending = false, other = false, rejected = false;
        for (Purchase p : in.purchases) {
            String owner = p.accountKey != null ? p.accountKey : in.legacyOwners.get(p.tokenHash);
            if (owner == null && p.state == STATE_PURCHASED && in.legacyClaimAllowed) {
                owner = in.account;
                r.newLegacyOwners.put(p.tokenHash, owner);
            }
            if (!in.account.equals(owner)) {
                if (p.state == STATE_PURCHASED) other = true;
                continue;
            }
            if (p.state == STATE_PENDING) { pending = true; continue; }
            if (p.state != STATE_PURCHASED) continue;
            Boolean server = in.serverValid.get(p.tokenHash);
            if (Boolean.FALSE.equals(server)) { rejected = true; continue; }
            r.entitled = true;
            r.tokenHash = p.tokenHash;
            r.reason = server == null ? "play" : "server";
            r.ads = Ads.SUPPRESSED;
            return r;
        }
        r.entitled = false;
        r.ads = Ads.ALLOWED;
        r.reason = rejected ? "server_rejected" : pending ? "pending" : other ? "other_account" : "none";
        return r;
    }
}
