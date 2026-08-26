# Inputs for the grit.chat zone.
#
# Two decisions are open at the time this was written, and both are represented
# here as values with EMPTY defaults rather than as guesses:
#
#   1. The web host. It lands in web_apex_a / web_apex_aaaa / web_apex_alias
#      and web_www_*.
#   2. The mail provider. It lands in mail_mx, mail_spf_terms and one of
#      mail_dkim_txt_keys or mail_dkim_cname_targets.
#
# Empty is a real state here, not a placeholder: an empty list produces no
# record at all rather than a wrong one, and check.delegation_readiness refuses
# to call the zone delegation-ready until both groups are filled.

variable "project_id" {
  description = <<-EOT
    GCP project that owns the managed zone. Supplied only by protected CI
    configuration so no operator project identifier appears in public source.
  EOT
  type        = string
  nullable    = false
}

variable "dns_name" {
  description = "Zone apex as a fully qualified name, trailing dot included."
  type        = string
  nullable    = false
  default     = "grit.chat."

  validation {
    condition     = endswith(var.dns_name, ".")
    error_message = "dns_name must be fully qualified and end with a dot, for example grit.chat."
  }
}

variable "zone_name" {
  description = <<-EOT
    Cloud DNS managed zone resource name. Lowercase letters, digits and
    hyphens only, so the dot in the domain cannot be used.
  EOT
  type        = string
  nullable    = false
  default     = "grit-chat"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,62}$", var.zone_name))
    error_message = "zone_name must start with a letter and contain only lowercase letters, digits and hyphens."
  }
}

variable "record_ttl" {
  description = <<-EOT
    TTL in seconds for every record this module creates.

    300 on purpose, and low on purpose: a short TTL is what makes a mistake
    during the cutover cheap to undo. Raise it deliberately once the zone has
    been serving correctly for a while, because a long TTL on a wrong record is
    an outage measured in cache lifetimes rather than in minutes.
  EOT
  type        = number
  nullable    = false
  default     = 300
}

# ---------------------------------------------------------------------------
# Open decision 1: the web host.
# ---------------------------------------------------------------------------

variable "web_apex_a" {
  description = <<-EOT
    IPv4 addresses for the apex. Cloud DNS forbids a CNAME at the apex because
    a CNAME cannot coexist with the SOA and NS records the apex must carry, so
    a host that publishes stable IPs is served with A records here.
  EOT
  type        = list(string)
  nullable    = false
  default     = []
}

variable "web_apex_aaaa" {
  description = "IPv6 addresses for the apex, if the chosen host publishes any."
  type        = list(string)
  nullable    = false
  default     = []
}

variable "web_apex_alias" {
  description = <<-EOT
    Apex ALIAS target, for a host that gives you a hostname rather than stable
    addresses. Fully qualified, trailing dot included.

    Two warnings, both from Google's own documentation on Cloud DNS record
    types:

      "An ALIAS record is a Cloud DNS custom record type that behaves like a
      CNAME record but can only be used at the zone apex"

      "ALIAS records are not compatible with DNSSEC, so you cannot enable
      DNSSEC on a zone with ALIAS records."

    So choosing an ALIAS apex forecloses the last step of the cutover. The
    validation on enable_dnssec enforces that rather than trusting this comment.

    Second warning, and this one is about the tooling rather than the service:
    the Terraform google provider documents `type` as a free string and does not
    name ALIAS as a supported value, so this path is passed straight through to
    the API and has not been exercised from here. A/AAAA is the proven path on
    these nameservers.
  EOT
  type        = string
  nullable    = false
  default     = ""

  validation {
    condition     = var.web_apex_alias == "" || endswith(var.web_apex_alias, ".")
    error_message = "web_apex_alias must be fully qualified and end with a dot."
  }

  validation {
    condition     = var.web_apex_alias == "" || (length(var.web_apex_a) == 0 && length(var.web_apex_aaaa) == 0)
    error_message = "web_apex_alias cannot be combined with web_apex_a or web_apex_aaaa. ALIAS synthesises the address records itself, so both would be answering the same query."
  }
}

