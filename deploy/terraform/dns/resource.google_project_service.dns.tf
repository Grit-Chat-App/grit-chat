# Cloud DNS is disabled in the newly created Grit project today. Terraform owns
# enabling it, and the zone waits on that operation instead of relying on a
# console click or a separately remembered gcloud command.
resource "google_project_service" "dns" {
  project            = var.project_id
  service            = "dns.googleapis.com"
  disable_on_destroy = false
}
