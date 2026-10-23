package cube.Finance;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;

import cube.Finance.EntitlementResolver.Ads;
import cube.Finance.EntitlementResolver.Input;
import cube.Finance.EntitlementResolver.Purchase;
import cube.Finance.EntitlementResolver.Result;

public class EntitlementResolverTest {

    private static final String A = EntitlementManager.accountKey("a@example.com");
    private static final String B = EntitlementManager.accountKey("b@example.com");
    private static final long NOW = 1_800_000_000_000L;

    private static Input signedIn(String account, Purchase... purchases) {
        Input in = new Input();
        in.accountKnown = true;
        in.account = account;
        in.playKnown = true;
        in.purchases = Arrays.asList(purchases);
        in.now = NOW;
        return in;
    }

    private static Purchase bought(String hash, String account) {
        return new Purchase(hash, account, EntitlementResolver.STATE_PURCHASED);
    }

    // ---- purchases -----------------------------------------------------------

    @Test public void successfulPurchaseForThisAccount_unlocksAndRemovesAds() {
        Result r = EntitlementResolver.resolve(signedIn(A, bought("t1", A)));
        assertEquals(Boolean.TRUE, r.entitled);
        assertEquals(Ads.SUPPRESSED, r.ads);
        assertEquals("play", r.reason);
        assertEquals("t1", r.tokenHash);
    }

    @Test public void pendingPurchase_grantsNothing() {
        Result r = EntitlementResolver.resolve(signedIn(A, new Purchase("t1", A, EntitlementResolver.STATE_PENDING)));
        assertEquals(Boolean.FALSE, r.entitled);
        assertEquals(Ads.ALLOWED, r.ads);
        assertEquals("pending", r.reason);
    }

    @Test public void failedOrCancelledPurchase_grantsNothing() {
        Result none = EntitlementResolver.resolve(signedIn(A));
        assertEquals(Boolean.FALSE, none.entitled);
        assertEquals(Ads.ALLOWED, none.ads);
        Result other = EntitlementResolver.resolve(signedIn(A, new Purchase("t1", A, EntitlementResolver.STATE_OTHER)));
        assertEquals(Boolean.FALSE, other.entitled);
        assertEquals(Ads.ALLOWED, other.ads);
    }

    @Test public void nonPurchaser_keepsSeeingAds() {
        Result r = EntitlementResolver.resolve(signedIn(B));
        assertEquals(Ads.ALLOWED, r.ads);
        assertEquals("none", r.reason);
    }

    // ---- accounts --------------------------------------------------------------

    @Test public void anotherAppAccountOnTheSamePhone_doesNotInherit() {
        Result r = EntitlementResolver.resolve(signedIn(B, bought("t1", A)));
        assertEquals(Boolean.FALSE, r.entitled);
        assertEquals(Ads.ALLOWED, r.ads);
        assertEquals("other_account", r.reason);
    }

    @Test public void signedOut_noEntitlementForAnyone() {
        Input in = signedIn(null, bought("t1", A));
        Result r = EntitlementResolver.resolve(in);
        assertEquals(Boolean.FALSE, r.entitled);
        assertEquals(Ads.ALLOWED, r.ads);
    }

    @Test public void restoreOnNewDeviceOrReinstall_followsTheAppAccount() {
        // Fresh install: no cache, no local assignments — the account recorded
        // on the purchase is enough.
        Result r = EntitlementResolver.resolve(signedIn(A, bought("t1", A)));
        assertEquals(Boolean.TRUE, r.entitled);
    }

    // ---- purchases from before this update (no account recorded on them) -------

    @Test public void existingPurchaser_isAssignedTheirPurchaseRetroactively() {
        Input in = signedIn(A, bought("old", null));
        in.legacyClaimAllowed = true;   // this account had Premium on this phone
        Result r = EntitlementResolver.resolve(in);
        assertEquals(Boolean.TRUE, r.entitled);
        assertEquals(Ads.SUPPRESSED, r.ads);
        assertEquals(A, r.newLegacyOwners.get("old"));

        // once assigned, a different account on the phone does not get it
        Input other = signedIn(B, bought("old", null));
        other.legacyOwners.put("old", A);
        other.legacyClaimAllowed = true;
        Result r2 = EntitlementResolver.resolve(other);
        assertEquals(Boolean.FALSE, r2.entitled);
        assertTrue(r2.newLegacyOwners.isEmpty());
    }

    @Test public void oldPurchase_notClaimedByAnAccountThatNeverHadIt_whenAnotherOneDid() {
        Input in = signedIn(B, bought("old", null));
        in.legacyClaimAllowed = false;   // some other local account had Premium
        Result r = EntitlementResolver.resolve(in);
        assertEquals(Boolean.FALSE, r.entitled);
        assertTrue(r.newLegacyOwners.isEmpty());
    }

    // ---- server + refunds ---------------------------------------------------------

    @Test public void serverConfirmation_keepsIt_serverRejection_removesIt() {
        Input in = signedIn(A, bought("t1", A));
        in.serverValid.put("t1", true);
        assertEquals("server", EntitlementResolver.resolve(in).reason);
        in.serverValid.put("t1", false);   // refunded / revoked / bound to another account
        Result r = EntitlementResolver.resolve(in);
        assertEquals(Boolean.FALSE, r.entitled);
        assertEquals(Ads.ALLOWED, r.ads);
        assertEquals("server_rejected", r.reason);
    }

    @Test public void refundedPurchase_disappearsFromPlay_andTheEntitlementGoes() {
        Input in = signedIn(A, bought("t1", A));
        assertEquals(Boolean.TRUE, EntitlementResolver.resolve(in).entitled);
        in.purchases = Collections.emptyList();   // Play no longer lists it
        Result r = EntitlementResolver.resolve(in);
        assertEquals(Boolean.FALSE, r.entitled);
        assertEquals(Ads.ALLOWED, r.ads);
    }

