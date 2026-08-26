# Firebase records split into non-sensitive RRset identity and sensitive RDATA.
# Terraform refuses to use a sensitive map as `for_each`, while a public plan
# must never reveal Firebase ownership or verification strings. The DNS root uses
# the first map for resource addresses and the second map only for record values.
output "firebase_dns_record_sets" {
  description = "Firebase Hosting desired DNS RRset names and types, grouped by normalized key."
  value       = local.firebase_dns_record_sets
}

output "firebase_dns_rrdatas" {
  description = "Firebase Hosting desired DNS RDATA values keyed by RRset."
  sensitive   = true
  value       = local.firebase_dns_rrdatas
}

output "custom_domain_status" {
  description = "Non-secret Firebase custom-domain states for CI verification after delegation."
  value = {
    apex = {
      cert_state      = try(google_firebase_hosting_custom_domain.apex.cert[0].state, null)
      host_state      = google_firebase_hosting_custom_domain.apex.host_state
      ownership_state = google_firebase_hosting_custom_domain.apex.ownership_state
      reconciling     = google_firebase_hosting_custom_domain.apex.reconciling
    }
    www = {
      cert_state      = try(google_firebase_hosting_custom_domain.www.cert[0].state, null)
      host_state      = google_firebase_hosting_custom_domain.www.host_state
      ownership_state = google_firebase_hosting_custom_domain.www.ownership_state
      reconciling     = google_firebase_hosting_custom_domain.www.reconciling
    }
  }
}
