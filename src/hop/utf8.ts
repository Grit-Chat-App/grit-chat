// UTF-8 decoding that works on Hermes.
//
// The SDK's own bytesToUtf8 is `new TextDecoder().decode(bytes)`, and Hermes does not provide
// TextDecoder: React Native ships no such global unless a polyfill is installed. Calling it threw
// `ReferenceError: Property 'TextDecoder' doesn't exist` inside the inbound handlers, which is the
// worst possible place for it. The handler is what accepts an item, so every inbound message and
// every channel publication threw before the store ever saw it, the core never got its accept, and
// the item was redelivered on the next poll: the error repeated every 250ms forever while the app
// looked like it was simply receiving nothing.
//
// So this module owns the decode instead. It is a plain UTF-8 decoder over the byte array, with the
// invalid sequences that a network can deliver mapped to U+FFFD rather than throwing, because an
// inbound handler that throws is exactly the failure above.

const REPLACEMENT = '\uFFFD';

/** Decode UTF-8 bytes to a string. Never throws; malformed input yields replacement characters. */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];

    if (byte <= 0x7f) {
      out += String.fromCharCode(byte);
      i += 1;
      continue;
    }

    // Continuation byte where a leading byte belongs: not decodable on its own.
    if (byte < 0xc2) {
      out += REPLACEMENT;
      i += 1;
      continue;
    }

    const width = byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : byte < 0xf5 ? 4 : 0;
    if (width === 0 || i + width > bytes.length) {
      out += REPLACEMENT;
      i += 1;
      continue;
    }

    let point = byte & (width === 2 ? 0x1f : width === 3 ? 0x0f : 0x07);
    let valid = true;
    for (let k = 1; k < width; k += 1) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      point = (point << 6) | (next & 0x3f);
    }

    // Overlong encodings, surrogates and out-of-range points are all rejected rather than decoded:
    // accepting them would let a peer inject characters the sender could not have written.
    if (
      !valid ||
      (width === 3 && (point < 0x800 || (point >= 0xd800 && point <= 0xdfff))) ||
      (width === 4 && (point < 0x10000 || point > 0x10ffff))
    ) {
      out += REPLACEMENT;
      i += 1;
      continue;
    }

    if (point <= 0xffff) {
      out += String.fromCharCode(point);
    } else {
      const adjusted = point - 0x10000;
      out += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
    i += width;
  }
  return out;
}
