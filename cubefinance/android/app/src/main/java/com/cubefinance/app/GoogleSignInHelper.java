package com.cubefinance.app;

import android.app.Activity;
import android.os.CancellationSignal;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * "Continue with Google" for the WebView app.
 *
 * Google refuses OAuth inside an embedded WebView (403 disallowed_useragent),
 * so sign-in runs natively through Credential Manager: the system sheet lists
 * the Google accounts on the phone, the user taps one, and we hand the
 * verified email back to the page.
 *
 * Google Cloud setup this depends on (project "CubeFinance"):
 *   - an OAuth client of type Android for this package + each signing SHA-1
 *     (Play app-signing key and upload key), and
 *   - the Web client below, which Credential Manager uses as serverClientId.
 * The client ID is public by design; there is no secret in the app.
 */
public final class GoogleSignInHelper {

    private static final String TAG = "CubeyGoogle";

    /** Web application client from Google Cloud → Google Auth Platform → Clients. */
    public static final String WEB_CLIENT_ID =
            "1077092568958-32v58kcpofd06b8n2p95hhdsbva9telf.apps.googleusercontent.com";

    /** ok=true with the verified email; otherwise error is cancelled | no_account | failed. */
    public interface Callback {
        void onResult(boolean ok, String email, String name, String error);
    }

    private final Activity activity;
    private final CredentialManager credentialManager;
    private boolean inFlight;

    public GoogleSignInHelper(Activity activity) {
        this.activity = activity;
        this.credentialManager = CredentialManager.create(activity);
    }

    /** Must be called on the main thread. A second tap while the sheet is up is ignored. */
    public void signIn(Callback callback) {
        if (inFlight) return;
        inFlight = true;

        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build();

        credentialManager.getCredentialAsync(
                activity,
                request,
                new CancellationSignal(),
                ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        inFlight = false;
                        handle(response.getCredential(), callback);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        inFlight = false;
                        String code;
                        if (e instanceof GetCredentialCancellationException) code = "cancelled";
                        else if (e instanceof NoCredentialException) code = "no_account";
                        else code = "failed";
                        Log.w(TAG, "sign-in error (" + code + "): " + e.getType() + " " + e.getMessage());
                        callback.onResult(false, null, null, code);
                    }
                });
    }

    private void handle(Credential credential, Callback callback) {
        if (credential instanceof CustomCredential
                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            try {
                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                // getId() is the account's email address, already verified by Google.
                callback.onResult(true, google.getId(), google.getDisplayName(), null);
                return;
            } catch (Exception e) {
                Log.w(TAG, "could not read the Google credential", e);
            }
        } else {
            Log.w(TAG, "unexpected credential type: " + credential.getType());
        }
        callback.onResult(false, null, null, "failed");
    }
}
