// The UTF-8 decoder that replaced the SDK's TextDecoder call. It runs on every inbound message and
// every channel publication, inside the handler that decides whether an item is accepted, so a
// throw here stalls the whole inbox: that is exactly the failure it exists to prevent (Hermes has
// no TextDecoder, and the ReferenceError repeated every pump tick while the app looked idle).
//
// Fixtures are literal byte sequences rather than an encoder call: the bytes ARE the contract a
// peer puts on the wire, and writing them out means the test cannot drift with a platform global.

import {utf8Decode} from '../src/hop/utf8';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('utf8Decode', () => {
  it('round trips plain ASCII', () => {
    expect(utf8Decode(bytes(0x67, 0x6d, 0x20, 0x61, 0x6c, 0x6c))).toBe('gm all');
  });

  it('decodes two and three byte sequences a message body will carry', () => {
    expect(utf8Decode(bytes(0x63, 0x61, 0x66, 0xc3, 0xa9))).toBe('café');
    expect(utf8Decode(bytes(0xd0, 0x96, 0xd0, 0x96))).toBe('ЖЖ');
    expect(utf8Decode(bytes(0xe6, 0x97, 0xa5, 0xe6, 0x9c, 0xac, 0xe8, 0xaa, 0x9e))).toBe('日本語');
  });

  it('decodes four byte sequences as a surrogate pair, which is the case a hand rolled decoder fails', () => {
    expect(utf8Decode(bytes(0xf0, 0x9f, 0x94, 0xa5))).toBe('🔥');
    expect(utf8Decode(bytes(0x61, 0xf0, 0x9f, 0x94, 0xa5, 0x62))).toBe('a🔥b');
  });

  it('keeps an embedded NUL rather than truncating there', () => {
    expect(utf8Decode(bytes(0x61, 0x00, 0x62))).toBe('a\u0000b');
  });

  it('returns an empty string for empty input', () => {
    expect(utf8Decode(bytes())).toBe('');
  });

  it('never throws on malformed input, because a throw here stalls the inbox', () => {
    const malformed: Uint8Array[] = [
      bytes(0x80), // lone continuation byte
      bytes(0xc3), // truncated two byte sequence
      bytes(0xe2, 0x82), // truncated three byte sequence
      bytes(0xf0, 0x9f, 0x94), // truncated four byte sequence
      bytes(0xc0, 0x80), // overlong encoding of NUL
      bytes(0xed, 0xa0, 0x80), // UTF-16 surrogate half, not legal UTF-8
      bytes(0xff, 0xfe), // not UTF-8 at all
    ];
    for (const input of malformed) {
      expect(() => utf8Decode(input)).not.toThrow();
      expect(utf8Decode(input)).toContain('\uFFFD');
    }
  });

  it('keeps the valid text around a malformed byte rather than discarding the message', () => {
    const decoded = utf8Decode(
      bytes(0x63, 0x61, 0x6d, 0x70, 0x20, 0x80, 0x20, 0x72, 0x61, 0x64, 0x69, 0x6f),
    );
    expect(decoded.startsWith('camp ')).toBe(true);
    expect(decoded.endsWith(' radio')).toBe(true);
  });
});
