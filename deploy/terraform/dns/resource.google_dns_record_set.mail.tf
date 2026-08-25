# Mail records.
#
# These are NOT a follow-up task, and the reason is mechanical rather than
# stylistic. RFC 5321 section 5.1: "If an empty list of MXs is returned, the
# address is treated as if it was associated with an implicit MX RR, with a
# preference of 0, pointing to that host." So a zone delegated with web address
# records and no MX does not bounce mail. It delivers mail to the web server,
# where nothing is listening on port 25, and the sender sees a timeout rather
# than a refusal.
#
# That failure mode is why Apple's contract language matters here. Apple deems
# notices given when SENT, so a verification message that dies in that hole
# still counts as delivered against you, and there is nothing to point at
# afterwards.
#
# Open decision: the mail provider. It lands in mail_mx, mail_spf_terms and one
# of mail_dkim_txt_keys or mail_dkim_cname_targets.

# MX, always present, in one of two states.
#
# With no provider chosen this publishes a null MX: RFC 7505 section 3 defines
# "a single MX RR with an RDATA section consisting of preference number 0 and a
# zero-length label, written in master files as '.'" to mean the domain accepts
# no mail. That converts the silent implicit-MX fallback above into an immediate
# permanent failure, which is the honest answer for a domain with no mailbox and
# is strictly safer than leaving MX absent.
#
# RFC 7505 section 3 also states "A domain that advertises a null MX MUST NOT
# advertise any other MX RR", which is why this is one record set that switches
# rather than two that could both exist.
resource "google_dns_record_set" "mail_mx" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = var.dns_name
  type         = "MX"
  ttl          = var.record_ttl
  rrdatas      = local.mx_rrdatas
}

# Apex TXT: SPF plus any ownership verification tokens, in ONE record set.
#
# Cloud DNS holds one record set per name and type. A second google_dns_record_set
# for TXT at the apex does not add strings to this one, it collides with it, so
# combining them here is the only correct shape rather than a convenience.
#
# This is created unconditionally. With no provider chosen the composed value is
# "v=spf1 -all", which authorises nobody to send as the domain. That is the
# correct posture for a domain with no sender and it closes spoofing from the
# first apply, where an absent SPF record would leave it open.
resource "google_dns_record_set" "mail_apex_txt" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = var.dns_name
  type         = "TXT"
  ttl          = var.record_ttl
  rrdatas      = local.apex_txt_rrdatas
}

# DMARC, always present.
#
# RFC 7489 puts the policy at _dmarc.<domain> as TXT. Publishing it before any
# mail flows is the right order: DMARC governs mail SENT as this domain, so it
# cannot interfere with an inbound verification message, and its absence is what
# lets a spoofed sender through unchallenged.
resource "google_dns_record_set" "mail_dmarc" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "_dmarc.${var.dns_name}"
  type         = "TXT"
  ttl          = var.record_ttl
  rrdatas      = ["\"${local.dmarc_record}\""]
}

# DKIM as TXT keys, one record set per selector.
#
# RFC 6376 section 3.6.2.1 fixes the name: "All DKIM keys are stored in a
# subdomain named '_domainkey'", queried as "<selector>._domainkey.<domain>".
# Values arrive pre-split into 255 byte quoted chunks from locals, because a
# 2048 bit key exceeds the single character string limit.
resource "google_dns_record_set" "mail_dkim_txt" {
  for_each = local.dkim_txt_rrdatas

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "${each.key}._domainkey.${var.dns_name}"
  type         = "TXT"
  ttl          = var.record_ttl
  rrdatas      = each.value
}

# DKIM delegated by CNAME, one record set per selector. Preferred over a TXT key
# where the provider offers it, because the provider can then rotate the key in
# its own zone without a change here.
resource "google_dns_record_set" "mail_dkim_cname" {
  for_each = var.mail_dkim_cname_targets

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "${each.key}._domainkey.${var.dns_name}"
  type         = "CNAME"
  ttl          = var.record_ttl
  rrdatas      = [each.value]
}

# Mail client autodiscovery names the provider requires. A zone with working MX
# and no autodiscovery record delegates mail that arrives but that no client can
# be configured for without manual server entry.
resource "google_dns_record_set" "mail_provider_cname" {
  for_each = var.mail_provider_cname_records

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "${each.key}.${var.dns_name}"
  type         = "CNAME"
  ttl          = var.record_ttl
  rrdatas      = [each.value]
}

# CAA. Empty by default and therefore absent by default, which leaves issuance
# open exactly as it is today. A CAA record that names the wrong CA blocks
# certificate issuance for both the web host and the mail host, so it lands only
# once both are known. See variables.tf caa_records.
resource "google_dns_record_set" "caa" {
  count = length(var.caa_records) > 0 ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = var.dns_name
  type         = "CAA"
  ttl          = var.record_ttl
  rrdatas      = var.caa_records
}