variable "web_www_cname" {
  description = <<-EOT
    CNAME target for www, fully qualified with a trailing dot. Most hosts
    prefer this for a subdomain, because it tracks the host's own address
    changes without a zone edit.
  EOT
  type        = string
  nullable    = false
  default     = ""

  validation {
    condition     = var.web_www_cname == "" || endswith(var.web_www_cname, ".")
    error_message = "web_www_cname must be fully qualified and end with a dot."
  }
}

variable "web_www_a" {
  description = <<-EOT
    IPv4 addresses for www, for a host that wants address records there rather
    than a CNAME.
  EOT
  type        = list(string)
  nullable    = false
  default     = []

  validation {
    condition     = length(var.web_www_a) == 0 || var.web_www_cname == ""
    error_message = "www cannot carry both a CNAME and address records. A CNAME cannot coexist with other data at the same name."
  }
}

variable "web_www_aaaa" {
  description = "IPv6 addresses for www, if the chosen host publishes any."
  type        = list(string)
  nullable    = false
  default     = []

  validation {
    condition     = length(var.web_www_aaaa) == 0 || var.web_www_cname == ""
    error_message = "www cannot carry both a CNAME and address records. A CNAME cannot coexist with other data at the same name."
  }
}

# ---------------------------------------------------------------------------
# Firebase Hosting generated records.
# ---------------------------------------------------------------------------

variable "firebase_dns_record_sets" {
  description = <<-EOT
    Firebase Hosting desired DNS RRset names and types, grouped by normalized
    "<name>|<type>" key. CI obtains this non-sensitive structural map from the
    private Hosting Terraform state after CustomDomain discovery.
  EOT
  type = map(object({
    name = string
    type = string
  }))
  nullable = false
  default  = {}
}

variable "firebase_dns_rrdatas" {
  description = <<-EOT
    Firebase Hosting desired DNS RDATA keyed by the same normalized keys as
    firebase_dns_record_sets. This includes ownership and verification strings,
    so it is sensitive. CI reads it from private state into a temporary tfvars
    file and it must never be committed, logged, or stored as a repository
    variable.
  EOT
  type        = map(list(string))
  sensitive   = true
  nullable    = false
  default     = {}
}

# ---------------------------------------------------------------------------
# Open decision 2: the mail provider.
# ---------------------------------------------------------------------------

variable "mail_mx" {
  description = <<-EOT
    Full MX rrdata strings, preference first, target fully qualified with a
    trailing dot. Example shape, NOT a recommendation and NOT a real host:
    ["10 mx1.example.net.", "20 mx2.example.net."].

    RFC 5321 section 5.1 requires the MX target to be a domain name that
    resolves to an address record, and says a target which itself returns a
    CNAME "lies outside the scope of this Standard". So point MX at a real
    hostname, never at a CNAME and never at a literal address.

    Leaving this empty is not neutral. RFC 5321 section 5.1: "If an empty list
    of MXs is returned, the address is treated as if it was associated with an
    implicit MX RR, with a preference of 0, pointing to that host." With web
    records present and no MX, mail for the domain is therefore delivered to
    the WEB SERVER rather than bounced, which fails silently instead of loudly.
    That is the reason mail records are part of this module rather than a
    follow-up.
  EOT
  type        = list(string)
  nullable    = false
  default     = []
}

variable "mail_spf_terms" {
  description = <<-EOT
    The mechanism section of the SPF record, without the v=spf1 prefix and
    without the trailing all qualifier. Both of those are added by locals, so
    there is exactly one SPF record and exactly one all term.

    Example shape, NOT a recommendation: "include:spf.example.net".

    RFC 7208 section 3.1: "SPF records MUST be published as a DNS TXT (type 16)
    Resource Record (RR) only." Section 4.5: if the record set "includes more
    than one record, check_host() produces the 'permerror' result", which is why
    this is a single composed string and not a list of records.

    RFC 7208 section 4.6.4 caps the terms that cause DNS queries at 10:
    "include", "a", "mx", "ptr", "exists" and the "redirect" modifier. Exceeding
    it is a permerror, so keep the include count small.
  EOT
  type        = string
  nullable    = false
  default     = ""
}

