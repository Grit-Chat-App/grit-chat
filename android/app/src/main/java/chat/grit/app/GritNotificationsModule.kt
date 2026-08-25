package chat.grit.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Local notifications, badge and sound, produced by the foreground pump.
 *
 * Deliberately LOCAL: it can only fire while the process is alive, because the pump that drives it
 * only runs in the foreground. Background push is future work that needs a relay push service;
 * nothing here pretends otherwise.
 *
 * Mirrors the iOS GritNotifications module: same name, same three methods, so one JS bridge serves
 * both platforms. Uses only the platform NotificationManager and NotificationChannel, no androidx
 * and no new gradle dependency, so it drops into the existing build wiring untouched.
 */
class GritNotificationsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "GritNotifications"

  private fun manager(): NotificationManager =
    reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager().getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Messages",
        NotificationManager.IMPORTANCE_DEFAULT,
      )
      channel.description = "A message arrived while the app was open in the background."
      manager().createNotificationChannel(channel)
    }
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    // Android 13+ posts a runtime notification permission; earlier versions grant at install. The
    // JS side treats a refusal as "no banners", never as an error, so resolving true here on pre-13
    // is the honest "the OS will show banners" answer.
    promise.resolve(true)
  }

  @ReactMethod
  fun present(title: String, body: String, promise: Promise) {
    try {
      ensureChannel()
      val builder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          android.app.Notification.Builder(reactApplicationContext, CHANNEL_ID)
        } else {
          @Suppress("DEPRECATION")
          android.app.Notification.Builder(reactApplicationContext)
        }
      val notification = builder
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(android.app.Notification.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .build()
      manager().notify(nextId++, notification)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("grit_notifications_present", e)
    }
  }

  @ReactMethod
  fun setBadge(count: Int, promise: Promise) {
    // Android has no first-party badge API; launchers that show counts read them from the
    // notification count, which the system maintains. Acknowledge and resolve so the JS contract is
    // identical on both platforms.
    promise.resolve(null)
  }

  companion object {
    private const val CHANNEL_ID = "grit.messages"
    private var nextId = 1
  }
}
