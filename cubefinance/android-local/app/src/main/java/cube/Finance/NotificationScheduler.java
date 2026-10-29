package cube.Finance;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/** Central place to trigger or cancel every local engagement/reminder notification. */
public final class NotificationScheduler {

    private static final String WORK_INACTIVITY = "work_inactivity_reminder";
    private static final String WORK_WEEKLY_SUMMARY = "work_weekly_budget_summary";
    private static final String WORK_WEEKLY_TIP = "work_weekly_financial_tip";

    // "_v2": a channel's importance/sound/vibration are locked in the moment
    // it's first created — createNotificationChannel() on an id that already
    // exists on the device (from a build before IMPORTANCE_HIGH) is a silent
    // no-op, so these ids were bumped to force a fresh, correctly-configured
    // channel instead of leaving existing installs stuck on the old one.
    private static final String CHANNEL_INACTIVITY = "inactivity_reminders_v2";
    private static final String CHANNEL_WEEKLY_SUMMARY = "weekly_budget_summary_v2";
    private static final String CHANNEL_WEEKLY_TIP = "weekly_financial_tip_v2";

    private static final int NOTIFICATION_ID_INACTIVITY = 1001;
    private static final int NOTIFICATION_ID_WEEKLY_SUMMARY = 1002;
    private static final int NOTIFICATION_ID_WEEKLY_TIP = 1003;

    private NotificationScheduler() { }

    /** Triggers every notification type in one call — used on app startup. */
    public static void scheduleAll(Context context) {
        scheduleInactivityReminder(context);
        scheduleWeeklyBudgetSummary(context);
        scheduleWeeklyFinancialTip(context);
    }

    public static void cancelAll(Context context) {
        cancelInactivityReminder(context);
        cancelWeeklyBudgetSummary(context);
        cancelWeeklyFinancialTip(context);
    }

    /**
     * (Re)starts the 10-day inactivity countdown. ExistingWorkPolicy.REPLACE
     * cancels any pending timer, so calling this on every app launch means
     * the notification only fires after 10 full days without the app opening.
     */
    public static void scheduleInactivityReminder(Context context) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(LocalNotificationWorker.class)
                .setInitialDelay(10, TimeUnit.DAYS)
                .setInputData(inactivityReminderData())
                .build();
        WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_INACTIVITY, ExistingWorkPolicy.REPLACE, request);
    }

    public static void cancelInactivityReminder(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_INACTIVITY);
    }

    /**
     * Weekly budget summary, anchored to the next Sunday 10:00 local time
     * and repeating every 7 days after that. Uses KEEP: once the periodic
     * work exists its schedule is left alone, so re-calling this on every
     * app launch doesn't push the anchor back out each time.
     */
    public static void scheduleWeeklyBudgetSummary(Context context) {
        long initialDelayMs = millisUntilNext(Calendar.SUNDAY, 10, 0);
        PeriodicWorkRequest request =
                new PeriodicWorkRequest.Builder(LocalNotificationWorker.class, 7, TimeUnit.DAYS)
                        .setInitialDelay(initialDelayMs, TimeUnit.MILLISECONDS)
                        .setInputData(weeklyBudgetSummaryData())
                        .build();
        WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_WEEKLY_SUMMARY, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancelWeeklyBudgetSummary(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_WEEKLY_SUMMARY);
    }

    /**
     * Weekly financial tip, anchored to the next Wednesday 17:00 local time
     * and repeating every 7 days after that — offset from the Sunday
     * summary so the two never land on the same day. Also uses KEEP — see
     * scheduleWeeklyBudgetSummary.
     */
    public static void scheduleWeeklyFinancialTip(Context context) {
        long initialDelayMs = millisUntilNext(Calendar.WEDNESDAY, 17, 0);
        PeriodicWorkRequest request =
                new PeriodicWorkRequest.Builder(LocalNotificationWorker.class, 7, TimeUnit.DAYS)
                        .setInitialDelay(initialDelayMs, TimeUnit.MILLISECONDS)
                        .setInputData(weeklyFinancialTipData())
                        .build();
        WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_WEEKLY_TIP, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancelWeeklyFinancialTip(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_WEEKLY_TIP);
    }

    /** True on API < 33 (no runtime permission needed) or once POST_NOTIFICATIONS is granted. */
    public static boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private static Data inactivityReminderData() {
        return new Data.Builder()
                .putString(LocalNotificationWorker.KEY_CHANNEL_ID, CHANNEL_INACTIVITY)
                .putInt(LocalNotificationWorker.KEY_CHANNEL_NAME_RES, R.string.channel_inactivity_name)
                .putInt(LocalNotificationWorker.KEY_CHANNEL_DESCRIPTION_RES, R.string.channel_inactivity_description)
                .putInt(LocalNotificationWorker.KEY_TITLE_RES, R.string.notification_inactivity_title)
                .putInt(LocalNotificationWorker.KEY_BODY_RES, R.string.notification_inactivity_body)
                .putInt(LocalNotificationWorker.KEY_NOTIFICATION_ID, NOTIFICATION_ID_INACTIVITY)
                .build();
    }

    private static Data weeklyBudgetSummaryData() {
        return new Data.Builder()
                .putString(LocalNotificationWorker.KEY_CHANNEL_ID, CHANNEL_WEEKLY_SUMMARY)
                .putInt(LocalNotificationWorker.KEY_CHANNEL_NAME_RES, R.string.channel_weekly_summary_name)
                .putInt(LocalNotificationWorker.KEY_CHANNEL_DESCRIPTION_RES, R.string.channel_weekly_summary_description)
                .putInt(LocalNotificationWorker.KEY_TITLE_RES, R.string.notification_weekly_summary_title)
                .putInt(LocalNotificationWorker.KEY_BODY_RES, R.string.notification_weekly_summary_body)
                .putInt(LocalNotificationWorker.KEY_NOTIFICATION_ID, NOTIFICATION_ID_WEEKLY_SUMMARY)
                .build();
    }

    private static Data weeklyFinancialTipData() {
        return new Data.Builder()
                .putString(LocalNotificationWorker.KEY_CHANNEL_ID, CHANNEL_WEEKLY_TIP)
                .putInt(LocalNotificationWorker.KEY_CHANNEL_NAME_RES, R.string.channel_weekly_tip_name)
                .putInt(LocalNotificationWorker.KEY_CHANNEL_DESCRIPTION_RES, R.string.channel_weekly_tip_description)
                .putInt(LocalNotificationWorker.KEY_TITLE_RES, R.string.notification_weekly_tip_title)
                .putInt(LocalNotificationWorker.KEY_BODY_RES, R.string.notification_weekly_tip_body)
                .putInt(LocalNotificationWorker.KEY_NOTIFICATION_ID, NOTIFICATION_ID_WEEKLY_TIP)
                .build();
    }

    /** Milliseconds from now until the next occurrence of dayOfWeek at hour:minute local time. */
    private static long millisUntilNext(int dayOfWeek, int hour, int minute) {
        Calendar target = Calendar.getInstance();
        target.set(Calendar.HOUR_OF_DAY, hour);
        target.set(Calendar.MINUTE, minute);
        target.set(Calendar.SECOND, 0);
        target.set(Calendar.MILLISECOND, 0);

        Calendar now = Calendar.getInstance();
        while (target.get(Calendar.DAY_OF_WEEK) != dayOfWeek || target.before(now)) {
            target.add(Calendar.DAY_OF_YEAR, 1);
        }
        return target.getTimeInMillis() - now.getTimeInMillis();
    }
}
