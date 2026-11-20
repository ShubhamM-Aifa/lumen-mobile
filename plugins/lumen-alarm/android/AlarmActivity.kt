package __PACKAGE__.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.util.Date

/**
 * The full-screen alarm shown over the lock screen. Deliberately native and minimal: it must
 * appear instantly from a cold start (no JavaScript to boot), and it shows only this reminder,
 * not the rest of the member's health data. "Open Lumen" asks for the unlock first.
 */
class AlarmActivity : Activity() {

    private var spec: AlarmStore.Spec? = null
    private lateinit var titleView: TextView
    private lateinit var bodyView: TextView
    private lateinit var timeView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(buildLayout())
        current = WeakReference(this)
        bind(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        bind(intent)
    }

    override fun onDestroy() {
        if (current?.get() === this) current = null
        super.onDestroy()
    }

    private fun bind(intent: Intent?) {
        spec = AlarmService.specFrom(intent) ?: spec
        titleView.text = spec?.title ?: "Lumen reminder"
        bodyView.text = spec?.body.orEmpty()
        bodyView.visibility = if (spec?.body.isNullOrBlank()) View.GONE else View.VISIBLE
        timeView.text = DateFormat.getTimeFormat(this).format(Date())
    }

    private fun stop() {
        AlarmService.stop(this)
        finish()
    }

    private fun snooze() {
        if (AlarmService.instance != null) {
            AlarmService.snoozeAndStop(this)
        } else {
            // Shown from the backup notification: no ringing service to ask, so schedule it here.
            spec?.let {
                AlarmStore.schedule(
                    this,
                    it.copy(
                        key = it.reminderId + AlarmStore.SNOOZE_SUFFIX,
                        timesOfDayMinutes = IntArray(0),
                        daysOfWeek = IntArray(0),
                        triggerAtMs = System.currentTimeMillis() + AlarmService.SNOOZE_MINUTES * 60_000L,
                    ),
                )
            }
            AlarmService.stop(this)
        }
        finish()
    }

    private fun openApp() {
        val reminderId = spec?.reminderId
        AlarmService.stop(this)
        val launch = { if (reminderId != null) startActivity(AlarmIntents.openAppIntent(this, reminderId)); finish() }
        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (km.isKeyguardLocked) {
            km.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() = launch()
            })
        } else {
            launch()
        }
    }

    private fun buildLayout(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.parseColor("#14161B"))
            setPadding(dp(28), dp(72), dp(28), dp(40))
        }
        timeView = text(64f, Color.WHITE, bold = false).also { root.addView(it) }
        root.addView(text(15f, Color.parseColor("#FF6B35"), bold = true).apply {
            text = "LUMEN REMINDER"
            letterSpacing = 0.12f
            setPadding(0, dp(8), 0, dp(36))
        })
        titleView = text(28f, Color.WHITE, bold = true).also { root.addView(it) }
        bodyView = text(18f, Color.parseColor("#C9CDD4"), bold = false).apply {
            setPadding(0, dp(12), 0, 0)
        }.also { root.addView(it) }

        root.addView(View(this), LinearLayout.LayoutParams(0, 0, 1f))

        root.addView(button("Snooze ${AlarmService.SNOOZE_MINUTES} min", "#2A2E36", Color.WHITE) { snooze() })
        root.addView(button("Dismiss","#FF6B35", Color.WHITE) { stop() }, buttonParams(top = 14))
        root.addView(button("Open Lumen", "#00000000", Color.parseColor("#C9CDD4")) { openApp() }, buttonParams(top = 10))
        return root
    }

    private fun text(sizeSp: Float, color: Int, bold: Boolean) = TextView(this).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(color)
        gravity = Gravity.CENTER
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun button(label: String, bg: String, fg: Int, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        setTextColor(fg)
        minHeight = dp(60)
        stateListAnimator = null
        background = GradientDrawable().apply {
            cornerRadius = dp(30).toFloat()
            setColor(Color.parseColor(bg))
        }
        setOnClickListener { onClick() }
    }

    private fun buttonParams(top: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = dp(top) }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        private var current: WeakReference<AlarmActivity>? = null

        fun closeIfOpen() {
            current?.get()?.let { if (!it.isFinishing) it.runOnUiThread { it.finish() } }
        }
    }
}
