# This output is intentionally sensitive. The records themselves will ultimately
# become public DNS, but while Firebase is discovering them they must not be copied
# into a public diff, PR body, or repository variable. The DNS workflow reads the
# output from the private state bucket and writes the records directly.
output "firebase_dns_records" {
  description = "Firebase Hosting desired DNS RRsets grouped by normalized name and type."
  sensitive   = true
  value       = local.firebase_dns_records
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
