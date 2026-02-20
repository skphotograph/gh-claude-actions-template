const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const POLICY_GATE_SRC = path.join(ROOT, 'tools', 'policy-gate.js');

const POLICY_YAML = `policy_version: 1

allowed_dirs:
  - 'src/**'
  - 'test/**'
  - 'tools/**'
  - '.claude/**'

allowed_files:
  - '.github/workflows/ci.yml'
  - '.github/workflows/policy-gate.yml'
  - '.github/ISSUE_TEMPLATE/ai-issue.md'
  - '.github/PULL_REQUEST_TEMPLATE.md'
  - '.github/labels.yml'
  - 'package.json'
  - 'README.md'
  - 'CLAUDE.md'

hard_gate:
  - 'policy.yml'
  - 'tools/policy-gate.js'
  - '.github/workflows/**'
  - 'migrations/**'
  - 'ddl/**'

soft_gate:
  deps:
    - 'package.json'
    - 'package-lock.json'
    - 'pnpm-lock.yaml'
    - 'yarn.lock'
    - 'pom.xml'
    - 'build.gradle'
    - 'build.gradle.kts'
    - 'gradle.properties'
    - 'tools/*.lock'
  config:
    - '*.yml'
    - '*.yaml'
    - '*.properties'
    - 'config/**/*.yml'
    - 'config/**/*.yaml'
    - 'config/**/*.properties'

limits:
  max_files_changed: 10
  max_diff_lines: 300
  max_new_files: 3
  max_deleted_files: 1

bootstrap:
  allow_workflows: false
  allowed_dirs_extra:
    - '.github/workflows/**'
  limits:
    max_files_changed: 20
    max_diff_lines: 1000
    max_new_files: 10
    max_deleted_files: 5
`;

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function git(cwd, ...args) {
  return run('git', args, { cwd });
}

function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function createRepo(mutator) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-gate-test-'));

  git(tmp, 'init');
  git(tmp, 'config', 'user.name', 'Policy Gate Test');
  git(tmp, 'config', 'user.email', 'policy-gate-test@example.com');

  writeFile(tmp, 'policy.yml', POLICY_YAML);
  fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
  fs.copyFileSync(POLICY_GATE_SRC, path.join(tmp, 'tools', 'policy-gate.js'));
  writeFile(tmp, 'src/base.txt', 'base\n');

  git(tmp, 'add', '.');
  git(tmp, 'commit', '-m', 'base');
  const base = git(tmp, 'rev-parse', 'HEAD').trim();

  mutator(tmp);
  git(tmp, 'add', '.');
  git(tmp, 'commit', '-m', 'change');
  const head = git(tmp, 'rev-parse', 'HEAD').trim();

  return {
    tmp,
    base,
    head,
    runGate(env = {}) {
      try {
        const stdout = run('node', ['tools/policy-gate.js', '--base', base, '--head', head], {
          cwd: tmp,
          env,
        });
        return { ok: true, stdout, stderr: '' };
      } catch (err) {
        return {
          ok: false,
          stdout: err.stdout ? String(err.stdout) : '',
          stderr: err.stderr ? String(err.stderr) : String(err.message || ''),
        };
      }
    },
    cleanup() {
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

test('rename with spaces in allowed dir passes', () => {
  const repo = createRepo((cwd) => {
    git(cwd, 'mv', 'src/base.txt', 'src/new name.txt');
  });
  try {
    const result = repo.runGate();
    assert.equal(result.ok, true, result.stderr || result.stdout);
  } finally {
    repo.cleanup();
  }
});

test('soft gate blocks deps file without allow flag', () => {
  // Use tools/*.lock (in allowed_dirs but not allowed_files) to test soft gate blocking
  const repo = createRepo((cwd) => {
    writeFile(cwd, 'tools/deps.lock', 'lockfile\n');
  });
  try {
    const result = repo.runGate();
    assert.equal(result.ok, false, 'expected policy gate to fail');
    assert.match(result.stderr, /Soft gate \(deps\)/);
  } finally {
    repo.cleanup();
  }
});

test('soft gate allows deps file with ALLOW_DEPS=true', () => {
  const repo = createRepo((cwd) => {
    writeFile(cwd, 'tools/deps.lock', 'lockfile\n');
  });
  try {
    const result = repo.runGate({ ALLOW_DEPS: 'true' });
    assert.equal(result.ok, true, result.stderr || result.stdout);
  } finally {
    repo.cleanup();
  }
});

test('allowed_files bypasses soft gate without allow flag', () => {
  // package.json is in both allowed_files and soft_gate.deps;
  // allowed_files should take precedence and skip the soft gate check
  const repo = createRepo((cwd) => {
    writeFile(cwd, 'package.json', '{"name":"x"}\n');
  });
  try {
    const result = repo.runGate();
    assert.equal(result.ok, true, result.stderr || result.stdout);
  } finally {
    repo.cleanup();
  }
});

test('limit check fails when files changed exceed max_files_changed', () => {
  const repo = createRepo((cwd) => {
    for (let i = 0; i < 11; i++) {
      writeFile(cwd, `src/f${i}.txt`, `${i}\n`);
    }
  });
  try {
    const result = repo.runGate();
    assert.equal(result.ok, false, 'expected policy gate to fail');
    assert.match(result.stderr, /Limit exceeded:/);
  } finally {
    repo.cleanup();
  }
});

test('workflow file change fails without bootstrap but passes with PHASE_BOOTSTRAP=true', () => {
  const repo = createRepo((cwd) => {
    writeFile(cwd, '.github/workflows/new.yml', 'name: x\n');
  });
  try {
    const blocked = repo.runGate();
    assert.equal(blocked.ok, false, 'expected policy gate to fail without bootstrap');

    const allowed = repo.runGate({ PHASE_BOOTSTRAP: 'true' });
    assert.equal(allowed.ok, true, allowed.stderr || allowed.stdout);
  } finally {
    repo.cleanup();
  }
});
