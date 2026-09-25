package com.cubefinance.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Real Google Play Billing for every one-time product the app sells.
 *
 *   {@link #PRODUCT_PREMIUM} — the "AI Premium" unlock (removes ads, opens the
 *                              adviser and the AI allocation tools).
 *   {@link #PRODUCT_BOOK}    — the ₪19 guide book.
 *
 * Both are **non-consumable** in-app products: bought once, owned forever.
 * Create each in Play Console → Monetise → In-app products with exactly these
 * IDs and set the price there. The UI shows whatever Google reports, so a price
 * change in the console never needs a new build.
 *
 * Three rules this class exists to get right:
 *  1. A purchase MUST be acknowledged within 3 days or Google automatically
 *     refunds it and revokes the entitlement.
 *  2. Entitlement must be restored from Play on every launch — reinstalls and
 *     new devices have no local state, and refunds have to be picked up too.
 *  3. Never consume a non-consumable. Consuming would let it be bought again.
 */
final class BillingManager implements PurchasesUpdatedListener {

    /** One tag for the whole flow: `adb logcat -s CubeyBilling` shows everything. */
    private static final String TAG = "CubeyBilling";

    /**
     * Google returns integers. Reading "response 3" in a bug report tells you
     * nothing; "BILLING_UNAVAILABLE" tells you the Play Store account cannot
     * transact, which is a completely different fix from "ITEM_UNAVAILABLE".
     */
    static String responseName(int code) {
        switch (code) {
            case BillingClient.BillingResponseCode.OK: return "OK";
            case BillingClient.BillingResponseCode.USER_CANCELED: return "USER_CANCELED";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE: return "SERVICE_UNAVAILABLE";
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE: return "BILLING_UNAVAILABLE";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE: return "ITEM_UNAVAILABLE";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR: return "DEVELOPER_ERROR";
            case BillingClient.BillingResponseCode.ERROR: return "ERROR";
            case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED: return "ITEM_ALREADY_OWNED";
            case BillingClient.BillingResponseCode.ITEM_NOT_OWNED: return "ITEM_NOT_OWNED";
            case BillingClient.BillingResponseCode.NETWORK_ERROR: return "NETWORK_ERROR";
            case BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED: return "FEATURE_NOT_SUPPORTED";
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED: return "SERVICE_DISCONNECTED";
            default: return "UNKNOWN(" + code + ")";
        }
    }

    /** What each code usually means in practice, so the fix is obvious. */
    static String responseHint(int code) {
        switch (code) {
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE:
                return "the Play Store account cannot buy — signed out, an unsupported country, or a Play Store that needs updating";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE:
                return "Play does not offer this product to THIS account/build — check the id, that it is ACTIVE, that this build came from a Play track, and that the account is a licensed tester";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR:
                return "the request itself was wrong — usually a package name, signing key or product id that does not match the uploaded build";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingClient.BillingResponseCode.NETWORK_ERROR:
                return "no usable connection to Play right now";
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED:
                return "the billing service dropped — reconnecting";
            case BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED:
                return "this Play Store version does not support the feature";
            default:
                return "";
        }
    }

    /** Must match the product IDs created in Play Console. */
    static final String PRODUCT_PREMIUM = "coins_100";
    static final String PRODUCT_BOOK = "premium_access";

    private static final List<String> PRODUCTS =
            Collections.unmodifiableList(Arrays.asList(PRODUCT_PREMIUM, PRODUCT_BOOK));

    interface Listener {
        /** Entitlement resolved for one product. Fires only when it changes. */
        void onOwnershipChanged(@NonNull String productId, boolean owned);
        /** A purchase attempt finished. ok=false carries a human-readable reason. */
        void onPurchaseResult(@NonNull String productId, boolean ok, @Nullable String reason);
        /** The localized price string from Google, e.g. "₪19.00". */
        void onPriceReady(@NonNull String productId, @NonNull String formattedPrice);
        /**
         * Billing could not be set up, or a product is missing from Play. This
         * is a setup problem rather than a user action, and it is reported so a
         * tester can see it instead of pressing a button that does nothing.
         */
        void onBillingUnavailable(@NonNull String detail);
    }

    private final Activity activity;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());

    private final Map<String, ProductDetails> details = new HashMap<>();
    private final Set<String> owned = new HashSet<>();

    private BillingClient client;
    private boolean connected;
    private int retries;

    /**
     * Which product the user is currently buying. Google's error callbacks do
     * not name the product, so without this a failed book purchase would be
     * reported against Premium.
     */
    @Nullable
    private volatile String pendingProductId;

    BillingManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    // ------------------------------------------------------------------
    // Connection
    // ------------------------------------------------------------------

    void start() {
        Log.i(TAG, "start(): package=" + activity.getPackageName()
                + " products=" + PRODUCTS);
        client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases()
                .build();
        connect();
    }

    /** One-line health summary, for logs and for the JS diagnostics call. */
    String status() {
        return "connected=" + (client != null && client.isReady())
                + " detailsLoaded=" + details.keySet()
                + " owned=" + owned
                + " package=" + activity.getPackageName();
    }

    private void connect() {
        if (client == null || client.isReady()) return;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                int code = result.getResponseCode();
                Log.i(TAG, "onBillingSetupFinished: " + responseName(code)
                        + " — " + result.getDebugMessage());
                if (code == BillingClient.BillingResponseCode.OK) {
                    connected = true;
                    retries = 0;
                    queryProducts();
                    restorePurchases();   // reinstall / new device / refund sync
                } else {
                    Log.e(TAG, "BILLING SETUP FAILED: " + responseName(code)
                            + " — " + responseHint(code));
                    listener.onBillingUnavailable(responseName(code) + " · " + responseHint(code));
                    scheduleRetry();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connected = false;
                Log.w(TAG, "billing service disconnected — will retry");
                scheduleRetry();
            }
        });
    }

    private void scheduleRetry() {
        long delay = Math.min(30_000L, 1_000L * (1L << Math.min(retries, 5)));
        retries++;
        main.postDelayed(this::connect, delay);
    }

    void destroy() {
        main.removeCallbacksAndMessages(null);
        if (client != null) {
            client.endConnection();
            client = null;
        }
    }

    // ------------------------------------------------------------------
    // Product details (price)
    // ------------------------------------------------------------------

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : PRODUCTS) {
            list.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
        }
        QueryProductDetailsParams params =
                QueryProductDetailsParams.newBuilder().setProductList(list).build();

        Log.i(TAG, "queryProductDetailsAsync for " + PRODUCTS);
        client.queryProductDetailsAsync(params, (result, found) -> {
            int code = result.getResponseCode();
            if (code != BillingClient.BillingResponseCode.OK) {
                Log.e(TAG, "PRODUCT LOOKUP FAILED: " + responseName(code)
                        + " — " + result.getDebugMessage() + " — " + responseHint(code));
                listener.onBillingUnavailable("שליפת המוצרים נכשלה: " + responseName(code));
                return;
            }
            if (found.isEmpty()) {
                Log.e(TAG, "PLAY RETURNED NO PRODUCTS for " + PRODUCTS + ". Usual causes: "
                        + "the ids do not match Play Console exactly; the products are not ACTIVE; "
                        + "this build was sideloaded rather than installed from a Play track; "
                        + "the signing key or applicationId differs from the uploaded build; "
                        + "or this Google account is not a licensed tester.");
                listener.onBillingUnavailable("Play לא מחזיר את המוצרים " + PRODUCTS);
                return;
            }
            Log.i(TAG, "products returned by Play: " + found.size());
            for (ProductDetails pd : found) {
                details.put(pd.getProductId(), pd);
                ProductDetails.OneTimePurchaseOfferDetails offer = pd.getOneTimePurchaseOfferDetails();
                if (offer == null) continue;
                final String id = pd.getProductId();
                final String price = offer.getFormattedPrice();
                main.post(() -> listener.onPriceReady(id, price));
            }
            // Say so loudly when one of ours is missing: the usual cause is a
            // product that was never created, or is still a draft.
            for (String id : PRODUCTS) {
                if (details.containsKey(id)) {
                    Log.i(TAG, "  ✓ " + id + " = " + getFormattedPrice(id));
                } else {
                    Log.e(TAG, "  ✗ " + id + " NOT returned by Play — check the id spelling "
                            + "and that it is ACTIVE in Play Console");
                    listener.onBillingUnavailable("המוצר " + id + " לא נמצא ב-Play");
                }
            }
        });
    }

    /** Formatted price from Google, or null before it loads. */
    @Nullable
    String getFormattedPrice(@NonNull String productId) {
        ProductDetails pd = details.get(productId);
        if (pd == null) return null;
        ProductDetails.OneTimePurchaseOfferDetails offer = pd.getOneTimePurchaseOfferDetails();
        return offer == null ? null : offer.getFormattedPrice();
    }

    boolean isOwned(@NonNull String productId) {
        return owned.contains(productId);
    }

    // ------------------------------------------------------------------
    // Buying
    // ------------------------------------------------------------------

    /** Launch Google's purchase sheet for one product. Safe to call any time. */
    void launchPurchase(@NonNull final String productId) {
        Log.i(TAG, "launchPurchase(" + productId + ") — " + status());
        if (!PRODUCTS.contains(productId)) {
            Log.e(TAG, "refusing to buy unknown product " + productId);
            main.post(() -> listener.onPurchaseResult(productId, false, "מוצר לא מוכר"));
            return;
        }
        if (owned.contains(productId)) {
            // Already bought on this account — treat as success so the caller
            // unlocks rather than sending the user to pay twice.
            main.post(() -> listener.onPurchaseResult(productId, true, null));
            return;
        }
        if (client == null || !client.isReady()) {
            Log.e(TAG, "BillingClient not ready (client=" + (client == null ? "null" : "isReady=false")
                    + ") — reconnecting; the tap did nothing");
            connect();
            main.post(() -> listener.onPurchaseResult(productId, false,
                    "החנות עדיין מתחברת — נסו שוב עוד רגע"));
            return;
        }
        ProductDetails pd = details.get(productId);
        if (pd == null) {
            Log.e(TAG, "no ProductDetails for " + productId + " — Play never returned it. "
                    + "Loaded so far: " + details.keySet());
            queryProducts();
            main.post(() -> listener.onPurchaseResult(productId, false,
                    "פרטי המוצר לא נטענו מהחנות — " + productId));
            return;
        }
        pendingProductId = productId;
        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(pd)
                                .build()))
                .build();
        BillingResult result = client.launchBillingFlow(activity, params);
        int launchCode = result.getResponseCode();
        Log.i(TAG, "launchBillingFlow -> " + responseName(launchCode)
                + " — " + result.getDebugMessage());
        if (launchCode != BillingClient.BillingResponseCode.OK) {
            pendingProductId = null;
            final String detail = responseName(launchCode)
                    + (responseHint(launchCode).isEmpty() ? "" : " · " + responseHint(launchCode));
            Log.e(TAG, "COULD NOT OPEN GOOGLE'S SHEET: " + detail);
            main.post(() -> listener.onPurchaseResult(productId, false, detail));
        }
    }

    // ------------------------------------------------------------------
    // Purchase results
    // ------------------------------------------------------------------

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        int code = result.getResponseCode();
        Log.i(TAG, "onPurchasesUpdated: " + responseName(code)
                + " — " + result.getDebugMessage()
                + " — purchases=" + (purchases == null ? "null" : purchases.size()));
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) handlePurchase(p);
            pendingProductId = null;
            return;
        }

        // Everything below is a failure, and Google does not tell us which
        // product it was for — hence pendingProductId.
        final String product = pendingProductId != null ? pendingProductId : PRODUCT_PREMIUM;
        pendingProductId = null;

        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            // Bought on another device, or a stale local state. Re-read the
            // truth from Play; that path unlocks and reports.
            restorePurchases();
            main.post(() -> listener.onPurchaseResult(product, true, null));
            return;
        }
        final String reason;
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            reason = null;                            // a normal cancel, not an error
            Log.i(TAG, "user cancelled the purchase of " + product);
        } else {
            String hint = responseHint(code);
            reason = responseName(code) + (hint.isEmpty() ? "" : " · " + hint);
            Log.e(TAG, "PURCHASE FAILED for " + product + ": " + reason
                    + " — " + result.getDebugMessage());
        }
        main.post(() -> listener.onPurchaseResult(product, false, reason));
    }

    /** Re-read what the account actually owns — the source of truth. */
    void restorePurchases() {
        if (client == null || !client.isReady()) return;
        client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP).build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                    Set<String> nowOwned = new HashSet<>();
                    for (Purchase p : purchases) {
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        boolean ours = false;
                        for (String id : PRODUCTS) {
                            if (p.getProducts().contains(id)) {
                                nowOwned.add(id);
                                ours = true;
                            }
                        }
                        if (ours) acknowledgeIfNeeded(p);
                    }
                    // Diff both ways: a refund revokes the entitlement, and that
                    // has to reach the UI as well as a new purchase does.
                    for (String id : PRODUCTS) setOwned(id, nowOwned.contains(id));
                });
    }

    private void handlePurchase(Purchase p) {
        List<String> ids = new ArrayList<>();
        for (String id : PRODUCTS) if (p.getProducts().contains(id)) ids.add(id);
        if (ids.isEmpty()) return;

        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            // e.g. cash payment at a shop — the entitlement arrives later, and
            // restorePurchases() on the next resume picks it up.
            for (String id : ids) {
                main.post(() -> listener.onPurchaseResult(id, false,
                        "התשלום ממתין לאישור — הגישה תיפתח לאחר השלמתו"));
            }
            return;
        }
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;

        Log.i(TAG, "PURCHASED " + ids + " — acknowledging");
        acknowledgeIfNeeded(p);
        for (String id : ids) {
            setOwned(id, true);
            main.post(() -> listener.onPurchaseResult(id, true, null));
        }
    }

    /**
     * Acknowledge within 3 days or Google auto-refunds the purchase. For a
     * non-consumable we acknowledge and never consume.
     */
    private void acknowledgeIfNeeded(Purchase p) {
        if (p.isAcknowledged()) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(p.getPurchaseToken())
                .build();
        client.acknowledgePurchase(params, r -> {
            int c = r.getResponseCode();
            if (c == BillingClient.BillingResponseCode.OK) {
                Log.i(TAG, "acknowledged " + p.getProducts());
            } else {
                // Left unacknowledged for 3 days, Google refunds it automatically.
                Log.e(TAG, "ACKNOWLEDGE FAILED for " + p.getProducts() + ": "
                        + responseName(c) + " — " + r.getDebugMessage()
                        + " — Google will auto-refund this in 3 days if it stays unacknowledged");
            }
        });
    }

    private void setOwned(@NonNull String productId, boolean value) {
        boolean had = owned.contains(productId);
        if (had == value) return;
        Log.i(TAG, "entitlement " + productId + ": " + had + " -> " + value);
        if (value) owned.add(productId); else owned.remove(productId);
        main.post(() -> listener.onOwnershipChanged(productId, value));
    }
}
