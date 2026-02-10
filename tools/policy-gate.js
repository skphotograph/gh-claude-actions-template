#!/usr/bin/env node
/**
 * Minimal policy gate runner (no external deps).
 * - Reads policy.yml (limited YAML subset)
 * - Inspects git diff stats between base..head
 * - Enforces allowed_dirs / hard_gate / soft_gate / limits
 *
 * NOTE: YAML parser supports:
 * - key: value
 * - key:
 *     - 'item'
 *     - "item"
 *     - item
 * - nested maps (2 spaces indentation)
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');

function die(msg, code = 1) {
  console.error(`policy-gate: ${msg}`);
  process.exit(code);
}

function sh(cmd) {
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

/** very small YAML subset parser for our policy.yml */
function parseSimpleYaml(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, '  '))
    .filter((l) => !/^\s*#/.test(l));

  const root = {};
  const stack = [{ indent: -1, value: root, type: 'map' }];

  function current() {
    return stack[stack.length - 1];
  }

  function unquote(s) {
    const t = s.trim();
    if (
      (t.startsWith("'") && t.endsWith("'")) ||
      (t.startsWith('"') && t.endsWith('"'))
    ) {
      return t.slice(1, -1);
    }
    return t;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const indent = raw.match(/^ */)[0].length;
    const line = raw.trimRight();

    while (current().indent >= indent) stack.pop();
    const parent = current().value;

    // list item
    if (line.trimStart().startsWith('- ')) {
      const item = unquote(line.trimStart().slice(2));
      if (!Array.isArray(parent)) {
        die(
          `Invalid YAML structure near line ${i + 1}: list item without list parent`,
        );
      }
      parent.push(item);
      continue;
    }

    // key: value OR key:
    const m = line.trim().match(/^([^:]+):(.*)$/);
    if (!m) die(`Unsupported YAML near line ${i + 1}: ${line.trim()}`);
    const key = m[1].trim();
    const rest = m[2].trim();

    if (rest === '') {
      // decide if next is list or map by peeking next non-empty non-comment
      let nextLine = '';
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j];
        if (!t.trim() || /^\s*#/.test(t)) continue;
        nextLine = t;
        break;
      }
      const nextIndent = nextLine ? nextLine.match(/^ */)[0].length : -1;
      const isChild = nextIndent > indent;

      if (!isChild) {
        parent[key] = {};
        continue;
      }

      const nextTrim = nextLine.trimStart();
      if (nextTrim.startsWith('- ')) {
        parent[key] = [];
        stack.push({ indent, value: parent[key], type: 'list' });
      } else {
        parent[key] = {};
        stack.push({ indent, value: parent[key], type: 'map' });
      }
    } else {
      // scalar (string/number/bool)
      const vRaw = unquote(rest);
      const v =
        vRaw === 'true'
          ? true
          : vRaw === 'false'
            ? false
            : vRaw.match(/^\d+$/)
              ? Number(vRaw)
              : vRaw;
      parent[key] = v;
    }
  }
  return root;
}

function globToRegExp(glob) {
  // Convert simple glob patterns (*, **) into a safe RegExp.
  // - ** => .*
  // - *  => [^/]*

  // 1) Replace glob tokens with placeholders first
  let g = String(glob);
  g = g.replace(/\*\*/g, '§§DOUBLESTAR§§');
  g = g.replace(/\*/g, '§§STAR§§');

  // 2) Escape regex metacharacters
  g = g.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // 3) Restore placeholders as regex fragments
  g = g.replace(/§§DOUBLESTAR§§/g, '.*');
  g = g.replace(/§§STAR§§/g, '[^/]*');

  return new RegExp('^' + g + '$');
}

function anyMatch(globs, path) {
  return globs.some((g) => globToRegExp(g).test(path));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base') out.base = args[++i];
    else if (a === '--head') out.head = args[++i];
    else if (a === '--policy') out.policy = args[++i];
    else if (a === '--allow-deps') out.allowDeps = true;
    else if (a === '--allow-config') out.allowConfig = true;
    else die(`Unknown arg: ${a}`);
  }
  return out;
}

