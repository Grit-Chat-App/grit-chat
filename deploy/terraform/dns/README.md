# grit.chat DNS zone

A Google Cloud DNS public zone for `grit.chat`, as Terraform, applied from CI.

This document is what you need to understand and run the module. It deliberately
names no project, no service account, no bucket and no principal, because those
identify one operator's cloud estate rather than describing this module. They are
inputs, listed as variables in [Inputs from the environment](#inputs-from-the-environment),
and the operator runbook that carries their actual values is held privately.

## What this module is, and the one property that shapes it

A zone that is **complete before it is delegated**. Delegation is the
hard-to-reverse step, so every record the domain needs exists and is correct
first, and nothing about the zone is left to a follow-up change.

That is why mail is part of this module rather than a later one, and why several
variables default to empty rather than to a plausible value. **Empty is a real
state here, not a placeholder:** an empty list produces no record at all rather
than a wrong one, and `check.delegation_readiness.tf` refuses to call the zone
delegation-ready until the web and mail groups are both filled.

## The record set, and why each record is there

| name | type | source of value | why |
|---|---|---|---|
| `grit.chat.` | A | `web_apex_a` | The apex cannot be a CNAME. Absent until the host is chosen. |
| `grit.chat.` | AAAA | `web_apex_aaaa` | Same, for hosts that publish IPv6. |
| `grit.chat.` | ALIAS | `web_apex_alias` | Alternative apex shape for a host that gives a hostname. Forecloses DNSSEC. |
| `www.grit.chat.` | CNAME | `web_www_cname` | A bare apex with no `www` fails for everyone who types the prefix out of habit. A CNAME tracks the host's address changes without a zone edit. |
| `www.grit.chat.` | A / AAAA | `web_www_a`, `web_www_aaaa` | For hosts that want address records at `www` instead. Cannot coexist with the CNAME, and a validation enforces that. |
| `grit.chat.` | MX | `mail_mx`, else null MX | Always present, in one of two states. See below. |
| `grit.chat.` | TXT | SPF plus `apex_txt_verification` | One record set, because Cloud DNS holds one per name and type. |
| `_dmarc.grit.chat.` | TXT | `dmarc_policy`, `dmarc_subdomain_policy`, `dmarc_rua` | Stops the domain being spoofed. Governs outbound, so it cannot interfere with an inbound verification message. |
| `<selector>._domainkey.grit.chat.` | TXT | `mail_dkim_txt_keys` | RFC 6376 section 3.6.2.1 fixes this name. Values split into 255 byte chunks. |
| `<selector>._domainkey.grit.chat.` | CNAME | `mail_dkim_cname_targets` | DKIM delegated to the provider's zone, so key rotation needs no change here. |
| `<label>.grit.chat.` | CNAME | `mail_provider_cname_records` | Mail client autodiscovery. A zone with working MX and no autodiscovery record delivers mail no client can be configured for without manual server entry. |
| `grit.chat.` | CAA | `caa_records` | Empty by default and therefore absent. A CAA record naming the wrong CA blocks certificate issuance for the web host and the mail host both, so it lands only once both are known. Absent means any CA may issue, which is the status quo. |

Records deliberately NOT here:

- **No wildcard MX and no wildcard SPF.** The attack they would block, spoofing
  from a subdomain that carries no policy of its own, is already covered by
  DMARC `sp=reject`. A wildcard would later fight any real subdomain that needs
  mail.
- **No SPF-type RR.** RFC 7208 section 3.1: "SPF records MUST be published as a
  DNS TXT (type 16) Resource Record (RR) only."
- **No NS or SOA at the apex.** Cloud DNS owns both. Writing them here would
  fight the service.

## Mail is part of this module, not a follow-up

The reason is mechanical. RFC 5321 section 5.1: "If an empty list of MXs is
returned, the address is treated as if it was associated with an implicit MX RR,
with a preference of 0, pointing to that host."

So a zone delegated with apex address records and no MX does not bounce mail. It
delivers it to the web server, where nothing listens on port 25, and the sender
sees a timeout rather than a refusal. That is the worst available failure: silent,
and unprovable afterwards.

This module closes that hole from the first apply. While `mail_mx` is empty it
publishes a **null MX**, which RFC 7505 section 3 defines as "a single MX RR with
an RDATA section consisting of preference number 0 and a zero-length label,
written in master files as '.'", meaning the domain accepts no mail. Mail then
fails immediately and visibly instead of being routed at the web server. RFC 7505
also states "A domain that advertises a null MX MUST NOT advertise any other MX
RR", which is why this is one record set that switches rather than two that could
both exist.

The apex TXT record is created unconditionally for the same reason. With no
provider chosen the composed value is `v=spf1 -all`, authorising nobody to send
as the domain. An absent SPF record would leave spoofing open from the first
apply.

## The two decisions, and where each lands

Each arrives as a value in a `*.auto.tfvars` file in this directory. Terraform
loads those automatically, so a decision arrives as a committed file reviewed in
a pull request rather than as a local flag nobody else can see.

**Decision 1, the web host.** Lands in `web_apex_a`, `web_apex_aaaa`,
`web_apex_alias`, `web_www_cname`, `web_www_a`, `web_www_aaaa`. Open. The apex
shape is the part that matters: address records keep DNSSEC available, and an
apex ALIAS forecloses it, because Cloud DNS does not support both. A validation
refuses the combination rather than leaving it to a comment.

**Decision 2, the mail provider. Settled as Google Workspace.** The values live
in `mail.auto.tfvars`, which carries the sourcing for each one against Google's
own published documentation. Summary: `mail_mx = ["1 smtp.google.com."]` and
`mail_spf_terms = "include:_spf.google.com"`. DKIM and the domain verification
token are left empty on purpose, because neither exists until the domain is added
to a Workspace tenant and Gmail is switched on for it, and a fabricated DKIM key
publishes a record that fails to verify, which is worse than publishing none.

One deliberate divergence from Google's published string, stated rather than
hidden: Google publishes `~all`, and this module defaults to `-all`. A domain with
no sending history and one sender has no forgotten sender to discover, so the hard
fail is the stronger anti-spoofing posture. `spf_all_qualifier` reverses it in one
line if a second sender appears.

## Inputs from the environment

The module takes its cloud identity from variables rather than hardcoding it, and
`terraform.tf` deliberately omits the state bucket so this tree never asserts the
existence of a bucket nobody has verified. Supply it at init time with
`-backend-config`.

| variable | what it is | effect if unset |
|---|---|---|
| `TF_WIF_PROVIDER` | Workload Identity provider resource path | `plan` and `apply` skip cleanly. Nothing runs, no red check. |
| `TF_SERVICE_ACCOUNT` | Service account the workflow impersonates | Auth fails once the provider is set, so set both together. |
| `GCP_PROJECT` | Project that owns the managed zone, passed as `TF_VAR_project_id` | Terraform errors on a missing required variable. |
| `TF_STATE_BUCKET` | GCS bucket holding Terraform state | `terraform init` fails on an incomplete backend. |
| `GRIT_DNS_APPLY_ENABLED` | Arming switch, `true` only when provisioning is intended | `apply` skips. `plan` still runs. |

These are repository **variables**, not secrets. A Workload Identity provider path
and a service account email are identifiers: the security comes from the
provider's attribute condition and the IAM binding, not from the names being
unknown. Setting them as secrets would only make CI logs harder to read.

## The credential this needs

**One service account, reachable from GitHub Actions by Workload Identity
Federation, and no service account key.** Nothing here needs a downloaded JSON
key and one should not be created: the point of the federation is that the
credential is a short-lived token minted from an OIDC assertion.

Two properties are worth keeping if you re-provision this:

**Not `roles/dns.admin`.** That role carries 49 permissions and this stack uses
16. The excess includes response policies, private zone and network bindings, GKE
cluster bindings and project-wide resolver policies, none of which this stack
touches and all of which affect name resolution beyond this zone. A custom role
with exactly the 16 is the right shape.

**A dedicated identity, not a shared deployer.** A DNS identity should not be
able to deploy services and a service-deploying identity should not be able to
rewrite DNS.

**The federation binding must name one repository.** Grant
`roles/iam.workloadIdentityUser` to the principal set for this repository only,
so a different repository cannot mint this identity. Whether an existing Workload
Identity pool can be reused depends on its provider's attribute condition; adding
a provider is a smaller blast radius than widening an existing condition.

## Running it

`plan` and `apply` run in CI. Locally, only the two commands that touch no state:

```
terraform fmt -check -recursive .
terraform init -backend=false -input=false && terraform validate
```

Both are what the `static` job runs, and both are safe from a workstation because
`-backend=false` means no backend is contacted and no state is read or locked.

## What is not in this document

The operator runbook: which project owns the zone, the actual provider path,
service account, bucket and principal, the registrar-side cutover in order, and
the dated measurements of the domain's delegation and mail state taken during
planning. That is one operator's cloud estate rather than this module's
behaviour, so it is held privately in the company records repository. Nothing was
lost in the split; the two documents together are the original.
