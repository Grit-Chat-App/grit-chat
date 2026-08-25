// The native boundary for local notifications, badge and sound.
//
// A local notification is produced by THIS process from the foreground pump, so it can only fire
// while the process is alive. That is stated honestly in the UI and in docs/ux-audit.md; background
// push is future work that needs a relay push service and is not faked here.
//
// The module no-ops when the native side is absent. On iOS the module is a small
// UNUserNotificationCenter wrapper; on Android a NotificationManager wrapper. A build that lacks
// either still runs, it just does not banner. The JS contract is named GritNotifications on both
// platforms so one bridge serves both.

import {NativeModules} from 'react-native';

interface GritNotificationsModule {
  present(title: string, body: string): Promise<void>;
  setBadge(count: number): Promise<void>;
  requestPermission(): Promise<boolean>;
}

const native = NativeModules.GritNotifications as GritNotificationsModule | undefined;

/** True when a native notification module is linked on this platform. */
export const notificationsAvailable = native != null;

/** Ask the OS for permission to banner. Resolves false when unavailable or refused. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (native == null) {
    return false;
  }
  try {
    return await native.requestPermission();
  } catch {
    return false;
  }
}

let askedThisProcess = false;

/**
 * Ask at most once per process, and only from a place where a banner would mean something.
 *
 * WHY NOT AT BOOT. This used to run in wireArrivals at startup, and the result was a system modal
 * sitting on top of the first screen of a brand new install: "Grit Chat Would Like to Send You
 * Notifications", over an empty conversation list, before the person had a single contact who could
 * ever send them anything. It is the worst possible first impression and it is the opposite of what
 * the first screen is supposed to be doing. It also made the whole Detox suite unrunnable, because
 * a modal alert means the app never goes idle and every launch burns its timeout.
 *
 * So the ask happens when the person opens their first conversation or channel. By then there is
 * somebody who can write to them, which is exactly when "may we tell you they did" is a reasonable
 * question. A refusal is not an error: the app does not banner and the badge still tracks unread.
 */
export function askToNotifyOnce(): void {
  if (askedThisProcess || native == null) {
    return;
  }
  askedThisProcess = true;
  void requestNotificationPermission();
}

/** Test seam: the once-per-process latch is module state, so a test has to be able to clear it. */
export function resetAskedForTests(): void {
  askedThisProcess = false;
}

/** Post one local notification. Swallow native failures: a missed banner is not a lost message. */
export async function presentArrival(title: string, body: string): Promise<void> {
  if (native == null) {
    return;
  }
  await native.present(title, body).catch(() => {});
}

/** Set the badge to the honest unread total. Zero clears it. */
export async function setUnreadBadge(count: number): Promise<void> {
  if (native == null) {
    return;
  }
  await native.setBadge(Math.max(0, count)).catch(() => {});
}
