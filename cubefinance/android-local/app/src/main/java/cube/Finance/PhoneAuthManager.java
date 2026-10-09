package cube.Finance;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.firebase.FirebaseException;
import com.google.firebase.FirebaseTooManyRequestsException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException;
import com.google.firebase.auth.FirebaseAuthMissingActivityForRecaptchaException;
import com.google.firebase.auth.FirebaseAuthUserCollisionException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;

import java.util.concurrent.TimeUnit;

/**
 * Phone number verification via Firebase, LINKED onto whichever FirebaseUser
 * is already signed in (from Google Sign-In / GoogleAuthManager) rather than
 * signing into a separate phone-only identity -- this only ever attaches a
 * verified phone number to the account that's already active.
 *
 * Requires the Phone sign-in provider enabled in Firebase console
 * (Authentication -> Sign-in method); otherwise every attempt reaches
 * onVerificationFailed with an "operation not allowed" error -- a console
 * setting, not a code bug (same class of issue as the AI Premium product
 * type mismatch BillingManager traces for coins_100_v2).
 */
final class PhoneAuthManager {

    private static final String TAG = "PhoneAuthManager";
    private static final long TIMEOUT_SECONDS = 60L;

    interface Listener {
        /** An SMS was dispatched; the caller should show the 6-digit code entry. */
        void onCodeSent();
        void onCodeSendFailed(@NonNull String reason);
        /** The phone is now verified and linked to the signed-in account. */
        void onPhoneVerified(@NonNull String phoneNumber);
        void onPhoneVerifyFailed(@NonNull String reason);
    }

    private final Activity activity;
    private final Listener listener;

    @Nullable private String pendingPhoneNumber;
    @Nullable private String verificationId;
    @Nullable private PhoneAuthProvider.ForceResendingToken resendToken;

    PhoneAuthManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    void sendCode(@NonNull String phoneNumber) {
        pendingPhoneNumber = phoneNumber;
        verificationId = null;
        resendToken = null;
        request(phoneNumber, null);
    }

    /** Re-sends to the same number passed to the last sendCode(). */
    void resendCode() {
        if (pendingPhoneNumber == null) {
            listener.onCodeSendFailed("אין מספר טלפון לשלוח אליו — הזינו אותו שוב");
            return;
        }
        request(pendingPhoneNumber, resendToken);
    }

    private void request(String phoneNumber, @Nullable PhoneAuthProvider.ForceResendingToken token) {
        Log.i(TAG, "verifyPhoneNumber requested (resend=" + (token != null) + ")");
        PhoneAuthOptions.Builder builder = PhoneAuthOptions.newBuilder(FirebaseAuth.getInstance())
                .setPhoneNumber(phoneNumber)
                .setTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(callbacks);
        if (token != null) builder.setForceResendingToken(token);
        PhoneAuthProvider.verifyPhoneNumber(builder.build());
    }

    void verifyCode(@NonNull String code) {
        if (verificationId == null) {
            listener.onPhoneVerifyFailed("הקוד פג תוקף — בקשו קוד חדש");
            return;
        }
        linkCredential(PhoneAuthProvider.getCredential(verificationId, code));
    }

    private void linkCredential(PhoneAuthCredential credential) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Log.w(TAG, "linkCredential: no signed-in FirebaseUser -- phone verification only "
                    + "runs right after Google sign-in, which should have set one");
            listener.onPhoneVerifyFailed("יש להתחבר עם Google לפני אימות הטלפון");
            return;
        }
        user.linkWithCredential(credential).addOnCompleteListener(activity, task -> {
            if (task.isSuccessful()) {
                FirebaseUser updated = task.getResult() != null ? task.getResult().getUser() : null;
                String phone = updated != null && updated.getPhoneNumber() != null
                        ? updated.getPhoneNumber()
                        : (pendingPhoneNumber != null ? pendingPhoneNumber : "");
                Log.i(TAG, "phone linked to account");
                listener.onPhoneVerified(phone);
                return;
            }
            Log.w(TAG, "linkWithCredential failed", task.getException());
            listener.onPhoneVerifyFailed(describeFailure(task.getException(), "אימות הטלפון נכשל"));
        });
    }

    private final PhoneAuthProvider.OnVerificationStateChangedCallbacks callbacks =
            new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
        @Override
        public void onVerificationCompleted(@NonNull PhoneAuthCredential credential) {
            // Instant verification -- SMS auto-retrieval, or the number is
            // already this device's own verified line. Skip manual entry
            // entirely and link straight away.
            Log.i(TAG, "onVerificationCompleted (auto, no manual code needed)");
            linkCredential(credential);
        }

        @Override
        public void onVerificationFailed(@NonNull FirebaseException e) {
            Log.w(TAG, "onVerificationFailed", e);
            listener.onCodeSendFailed(describeFailure(e, "שליחת הקוד נכשלה"));
        }

        @Override
        public void onCodeSent(@NonNull String id, @NonNull PhoneAuthProvider.ForceResendingToken token) {
            Log.i(TAG, "onCodeSent");
            verificationId = id;
            resendToken = token;
            listener.onCodeSent();
        }
    };

    private static String describeFailure(@Nullable Exception e, String fallback) {
        if (e instanceof FirebaseAuthInvalidCredentialsException) return "מספר טלפון או קוד לא תקינים";
        if (e instanceof FirebaseAuthUserCollisionException) return "המספר הזה כבר משויך לחשבון אחר";
        if (e instanceof FirebaseTooManyRequestsException) return "יותר מדי בקשות — נסו שוב מאוחר יותר";
        if (e instanceof FirebaseAuthMissingActivityForRecaptchaException) return "לא ניתן להציג אימות reCAPTCHA כרגע";
        return fallback + (e != null && e.getMessage() != null ? " · " + e.getMessage() : "");
    }
}
