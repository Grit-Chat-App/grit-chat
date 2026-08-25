// Tracks what the person is looking at, so an arrival that is already on screen is never announced.
//
// Two signals matter: whether the process is active at all (AppState), and which conversation or
// channel is currently open. Both are written by the screens and read by the arrival wiring in
// GritContext. This is a plain module-level record rather than React state because the pump runs
// outside the render cycle and must be able to read it synchronously.

import {AppState, AppStateStatus} from 'react-native';

let appActive = AppState.currentState === 'active';
let openConversation: string | null = null;
let openChannel: string | null = null;

let subscribed = false;

export const focus = {
  /** Begin tracking AppState. Idempotent; call once at boot. */
  start(): void {
    if (subscribed) {
      return;
    }
    subscribed = true;
    AppState.addEventListener('change', (next: AppStateStatus) => {
      appActive = next === 'active';
    });
  },
  isAppActive(): boolean {
    return appActive;
  },
  openDirect(address: string | null): void {
    openConversation = address;
  },
  openTopic(path: string | null): void {
    openChannel = path;
  },
  reading(): {conversation: string | null; channel: string | null} {
    return {conversation: openConversation, channel: openChannel};
  },
};
