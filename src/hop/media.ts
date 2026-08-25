// Media helpers: the content-type vocabulary the app understands. This module is PURE on
// purpose: it is imported by unit tests, and a native import here (react-native-fs constructs a
// NativeEventEmitter at module scope) kills the whole suite at load. The file-writing half lives
// in mediaFiles.ts, which only the app context imports. Media bytes never pass through UTF-8
// decoding: that path exists for text and would corrupt a JPEG into replacement characters.

/** File extension for a content type, for the few types this app sends. Unknown stays .bin. */
export function mediaExtension(contentType: string): string {
  if (contentType === 'image/jpeg') {
    return 'jpg';
  }
  if (contentType === 'image/png') {
    return 'png';
  }
  if (contentType === 'audio/m4a' || contentType === 'audio/mp4') {
    return 'm4a';
  }
  return 'bin';
}

export function isMedia(contentType: string | undefined): boolean {
  return (
    contentType != null &&
    (contentType.startsWith('image/') || contentType.startsWith('audio/'))
  );
}
