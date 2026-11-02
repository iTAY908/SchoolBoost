package cube.Finance;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

/**
 * Fingerprint / face unlock, gating access to the credentials CredentialStore
 * holds. This is the ONLY path in the app that ever reads back the saved
 * password -- there is no plain "give me the stored password" bridge method;
 * a caller has to go through a real BiometricPrompt success first.
 *
 * Separate from "Remember Me" being on: a saved email/password pair can exist
 * (used only to pre-fill the email field) with biometric login still off, and
 * turning biometric login on requires saved credentials to already exist.
 */
final class BiometricAuthManager {

    private static final String TAG = "BiometricAuthManager";
    private static final String PREFS_NAME = "cubefinance_prefs"; // same file WelcomeNotifier uses
    private static final String KEY_ENABLED = "biometric_login_enabled";

    interface Listener {
        void onBiometricSuccess(@NonNull String email, @NonNull String password);
        /** reason is always non-null and safe to show directly (never a raw exception message tied to secrets). */
        void onBiometricFailed(@NonNull String reason);
    }

    private final FragmentActivity activity;
    private final CredentialStore credentialStore;
    private final Listener listener;

    BiometricAuthManager(FragmentActivity activity, CredentialStore credentialStore, Listener listener) {
        this.activity = activity;
        this.credentialStore = credentialStore;
        this.listener = listener;
    }

    /** True only when the device has biometric hardware AND the user has enrolled at least one biometric. */
    boolean isAvailable() {
        BiometricManager bm = BiometricManager.from(activity);
        int result = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.BIOMETRIC_WEAK);
        return result == BiometricManager.BIOMETRIC_SUCCESS;
    }

    boolean isEnabled() {
        return prefs().getBoolean(KEY_ENABLED, false);
    }

    void setEnabled(boolean value) {
        prefs().edit().putBoolean(KEY_ENABLED, value).apply();
    }

    private SharedPreferences prefs() {
        return activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * Shows the system biometric prompt. Every outcome -- success, a
     * recoverable failed attempt, cancellation, lockout, or "biometrics
     * stopped being available mid-flow" -- reaches the Listener or is
     * absorbed here; nothing about this can hang or crash the caller.
     */
    void authenticate() {
        if (!credentialStore.hasSavedCredentials()) {
            listener.onBiometricFailed("אין פרטי התחברות שמורים למכשיר הזה");
            return;
        }
        if (!isAvailable()) {
            listener.onBiometricFailed("ביומטריה אינה זמינה או שלא הוגדרה במכשיר");
            return;
        }

        BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                String email = credentialStore.getSavedEmail();
                String password = credentialStore.getSavedPassword();
                if (email == null || password == null) {
                    listener.onBiometricFailed("אין פרטי התחברות שמורים למכשיר הזה");
                    return;
                }
                listener.onBiometricSuccess(email, password);
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                // Covers user cancel, too many failed attempts (lockout), no
                // hardware, and everything else BiometricPrompt considers
                // terminal -- always reported back, never left hanging.
                Log.w(TAG, "biometric error " + errorCode + ": " + errString);
                listener.onBiometricFailed(errString.toString());
            }

            @Override
            public void onAuthenticationFailed() {
                // One unrecognized fingerprint/face -- the system prompt
                // itself stays open and lets the user retry, so this is not
                // terminal and nothing needs reporting yet.
                Log.i(TAG, "biometric attempt not recognized, prompt still open for retry");
            }
        };

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("התחברות ל-CubeFinance")
                .setSubtitle("אמתו את זהותכם עם טביעת אצבע או זיהוי פנים")
                .setNegativeButtonText("ביטול")
                .build();

        try {
            BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback);
            prompt.authenticate(promptInfo);
        } catch (Exception e) {
            Log.e(TAG, "could not launch BiometricPrompt", e);
            listener.onBiometricFailed("לא ניתן היה לפתוח את אימות הביומטריה");
        }
    }
}
