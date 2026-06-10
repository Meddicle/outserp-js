# Outserp plugin for Claude Code

Adds the hosted Outserp MCP server plus ready‑made slash commands for AI SEO & AEO.

## Install

```shell
/plugin marketplace add Meddicle/outserp-js
/plugin install outserp@outserp
```

On first use the MCP server opens a browser to sign in to Outserp (OAuth) and pick
which account/brand to connect. Prefer a token? Set one in your MCP config header —
see https://outserp.ai/docs/mcp.

## What you get

- **MCP server** (`outserp`, remote HTTP at `https://mcp.outserp.ai/mcp`) — all the
  Outserp tools: `whoami`, visibility/competitor/citation/mention reads, brand
  profile, site health, `generate_article`, `create_content_plan_grid`/`run_grid`,
  credits, and webhooks.
- **Slash commands**
  - `/outserp:article` — turn a keyword, a shipped feature, or your own research into an article
  - `/outserp:visibility` — AI‑search visibility + competitor gaps
  - `/outserp:content-plan` — build a programmatic plan from a list and bulk‑run it

## Requirements

An active Outserp account (paid plan or trial). Generation uses your monthly
allowance, then credits. One Outserp organization = one brand.
