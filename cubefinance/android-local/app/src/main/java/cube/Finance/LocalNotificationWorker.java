package cube.Finance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Builds and posts one local notification from the string/channel resource
 * ids passed in via input data. Resolving those ids here — at fire time,
 * inside the application's current Configuration — means the text always
 * matches the device's current locale, even if it changed since scheduling.
 */
public class LocalNotificationWorker extends Worker {

    static final String KEY_CHANNEL_ID = "channel_id";
    static final String KEY_CHANNEL_NAME_RES = "channel_name_res";
    static final String KEY_CHANNEL_DESCRIPTION_RES = "channel_description_res";
    static final String KEY_TITLE_RES = "title_res";
    static final String KEY_BODY_RES = "body_res";
    static final String KEY_NOTIFICATION_ID = "notification_id";

    public LocalNotificationWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Data input = getInputData();
        String channelId = input.getString(KEY_CHANNEL_ID);
        int titleRes = input.getInt(KEY_TITLE_RES, 0);
        int bodyRes = input.getInt(KEY_BODY_RES, 0);

        if (channelId == null || titleRes == 0 || bodyRes == 0) return Result.failure();

        Context context = getApplicationContext();
        createNotificationChannel(
                context,
                channelId,
                input.getInt(KEY_CHANNEL_NAME_RES, 0),
                input.getInt(KEY_CHANNEL_DESCRIPTION_RES, 0));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(titleRes))
                .setContentText(context.getString(bodyRes))
                // On API 26+ the channel's importance is what actually decides
                // heads-up/banner behavior — this priority only matters as a
                // pre-O fallback — but it's set to match regardless.
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL) // sound + vibration + lights
                .setAutoCancel(true);

        try {
            NotificationManagerCompat.from(context)
                    .notify(input.getInt(KEY_NOTIFICATION_ID, 0), builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS was never granted (or was revoked) — nothing to show.
        }
        return Result.success();
    }

    private void createNotificationChannel(Context context, String channelId, int nameRes, int descriptionRes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        CharSequence name = nameRes != 0 ? context.getString(nameRes) : channelId;
        // IMPORTANCE_HIGH is what makes a notification pop up as a heads-up
        // banner instead of silently landing in the shade. Channel settings
        // are immutable once created, so createNotificationChannel() on a
        // channel id that already exists on this device (from a build before
        // this change) is a silent no-op — see NotificationScheduler's
        // channel id comment for why these ids carry a "_v2" suffix now.
        NotificationChannel channel =
                new NotificationChannel(channelId, name, NotificationManager.IMPORTANCE_HIGH);
        if (descriptionRes != 0) channel.setDescription(context.getString(descriptionRes));
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
}
