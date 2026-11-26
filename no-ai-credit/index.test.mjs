import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const action = fileURLToPath(new URL('./index.mjs', import.meta.url))

test('fails a pull request that credits an AI tool, and passes one that does not', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'no-ai-credit-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Test Owner', GIT_AUTHOR_EMAIL: 'owner@example.com',
    GIT_COMMITTER_NAME: 'Test Owner', GIT_COMMITTER_EMAIL: 'owner@example.com' }
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
  const commit = (message) => {
    git('commit', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const eventPath = join(cwd, 'event.json')
  const check = (base, head, { title = 'Clean title', body = null } = {}, extraEnv = {}) => {
    writeFileSync(eventPath, JSON.stringify({ pull_request: { title, body, base: { sha: base }, head: { sha: head } } }))
    return spawnSync(process.execPath, [action], {
      cwd, env: { ...env, GITHUB_EVENT_PATH: eventPath, ...extraEnv }, encoding: 'utf8',
    }).status
  }

  git('init', '-q')
  const initial = commit('Initial commit')
  const oldCredit = commit('Old work\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')
  assert.equal(check(initial, oldCredit), 1, 'rejects a coauthor trailer')
  const clean = commit('Document how Claude attribution works')
  assert.equal(check(oldCredit, clean), 0, 'allows mentions outside a trailer, and leaves existing history alone')
  const lowerCase = commit('New work\n\nco-authored-by: Claude <noreply@anthropic.com>')
  assert.equal(check(clean, lowerCase), 1, 'rejects a trailer whatever its capitalization')

  git('checkout', '-q', '--detach', initial)
  const newMain = commit('Clean main history')
  git('merge', '--no-ff', lowerCase, '-m', 'Bring back an older branch')
  assert.equal(check(newMain, git('rev-parse', 'HEAD')), 1, 'catches credits in reintroduced ancestors')

  git('checkout', '-q', '--detach', clean)
  git('commit', '--allow-empty', '--author=Claude <noreply@anthropic.com>', '-m', 'Authored directly')
  assert.equal(check(clean, git('rev-parse', 'HEAD')), 1, 'catches an AI author without a trailer')
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Committed directly'], {
    cwd, env: { ...env, GIT_COMMITTER_NAME: 'Claude', GIT_COMMITTER_EMAIL: 'noreply@anthropic.com' },
  })
  assert.equal(check(git('rev-parse', 'HEAD^'), git('rev-parse', 'HEAD')), 1, 'catches an AI committer')

  git('checkout', '-q', '--detach', clean)
  for (const tool of [
    'Copilot <175728472+Copilot@users.noreply.github.com>',
    'Cursor Agent <cursoragent@cursor.com>',
    'chatgpt-codex-connector[bot] <199175422+chatgpt-codex-connector[bot]@users.noreply.github.com>',
    'gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>',
  ]) {
    const credited = commit(`Tool work\n\nCo-authored-by: ${tool}`)
    assert.equal(check(git('rev-parse', 'HEAD^'), credited), 1, `rejects a coauthor trailer for ${tool}`)
  }
  const human = commit('Pair work\n\nCo-authored-by: Ada Lovelace <ada@example.com>')
  assert.equal(check(git('rev-parse', 'HEAD^'), human), 0, 'allows a human coauthor')

  assert.equal(check(human, human, { body: 'Description\n\nCo-authored-by: Claude <noreply@anthropic.com>' }), 1,
    'catches a trailer in the description, which a squash merge can use')
  assert.equal(check(human, human, { title: 'Turn off Copilot suggestions' }), 0, 'allows a clean pull request')
  assert.equal(check(human, human, {}, { GITHUB_EVENT_PATH: '' }), 1, 'fails outside a pull_request event')
})
