# Outserp MCP Server — Agent Skill

The Outserp MCP server gives AI coding assistants (Cursor, Claude Desktop, Cline, Zed) direct access to your Outserp workspace — articles, keywords, visibility analytics, content planning and publishing.

It speaks the [Model Context Protocol](https://modelcontextprotocol.io/) over `stdio` and is published to npm as `@outserp/mcp-server` (binary: `outserp-mcp`).

## Quick Setup

```json
{
  "mcpServers": {
    "outserp": {
      "command": "npx",
      "args": ["-y", "@outserp/mcp-server"],
      "env": {
        "OUTSERP_API_KEY": "your-api-key",
        "OUTSERP_PROJECT_ID": "your-default-project-id"
      }
    }
  }
}
```

Generate an `OUTSERP_API_KEY` at [outserp.ai/agent-settings](https://outserp.ai/agent-settings) → **API keys**. Choose `read`, `write`, or `publish` scope depending on what the agent should do.

## Available Tools (18)

### Articles (6)
- `list_articles` — list / filter articles by status (draft, published, scheduled, archived) with pagination
- `get_article` — full article detail (content, SEO + AEO scores, metadata)
- `generate_article` — generate a new SEO-optimized article; polls the job to completion (up to 5 min)
- `optimize_article` — run the auto-optimizer on an existing article (`mode: light | aggressive`, `targetScore: 50-100`)
- `publish_article` — push a draft to the connected CMS / GitHub / webhook integration
- `create_brief` — create a content brief for a keyword (outline, competitor analysis, recommended structure)

### Keywords (3)
- `list_keywords` — list tracked keywords with filters (status, topic cluster) + pagination
- `add_keywords` — add new keyword rows to track
- `generate_keywords` — run the keyword research pipeline (live search-volume + SERP data + AI clustering + content-gap discovery)

### Topics & Visibility (3)
- `get_topic_clusters` — pillar + supporting keywords for each topic cluster
- `get_visibility_summary` — cross-platform AI visibility (ChatGPT, Claude, Gemini, Perplexity, Google AIO)
- `get_insights` — AI-generated insights (rank changes, freshness, gaps, drift, GSC performance, lost citations)

### Planning & Scheduling (2)
- `get_content_schedule` — upcoming scheduled articles
- `schedule_content` — schedule a new article for generation + publish on a specific date

### Opportunities (1)
- `get_opportunities` — daily curated opportunities (outreach, optimization, creation)

### Account & Jobs (3)
- `list_projects` — list all projects in the workspace
- `get_usage` — usage stats vs limit, subscription tier, feature availability
- `get_job_status` — check the status of any article generation / optimization job

## Common Workflows

### Generate, optimize, publish
1. `generate_article` with a target keyword → returns a completed article
2. `optimize_article` (mode: light) if the SEO/AEO score is below 85
3. `publish_article` to push to the connected CMS

### Build a content plan from gaps
1. `get_insights` (type: `content_gaps`) to find topics where competitors lead
2. `generate_keywords` (expansionMode: `gaps_only`) to flesh out the cluster
3. `schedule_content` for each new keyword on the upcoming calendar
4. (loop) `get_job_status` until each scheduled article completes

### Visibility monitoring
1. `get_visibility_summary` for the cross-platform overview
2. `get_insights` (type: `llm_citation_lost`, priority: `critical`) to surface citations you've lost
3. `get_opportunities` to get a curated remediation list

## Scope & Permissions

| Scope | Tools available |
|---|---|
| `read` | All `list_*`, `get_*` tools |
| `write` | All `read` tools + `add_keywords`, `generate_keywords`, `generate_article`, `optimize_article`, `create_brief`, `schedule_content` |
| `publish` | All `write` tools + `publish_article` |

API keys are managed at [outserp.ai/agent-settings](https://outserp.ai/agent-settings). Per-key rate limits: `per-min` and `per-day`. Trial accounts inherit the same daily article cap as the dashboard (1 article/day).

## Troubleshooting

- **`API key is required`** — set `OUTSERP_API_KEY` in the MCP server's `env` block, not your shell.
- **`projectId is required`** — pass `OUTSERP_PROJECT_ID`, or include `projectId` in the tool call. Find your project ID at [outserp.ai/settings](https://outserp.ai/settings).
- **Generation timed out** — `generate_article` polls for up to 5 min. If your job is slower, the tool returns a `jobId` you can monitor via `get_job_status`.
- **`403 publish scope required`** — your API key needs `publish` scope. Rotate it in **Agent Settings → API keys**.

## Related

- `@outserp/cli` — terminal CLI with the same surface (`npx @outserp/cli init`)
- `@outserp/sdk` — TypeScript SDK if you need to call the REST API from your own code
- [outserp.ai/docs/api](https://outserp.ai/docs/api) — full REST API reference