variable "spf_all_qualifier" {
  description = <<-EOT
    Qualifier on the trailing all mechanism. "-all" is a hard fail and is the
    right choice for a brand new domain, because there is no legacy sender to
    discover and break: the set of legitimate senders is exactly the provider
    named in mail_spf_terms. "~all" is a soft fail and only exists here for the
    case where a second sender is being added and its inclusion is not yet
    proven.
  EOT
  type        = string
  nullable    = false
  default     = "-all"

  validation {
    condition     = contains(["-all", "~all", "?all"], var.spf_all_qualifier)
    error_message = "spf_all_qualifier must be one of -all, ~all or ?all. '+all' is never valid here: it authorises the entire internet to send as this domain."
  }
}

variable "mail_dkim_txt_keys" {
  description = <<-EOT
    DKIM public keys as TXT records, keyed by selector. The key is the selector
    alone and the value is the full record body, for example
    { "s1" = "v=DKIM1; k=rsa; p=MIIBIjAN..." }.

    RFC 6376 section 3.6.2.1: "All DKIM keys are stored in a subdomain named
    '_domainkey'. Given a DKIM-Signature field with a 'd=' tag of 'example.com'
    and an 's=' tag of 'foo.bar', the DNS query will be for
    'foo.bar._domainkey.example.com'." locals builds that name, so the map key
    is just the selector.

    The selector and the key material both come from the mail provider, so this
    cannot be filled before a provider exists and has issued a key. That is a
    genuine ordering dependency, not an oversight.

    Long values are handled: a DKIM key exceeds the 255 byte limit on a single
    DNS character string, and locals splits it into 255 byte chunks. RFC 6376
    section 3.6.2.2 makes that safe: "Strings in a TXT RR MUST be concatenated
    together before use with no intervening whitespace."
  EOT
  type        = map(string)
  nullable    = false
  default     = {}
}

variable "mail_dkim_cname_targets" {
  description = <<-EOT
    DKIM delegated by CNAME, keyed by selector, for providers that host the key
    in their own zone and rotate it there rather than handing you key material.
    Values fully qualified with a trailing dot.

    This is the shape that survives provider key rotation without a zone edit,
    so prefer it when the provider offers it.
  EOT
  type        = map(string)
  nullable    = false
  default     = {}

  validation {
    condition     = length(setintersection(keys(var.mail_dkim_cname_targets), keys(var.mail_dkim_txt_keys))) == 0
    error_message = "A DKIM selector cannot be both a TXT key and a CNAME delegation. RFC 6376 section 3.6.2.2: TXT RRs must be unique for a selector, and a CNAME cannot coexist with other data at the same name."
  }
}

variable "mail_provider_cname_records" {
  description = <<-EOT
    Extra CNAME records the mail provider requires, keyed by label relative to
    the apex, values fully qualified with a trailing dot. Example shape:
    { "autodiscover" = "autodiscover.example.net." }.

    This exists because mailbox providers commonly require client autodiscovery
    names, and a zone that omits them delegates working DNS with broken mail
    client setup, which is the same class of defect as a missing MX but quieter.
  EOT
  type        = map(string)
  nullable    = false
  default     = {}
}

# ---------------------------------------------------------------------------
# DMARC.
# ---------------------------------------------------------------------------

