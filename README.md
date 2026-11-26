# actions

Shared GitHub Actions for my repositories.

## no-ai-credit

Fails a pull request whose commits, title or description credit an AI coding tool: a commit authored or committed as one, or a `Co-Authored-By` trailer naming one. Mentions of a tool elsewhere, and human co-authors, pass. The tools it knows are listed in [`no-ai-credit/index.mjs`](no-ai-credit/index.mjs).

```yaml
# .github/workflows/no-ai-credit.yml
name: no-ai-credit

on:
  pull_request:
    branches: [main]
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read

jobs:
  no-ai-credit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: phillipbritain/actions/no-ai-credit@v1
```

`edited` reruns it when the title or description changes. Make `no-ai-credit` a required check in the branch's ruleset.

## Releases

Each release is tagged `vX.Y.Z`, and the major tag (`v1`) moves to the latest release of that major version.
