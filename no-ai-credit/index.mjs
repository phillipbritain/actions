// Fails a pull request that credits an AI coding tool: a commit authored or committed as one, or a
// Co-Authored-By trailer naming one in a commit message or in the PR's title and description (a
// squash merge can use those as its commit message). Every commit the PR brings is checked, old
// ancestors included, so merging an old branch can't bring back credits a history cleanup removed.
// Needs the repository checked out with its full history (actions/checkout with fetch-depth: 0).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// AI coding tools, by the names and email domains they sign commits with. A new tool goes here.
const aiTool = new RegExp([
  String.raw`\b(?:claude|anthropic|openai|chatgpt|codex|copilot|cursor ?agent|gemini|aider|windsurf|codeium|devin-ai-integration)\b`,
  String.raw`@(?:anthropic\.com|openai\.com|cursor\.com|cognition\.ai|aider\.chat|codeium\.com|windsurf\.com)\b`,
].join('|'), 'i')
const creditsAiTool = (text) => (text.match(/^\s*co-authored-by:.*$/gim) ?? []).some((line) => aiTool.test(line))

const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {}
const pr = event.pull_request
if (!pr) {
  console.log('::error::no-ai-credit runs on pull_request events only.')
  process.exit(1)
}

const failures = []
if (creditsAiTool(`${pr.title}\n${pr.body ?? ''}`))
  failures.push('The pull request title or description has a Co-Authored-By trailer naming an AI tool.')

// Commit messages are read as data, never as shell commands.
const log = execFileSync('git', [
  'log', '-z', '--format=%H%x00%an <%ae>%x00%cn <%ce>%x00%B', `${pr.base.sha}..${pr.head.sha}`, '--',
], { encoding: 'utf8' }).split('\0')
log.pop() // git log -z ends each record with NUL, which commit messages cannot contain.
for (let i = 0; i < log.length; i += 4) {
  const [sha, author, committer, message] = log.slice(i, i + 4)
  if (aiTool.test(author) || aiTool.test(committer) || creditsAiTool(message))
    failures.push(`Commit ${sha.slice(0, 12)} credits an AI tool.`)
}

if (failures.length) {
  for (const failure of failures) console.log(`::error::${failure}`)
  console.log('Remove the AI tool author, committer or Co-Authored-By trailer, then push again (or edit the PR, which reruns the check).')
  process.exit(1)
}
console.log('No AI tool credited in the pull request or its commits.')
