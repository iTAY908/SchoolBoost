package cube.Finance;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;

/**
 * "Sign in with Google", end to end: launches Google's account picker,
 * exchanges the returned ID token for a Firebase credential, and reports the
 * resulting identity (or a reason it failed) back to the caller.
 *
 * Requires app/google-services.json to contain a Web (client_type 3) OAuth
 * client for this Firebase project — the google-services Gradle plugin turns
 * that into the R.string.default_web_client_id read below. Also requires this
 * build's signing certificate's SHA-1 to be registered against the Android
 * OAuth client for the same project (Firebase console → Project settings →
 * your Android app → Add fingerprint), or Google's sign-in intent fails with
 * DEVELOPER_ERROR (status code 10).
 */
final class GoogleAuthManager {

    private static final String TAG = "GoogleAuthManager";

    interface Listener {
        /** email/displayName are non-null only when ok is true. */
        void onSignInResult(boolean ok, @Nullable String email, @Nullable String displayName, @Nullable String reason);
    }

    private final Activity activity;
    private final Listener listener;
    private final GoogleSignInClient client;
    private final ActivityResultLauncher<Intent> launcher;

    GoogleAuthManager(Activity activity, ActivityResultLauncher<Intent> launcher, Listener listener) {
        this.activity = activity;
        this.launcher = launcher;
        this.listener = listener;
        GoogleSignInOptions.Builder gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail();
        // R.string.default_web_client_id only exists when app/google-services.json
        // was present at build time (the google-services plugin generates it from
        // the project's Web OAuth client) -- google-services.json is optional (see
        // app/build.gradle), so this is a runtime lookup, never a compile-time
        // R.string reference, or a checkout without the file would fail to compile
        // this whole class rather than simply not offer Google sign-in.
        int webClientId = activity.getResources()
                .getIdentifier("default_web_client_id", "string", activity.getPackageName());
        if (webClientId != 0) {
            gso.requestIdToken(activity.getString(webClientId));
        } else {
            Log.w(TAG, "default_web_client_id not found -- app/google-services.json is "
                    + "missing or has no Web OAuth client. The account picker will still "
                    + "open, but signIn() will report a configuration error instead of an "
                    + "ID token.");
        }
        client = GoogleSignIn.getClient(activity, gso.build());
    }

    /** Launches Google's account picker. The result arrives at handleResult(). */
    void signIn() {
        // Force the picker every time rather than silently reusing whichever
        // Google account signed in last -- this app supports multiple local
        // accounts on one device, so the user must be able to pick.
        client.signOut().addOnCompleteListener(t -> launcher.launch(client.getSignInIntent()));
    }

    /** Feed this the Intent from onActivityResult/registerForActivityResult. */
    void handleResult(@Nullable Intent data) {
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            firebaseAuthWithGoogle(account);
        } catch (ApiException e) {
            // 12501 is Google's code for "the user closed the picker" — not a
            // real error, so don't report it as one.
            if (e.getStatusCode() == 12501) {
                Log.i(TAG, "user cancelled Google sign-in");
                listener.onSignInResult(false, null, null, null);
            } else if (e.getStatusCode() == CommonStatusCodes.DEVELOPER_ERROR) {
                // Code 10 is always a *configuration* mismatch, never a runtime
                // fluke — retrying does nothing until the config is fixed. The
                // two causes, in order of likelihood: (1) this build's signing
                // certificate SHA-1 isn't registered against the Android OAuth
                // client for this Firebase project, or (2) the applicationId /
                // package name here doesn't match what's registered. Full
                // exception logged below; the fix is always on the Firebase /
                // Google Cloud console side, not in this code.
                Log.e(TAG, "Google sign-in DEVELOPER_ERROR (code 10) -- this is a "
                        + "SHA-1 or applicationId mismatch between this build ("
                        + activity.getPackageName() + ") and the Android OAuth client "
                        + "registered in Firebase console. Run `./gradlew signingReport` "
                        + "to print this build's SHA-1, then add it under Firebase console "
                        + "-> Project settings -> your Android app -> Add fingerprint. "
                        + "Full exception:", e);
                listener.onSignInResult(false, null, null,
                        "שגיאת הגדרה (קוד 10) — ה-SHA-1 של החתימה או מזהה החבילה אינם רשומים "
                        + "כראוי ב-Firebase Console");
            } else {
                Log.w(TAG, "Google sign-in failed: status=" + e.getStatusCode(), e);
                listener.onSignInResult(false, null, null, "קוד שגיאה " + e.getStatusCode());
            }
        }
    }

    private void firebaseAuthWithGoogle(@NonNull GoogleSignInAccount account) {
        String idToken = account.getIdToken();
        if (idToken == null) {
            Log.w(TAG, "Google account carried no ID token -- default_web_client_id is "
                    + "missing (see the constructor); cannot exchange for a Firebase credential.");
            listener.onSignInResult(false, null, null, "הגדרת Google Sign-In חסרה בפרויקט");
            return;
        }
        AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        FirebaseAuth.getInstance().signInWithCredential(credential).addOnCompleteListener(activity, task -> {
            if (!task.isSuccessful()) {
                Log.w(TAG, "Firebase signInWithCredential failed", task.getException());
                listener.onSignInResult(false, null, null, "האימות מול Firebase נכשל");
                return;
            }
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            String email = user != null && user.getEmail() != null ? user.getEmail() : account.getEmail();
            String name = user != null && user.getDisplayName() != null ? user.getDisplayName() : account.getDisplayName();
            if (email == null) {
                listener.onSignInResult(false, null, null, "חשבון Google ללא כתובת אימייל");
                return;
            }
            listener.onSignInResult(true, email, name, null);
        });
    }

    /** Clears both the cached Google account and the Firebase session. */
    void signOut() {
        client.signOut();
        FirebaseAuth.getInstance().signOut();
    }
}
