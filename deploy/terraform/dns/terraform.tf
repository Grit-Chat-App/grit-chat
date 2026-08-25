# Backend and provider pins for the grit.chat DNS zone.
#
# Why this is its own root module rather than sharing one with a future hosting
# stack: the zone has to be creatable and fully populated BEFORE anything is
# hosted, because delegation is the irreversible-ish step and it should happen
# against a complete zone. A hosting stack that cannot apply must never be able
# to block a DNS change, and separate state is the only way to guarantee that.
#
# The bucket is deliberately NOT written here. It is supplied at init time with
# -backend-config, so this tree does not assert the existence of a bucket that
# has not been verified from this machine. The prefix is ours to choose, so it
# is literal.
terraform {
  # 1.9 is the floor because variable validation blocks in this module refer to
  # OTHER variables, which older versions reject. That is load bearing here: it
  # is what lets the config refuse an apex ALIAS alongside DNSSEC rather than
  # leaving the operator to read a comment about it.
  required_version = ">= 1.9.0"

  backend "gcs" {
    # bucket supplied by CI: -backend-config="bucket=..."
    prefix = "grit-chat-dns"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.45"
    }
  }
}

provider "google" {
  project = var.project_id
}
