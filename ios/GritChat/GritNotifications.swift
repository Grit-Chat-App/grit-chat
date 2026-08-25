// Local notifications, badge and sound, produced by the foreground pump.
//
// This is deliberately a LOCAL notification source: it can only fire while the process is alive,
// because the pump that drives it only runs in the foreground. Background push is future work that
// needs a relay push service; nothing here pretends otherwise, and no copy in the app implies the
// app receives while closed.
//
// The module mirrors the Android GritNotificationsModule: same name, same three methods, so one JS
// bridge serves both platforms.

import Foundation
import React
import UserNotifications

@objc(GritNotifications)
final class GritNotifications: NSObject {

  @objc
  func requestPermission(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
      if let error = error {
        reject("grit_notifications_permission", error.localizedDescription, error)
        return
      }
      resolve(granted)
    }
  }

  @objc
  func present(_ title: String, body: String, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default

    let request = UNNotificationRequest(
      identifier: UUID().uuidString,
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        reject("grit_notifications_present", error.localizedDescription, error)
        return
      }
      resolve(nil)
    }
  }

  @objc
  func setBadge(_ count: NSNumber, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UNUserNotificationCenter.current().setBadgeCount(count.intValue) { error in
      if let error = error {
        reject("grit_notifications_badge", error.localizedDescription, error)
        return
      }
      resolve(nil)
    }
  }
}
