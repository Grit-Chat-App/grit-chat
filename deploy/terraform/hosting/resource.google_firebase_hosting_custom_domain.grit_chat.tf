# Firebase must first create the CustomDomain objects to tell us the DNS records
# it needs. `wait_dns_verification = false` is load bearing: before GoDaddy
# delegates to Cloud DNS, public DNS cannot see the new zone, so waiting here
# would deadlock record discovery behind the delegation we are trying to prepare.
#
# The resources are protected against destroy. Removing a custom domain is a
# public outage, and a DNS-stack refactor must never silently make it an apply
# side effect.
resource "google_firebase_hosting_custom_domain" "apex" {
  provider = google-beta

  project               = var.project_id
  site_id               = var.hosting_site_id
  custom_domain         = var.apex_domain
  cert_preference       = var.certificate_preference
  deletion_policy       = "PREVENT"
  wait_dns_verification = false
}

resource "google_firebase_hosting_custom_domain" "www" {
  provider = google-beta

  project               = var.project_id
  site_id               = var.hosting_site_id
  custom_domain         = var.www_domain
  redirect_target       = var.apex_domain
  cert_preference       = var.certificate_preference
  deletion_policy       = "PREVENT"
  wait_dns_verification = false
}
