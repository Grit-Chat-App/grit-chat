# The managed zone itself.
#
# Creating this zone is safe and reversible: Cloud DNS starts answering for
# grit.chat only once the registrar delegates to the nameservers Google assigns
# here. Until then the zone is authoritative for nothing and nobody queries it.
# That is why zone creation and delegation are two separate steps in the cutover
# rather than one, and why the records go in BEFORE the nameservers move.
resource "google_dns_managed_zone" "grit_chat" {
  project  = var.project_id
  name     = var.zone_name
  dns_name = var.dns_name

  description = "Public DNS for ${local.apex}. Managed in deploy/terraform/dns."

  visibility = "public"

  dnssec_config {
    # Off until delegation is verified. See variables.tf enable_dnssec for the
    # measurement behind that ordering: grit.chat publishes no DS record today,
    # so nothing can break until one is published, and publishing one is a
    # registrar action rather than a Terraform one.
    state = var.enable_dnssec ? "on" : "off"

    # NSEC3 rather than NSEC when signing is turned on, so the zone cannot be
    # walked to enumerate every name in it. This has no effect while state is
    # off.
    non_existence = "nsec3"
  }

  labels = {
    product = "grit-chat"
    managed = "terraform"
  }
}
