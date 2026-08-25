# Web records. Every one of these is gated on a value being supplied, so the
# zone can be created to obtain its nameservers before the host is chosen, and
# no record is invented in the meantime.
#
# Open decision: the web host. It lands entirely in the variables these read.

# Apex address records. This is the shape for a host that publishes stable IPs,
# and it is the shape proven to work on these nameservers: thebushido.co, also a
# Cloud DNS zone on ns-cloud-b*.googledomains.com, serves its apex as a plain A
# record. Measured with dig on 2026-08-24.
resource "google_dns_record_set" "web_apex_a" {
  count = length(var.web_apex_a) > 0 ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = var.dns_name
  type         = "A"
  ttl          = var.record_ttl
  rrdatas      = var.web_apex_a
}

resource "google_dns_record_set" "web_apex_aaaa" {
  count = length(var.web_apex_aaaa) > 0 ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = var.dns_name
  type         = "AAAA"
  ttl          = var.record_ttl
  rrdatas      = var.web_apex_aaaa
}

# Apex ALIAS. The alternative shape, for a host that gives a hostname instead of
# addresses.
#
# AIDEV-NOTE: two caveats live on the variable rather than here, and both matter
# before anyone selects this path. Google's Cloud DNS documentation states
# "ALIAS records are not compatible with DNSSEC, so you cannot enable DNSSEC on
# a zone with ALIAS records", which is enforced by a validation on
# enable_dnssec. And the Terraform google provider does not document ALIAS as a
# value for `type`; it is passed through to the API untouched, so this path is
# unexercised from here while A/AAAA is proven.
resource "google_dns_record_set" "web_apex_alias" {
  count = var.web_apex_alias != "" ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = var.dns_name
  type         = "ALIAS"
  ttl          = var.record_ttl
  rrdatas      = [var.web_apex_alias]
}

# www. Present because a bare apex with no www is a domain that fails for the
# large fraction of people who type the prefix out of habit, and because a host
# that issues one certificate per name needs the name to exist before it can
# validate it.
resource "google_dns_record_set" "web_www_cname" {
  count = var.web_www_cname != "" ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "www.${var.dns_name}"
  type         = "CNAME"
  ttl          = var.record_ttl
  rrdatas      = [var.web_www_cname]
}

resource "google_dns_record_set" "web_www_a" {
  count = length(var.web_www_a) > 0 ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "www.${var.dns_name}"
  type         = "A"
  ttl          = var.record_ttl
  rrdatas      = var.web_www_a
}

resource "google_dns_record_set" "web_www_aaaa" {
  count = length(var.web_www_aaaa) > 0 ? 1 : 0

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = "www.${var.dns_name}"
  type         = "AAAA"
  ttl          = var.record_ttl
  rrdatas      = var.web_www_aaaa
}
