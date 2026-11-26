# actions

Shared GitHub Actions for my repositories.

## attribution

Fails a pull request whose commits, title or description credit an AI coding tool: a commit authored or committed as one, or a `Co-Authored-By` trailer naming one. Mentions of a tool elsewhere, and human co-authors, pass. The tools it knows are listed in [`attribution/index.mjs`](attribution/index.mjs).

```yaml
# .github/workflows/pr-policy.yml
name: pr-policy

on:
  pull_request:
    branches: [main]
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read

jobs:
  attribution:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: phillipbritain/actions/attribution@v2
```

`edited` reruns it when the title or description changes. Make `attribution` a required check in the branch's ruleset.

## Releases

Each release is tagged `vX.Y.Z`, and its major tag (`v2`) moves to the latest release of that major version.

- **v2**: `no-ai-credit` renamed `attribution`.
- **v1**: `no-ai-credit`.
