# Derived values: record names, composed policy strings, and the readiness flags
# the delegation check and the outputs both read.

locals {
  # The apex without its trailing dot, for anything that embeds the domain in a
  # string rather than using it as a DNS name.
  apex = trimsuffix(var.dns_name, ".")

  # Exactly one SPF record with exactly one all term, composed rather than
  # hand written, because RFC 7208 section 4.5 makes two v=spf1 records at the
  # same name a permerror and hand assembly is how a second one appears.
  # compact() drops the middle element when no provider has been chosen yet, so
  # the string stays syntactically valid at every stage instead of carrying a
  # double space.
  spf_record = join(" ", compact([
    "v=spf1",
    trimspace(var.mail_spf_terms),
    var.spf_all_qualifier,
  ]))

  # Reports stay in-domain unless overridden. RFC 7489 section 7.1 only demands
  # a _report._dmarc authorisation record when the destination's organisational
  # domain differs from the policy domain, so an in-domain mailbox needs no
  # second record anywhere.
  dmarc_rua = var.dmarc_rua != "" ? var.dmarc_rua : "mailto:dmarc@${local.apex}"

  # adkim and aspf are deliberately absent. Relaxed is the RFC 7489 default for
  # both, and writing the default out adds bytes that can drift from intent
  # without changing behaviour. Strict alignment is a decision to make once the
  # provider's signing domain is known, not a default to inherit.
  dmarc_record = "v=DMARC1; p=${var.dmarc_policy}; sp=${var.dmarc_subdomain_policy}; rua=${local.dmarc_rua}"

  # Cloud DNS holds one record set per name and type, so every TXT string that
  # belongs at the apex has to arrive in a single resource. SPF leads because a
  # verifier reads the first matching record and putting it first costs nothing.
  apex_txt_rrdatas = [
    join(" ", [for s in concat([local.spf_record], var.apex_txt_verification) : "\"${s}\""])
  ]

  # A single DNS character string caps at 255 bytes, and a 2048 bit DKIM key
  # exceeds that, so the value is split and re-quoted. RFC 6376 section 3.6.2.2
  # makes this lossless: "Strings in a TXT RR MUST be concatenated together
  # before use with no intervening whitespace."
  #
  # AIDEV-NOTE: the chunk boundary is bytes, and substr() counts unicode
  # characters. DKIM keys are base64, so every character is one byte and the two
  # agree. A non-ASCII TXT value would need a different split.
  dkim_txt_rrdatas = {
    for selector, value in var.mail_dkim_txt_keys :
    selector => [
      join(" ", [
        for i in range(0, ceil(length(value) / 255)) :
        "\"${substr(value, i * 255, min(255, length(value) - i * 255))}\""
      ])
    ]
  }

  # MX in one of two states, never absent. Absent MX plus an apex address record
  # means RFC 5321 section 5.1 implicit-MX fallback, which routes mail to the web
  # server silently. A null MX refuses it outright instead. RFC 7505 section 3:
  # preference 0 and a zero-length label written as "." means no mail exchanger
  # exists for the domain.
  mx_rrdatas = length(var.mail_mx) > 0 ? var.mail_mx : ["0 ."]

  # Readiness, split in two because the two halves are two different people's
  # decisions and reporting them together would hide which one is missing.
  web_ready = length(var.web_apex_a) > 0 || length(var.web_apex_aaaa) > 0 || var.web_apex_alias != ""

  # Mail readiness is split, and the split is a correction rather than a
  # refinement. This gate previously demanded MX, SPF AND DKIM before it would
  # call the zone delegation-ready, which is a requirement the mechanism cannot
  # satisfy in that order.
  #
  # Google's own DKIM documentation is explicit: the key is generated in the
  # Admin console, and "after you turn on Gmail for your organization, you must
  # wait 24-72 hours before you can get your DKIM key in the Admin console."
  # Turning on Gmail requires the domain to be verified in the tenant, and
  # verifying it requires a resolvable record at the domain. For grit.chat the
  # authoritative nameservers are the seller's parking nameservers, which are not
  # editable here, so that record cannot exist until the zone is delegated.
  #
  # So the old gate was circular: DKIM before delegation, delegation before DKIM.
  # It could never go green in the correct order.
  #
  # What actually has to precede delegation is INBOUND mail. MX decides where
  # mail is delivered and SPF decides who may send as the domain, and both are
  # fixed published values that can be written before anything is provisioned.
  # DKIM only signs outbound mail, and its absence does not misroute or lose a
  # message: with SPF passing, DMARC still passes on the SPF leg alone.
  mail_inbound_ready = length(var.mail_mx) > 0 && var.mail_spf_terms != ""

  # Tracked separately and deliberately NOT part of delegation readiness, so an
  # unsigned zone is visible rather than blocking.
  mail_signing_ready = (length(var.mail_dkim_txt_keys) + length(var.mail_dkim_cname_targets)) > 0

  delegation_ready = local.web_ready && local.mail_inbound_ready
}
