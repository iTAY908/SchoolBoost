package cube.Finance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Sends the one-time "welcome aboard" notification right after registration. */
public final class WelcomeNotifier {

    // "_v2": channel settings (importance/sound/vibration) are immutable once
    // created, so bumping importance in code is a silent no-op for anyone who
    // already has the old "welcome_notifications" channel from an earlier
    // build — a new id forces a fresh, correctly-configured channel instead.
    private static final String CHANNEL_ID = "welcome_notifications_v2";
    private static final int NOTIFICATION_ID = 2001;
    private static final String PREFS_NAME = "cubefinance_prefs";
    private static final String KEY_WELCOME_SENT = "welcome_notification_sent";

    private WelcomeNotifier() { }

    /** Builds and posts the welcome notification via NotificationManager. */
    public static void sendWelcomeNotification(Context context) {
        createNotificationChannel(context);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(context.getString(R.string.notification_welcome_title))
                .setContentText(context.getString(R.string.notification_welcome_body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL) // sound + vibration + lights
                .setAutoCancel(true);

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS was never granted (or was revoked) — nothing to show.
        }
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.channel_welcome_name),
                NotificationManager.IMPORTANCE_HIGH);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 250, 150, 250});
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(sound, audioAttributes);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    /** True once the welcome notification has already been sent on this device. */
    static boolean hasSentWelcomeNotification(Context context) {
        return prefs(context).getBoolean(KEY_WELCOME_SENT, false);
    }

    /** Marks the welcome notification as sent so it never fires again. */
    static void markWelcomeNotificationSent(Context context) {
        prefs(context).edit().putBoolean(KEY_WELCOME_SENT, true).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
