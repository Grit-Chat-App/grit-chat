// Asserts the two trademark invariants the brand work states in prose but never checked.
//
//   node scripts/check-trademark.mjs      (run from site/, no build needed)
//
// WHY THIS EXISTS. src/components/Footer.astro carries the sentence "There is no trademark symbol
// anywhere and there never should be", and src/branding.ts says the mark is NOT cleared and that
// nothing may hardcode the product name in a template. Both were stated invariants with nothing
// behind them, which is the same shape as a comment claiming a test exists. A stray registered
// symbol on an uncleared mark is a legal claim we cannot support, in the one artifact the public
// reads, and it would ship green.
//
// TWO ASSERTIONS, deliberately separate so a failure names which invariant broke:
//
//   1. No U+00AE or U+2122 in any TEXT file under site/ and brand/.
//   2. No hardcoded product name in RENDERED site files. Copy comes from src/branding.ts, so pages,
//      components and layouts may contain the literal only inside a comment.
//
// TEXT FILES ONLY, AND THIS IS THE PART THAT MATTERS. A first pass at assertion 1 that scanned every
// tracked file reported seven hits, and every one was a binary: a woff2, a jpg and five rasters,
// where compressed bytes happen to coincide with those code points. Non-zero and wrong is much
// harder to disbelieve than zero and wrong, so the classification below is explicit in both
// directions and an UNKNOWN extension is a failure rather than a skip. A filter that silently
// dropped files would make the whole assertion vacuous while still printing a plausible number.
//
// The product name is READ FROM src/branding.ts rather than written here. A checker that hardcodes
// the string it is enforcing is a second copy of the thing it exists to protect, and it would go
// stale through exactly the rename it is meant to make safe.
//
// WHAT THIS DELIBERATELY DOES NOT COVER, so the next person to notice reads why rather than
// reopening it. A symbol typeset into a generated wordmark or lettermark is INVISIBLE here: those
// SVGs are pure outline geometry with no text element, so there is no code point left to find. That
// is not a gap to be closed on this side. This check MUST NEVER grow a heuristic that tries to
// recognise a registration symbol from path data, because a checker guessing at bezier curves would
// be the least trustworthy thing in the repo and a false pass from it would be worse than the
// honest blind spot. The source path is closed where it can actually be closed, at the typesetter's
// input, by the denylist in brand/tools/typeset.mjs. Two checks, two artifacts, neither pretending
// to cover the other.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/** Extensions whose bytes are text, so a match in one is a real authored character. */
const TEXT = new Set([
  '.astro', '.css', '.example', '.gitignore', '.json', '.md', '.mjs', '.svg', '.ts', '.yml', '.html',
]);

/** Extensions whose bytes are compressed or encoded, where a code point match means nothing. */
const BINARY = new Set(['.ico', '.jpg', '.jpeg', '.png', '.webp', '.woff2', '.woff', '.mp4']);

/**
 * A plausibility floor. If a filter breaks and scans almost nothing, both assertions pass while
 * checking nothing, which is worse than a failure because it reads as a green gate.
 */
const MIN_TEXT_FILES = 45;

const banned = [
  { code: 0x00ae, name: 'U+00AE REGISTERED SIGN' },
  { code: 0x2122, name: 'U+2122 TRADE MARK SIGN' },
];

const failures = [];

// ---- the file list, tracked only, so build output and node_modules cannot enter -------------------

const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', 'site', 'brand'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const textFiles = [];
const binaryFiles = [];
const unclassified = [];

for (const rel of tracked) {
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  // A leading-dot name like .gitignore is all extension, which is why this reads the last dot of the
  // basename rather than assuming a stem exists.
  const ext = dot <= 0 ? base : base.slice(dot);
  if (TEXT.has(ext)) {
    textFiles.push(rel);
  } else if (BINARY.has(ext)) {
    binaryFiles.push(rel);
  } else {
    unclassified.push(rel);
  }
}

