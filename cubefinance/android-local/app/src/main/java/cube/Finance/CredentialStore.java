package cube.Finance;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.IOException;
import java.security.GeneralSecurityException;

/**
 * "Remember me" credential storage, encrypted at rest with an Android
 * Keystore-backed key (AES256-GCM via EncryptedSharedPreferences). The key
 * itself never leaves secure hardware, so the encrypted file is useless
 * without this exact device's Keystore even if extracted -- e.g. from
 * android:allowBackup or a rooted device's filesystem, since Keystore keys
 * are hardware-bound and are never included in a backup.
 *
 * The saved email is exposed directly (getSavedEmail(), low sensitivity --
 * just pre-fills a field). The saved password deliberately has NO public
 * getter here: it is only ever handed back by BiometricAuthManager, after a
 * successful biometric check. See that class's authenticate().
 */
final class CredentialStore {

    private static final String TAG = "CredentialStore";
    private static final String PREFS_NAME = "cubefinance_secure_credentials";
    private static final String KEY_EMAIL = "remembered_email";
    private static final String KEY_PASSWORD = "remembered_password";

    @Nullable private final SharedPreferences prefs;

    CredentialStore(Context context) {
        prefs = open(context);
    }

    @Nullable
    private static SharedPreferences open(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
        } catch (GeneralSecurityException | IOException e) {
            // Should not happen on a real device with a working Keystore. If it
            // somehow does, "remember me" just quietly does nothing this
            // session rather than crashing the app or falling back to
            // plaintext storage.
            Log.e(TAG, "could not open encrypted credential store -- remember me is unavailable this session", e);
            return null;
        }
    }

    boolean save(String email, String password) {
        if (prefs == null) return false;
        try {
            prefs.edit().putString(KEY_EMAIL, email).putString(KEY_PASSWORD, password).apply();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "failed to save credentials", e);
            return false;
        }
    }

    @Nullable
    String getSavedEmail() {
        return prefs == null ? null : prefs.getString(KEY_EMAIL, null);
    }

    @Nullable
    String getSavedPassword() {
        return prefs == null ? null : prefs.getString(KEY_PASSWORD, null);
    }

    boolean hasSavedCredentials() {
        return getSavedEmail() != null && getSavedPassword() != null;
    }

    void clear() {
        if (prefs != null) prefs.edit().clear().apply();
    }
}
