# Mail provider decision: Google Workspace at grit.chat.
#
# Terraform loads *.auto.tfvars automatically, so this file IS the decision
# record. It is committed rather than held locally on purpose: a decision that
# changes what the zone publishes should be reviewable in a pull request.
#
# WHY THIS FILE HAS NOT CHANGED WHILE THE ACCOUNT SHAPE DID, TWICE
#
# The tenant is settled: grit.chat joins the bushido collective's Workspace
# account as an additional domain, the same way hopme.sh already sits on it.
# Rejected along the way: an alias on the personal waldrip.net tenant, and a
# standalone Grit Chat tenant.
#
# None of those reversals touched a value in this file, and that is a property of
# Google rather than luck. Every Workspace domain uses the same MX host, the same
# SPF include and the same google._domainkey DKIM record regardless of whether it
# is an alias, a secondary, or a primary, and regardless of which tenant holds it.
#
# Proven on the collective's own tenant rather than only read: thebushido.co
# serves the legacy five-host MX set while hopme.sh serves the modern single host,
# both with include:_spf.google.com and a DKIM key at selector google, and both
# deliver. Two domains, one tenant, two MX vintages, both working. The record set
# tracks WHEN a domain was set up, not what role it plays.
#
# One distinction is still open and it does not affect DNS: an alias domain gives
# every existing user and group on the tenant an @grit.chat address into their own
# mailbox, while a secondary domain creates one mailbox at one licence. That is a
# billing and delivery question, not a records question.
#
# SOURCING RULE APPLIED HERE
#
# Every value below is taken from Google's own published documentation for a
# domain being set up now. Records that an existing tenant happens to serve were
# used only to confirm the documentation describes something real, never as the
# source of the value. That distinction changed one of these values: see MX.

# ---------------------------------------------------------------------------
# MX
# ---------------------------------------------------------------------------
#
# ONE host, not five. From "Set up MX records for Google Workspace"
# (support.google.com/a/answer/174125), fetched 2026-08-24:
#
#   "The Google Workspace MX record value is smtp.google.com."
#
# and the table on that page gives "Priority 1", "Value / Answer / Destination
# smtp.google.com".
#
# The five-host aspmx set is on the same page under the heading "Legacy MX record
# values", and it is scoped to existing domains rather than new ones:
#
#   "If you started using Google Workspace before 2023, your domain might have
#   different MX record values that start with 'aspmx'. If your email is working,
#   no changes are required. Any account can use the new single MX record value,
#   but the legacy MX record values are still supported."
#
# grit.chat is a new domain, so the published value for it is the single host.
# waldrip.net and thebushido.co both serve the five-host legacy set, which is
# exactly the reason not to copy a live tenant: those zones predate 2023 and
# carry a configuration Google now documents as legacy.
#
# The trailing dot is required by Cloud DNS. Google's page anticipates this:
# "some domain registrars require a period at the end (smtp.google.com.)".
mail_mx = ["1 smtp.google.com."]

# ---------------------------------------------------------------------------
# SPF
# ---------------------------------------------------------------------------
#
# From "Set up SPF" (support.google.com/a/answer/33786), fetched 2026-08-24:
#
#   "If you use only Google Workspace to send email, copy this line of text:
#   v=spf1 include:_spf.google.com ~all"
#
# Only the mechanism goes here. The module composes the v=spf1 prefix and the
# trailing all term, so there is exactly one SPF record with exactly one all
# term, which RFC 7208 section 4.5 requires on pain of permerror.
mail_spf_terms = "include:_spf.google.com"

# ONE DELIBERATE DIVERGENCE FROM GOOGLE'S PUBLISHED STRING, stated rather than
# hidden. Google publishes "~all", a soft fail. This module defaults to "-all", a
# hard fail, and that default is kept.
#
# Google publishes the softer qualifier because most organisations discover a
# forgotten sender after the fact. grit.chat has no history and exactly one
# sender, so there is no forgotten sender to discover, and a hard fail is the
# stronger anti-spoofing posture. Flipping to Google's published value is one
# line if a second sender ever appears:
#
#   spf_all_qualifier = "~all"
#
# Left commented so the divergence is visible and reversible rather than assumed.

# ---------------------------------------------------------------------------
# DKIM: genuinely unknown until the domain exists in the tenant
# ---------------------------------------------------------------------------
#
# Left EMPTY rather than filled with a fabricated key. An empty map produces no
# record at all, which is the module's placeholder and the honest state. A
# syntactically plausible dummy key would publish a DKIM record that fails to
# verify, which is worse than publishing none.
#
# The shape is known and is not in doubt. From "Set up DKIM"
# (support.google.com/a/answer/174124), fetched 2026-08-24: the record is a TXT,
# the host is "google._domainkey", the value "should start with something like:
# v=DKIM1", and "The default prefix selector is google. If you are using Google
# Workspace, this is the recommended option." Key length is a choice of 2048 or
# 1024, and Google says of 2048 "Longer keys are more secure than shorter keys."
#
# So this becomes, in a later commit, exactly:
#
#   mail_dkim_txt_keys = { "google" = "v=DKIM1; k=rsa; p=<the generated key>" }
#
# The module already splits a value that long into 255 byte chunks, so a 2048 bit
# key needs no special handling here.
#
# WHAT PRODUCES THE KEY, AND WHY IT CANNOT HAPPEN SOONER. Same page:
#
#   "In Google Workspace, after you turn on Gmail for your organization, you must
#   wait 24-72 hours before you can get your DKIM key in the Admin console."
#
# The path is Admin console, Apps, Google Workspace, Gmail, Authenticate email,
# select the domain, Generate New Record. It needs a super administrator with the
# Gmail Settings privilege.
#
# Turning on Gmail for the domain requires the domain to be verified in the
# tenant, and verification needs a resolvable record at grit.chat. The current
# authoritative zone is a third-party empty zone outside this stack, so that
# record cannot exist until Jason delegates to the complete Cloud DNS zone.
# DKIM therefore lands AFTER delegation, and it cannot be brought forward.
mail_dkim_txt_keys      = {}
mail_dkim_cname_targets = {}

# ---------------------------------------------------------------------------
# Domain verification: also unknown, and it shares the apex TXT record
# ---------------------------------------------------------------------------
#
# Google issues a google-site-verification token per domain when the domain is
# added to the tenant, so it cannot be written now. When it arrives it goes here
# rather than into a second resource, because Cloud DNS holds one record set per
# name and type and the apex TXT already carries SPF:
#
#   apex_txt_verification = ["google-site-verification=<token>"]
apex_txt_verification = []

# ---------------------------------------------------------------------------
# Nothing else is required
# ---------------------------------------------------------------------------
#
# Google's MX, SPF and DKIM pages name no autodiscovery names and no other
# records for mail, so this stays empty rather than carrying a guess.
mail_provider_cname_records = {}
