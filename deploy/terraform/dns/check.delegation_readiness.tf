# The guard that makes "populate before you delegate" mechanical rather than a
# line in a runbook.
#
# A check block reports on every plan and apply without failing them, which is
# exactly the behaviour wanted here: the zone SHOULD be creatable before the
# host and mailbox decisions are made, because creating it is how the assigned
# nameservers become known, and they cannot be known any earlier. What must not
# happen is delegating to it in that state. So this warns continuously until the
# zone is safe to delegate, and outputs.tf exposes the same fact as a value the
# workflow prints.
check "delegation_readiness" {
  assert {
    condition = local.web_ready
    error_message = join(" ", [
      "NOT READY TO DELEGATE: Firebase Hosting DNS updates are absent or incomplete.",
      "Create the Hosting CustomDomain associations first, then let CI read their",
      "generated desired RRsets from private state and materialize every one here.",
      "The gate requires apex plus www address behavior. Do not copy a static A",
      "record from documentation and call the Firebase ownership and certificate",
      "records complete.",
    ])
  }

  assert {
    condition = local.mail_inbound_ready
    error_message = join(" ", [
      "NOT READY TO DELEGATE: inbound mail incomplete.",
      "Need both mail_mx and mail_spf_terms.",
      "While mail_mx is empty the zone publishes a null MX, so mail hard fails",
      "rather than being routed to the web server, but the domain cannot receive",
      "a verification message in that state.",
    ])
  }

  # Reports without blocking, on purpose. DKIM cannot be obtained before
  # delegation: the key is generated in the mail provider's console after the
  # domain is verified there, and verification needs the zone to be live.
  # Treating that as a delegation blocker would be a circular gate.
  assert {
    condition = local.mail_signing_ready
    error_message = join(" ", [
      "ZONE IS UNSIGNED FOR OUTBOUND MAIL: no DKIM selector.",
      "This does NOT block delegation and is expected before the domain exists in",
      "the mail tenant. Outbound mail still passes DMARC on the SPF leg alone.",
      "Fill mail_dkim_txt_keys once the provider issues a key, which for Google",
      "Workspace is in the Admin console after Gmail is turned on for the domain.",
    ])
  }
}
