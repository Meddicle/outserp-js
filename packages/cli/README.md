# @outserp/cli

Outserp CLI — AI SEO & AEO content platform from your terminal.

## Install

```bash
npm install -g @outserp/cli
# or run directly
npx @outserp/cli
```

## Authentication

```bash
outserp auth login <your-api-key>
outserp init  # select default project
```

Or set environment variables:

```bash
export OUTSERP_API_KEY=your-api-key
export OUTSERP_PROJECT_ID=your-project-id
```

## Workflow Commands

```bash
# Generate article
outserp generate "best seo tools 2026"

# Generate without waiting
outserp generate "keyword research" --no-wait

# Optimize existing article
outserp optimize <article-id>

# Publish to connected CMS
outserp publish <article-id>

# Project dashboard
outserp status
```

## Resource Commands

```bash
# Articles
outserp articles list --status published
outserp articles get <id>

# Keywords
outserp keywords list --limit 50
outserp keywords add "seo tools" "keyword research" "content marketing"

# Visibility
outserp visibility summary

# Projects
outserp projects list

# Schedule
outserp schedule list
outserp schedule add "target keyword" --date 2026-04-15
```

## Output Formats

All commands support `--format json` for piping:

```bash
outserp articles list --format json | jq '.[] | .title'
```

## Config

Credentials stored in `~/.outserp/config.json`. Environment variables take precedence.
