variable "project_id" {
  description = "GCP project that contains the existing Firebase project and Hosting site. Supplied by protected CI configuration."
  type        = string
  nullable    = false
}

variable "hosting_site_id" {
  description = <<-EOT
    Existing Firebase Hosting site ID. Supplied by protected CI configuration so
    the public repository does not carry an operator project identifier.
  EOT
  type        = string
  nullable    = false
}

variable "apex_domain" {
  description = "Canonical Firebase Hosting custom domain."
  type        = string
  nullable    = false
  default     = "grit.chat"
}

variable "www_domain" {
  description = "Noncanonical Firebase Hosting custom domain, redirected to apex after DNS verification."
  type        = string
  nullable    = false
  default     = "www.grit.chat"
}

variable "certificate_preference" {
  description = <<-EOT
    Firebase Hosting certificate preference. Blaze permits a dedicated
    certificate, the explicit choice here. The project billing link is verified
    before any write and is a prerequisite for this value.
  EOT
  type        = string
  nullable    = false
  default     = "DEDICATED"

  validation {
    condition     = contains(["GROUPED", "PROJECT_GROUPED", "DEDICATED"], var.certificate_preference)
    error_message = "certificate_preference must be GROUPED, PROJECT_GROUPED or DEDICATED."
  }
}
