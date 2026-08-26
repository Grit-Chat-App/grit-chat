# Making this repository public

The flip is the one action in this project that cannot be walked back. Content is scraped within
minutes. This is the procedure, in order, so it does not have to be reconstructed.

**Nobody but Jason runs step 2.**

Set this once and every command below works as written:

```sh
R=Grit-Chat-App/grit-chat
```

---

## 1. Before the flip: prove the five surfaces are clean

Public visibility exposes **every ref**, not just `main`, and a merged pull request's stored file list
and its diff both outlive the branch and any history rewrite. Those are the five ways content escapes.

```sh
# a. every ref the server will serve. Expect ONLY refs/heads/* you recognise.
git ls-remote https://github.com/$R.git

# b. pull request refs. Expect ZERO lines.
git ls-remote https://github.com/$R.git 'refs/pull/*'

# c. the pull request file lists. Expect an empty array.
gh api "repos/$R/pulls?state=all&per_page=100" --jq 'length'

# d. no company documents on ANY ref. A remote sha cannot be read without fetching it,
#    so mirror-clone once and walk every ref's tree locally.
tmp=$(mktemp -d) && git clone --quiet --mirror "https://github.com/$R.git" "$tmp/m.git"
git -C "$tmp/m.git" for-each-ref --format='%(objectname)' | while read s; do
  git -C "$tmp/m.git" ls-tree -r --name-only "$s"
done | sort -u | grep -ciE \
  'ein-briefing|entity-and-store|entity-formation|intercompany|ip-allocation|operating-agreement|parent-structure|store-enrolment'
```

```sh
# e. THE ONE THAT ACTUALLY BITES. A pull request that REMOVED something publishes
#    that something in its own diff, forever, on an endpoint that needs no git and
#    no credentials once the repo is public.
#
#    These patterns match the SHAPE of a leak rather than a list of known values.
#    That is deliberate twice over: a class pattern catches an identifier nobody has
#    catalogued yet, and a literal list would mean this file published the very
#    inventory it exists to detect. The catalogued values live in the private company
#    records repository, not here.
SHAPES='[a-z0-9][a-z0-9-]*@[a-z0-9-]+\.iam\.gserviceaccount\.com'   # any service account
SHAPES="$SHAPES|projects/[0-9]{6,}"                                  # any GCP project number
SHAPES="$SHAPES|workloadIdentityPools/"                              # any WIF pool
SHAPES="$SHAPES|principalSet://"                                     # any WIF principal
SHAPES="$SHAPES|gs://|[a-z0-9-]+-terraform-state"                    # any state bucket
SHAPES="$SHAPES|[0-9]{8}-[0-9A-F]{16}"                               # any Apple device UDID
SHAPES="$SHAPES|-----BEGIN [A-Z ]*PRIVATE KEY"                       # any private key
SHAPES="$SHAPES|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}"              # AWS / Google keys

for n in $(gh api "repos/$R/pulls?state=all&per_page=100" --jq '.[].number'); do
  printf 'PR#%s ' "$n"
  gh api "repos/$R/pulls/$n/files?per_page=100" --jq '[.[].patch // ""] | join("\n")' \
  | grep -ciE "$SHAPES"
done
```

Run the same `$SHAPES` set over the tree and over every ref, not only over pull request diffs:

```sh
git grep -ciE "$SHAPES" $(git rev-list --all) -- . | grep -v ':0$' || echo "clean on every ref"
```

**One match is expected, and only one: this file.** It contains the pattern strings themselves, so
`workloadIdentityPools/`, `principalSet://` and `gs://` match their own definitions. Check (d)'s
document-name pattern self-matches here for the same reason. A pattern definition is not an instance.
**Any match in any other file is a real finding.** The patterns are deliberately not excluded from
their own scan, because an exclusion is a hole that would hide a real identifier if one were ever
written into this document.

**Expected answers.** (a) only branches you put there. (b) **zero**. (c) **zero**, and if it is ever
non-zero then every pull request it counts must be one whose diff you are content to publish.
(d) **zero**. (e) **zero for every pull request**, and on the whole-history scan, this file only.

If (b) is not zero, **stop**. A pull request ref is why this repository was reseeded in the first
place: GitHub keeps `refs/pull/N/head` permanently, and the files endpoint serves a merged pull
request's full patch to anyone. That is not fixable by deleting a branch or rewriting history.

### The rule this repository is built on, and why

**Nothing is ever removed in a pull request. This repository's first commit is the first state that
has ever existed.**

That is not style. It is the lesson from two reseeds, and it is the reason check (e) exists.

The first reseed happened because a merged pull request had carried eight company documents, and
GitHub serves a merged pull request's stored file list permanently. Removing them from every branch
did not remove them from the repository.

The second reseed happened because the remediation repeated the mistake at one remove. A pull request
moved the DNS operator runbook out of the tree, and **a move is a deletion, so its diff still carried
what it deleted**: the cloud project id 21 times, the project number, service account addresses, the
Terraform state bucket, the Workload Identity pool path, another private repository's name, two
unrelated organisations with their organisation numbers, three email addresses, and a private LAN
address. Measured on the endpoint, not guessed.

