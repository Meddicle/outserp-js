# Outserp developer tools

Connect [Outserp](https://outserp.ai) — the AI SEO & AEO content platform — to your
coding agent and scripts. Pull your brand and AI‑visibility data, generate articles
seeded with your own research, and spin up programmatic content plans, all from
Claude Code, Cursor, Windsurf, the terminal, or any MCP client.

This repo contains three thin clients for the public Outserp REST API. They never
touch any provider keys, prompts, or pipeline internals — everything sensitive stays
server‑side behind the API.

| Package | What it is |
| --- | --- |
| [`@outserp/mcp-server`](packages/mcp-server) | MCP server (stdio) for Cursor / Claude / Cline |
| [`@outserp/cli`](packages/cli) | `outserp` terminal CLI |
| [`@outserp/sdk`](packages/sdk) | TypeScript client for the REST API v1 |

## Quick start — MCP

The fastest path is the hosted, remote MCP server (no install, OAuth sign‑in):

```bash
claude mcp add outserp --transport http https://mcp.outserp.ai/mcp
```

Then ask: *"What can my Outserp account do?"* — the agent calls `whoami`.

Prefer a bearer token (CI / a specific brand)? Create a key in Outserp under
**Agent settings → API**, then:

```bash
claude mcp add outserp --transport http https://mcp.outserp.ai/mcp \
  --header "Authorization: Bearer $OUTSERP_API_KEY"
```

Full docs, the tool reference, and connect steps for Cursor / VS Code / Windsurf:
**https://outserp.ai/docs/mcp**

## Claude Code plugin

This repo is also a Claude Code plugin marketplace. Install the `outserp` plugin to
get the remote MCP server plus ready‑made slash commands:

```shell
/plugin marketplace add Meddicle/outserp-js
/plugin install outserp@outserp
```

See [`plugins/outserp`](plugins/outserp).

## Local development

```bash
npm install          # workspaces link the local SDK
npm run build        # builds sdk, cli, mcp-server
```

## Auth & data model

- Any **active** Outserp account (paid plan or trial) can connect and read.
- Generating content draws from your monthly plan allowance, then your credit wallet.
- One Outserp organization = one brand. Use a token (or OAuth account) per brand.

## License

MIT — see [LICENSE](LICENSE).
