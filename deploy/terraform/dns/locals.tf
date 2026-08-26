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

  # Firebase returns record data without Cloud DNS's required outer TXT quotes.
  # Keep RRset identity separate from sensitive RDATA. Terraform must know the
  # former for `for_each`, while plan logs must not disclose the latter.
  firebase_dns_record_sets = {
    for key, record_set in var.firebase_dns_record_sets : key => {
      name = endswith(record_set.name, ".") ? record_set.name : "${record_set.name}."
      type = record_set.type
    }
  }

  firebase_dns_rrdatas = {
    for key, record_set in local.firebase_dns_record_sets : key => [
      for rdata in lookup(var.firebase_dns_rrdatas, key, []) :
      record_set.type == "TXT" ? "\"${rdata}\"" : (
        record_set.type == "CNAME" && !endswith(rdata, ".") ? "${rdata}." : rdata
      )
    ]
  }

  firebase_dns_rrdatas_complete = (
    length(local.firebase_dns_record_sets) > 0 &&
    alltrue([
      for key in keys(local.firebase_dns_record_sets) :
      length(lookup(var.firebase_dns_rrdatas, key, [])) > 0
    ])
  )

  # Cloud DNS holds one apex TXT RRset. Firebase ownership data therefore joins
  # SPF and future Workspace verification data here rather than becoming a second
  # google_dns_record_set that fights the mail resource.
  firebase_apex_txt_values = lookup(
    var.firebase_dns_rrdatas,
    "${local.apex}|TXT",
    [],
  )

  # SPF leads because it is stable and every other apex TXT value joins its same
  # record set. Firebase data is emitted by the Hosting control-plane state and
  # is known only after CustomDomain discovery succeeds.
  apex_txt_rrdatas = [
    join(" ", [
      for value in concat(
        [local.spf_record],
        var.apex_txt_verification,
        local.firebase_apex_txt_values,
      ) : "\"${value}\""
    ])
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

  # Firebase Hosting is the selected web host. A literal A record copied from a
  # guide is not enough to authorize delegation: Firebase generates ownership,
  # ACME and conditionally CAA records per CustomDomain. The Hosting root exposes
  # all of them through private state, and this root writes all of them. Requiring
  # both apex and www address behavior keeps a missing www association from
  # reading as a complete web deployment.
  firebase_apex_ready = anytrue([
    for record_set in values(local.firebase_dns_record_sets) :
    trimsuffix(record_set.name, ".") == local.apex &&
    contains(["A", "AAAA"], record_set.type)
  ])

  firebase_www_ready = anytrue([
    for record_set in values(local.firebase_dns_record_sets) :
    trimsuffix(record_set.name, ".") == "www.${local.apex}" &&
    contains(["A", "AAAA", "CNAME"], record_set.type)
  ])

  # The completeness result is a boolean, not record content. Explicitly remove
  # sensitivity so CI can print a safe readiness verdict without exporting the
  # verification strings it inspected.
  firebase_dns_ready = (
    nonsensitive(local.firebase_dns_rrdatas_complete) &&
    local.firebase_apex_ready &&
    local.firebase_www_ready
  )

  web_ready = local.firebase_dns_ready
  # Mail readiness is split. DKIM is issued by Workspace only after the domain
  # is verified in that tenant. Domain verification needs a resolvable record,
  # which cannot happen until GoDaddy delegates to Cloud DNS. Requiring DKIM
  # before delegation would recreate the circular gate this module was built to
  # prevent.
  #
  # What must precede delegation is INBOUND mail. MX decides where mail is
  # delivered and SPF authorizes its sender. DKIM signs outbound mail later;
  # with SPF aligned, DMARC still passes on its SPF leg while the Workspace key
  # is pending.
  mail_inbound_ready = length(var.mail_mx) > 0 && var.mail_spf_terms != ""

  # Tracked separately and deliberately NOT part of delegation readiness, so an
  # unsigned zone is visible rather than blocking.
  mail_signing_ready = (length(var.mail_dkim_txt_keys) + length(var.mail_dkim_cname_targets)) > 0

  delegation_ready = local.web_ready && local.mail_inbound_ready
}