function main() {
  const args = parseArgs();

  const policyPath = args.policy || 'policy.yml';
  if (!fs.existsSync(policyPath)) die(`Missing ${policyPath}`);

  const policy = parseSimpleYaml(fs.readFileSync(policyPath, 'utf8'));

  const allowedDirs = policy.allowed_dirs || [];
  const allowedFiles = policy.allowed_files || [];
  const hardGate = policy.hard_gate || [];
  const softGate = policy.soft_gate || {};
  const limits = policy.limits || {};

  // bootstrap: allow modifying workflows during initial setup
  const bootstrap = policy.bootstrap || {};
  const allowWorkflows = bootstrap.allow_workflows === true;

  const effectiveHardGate = allowWorkflows
    ? hardGate.filter((g) => g !== '.github/workflows/**')
    : hardGate;

  const base = args.base || process.env.POLICY_BASE || 'origin/main';
  const head = args.head || process.env.POLICY_HEAD || 'HEAD';

  // Ensure refs exist (best effort)
  try {
    sh(`git rev-parse --verify ${base}`);
  } catch {
    die(`Base ref not found: ${base}`);
  }
  try {
    sh(`git rev-parse --verify ${head}`);
  } catch {
    die(`Head ref not found: ${head}`);
  }

  // Changed files with status
  const nameStatus = sh(`git diff --name-status ${base}..${head}`);
  const changes = nameStatus
    ? nameStatus.split('\n').map((l) => {
        const [status, ...rest] = l.split(/\s+/);
        const path = rest.join(' ');
        return { status, path };
      })
    : [];

  // Numstat for line counts
  const numstatRaw = sh(`git diff --numstat ${base}..${head}`);
  const numstats = {};
  if (numstatRaw) {
    for (const l of numstatRaw.split('\n')) {
      const [a, d, ...rest] = l.split('\t');
      const path = rest.join('\t');
      const add = a === '-' ? 0 : Number(a);
      const del = d === '-' ? 0 : Number(d);
      numstats[path] = { add, del };
    }
  }

  const filesChanged = changes.length;
  const newFiles = changes.filter((c) => c.status === 'A').length;
  const deletedFiles = changes.filter((c) => c.status === 'D').length;
  const diffLines = Object.values(numstats).reduce(
    (s, v) => s + v.add + v.del,
    0,
  );

  console.log('policy-gate: target range', { base, head });
  console.log('policy-gate: stats', {
    filesChanged,
    newFiles,
    deletedFiles,
    diffLines,
  });

  // Hard gate
  const hardHits = changes
    .filter((c) => anyMatch(effectiveHardGate, c.path))
    .map((c) => c.path);
  if (hardHits.length) {
    die(`Hard gate violation: ${hardHits.join(', ')}`);
  }

  // Allowed dirs gate
  const outside = changes
    .filter(
      (c) => !anyMatch(allowedDirs, c.path) && !allowedFiles.includes(c.path),
    )
    .map((c) => c.path);

  if (outside.length) {
    die(`Outside allowed_dirs: ${outside.join(', ')}`);
  }

  // Soft gate
  const allowDeps = args.allowDeps || process.env.ALLOW_DEPS === 'true';
  const allowConfig = args.allowConfig || process.env.ALLOW_CONFIG === 'true';

  const depsHits = (softGate.deps || []).length
    ? changes.filter((c) => anyMatch(softGate.deps, c.path)).map((c) => c.path)
    : [];
  const configHits = (softGate.config || []).length
    ? changes
        .filter((c) => anyMatch(softGate.config, c.path))
        .map((c) => c.path)
    : [];

  if (depsHits.length && !allowDeps)
    die(`Soft gate (deps) hit without allow: ${depsHits.join(', ')}`);
  if (configHits.length && !allowConfig)
    die(`Soft gate (config) hit without allow: ${configHits.join(', ')}`);

  // Limits
  function over(name, actual, max) {
    return typeof max === 'number' && max >= 0 && actual > max;
  }
  if (over('max_files_changed', filesChanged, limits.max_files_changed))
    die(`Limit exceeded: filesChanged=${filesChanged}`);
  if (over('max_new_files', newFiles, limits.max_new_files))
    die(`Limit exceeded: newFiles=${newFiles}`);
  if (over('max_deleted_files', deletedFiles, limits.max_deleted_files))
    die(`Limit exceeded: deletedFiles=${deletedFiles}`);
  if (over('max_diff_lines', diffLines, limits.max_diff_lines))
    die(`Limit exceeded: diffLines=${diffLines}`);

  console.log('policy-gate: PASS');
}

main();
