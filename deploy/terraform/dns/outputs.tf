# The nameservers are the whole point of this stack, and they are the one value
# that CANNOT be known before the zone exists. Cloud DNS assigns a set per zone
# at creation. Nothing in this tree writes an example set, because a plausible
# looking placeholder in a nameserver field is the kind of value that gets
# pasted into a registrar by mistake.
output "name_servers" {
  description = "Nameservers Cloud DNS assigned to this zone. Give these to the registrar, and only after delegation_ready is true."
  value       = google_dns_managed_zone.grit_chat.name_servers
}

output "zone_name" {
  description = "Cloud DNS managed zone resource name, for gcloud dns commands."
  value       = google_dns_managed_zone.grit_chat.name
}

output "delegation_ready" {
  description = <<-EOT
    True only when the zone carries both web records and a complete mail record
    set. Do not change nameservers at the registrar while this is false: see
    check.delegation_readiness for what each half means.
  EOT
  value       = local.delegation_ready
}

output "web_ready" {
  description = "True when the apex has address records or an ALIAS."
  value       = local.web_ready
}

output "mail_inbound_ready" {
  description = "True when MX and SPF are both present. This is the mail half of delegation readiness, because inbound delivery is what a nameserver change can break."
  value       = local.mail_inbound_ready
}

output "mail_signing_ready" {
  description = "True when at least one DKIM selector is present. Deliberately NOT part of delegation_ready: the key is issued by the mail provider after the domain is verified there, which cannot happen before the zone is live."
  value       = local.mail_signing_ready
}

output "spf_record" {
  description = "The composed SPF string, so a reviewer can read what will be published without decoding the locals."
  value       = local.spf_record
}

output "dmarc_record" {
  description = "The composed DMARC string, for the same reason."
  value       = local.dmarc_record
}

output "mx_rrdatas" {
  description = "The MX rrdatas that will be published. A single '0 .' entry is the null MX, meaning the domain accepts no mail yet."
  value       = local.mx_rrdatas
}

output "dnssec_state" {
  description = "Signing state of the zone. Publishing a DS record at the registrar is a separate manual step and is the one that can break resolution."
  value       = google_dns_managed_zone.grit_chat.dnssec_config[0].state
}
