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

import java.util.Collections;
import java.util.List;

/**
 * Real Google Play Billing for the one-time "AI Premium" unlock.
 *
 * Product: {@link #PRODUCT_ID} — a non-consumable in-app product. Create it in
 * Play Console → Monetise → In-app products with exactly this ID and set the
 * price there (₪10). The price shown in the UI is whatever Google reports, so
 * changing it in the console never requires a new build.
 *
 * Two rules this class exists to get right:
 *  1. A purchase MUST be acknowledged within 3 days or Google automatically
 *     refunds it and revokes the entitlement.
 *  2. Entitlement must be restored from Play on every launch — reinstalls and
 *     new devices have no local state.
 */
final class BillingManager implements PurchasesUpdatedListener {

    private static final String TAG = "BillingManager";

    /** Must match the product ID created in Play Console. */
    static final String PRODUCT_ID = "premium_upgrade_10";

    interface Listener {
        /** Entitlement resolved: true = the user owns Premium. */
        void onPremiumChanged(boolean premium);
        /** A purchase attempt finished. ok=false carries a human-readable reason. */
        void onPurchaseResult(boolean ok, @Nullable String reason);
        /** The localized price string from Google, e.g. "₪10.00". */
        void onPriceReady(@NonNull String formattedPrice);
    }

    private final Activity activity;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());

    private BillingClient client;
    private ProductDetails productDetails;
    private boolean connected;
    private int retries;
    private boolean premium;

    BillingManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    // ------------------------------------------------------------------
    // Connection
    // ------------------------------------------------------------------

    void start() {
        client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases()
                .build();
        connect();
    }

    private void connect() {
        if (client == null || client.isReady()) return;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    connected = true;
                    retries = 0;
                    queryProduct();
                    restorePurchases();   // reinstall / new device / refund sync
                } else {
                    Log.w(TAG, "setup failed: " + result.getDebugMessage());
                    scheduleRetry();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connected = false;
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

    private void queryProduct() {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                        QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(PRODUCT_ID)
                                .setProductType(BillingClient.ProductType.INAPP)
                                .build()))
                .build();

        client.queryProductDetailsAsync(params, (result, list) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || list.isEmpty()) {
                Log.w(TAG, "product lookup failed: " + result.getDebugMessage()
                        + " — is " + PRODUCT_ID + " created and ACTIVE in Play Console?");
                return;
            }
            productDetails = list.get(0);
            ProductDetails.OneTimePurchaseOfferDetails offer =
                    productDetails.getOneTimePurchaseOfferDetails();
            if (offer != null) {
                final String price = offer.getFormattedPrice();
                main.post(() -> listener.onPriceReady(price));
            }
        });
    }

    /** Formatted price from Google, or null before it loads. */
    @Nullable
    String getFormattedPrice() {
        if (productDetails == null) return null;
        ProductDetails.OneTimePurchaseOfferDetails offer = productDetails.getOneTimePurchaseOfferDetails();
        return offer == null ? null : offer.getFormattedPrice();
    }

    boolean isPremium() {
        return premium;
    }

    // ------------------------------------------------------------------
    // Buying
    // ------------------------------------------------------------------

    /** Launch Google's purchase sheet. Safe to call at any time. */
    void launchPurchase() {
        if (premium) {
            main.post(() -> listener.onPurchaseResult(true, null));
            return;
        }
        if (client == null || !client.isReady()) {
            connect();
            main.post(() -> listener.onPurchaseResult(false, "החנות עדיין מתחברת — נסו שוב עוד רגע"));
            return;
        }
        if (productDetails == null) {
            queryProduct();
            main.post(() -> listener.onPurchaseResult(false, "פרטי המוצר לא נטענו מהחנות"));
            return;
        }
        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(productDetails)
                                .build()))
                .build();
        BillingResult result = client.launchBillingFlow(activity, params);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            main.post(() -> listener.onPurchaseResult(false, result.getDebugMessage()));
        }
    }

    // ------------------------------------------------------------------
    // Purchase results
    // ------------------------------------------------------------------

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) handlePurchase(p);
            return;
        }
        final String reason;
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            reason = null;                                   // a normal cancel, not an error
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            restorePurchases();
            return;
        } else {
            reason = result.getDebugMessage();
        }
        main.post(() -> listener.onPurchaseResult(false, reason));
    }

    /** Re-read what the account actually owns — the source of truth. */
    void restorePurchases() {
        if (client == null || !client.isReady()) return;
        client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (result, purchases) -> {
                    boolean owned = false;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        for (Purchase p : purchases) {
                            if (p.getProducts().contains(PRODUCT_ID)
                                    && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                owned = true;
                                acknowledgeIfNeeded(p);
                            }
                        }
                    }
                    setPremium(owned);
                });
    }

    private void handlePurchase(Purchase p) {
        if (!p.getProducts().contains(PRODUCT_ID)) return;

        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            // e.g. cash payment at a store — entitlement comes later.
            main.post(() -> listener.onPurchaseResult(false, "התשלום ממתין לאישור — הגישה תיפתח לאחר השלמתו"));
            return;
        }
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;

        acknowledgeIfNeeded(p);
        setPremium(true);
        main.post(() -> listener.onPurchaseResult(true, null));
    }

    /**
     * Acknowledge within 3 days or Google auto-refunds the purchase. For a
     * non-consumable we acknowledge (never consume — consuming would let the
     * user buy it again).
     */
    private void acknowledgeIfNeeded(Purchase p) {
        if (p.isAcknowledged()) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(p.getPurchaseToken())
                .build();
        client.acknowledgePurchase(params, r -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "acknowledge failed: " + r.getDebugMessage());
            }
        });
    }

    private void setPremium(boolean value) {
        if (premium == value) return;
        premium = value;
        main.post(() -> listener.onPremiumChanged(value));
    }
}
