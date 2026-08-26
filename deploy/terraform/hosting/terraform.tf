# Firebase Hosting control plane for grit.chat.
#
# This root deliberately owns only the Hosting custom-domain associations. The
# Firebase project and default Hosting site already exist, verified privately
# before this tree was written. Recreating either in Terraform would produce a
# 409 or force an import, neither of which is a DNS concern.
#
# The Hosting API creates the desired DNS records after it creates a CustomDomain.
# This root exposes those generated records through private Terraform state. The
# DNS root consumes that output during its second CI phase, so public source never
# carries a copied verification token, ACME challenge, or provider-generated value.
terraform {
  required_version = ">= 1.9.0"

  backend "gcs" {
    # Bucket supplied only in CI: -backend-config="bucket=...".
    # It is intentionally absent from public source.
    prefix = "grit-chat-hosting"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.45"
    }

    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.45"
    }
  }
}

provider "google" {
  project = var.project_id
}

provider "google-beta" {
  project = var.project_id
}
