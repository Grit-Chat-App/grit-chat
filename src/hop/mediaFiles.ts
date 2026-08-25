// The file-writing half of media: persist inbound media bytes to Documents and hand back a URI.
// Imports react-native-fs, so nothing unit-tested may import this module; see media.ts for the
// pure vocabulary and the reason for the split.

import RNFS from 'react-native-fs';
import {toBase64} from '@hop-mesh/react-native';

import {mediaExtension} from './media';

/**
 * Persist inbound media bytes and return the file URI to render from, or null when the write
 * failed. A null here must not drop the message: the row exists, its body just cannot render,
 * which is an honest failure to show rather than a vanished message.
 */
export async function persistInboundMedia(
  bytes: Uint8Array,
  id: string,
  contentType: string,
): Promise<string | null> {
  const dir = `${RNFS.DocumentDirectoryPath}/grit-media`;
  const safeId = id.replace(/[^A-Za-z0-9]/g, '_');
  const path = `${dir}/${safeId}.${mediaExtension(contentType)}`;
  try {
    await RNFS.mkdir(dir);
    await RNFS.writeFile(path, toBase64(bytes), 'base64');
    return `file://${path}`;
  } catch {
    return null;
  }
}
