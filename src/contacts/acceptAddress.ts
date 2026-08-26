// Accepting an address that came in through the scanner, as one pure function.
//
// It takes the two side effects as arguments (validate with the SDK's decoder, add to the
// store) so the decision logic is testable without a camera, a native module, or a seam.
// The scanner fires repeatedly while a code is in frame, so the screen debounces before
// calling this; this function itself must be safe to call more than once, and adding an
// existing contact is reported rather than treated as an error.

import {parseContactCard, type ScannedContactCard} from './contactCard';

export interface AcceptAddressOutcome {
  ok: boolean;
  address?: string;
  /** Unauthenticated public text supplied in a scanned QR contact card. */
  profile?: ScannedContactCard['profile'];
  /** What the user should see when ok is false. */
  reason?: string;
}

export async function acceptScannedAddress(
  validate: (text: string) => Promise<boolean>,
  add: (address: string) => Promise<void>,
  ownAddress: string,
  scanned: string,
): Promise<AcceptAddressOutcome> {
  const text = scanned.trim();
  if (text.length === 0) {
    return {ok: false, reason: 'That code was empty.'};
  }
  let card: ScannedContactCard | null;
  try {
    card = parseContactCard(text);
  } catch (e) {
    return {ok: false, reason: String(e)};
  }
  const address = card?.address ?? text;
  if (address === ownAddress) {
    return {ok: false, reason: 'That is this device, not a peer.'};
  }
  const valid = await validate(address);
  if (!valid) {
    return {ok: false, reason: 'Not a Hop address. A base58 encoding of 32 bytes is expected.'};
  }
  await add(address);
  return {ok: true, address, profile: card?.profile};
}
