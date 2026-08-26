# Firebase Hosting supplies this map after its CustomDomain associations exist.
# The Hosting root owns discovery with wait_dns_verification=false; this root owns
# the public DNS record sets. Each entry is a complete RRset grouped by name and
# type, which is mandatory because google_dns_record_set is authoritative for the
# whole set and would otherwise erase sibling values on a later apply.
#
# Apex TXT is the one exception. It shares the mail resource with SPF and future
# Workspace verification data, so locals merges it there instead of creating a
# second conflicting TXT resource.
resource "google_dns_record_set" "firebase" {
  for_each = {
    for key, record_set in local.firebase_dns_record_sets : key => record_set
    if !(record_set.name == var.dns_name && record_set.type == "TXT")
  }

  project      = var.project_id
  managed_zone = google_dns_managed_zone.grit_chat.name
  name         = each.value.name
  type         = each.value.type
  ttl          = var.record_ttl
  rrdatas      = local.firebase_dns_rrdatas[each.key]
}
