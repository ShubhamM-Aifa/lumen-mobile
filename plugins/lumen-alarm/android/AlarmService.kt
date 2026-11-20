package __PACKAGE__.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import __PACKAGE__.R

/**
 * Rings a fired reminder like a clock alarm: looping sound on the ALARM stream (so it follows the
 * phone's alarm volume and still plays in silent/vibrate mode, exactly like Samsung Clock),
 * vibration, and a high-priority notification whose full-screen intent opens AlarmActivity.
 *
 * Android decides how that notification appears: full screen when the phone is locked or the
 * screen is off; a heads-up popup with Stop/Snooze while another app is in use. If the member has
 * granted "Appear on top", the alarm screen is also opened over other apps.
 */
class AlarmService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var focusRequest: AudioFocusRequest? = null
    private var current: AlarmStore.Spec? = null
    private val timeout = Runnable { onRingTimeout() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val spec = specFrom(intent)
                if (spec == null) stopSelf() else startRinging(spec)
            }
            ACTION_SNOOZE -> { snooze(); stopAlarm() }
            ACTION_STOP -> stopAlarm()
            else -> if (current == null) stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        releaseOutputs()
        if (instance === this) instance = null
        super.onDestroy()
    }

    private fun startRinging(spec: AlarmStore.Spec) {
        releaseOutputs()
        current = spec
        ensureChannels(this)

        val notification = ringingNotification(spec)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lumen:alarm")
            .apply { acquire(RING_TIMEOUT_MS + 30_000L) }

        requestAudioFocus()
        playSound(spec.soundId)
        startVibration()

        // A full-screen intent only takes over the screen when the phone is locked. With
        // "Appear on top" granted, Android also lets us open the alarm screen over other apps.
        if (Settings.canDrawOverlays(this)) {
            try {
                startActivity(alarmActivityIntent(this, spec))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        handler.removeCallbacks(timeout)
        handler.postDelayed(timeout, RING_TIMEOUT_MS)
    }

    /** Stop ringing, close the alarm screen, and remove the ongoing notification. */
    fun stopAlarm() {
        handler.removeCallbacks(timeout)
        releaseOutputs()
        current = null
        AlarmActivity.closeIfOpen()
        stopForegroundCompat()
        stopSelf()
    }

    private fun snooze() {
        val spec = current ?: return
        AlarmStore.schedule(
            this,
            spec.copy(
                key = spec.reminderId + AlarmStore.SNOOZE_SUFFIX,
                timesOfDayMinutes = IntArray(0),
                daysOfWeek = IntArray(0),
                triggerAtMs = System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L,
            ),
        )
    }

    /** Nobody answered: go quiet like a clock alarm does, but leave a note that it rang. */
    private fun onRingTimeout() {
        val spec = current
        releaseOutputs()
        current = null
        AlarmActivity.closeIfOpen()
        stopForegroundCompat()
        if (spec != null) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(
                spec.reminderId.hashCode(),
                NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.drawable.notification_icon)
                    .setContentTitle("Missed: ${spec.title}")
                    .setContentText(spec.body)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setSilent(true)
                    .setAutoCancel(true)
                    .setContentIntent(openAppPendingIntent(this, spec))
                    .build(),
            )
        }
        stopSelf()
    }

    private fun ringingNotification(spec: AlarmStore.Spec): Notification {
        val fullScreen = PendingIntent.getActivity(
            this, spec.reminderId.hashCode(), alarmActivityIntent(this, spec),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(spec.title)
            .setContentText(spec.body.ifBlank { "Reminder" })
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true) // the service plays the sound itself, on the alarm stream
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .setDeleteIntent(servicePendingIntent(this, ACTION_STOP, 2))
            // Same two buttons as the phone's own clock alarm; snooze length stays in the notification text.
            .setSubText("Reminder · snooze $SNOOZE_MINUTES min")
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .addAction(0, "Dismiss", servicePendingIntent(this, ACTION_STOP, 2))
            .addAction(0, "Snooze", servicePendingIntent(this, ACTION_SNOOZE, 1))
            .build()
    }

    private fun playSound(soundId: String) {
        val candidates = listOfNotNull(bundledSoundUri(soundId), systemAlarmUri())
        for (uri in candidates) {
            try {
                player = MediaPlayer().apply {
                    setAudioAttributes(ALARM_AUDIO)
                    setDataSource(this@AlarmService, uri)
                    isLooping = true
                    prepare()
                    start()
                }
                return
            } catch (e: Exception) {
                e.printStackTrace()
                player?.release()
                player = null
            }
        }
    }

    /** The tones the member can pick in Lumen, copied into res/raw by the config plugin. */
    private fun bundledSoundUri(soundId: String): Uri? {
        if (soundId.isBlank() || soundId == "default") return null
        val resId = resources.getIdentifier("lumen_alarm_$soundId", "raw", packageName)
        return if (resId == 0) null else Uri.parse("android.resource://$packageName/$resId")
    }

    /** "Device Default" means the tone set for alarms in the phone's own settings. */
    private fun systemAlarmUri(): Uri? =
        RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

    private fun startVibration() {
        val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        if (!v.hasVibrator()) return
        val effect = VibrationEffect.createWaveform(longArrayOf(0, 600, 400, 600, 1200), 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(effect, ALARM_AUDIO)
        }
        vibrator = v
    }

    /** Pauses music or a video while the alarm rings, as the Clock app does. */
    private fun requestAudioFocus() {
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(ALARM_AUDIO)
            .build()
        am.requestAudioFocus(req)
        focusRequest = req
    }

    private fun releaseOutputs() {
        try { player?.stop() } catch (_: Exception) {}
        player?.release()
        player = null
        vibrator?.cancel()
        vibrator = null
        focusRequest?.let { (getSystemService(Context.AUDIO_SERVICE) as AudioManager).abandonAudioFocusRequest(it) }
        focusRequest = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    companion object {
        const val CHANNEL_ID = "lumen_alarm_ring_v1"
        private const val FALLBACK_CHANNEL_ID = "lumen_alarm_fallback_v1"
        const val NOTIFICATION_ID = 0x4C554D
        const val SNOOZE_MINUTES = 10
        /** How long an unanswered alarm rings before going quiet. */
        const val RING_TIMEOUT_MS = 3 * 60_000L

        const val ACTION_START = "lumen.alarm.START"
        const val ACTION_STOP = "lumen.alarm.STOP"
        const val ACTION_SNOOZE = "lumen.alarm.SNOOZE"
        const val EXTRA_SPEC = "alarmSpec"

        val ALARM_AUDIO: AudioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        @Volatile
        var instance: AlarmService? = null
            private set

        fun start(context: Context, spec: AlarmStore.Spec) {
            val intent = Intent(context, AlarmService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_SPEC, spec.toJson())
            }
            try {
                context.startForegroundService(intent)
            } catch (e: Exception) {
                // Android refused a background service start (rare for an exact alarm, but OEMs
                // differ). Still alert the member with a sounding notification on the alarm stream.
                e.printStackTrace()
                postFallback(context, spec)
            }
        }

        /** Called from the alarm screen and from JS ("Dismiss" in the app). Safe if not ringing. */
        fun stop(context: Context) {
            instance?.let { svc -> Handler(Looper.getMainLooper()).post { svc.stopAlarm() } }
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIFICATION_ID)
        }

        fun snoozeAndStop(context: Context) {
            instance?.let { svc -> Handler(Looper.getMainLooper()).post { svc.snooze(); svc.stopAlarm() } }
        }

        fun ensureChannels(context: Context) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            // Silent: the service plays the tone itself so it can loop and use the alarm stream.
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Ringing reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Reminders ringing now, shown over the lock screen"
                    setSound(null, null)
                    enableVibration(false)
                    setBypassDnd(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
            )
            nm.createNotificationChannel(
                NotificationChannel(FALLBACK_CHANNEL_ID, "Reminders (backup)", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Used only if Android stops Lumen from ringing a reminder normally"
                    setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), ALARM_AUDIO)
                    enableVibration(true)
                    setBypassDnd(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
            )
        }

        private fun postFallback(context: Context, spec: AlarmStore.Spec) {
            ensureChannels(context)
            val fullScreen = PendingIntent.getActivity(
                context, spec.reminderId.hashCode(), alarmActivityIntent(context, spec),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(
                spec.reminderId.hashCode(),
                NotificationCompat.Builder(context, FALLBACK_CHANNEL_ID)
                    .setSmallIcon(R.drawable.notification_icon)
                    .setContentTitle(spec.title)
                    .setContentText(spec.body)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setFullScreenIntent(fullScreen, true)
                    .setContentIntent(fullScreen)
                    .build(),
            )
        }

        fun alarmActivityIntent(context: Context, spec: AlarmStore.Spec): Intent =
            Intent(context, AlarmActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
                putExtra(EXTRA_SPEC, spec.toJson())
            }

        fun openAppPendingIntent(context: Context, spec: AlarmStore.Spec): PendingIntent =
            PendingIntent.getActivity(
                context, spec.reminderId.hashCode() + 1, AlarmIntents.openAppIntent(context, spec.reminderId),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        private fun servicePendingIntent(context: Context, action: String, requestCode: Int): PendingIntent =
            PendingIntent.getService(
                context, requestCode, Intent(context, AlarmService::class.java).setAction(action),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        fun specFrom(intent: Intent?): AlarmStore.Spec? =
            intent?.getStringExtra(EXTRA_SPEC)?.let { AlarmStore.Spec.fromJson(it) }
    }
}
