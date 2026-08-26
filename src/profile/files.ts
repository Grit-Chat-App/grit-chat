import RNFS from 'react-native-fs';

import {MAX_PROFILE_PHOTO_BYTES, base64ByteLength, isJpegBase64} from './protocol';
import {ProfilePhoto} from './types';

const PROFILE_DIR = `${RNFS.DocumentDirectoryPath}/grit-profile`;

function pathFromUri(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function assertPhotoBase64(base64: string): number {
  const byteLength = base64ByteLength(base64);
  if (byteLength == null || !isJpegBase64(base64) || byteLength > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error(`Profile photo must be a valid JPEG no larger than ${MAX_PROFILE_PHOTO_BYTES / 1024} KiB.`);
  }
  return byteLength;
}

/** Copies a selected or received bounded JPEG into the app's durable documents directory. */
export async function persistProfilePhoto(base64: string, name: string): Promise<ProfilePhoto> {
  const byteLength = assertPhotoBase64(base64);
  const safeName = name.replace(/[^A-Za-z0-9_-]/g, '_');
  const path = `${PROFILE_DIR}/${safeName}.jpg`;
  await RNFS.mkdir(PROFILE_DIR);
  await RNFS.writeFile(path, base64, 'base64');
  return {uri: `file://${path}`, contentType: 'image/jpeg', byteLength};
}

/** Reads an own photo for a deliberate share and rejects a damaged or oversize local file. */
export async function readProfilePhoto(photo: ProfilePhoto): Promise<string> {
  if (photo.contentType !== 'image/jpeg') {
    throw new Error('Profile photo must be a JPEG.');
  }
  const base64 = await RNFS.readFile(pathFromUri(photo.uri), 'base64');
  const byteLength = assertPhotoBase64(base64);
  if (byteLength !== photo.byteLength) {
    throw new Error('Profile photo changed on disk. Choose it again before sharing.');
  }
  return base64;
}

/** Removing a photo means deleting its local copy before the profile stops referencing it. */
export async function removeProfilePhoto(photo: ProfilePhoto): Promise<void> {
  try {
    await RNFS.unlink(pathFromUri(photo.uri));
  } catch {
    // The profile record still needs to lose the stale URI when the file is already gone.
  }
}
