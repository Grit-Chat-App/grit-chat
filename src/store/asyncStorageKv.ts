// The production KV: AsyncStorage, which survives restart and makes no claims about encryption.
//
// Kept apart from kv.ts so the contract and the in-memory implementation can be imported without
// pulling a native module into the process. The conversation store writes through this and awaits
// the write before reporting success, per the durable-state rule.

import AsyncStorage from '@react-native-async-storage/async-storage';

import {KeyValueStore} from './kv';

export const asyncStorageKv: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