if (unclassified.length > 0) {
  failures.push(
    `${unclassified.length} file(s) have an extension this check does not classify, so they were ` +
      `neither scanned nor deliberately skipped. Add each extension to TEXT or BINARY rather than ` +
      `letting it fall through: ${unclassified.slice(0, 8).join(', ')}`,
  );
}

if (textFiles.length < MIN_TEXT_FILES) {
  failures.push(
    `only ${textFiles.length} text file(s) found, below the floor of ${MIN_TEXT_FILES}. The file ` +
      `list or the extension filter is broken, and a check that scans nothing passes everything.`,
  );
}

// ---- assertion 1: no trademark symbols in text -----------------------------------------------------

const symbolHits = [];

for (const rel of textFiles) {
  const text = readFileSync(`${ROOT}/${rel}`, 'utf8');
  for (const { code, name } of banned) {
    const ch = String.fromCodePoint(code);
    let from = 0;
    for (;;) {
      const at = text.indexOf(ch, from);
      if (at < 0) {
        break;
      }
      const line = text.slice(0, at).split('\n').length;
      symbolHits.push({ rel, line, name });
      from = at + 1;
    }
  }
}

if (symbolHits.length > 0) {
  // The person who trips this reads only these lines, so they name the exposure rather than a house
  // style. A style rule invites an override; a false claim of registration does not.
  failures.push(
    `${symbolHits.length} trademark symbol(s) in text files. "Grit" is NOT a federally registered ` +
      `mark, and using a registration symbol on an unregistered mark is a FALSE CLAIM OF ` +
      `REGISTRATION, which is a legal exposure separate from infringement. Delete the symbol; do ` +
      `not silence this check. Note the footer is what creates the exposure rather than the ` +
      `product, so it is also the most likely place to reach for one out of convention:\n` +
      symbolHits.map((h) => `      ${h.rel}:${h.line} ${h.name}`).join('\n'),
  );
}

// ---- assertion 2: no hardcoded product name, and no hardcoded entity name, in rendered markup -----
//
// TWO LITERALS, not one, and they are deliberately sourced from two modules. A corporate name says
// who is liable; a product name is a trademark. They can diverge, so coupling them would let a
// rename of one silently rewrite the other. This is also the exact spot where the two get conflated,
// which is worth stating: "Grit Chat, Inc." in a footer is fine, a registered or trade mark symbol
// next to it is the violation, and assertion 1 above is what forbids the symbol.
//
// The entity module is OPTIONAL BY DESIGN. There is no legal entity yet and its name is still an
// open decision, so naming a company that does not exist in public copy would be worse than an
// unmet prerequisite. This reads it if present and stays quiet if absent, and the absence CANNOT
// make the assertion vacuous: the product name is checked either way, and a module that is present
// but unparseable is a failure rather than a skip.

/** Pull a single-quoted string field out of a module, or null if the field is not there. */
function readNameField(src, field) {
  return /** @type {string | null} */ (new RegExp(`${field}:\\s*'([^']+)'`).exec(src)?.[1] ?? null);
}

const BRANDING = 'site/src/branding.ts';
const ENTITY = 'site/src/entity.ts';

const productName = readNameField(readFileSync(`${ROOT}/${BRANDING}`, 'utf8'), 'displayName');
if (productName == null) {
  // Read rather than assumed: if the shape of branding.ts changes, this fails loudly instead of
  // quietly enforcing nothing.
  failures.push(`could not read displayName out of ${BRANDING}, so assertion 2 cannot run.`);
}

