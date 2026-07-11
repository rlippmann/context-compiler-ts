import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const PROVENANCE_FILE = resolve(ROOT, 'tests', 'fixtures', '.source-commit');
const FIXTURES_CHECK_SCRIPT = resolve(ROOT, 'scripts', 'fixtures-check.sh');
const STRUCTURED_FIXTURES_CHECK_SCRIPT = resolve(ROOT, 'scripts', 'structured-fixtures-check.sh');
const CI_WORKFLOW = resolve(ROOT, '.github', 'workflows', 'ci.yml');
const ORIGINAL_SOURCE_COMMIT = readFileSync(PROVENANCE_FILE, 'utf8');
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8'
  });
}

function createGitRepo(commitMessage: string): { dir: string; commit: string } {
  const dir = makeTempDir('fixture-provenance-repo-');
  mkdirSync(join(dir, 'tests', 'fixtures', 'conformance'), { recursive: true });
  mkdirSync(join(dir, 'tests', 'fixtures', 'engine-regression', 'structured'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'fixtures', 'conformance', 'placeholder.json'), '{}\n', 'utf8');
  writeFileSync(join(dir, 'tests', 'fixtures', 'engine-regression', 'structured', 'placeholder.json'), '{}\n', 'utf8');

  expect(runCommand('git', ['init'], dir).status).toBe(0);
  expect(runCommand('git', ['config', 'user.name', 'Codex Tests'], dir).status).toBe(0);
  expect(runCommand('git', ['config', 'user.email', 'codex@example.com'], dir).status).toBe(0);
  expect(runCommand('git', ['add', '.'], dir).status).toBe(0);
  expect(runCommand('git', ['commit', '-m', commitMessage], dir).status).toBe(0);

  const revParse = runCommand('git', ['rev-parse', 'HEAD'], dir);
  expect(revParse.status).toBe(0);
  return {
    dir,
    commit: revParse.stdout.trim()
  };
}

afterEach(() => {
  writeFileSync(PROVENANCE_FILE, ORIGINAL_SOURCE_COMMIT, 'utf8');
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('fixture provenance', () => {
  it('tracks one lowercase 40-character commit SHA with trailing newline', () => {
    expect(ORIGINAL_SOURCE_COMMIT).toMatch(/^[0-9a-f]{40}\n$/);
  });

  it('accepts a valid provenance file and matching source checkout', () => {
    const repo = createGitRepo('valid provenance source');
    writeFileSync(PROVENANCE_FILE, `${repo.commit}\n`, 'utf8');

    const result = runCommand('bash', [FIXTURES_CHECK_SCRIPT], ROOT, {
      ...process.env,
      FIXTURES_SOURCE: join(repo.dir, 'tests', 'fixtures', 'conformance')
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[fixtures:check] Using source fixture directory:');
    expect(result.stderr).toContain('Fixture drift detected');
  });

  it('fails when the provenance file is missing', () => {
    rmSync(PROVENANCE_FILE);

    const result = runCommand('bash', [FIXTURES_CHECK_SCRIPT], ROOT, {
      ...process.env,
      FIXTURES_SOURCE: resolve(ROOT, 'tests', 'fixtures', 'conformance')
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing provenance file');
  });

  it('fails when the provenance file contains a malformed SHA', () => {
    writeFileSync(PROVENANCE_FILE, 'not-a-commit\n', 'utf8');

    const result = runCommand('bash', [STRUCTURED_FIXTURES_CHECK_SCRIPT], ROOT, {
      ...process.env,
      STRUCTURED_FIXTURES_SOURCE: resolve(ROOT, 'tests', 'fixtures', 'engine-regression', 'structured')
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must contain one lowercase 40-character commit SHA');
  });

  it('fails when the source checkout is at the wrong commit', () => {
    const repo = createGitRepo('first commit');
    writeFileSync(PROVENANCE_FILE, `${repo.commit}\n`, 'utf8');
    writeFileSync(join(repo.dir, 'SECOND.md'), 'next\n', 'utf8');
    expect(runCommand('git', ['add', 'SECOND.md'], repo.dir).status).toBe(0);
    expect(runCommand('git', ['commit', '-m', 'second commit'], repo.dir).status).toBe(0);

    const result = runCommand('bash', [FIXTURES_CHECK_SCRIPT], ROOT, {
      ...process.env,
      FIXTURES_SOURCE: join(repo.dir, 'tests', 'fixtures', 'conformance')
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Source checkout commit mismatch');
    expect(result.stderr).toContain(`Expected: ${repo.commit}`);
  });

  it('uses the same provenance file helper for both fixture workflows', () => {
    const fixturesSync = readFileSync(resolve(ROOT, 'scripts', 'fixtures-sync.sh'), 'utf8');
    const fixturesCheck = readFileSync(resolve(ROOT, 'scripts', 'fixtures-check.sh'), 'utf8');
    const structuredSync = readFileSync(resolve(ROOT, 'scripts', 'structured-fixtures-sync.sh'), 'utf8');
    const structuredCheck = readFileSync(resolve(ROOT, 'scripts', 'structured-fixtures-check.sh'), 'utf8');

    for (const script of [fixturesSync, fixturesCheck, structuredSync, structuredCheck]) {
      expect(script).toContain('fixtures-provenance.sh');
      expect(script).toContain('cc_verify_source_dir_matches_expected_commit');
    }
  });

  it('keeps the CI workflow free of a second hard-coded fixture SHA', () => {
    const ci = readFileSync(CI_WORKFLOW, 'utf8');
    expect(ci).toContain('tests/fixtures/.source-commit');
    expect(ci).not.toContain('PY_FIXTURE_REF:');
    expect(ci).not.toContain(ORIGINAL_SOURCE_COMMIT.trim());
  });
});
