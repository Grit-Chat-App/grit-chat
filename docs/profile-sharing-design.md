# Profile sharing design

## Scope and public meaning

Grit Chat has no profile directory, account service, contact search endpoint, or received-presence profile API. A profile is never published, indexed, searchable, or returned to an unknown peer.

**Public** means a field is included by default when its owner deliberately shares a bounded profile card with a named, already-saved Hop contact. Public name and contact information also appear in the bounded contact QR card. A QR card never carries a photo. A public photo travels only in the direct card sent to a named contact. Public fields are not published to a server or made searchable on the mesh. **Private** means the field remains on this device unless the owner deliberately includes that field in the named share confirmation. A scanned card is an out-of-band claim and stays pending until the recipient accepts it. There is no peer profile-request mechanism in this change.

The own profile has a required display name and optional contact information and photo. Name, contact information, and photo each have their own public or private scope. A private field is excluded by default in every share confirmation.

## Stored records and migration

The own profile lives under its own AsyncStorage record. It is not a Hop identity secret and does not belong in the keychain. Its photo is copied into the app documents directory; the record stores only its local URI, MIME type, byte count, revision, and scopes.

Contacts separate local and sender-supplied information:

- `localAlias` is written only by the device owner.
- `sharedProfile` is accepted sender data.
- `pendingProfile` is sender data waiting for the recipient's decision.

Display precedence is `localAlias`, then accepted `sharedProfile.name`, then the short Hop address. Receiving a profile never writes `localAlias`. Acceptance moves validated `pendingProfile` into `sharedProfile`; rejection deletes only the pending data.

Existing `grit.contacts.v1` records contain `label`. On load, a legacy label unequal to the generated short address becomes `localAlias`; the generated short address becomes no alias. The normalized record is written before the store is exposed. Existing identity records have no profile data and start with an empty own profile.

## Profile wire contract

Profile cards use a distinct application content type, `application/vnd.grit-chat.profile+json`, over the existing one-to-one `GritSeam.send` path. They are not `text/plain` chat messages and do not appear as bubbles.

The JSON envelope has a schema version (`v: 1`), a monotonically increasing profile revision, field values, and an optional JPEG photo encoded as base64. The receiving handler binds it to the Hop-authenticated inbound sender address rather than trusting a sender address inside JSON. It rejects an unknown version, invalid field types, unsupported image types, oversized JSON, oversized decoded photos, invalid UTF-8, and stale revisions. A scanned QR remains an out-of-band claim and carries no authenticated profile proof.

The complete UTF-8 profile envelope is capped at 40 KiB. A profile photo is JPEG only and capped at 24 KiB before base64 encoding. The picker requests a 512 pixel maximum dimension and JPEG quality reduction, but the byte cap is enforced after selection and again before receiving data is written. Oversize selections and received cards are rejected with a plain explanation. Profile photos are copied to the app documents directory, referenced by URI, removed with their file when the owner removes the photo, and never uploaded to a new backend.

## Receiving and sharing

The contact detail screen names the recipient in the share confirmation. It shows public fields that will be included and private fields as opt-in controls. Confirming is the explicit action that sends a profile card to that one address.

Incoming valid cards create a pending profile associated with the authenticated sender address. The recipient sees the pending card and can accept or reject it. Accepting updates only `sharedProfile`; a local alias remains untouched. Rejecting retains the contact and local alias while discarding the pending card.

## Delivery presentation

The primary conversation row uses compact text only: `Sending`, `Waiting for delivery`, `Delivered · 2 hops`, and `Not delivered`. The app has no resend operation today, so it must not label an unconfirmed send as `Retrying`. When an actual retry operation exists, its compact state can be `Retrying` and is tested separately. Numeric peer handoff and hop information remain durable and are available in a secondary details disclosure. The React Native Hop SDK does not expose a named route, so the UI does not claim one.
