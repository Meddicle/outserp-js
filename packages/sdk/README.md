# @outserp/sdk

TypeScript SDK for the [Outserp](https://outserp.ai) REST API v1. Used internally by `@outserp/cli` and `@outserp/mcp-server`, and available as a standalone package for any Node.js / browser integration.

```bash
npm install @outserp/sdk
```

```ts
import { OutserpClient } from '@outserp/sdk';

const client = new OutserpClient({
  apiKey: process.env.OUTSERP_API_KEY,
  projectId: 'your-project-id',
});

const { articles } = await client.listArticles();
const draft = await client.generateArticle(undefined, {
  keyword: 'best AI seo tool 2026',
  wordCount: 1800,
  tone: 'expert',
});
```

## Auth

Generate an API key at [outserp.ai/agent-settings](https://outserp.ai/agent-settings) (Agent Settings → API keys). Keys are scoped (read / write / publish) — the SDK surfaces this via the standard `401 / 403` responses (`OutserpAPIError`).

## Error handling

All non-2xx responses throw `OutserpAPIError` with `status`, `code` and `details` populated from the API response body.

```ts
import { OutserpClient, OutserpAPIError } from '@outserp/sdk';

try {
  await client.publishArticle('art_…');
} catch (err) {
  if (err instanceof OutserpAPIError && err.status === 429) {
    // rate limited — back off
  }
}
```

## Reference

Full API docs: [outserp.ai/docs/api](https://outserp.ai/docs/api)

| Method | Endpoint |
|---|---|
| `listProjects()` | `GET /api/v1/projects` |
| `listArticles(projectId?, opts?)` | `GET /api/v1/articles` |
| `getArticle(id)` | `GET /api/v1/articles/:id` |
| `generateArticle(projectId?, data)` | `POST /api/v1/articles/generate` |
| `optimizeArticle(id, opts?)` | `POST /api/v1/articles/:id/optimize` |
| `publishArticle(id)` | `POST /api/v1/articles/:id/publish` |
| `listKeywords(projectId?, opts?)` | `GET /api/v1/keywords` |
| `addKeywords(projectId?, data)` | `POST /api/v1/keywords` |
| `generateKeywords(projectId?, opts?)` | `POST /api/v1/keywords/generate` |
| `getTopicClusters(projectId?)` | `GET /api/v1/topics` |
| `getVisibilitySummary(projectId?)` | `GET /api/v1/visibility` |
| `getInsights(projectId?, opts?)` | `GET /api/v1/insights` |
| `getOpportunities(projectId?)` | `GET /api/v1/opportunities` |
| `getUsage()` | `GET /api/v1/usage` |
| `getContentSchedule(projectId?)` | `GET /api/v1/content-schedule` |
| `scheduleContent(projectId?, data)` | `POST /api/v1/content-schedule` |
| `getJobStatus(jobId)` | `GET /api/v1/jobs/:id` |

## License

MIT — © Outserp