    // ---- startup / restart ----------------------------------------------------------

    @Test public void restart_knownPurchaser_noAdsWhileStillChecking() {
        Input in = new Input();
        in.now = NOW;
        in.cachedAccount = A;
        in.cachedAt = NOW - 60_000;
        Result r = EntitlementResolver.resolve(in);   // page hasn't reported the account, Play hasn't answered
        assertEquals(Ads.SUPPRESSED, r.ads);
        assertNull(r.entitled);
        in.timedOut = true;
        assertEquals(Ads.SUPPRESSED, EntitlementResolver.resolve(in).ads);
    }

    @Test public void restart_unknownUser_adsHeldBrieflyThenAllowed() {
        Input in = new Input();
        in.now = NOW;
        assertEquals(Ads.PENDING, EntitlementResolver.resolve(in).ads);
        in.timedOut = true;
        assertEquals(Ads.ALLOWED, EntitlementResolver.resolve(in).ads);
    }

    @Test public void playUnreachable_cacheCoversOnlyTheSameAccount_andExpires() {
        Input in = new Input();
        in.accountKnown = true;
        in.account = A;
        in.now = NOW;
        in.cachedAccount = A;
        in.cachedAt = NOW - 1000;
        Result r = EntitlementResolver.resolve(in);
        assertEquals(Boolean.TRUE, r.entitled);
        assertEquals("cache", r.reason);

        in.account = B;
        Result rb = EntitlementResolver.resolve(in);
        assertNull(rb.entitled);
        assertEquals(Ads.PENDING, rb.ads);

        in.account = A;
        in.cachedAt = NOW - EntitlementResolver.CACHE_MAX_MS - 1;
        in.timedOut = true;
        Result old = EntitlementResolver.resolve(in);
        assertNull(old.entitled);
        assertEquals(Ads.ALLOWED, old.ads);
    }

    // ---- identity --------------------------------------------------------------------

    @Test public void accountKey_matchesTheServerFormula_andHasNoPersonalData() {
        // value from firebase/functions: accountKeyForEmail("Tester@Example.com ")
        assertEquals("ebb7a67a60c68ac77b645e0b3f468ff1f22b9034cc093b31ea12b50682745e94",
                EntitlementManager.accountKey("Tester@Example.com "));
        assertEquals(64, A.length());   // Play's obfuscatedAccountId limit is 64
        assertFalse(A.contains("example"));
    }

    // ---- complimentary (creator) access -------------------------------------------------

    private static Input creator(String account) {
        Input in = signedIn(account);
        in.complimentaryAccount = A;
        in.complimentaryAt = NOW - 1000;
        return in;
    }

    @Test public void complimentary_unlocksAndRemovesAds_withoutAnyPurchase() {
        Result r = EntitlementResolver.resolve(creator(A));
        assertEquals(Boolean.TRUE, r.entitled);
        assertEquals(Ads.SUPPRESSED, r.ads);
        assertEquals("complimentary", r.reason);
    }

    @Test public void complimentary_cannotBeRevokedByPurchaseChecks() {
        Input in = creator(A);
        in.purchases = Arrays.asList(bought("t1", A));
        in.serverValid.put("t1", false);                       // the server rejected a purchase
        assertEquals("complimentary", EntitlementResolver.resolve(in).reason);
        in.purchases = Collections.emptyList();                // refunded / nothing in Play
        assertEquals(Boolean.TRUE, EntitlementResolver.resolve(in).entitled);
        in.playKnown = false;                                  // Play unreachable
        assertEquals(Boolean.TRUE, EntitlementResolver.resolve(in).entitled);
    }

    @Test public void complimentary_neverTransfersToAnotherAccountOrToNobody() {
        Result other = EntitlementResolver.resolve(creator(B));
        assertEquals(Boolean.FALSE, other.entitled);
        assertEquals(Ads.ALLOWED, other.ads);
        Result signedOut = EntitlementResolver.resolve(creator(null));
        assertEquals(Boolean.FALSE, signedOut.entitled);
        assertEquals(Ads.ALLOWED, signedOut.ads);
    }

    @Test public void complimentary_restart_noAdsWhileStartingUp() {
        Input in = new Input();
        in.now = NOW;
        in.complimentaryAccount = A;
        in.complimentaryAt = NOW - 1000;
        assertEquals(Ads.SUPPRESSED, EntitlementResolver.resolve(in).ads);
    }

    @Test public void complimentary_cacheExpires_withoutAFreshServerAnswer() {
        Input in = creator(A);
        in.complimentaryAt = NOW - EntitlementResolver.CACHE_MAX_MS - 1;
        assertEquals("none", EntitlementResolver.resolve(in).reason);
    }

    @Test public void serverAnswer_parsing_takesTheEmailFromTheServer() {
        EntitlementManager.Verdict v = EntitlementManager.parseEntitlements(
                "{\"ok\":true,\"email\":\"itayleiss2010@gmail.com\",\"complimentary\":true}");
        assertEquals(EntitlementManager.accountKey("itayleiss2010@gmail.com"), v.accountKey);
        assertTrue(v.complimentary);
        assertEquals(false, EntitlementManager.parseEntitlements("{\"ok\":true,\"email\":\"x@y.com\",\"complimentary\":false}").complimentary);
        assertNull(EntitlementManager.parseEntitlements("{\"ok\":false,\"error\":\"not_signed_in\"}"));
        assertNull(EntitlementManager.parseEntitlements("{\"code\":\"PGRST202\"}"));
        assertNull(EntitlementManager.parseEntitlements("not json"));
        assertNull(EntitlementManager.parseEntitlements(null));
    }
}