So the rule. If something must not be public, it must never have been in a commit that becomes a
reviewable diff. Rewriting history does not help, deleting the branch does not help, and neither does
deleting the file in a later commit. **The only reliable move is that it was never there.**

A corollary worth keeping: **audit yourself with the same check you would run on someone else.** Both
of these were found by running the checks in this document against this repository, not by reasoning
about it.

### One mechanical trap, recorded because it will recur

Merging a pull request with `--delete-branch` deletes the base branch of any pull request stacked on
it, which **closes** that child. GitHub then refuses to reopen it, because its base is gone, and
refuses to retarget it, because it is closed. The branch itself survives, so the recovery is to
rebase it onto the new base with `git rebase --onto`, force-push with a lease, and open a new pull
request.

Avoid it by merging the parent without `--delete-branch`, or by retargeting the child to `main`
first. With a single seed commit and no stacked branches the trap does not arise, but it will the
moment two pull requests depend on each other.

---

## 2. The flip

**Everything above ran with your credentials, so it proves nothing about what a stranger sees.** A
private repository answers its owner and refuses everyone else. Step 3 is the only step that tests
the thing you actually care about.

```sh
gh api -X PATCH "repos/$R" -f visibility=public
gh api "repos/$R" --jq '.visibility'   # expect: public
```

---

## 3. Immediately after: re-run the surfaces with no credentials

Strip the environment the way a stranger's shell is stripped. Without this the checks pass on
authentication and tell you nothing.

```sh
mkdir -p /tmp/anon-check
env -i HOME=/tmp/anon-check PATH="$PATH" \
    GIT_TERMINAL_PROMPT=0 GIT_CONFIG_NOSYSTEM=1 \
    bash -c '
      R=Grit-Chat-App/grit-chat
      echo "-- pull refs (expect zero lines):"
      git ls-remote https://github.com/$R.git "refs/pull/*"
      echo "-- all refs (expect only your branches):"
      git ls-remote https://github.com/$R.git
    '

# the REST surface, unauthenticated. Expect [] and a 404.
curl -s "https://api.github.com/repos/$R/pulls?state=all" | head -c 40; echo
curl -s -o /dev/null -w 'pulls/1/files http=%{http_code}\n' \
     "https://api.github.com/repos/$R/pulls/1/files"

# raw content: a path that must be ABSENT, then one that must be PRESENT.
curl -s -o /dev/null -w 'ip-allocation (expect 404) http=%{http_code}\n' \
     "https://raw.githubusercontent.com/$R/main/docs/ip-allocation.md"
curl -s -o /dev/null -w 'README        (expect 200) http=%{http_code}\n' \
     "https://raw.githubusercontent.com/$R/main/README.md"
curl -s -o /dev/null -w 'LICENSE       (expect 200) http=%{http_code}\n' \
     "https://raw.githubusercontent.com/$R/main/LICENSE"
```

**The 200s matter as much as the 404s.** A check that only ever sees 404 cannot tell "correctly
absent" from "the whole request path is broken".

---

## 4. Harden, which is only possible now

Secret scanning and push protection are free on public repositories and unavailable on a private
repository on the free plan. That is why this step comes last rather than first.

```sh
gh api -X PATCH "repos/$R" --input - <<'JSON'
{"security_and_analysis":{
   "secret_scanning":{"status":"enabled"},
   "secret_scanning_push_protection":{"status":"enabled"}}}
JSON

gh api "repos/$R" --jq '.security_and_analysis'   # confirm both enabled
```

Then, in **Settings, Actions, General**:

- **Fork pull request workflows**: require approval for **all outside collaborators**. Without this a
  stranger's first pull request can run workflows against this repository.
- Confirm **no self-hosted runner** is reachable. Every workflow here targets `macos-26` and
  `ubuntu-latest`, so this should already hold; verify rather than assume, because a self-hosted
  runner reachable from a fork pull request is arbitrary code execution on that machine.

```sh
gh api "repos/$R/actions/runners" --jq '.total_count'   # expect: 0
```

---

## Known state at the time of writing

Things a reader of this document should know, so they are decisions rather than surprises.

- **`PATH.md` carries the Apple Team ID `8H7HVPHS87`.** Deliberate. It is recoverable from any
  shipped binary. The physical device UDID that used to sit beside it is redacted.
- **Operator network addresses are absent.** Test fixtures use synthetic private ranges; historical
  relay endpoints and device identifiers live in the private company evidence record.
- **`site/src/config.ts` links to this repository.** While it is private that link 404s for the
  public; after the flip it resolves.
- **The operator runbook for the DNS stack is not here.** It names the cloud project, service
  accounts, state bucket and Workload Identity path, and lives in the private company records
  repository instead.
- **Actions minutes.** This organisation is on the free plan and the macOS runners this repository
  uses bill at a multiplier. A red check reading "the job was not started because recent account
  payments have failed or your spending limit needs to be increased" is a billing condition, not a
  code failure. Check the annotation before believing a red check.