// THREE STATES, not two, and the middle one is the reason this is not a one liner. The entity name is
// genuinely undecided and is the owner's call, so the module is allowed to exist saying so. What is
// NOT allowed is ambiguity: a module that neither names the entity nor declares it undecided would
// silently drop half of assertion 2 while still printing a plausible report. So the module must be
// explicit, exactly as tools/inline.mjs refuses to guess a mime type.
//
//   legalName: 'Something Ltd'   enforced as a forbidden literal in rendered markup
//   legalName: null              declared undecided, nothing to enforce, and that is visible below
//   neither                      failure, because it cannot be told apart from a parser that broke
let entityName = null;
let entityState = 'module absent, nothing to enforce yet';
if (existsSync(`${ROOT}/${ENTITY}`)) {
  const entitySrc = readFileSync(`${ROOT}/${ENTITY}`, 'utf8');
  entityName = readNameField(entitySrc, 'legalName');
  if (entityName != null) {
    entityState = entityName;
  } else if (/\blegalName\s*:\s*null\b/.test(entitySrc)) {
    entityState = 'declared undecided (legalName: null), nothing to enforce';
  } else {
    failures.push(
      `${ENTITY} exists but declares neither a legalName string nor legalName: null. Say which, ` +
        `because a module this check cannot read looks identical to a check that stopped working.`,
    );
    entityState = 'module present, legalName AMBIGUOUS';
  }
}

/**
 * Remove comments so the check does not flag the documentation that explains the rule. Both
 * Footer.astro and index.astro discuss the product name in prose on purpose, and a matcher that
 * cannot tell prose from markup would force those comments to be deleted to go green.
 */
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // Only a // that does not follow a colon, so https:// and data: URLs survive intact.
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const RENDERED = ['site/src/pages', 'site/src/components', 'site/src/layouts'];

const renderedFiles = textFiles.filter(
  (rel) => RENDERED.some((dir) => rel.startsWith(`${dir}/`)) && /\.(astro|ts)$/.test(rel),
);

/** Each literal that must come from a module rather than a template, with the fix named per case. */
const forbidden = [
  productName == null
    ? null
    : { label: 'product name', value: productName, fix: 'Read Branding.displayName instead' },
  entityName == null
    ? null
    : { label: 'entity name', value: entityName, fix: 'Read the entity module instead' },
].filter((f) => f != null);

const hardcodes = [];

for (const rel of renderedFiles) {
  const stripped = stripComments(readFileSync(`${ROOT}/${rel}`, 'utf8'));
  stripped.split('\n').forEach((line, i) => {
    for (const f of forbidden) {
      if (line.toLowerCase().includes(f.value.toLowerCase())) {
        hardcodes.push({ rel, line: i + 1, label: f.label, fix: f.fix, text: line.trim().slice(0, 90) });
      }
    }
  });
}

if (hardcodes.length > 0) {
  failures.push(
    `${hardcodes.length} hardcoded name(s) in rendered markup. A name in a template is a second ` +
      `copy, and a rename then has to find every one of them:\n` +
      hardcodes
        .map((h) => `      ${h.rel}:${h.line}  ${h.label}, ${h.fix}\n        ${h.text}`)
        .join('\n'),
  );
}

// ---- report ----------------------------------------------------------------------------------------

console.log(`trademark check`);
console.log(`  text files scanned      ${textFiles.length}`);
console.log(`  binary files skipped    ${binaryFiles.length}`);
console.log(`  unclassified            ${unclassified.length}`);
console.log(`  product name            ${productName ?? '(unreadable)'}`);
console.log(`  entity name             ${entityState}`);
console.log(`  literals enforced       ${forbidden.length} (${forbidden.map((f) => f.label).join(', ')})`);
console.log(`  rendered files checked  ${renderedFiles.length}`);
console.log(`  trademark symbols       ${symbolHits.length}`);
console.log(`  hardcoded names         ${hardcodes.length}`);

if (failures.length > 0) {
  console.error('');
  for (const f of failures) {
    console.error(`  FAIL: ${f}`);
  }
  process.exit(1);
}

console.log('');
console.log(
  'no trademark symbol in any text file, and no rendered file hardcodes a name that belongs in a module.',
);