variable "dmarc_policy" {
  description = <<-EOT
    DMARC policy for the apex. "reject" is the default and is defensible here
    rather than reckless, for a reason specific to a brand new domain: p=reject
    tells receivers to discard mail that fails both SPF and DKIM alignment, and
    on a domain that has never sent mail there is no unknown legitimate sender
    to discover. The usual argument for starting at p=none is to find senders
    you forgot about, and there are none.

    Note this affects mail SENT as the domain, not mail received by it, so it
    cannot interfere with an inbound verification message.
  EOT
  type        = string
  nullable    = false
  default     = "reject"

  validation {
    condition     = contains(["none", "quarantine", "reject"], var.dmarc_policy)
    error_message = "dmarc_policy must be none, quarantine or reject."
  }
}

variable "dmarc_subdomain_policy" {
  description = <<-EOT
    DMARC policy for subdomains, the sp tag. "reject" closes the gap that a
    policy on the apex alone leaves open, which is spoofing from a subdomain
    that has no DMARC record of its own. This is why the module publishes no
    wildcard MX or wildcard SPF: sp covers the same attack without a wildcard
    that would later fight a real subdomain.
  EOT
  type        = string
  nullable    = false
  default     = "reject"

  validation {
    condition     = contains(["none", "quarantine", "reject"], var.dmarc_subdomain_policy)
    error_message = "dmarc_subdomain_policy must be none, quarantine or reject."
  }
}

variable "dmarc_rua" {
  description = <<-EOT
    Aggregate report destination. Empty means locals derives dmarc@<apex>,
    which is deliberate: RFC 7489 section 7.1 requires a _report._dmarc
    authorisation record at the RECEIVING domain whenever the report
    destination's organisational domain differs from the policy domain. Keeping
    reports in-domain avoids that second record entirely.

    The mailbox has to actually exist, which is another reason the mailbox
    decision and the zone are one step.
  EOT
  type        = string
  nullable    = false
  default     = ""
}

# ---------------------------------------------------------------------------
# Verification tokens, CAA and DNSSEC.
# ---------------------------------------------------------------------------

variable "apex_txt_verification" {
  description = <<-EOT
    Domain ownership verification strings that must sit at the apex as TXT,
    such as a mail provider or app store console token. Values WITHOUT
    surrounding quotes; locals adds them.

    These share the apex TXT record set with SPF on purpose. Cloud DNS holds one
    record set per name and type, so a second google_dns_record_set for TXT at
    the apex would collide with the first rather than adding to it. Putting them
    in one resource is the only correct shape.
  EOT
  type        = list(string)
  nullable    = false
  default     = []
}

variable "caa_records" {
  description = <<-EOT
    CAA rrdata strings, for example ["0 issue \"pki.goog\""].

    Empty by default, and that is the safe direction rather than laziness: no
    CAA record means any CA may issue, which is the status quo for this domain
    today. A CAA record that omits the CA the chosen web host or mail host
    actually uses BLOCKS certificate issuance, so this can only be filled once
    both hosts are known. Getting it wrong fails closed on TLS, which is a
    worse outage than not having it.
  EOT
  type        = list(string)
  nullable    = false
  default     = []
}

variable "enable_dnssec" {
  description = <<-EOT
    Sign the zone. Off by default because signing belongs at the END of the
    cutover, after delegation is verified.

    Measured on 2026-08-24 rather than assumed: the .chat registry returns
    NOERROR with an empty answer and an opt-out NSEC3 proof for grit.chat DS,
    so the domain publishes no DS record and is an insecure delegation today.
    That is what makes this cutover low risk: with no DS at the parent, no
    nameserver change can produce a validation failure, because there is no
    chain of trust to break.

    Turning this on creates keys and signs the zone. It does NOT publish a DS
    record: that is a registrar action, and it is the step that can take the
    domain down if the DS does not match the live key.
  EOT
  type        = bool
  nullable    = false
  default     = false

  validation {
    condition     = !(var.enable_dnssec && var.web_apex_alias != "")
    error_message = "Cloud DNS cannot sign a zone that contains ALIAS records. Choose address records at the apex, or leave DNSSEC off."
  }
}
