#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OutserpClient } from './client.js';

const client = new OutserpClient(
  process.env.OUTSERP_API_KEY,
  process.env.OUTSERP_BASE_URL,
  process.env.OUTSERP_PROJECT_ID
);

const server = new McpServer({
  name: 'outserp',
  version: '1.0.0',
});

// ── Helper ──────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

async function pollJob(jobId: string, maxSeconds = 300, intervalMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    const status = await client.getJobStatus(jobId);
    if (status.status === 'completed' || status.status === 'failed' || status.status === 'error') {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: 'timeout', jobId, message: `Job did not complete within ${maxSeconds}s` };
}

// ── Projects ────────────────────────────────────────────────────────────────

server.tool(
  'list_projects',
  'List all projects in the Outserp account',
  {},
  async () => {
    try {
      return ok(await client.listProjects());
    } catch (e) {
      return err(e);
    }
  }
);

// ── Articles ────────────────────────────────────────────────────────────────

server.tool(
  'list_articles',
  'List articles for a project. Filter by status (draft, published, scheduled, archived). Supports pagination with limit and offset.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    status: z.string().optional().describe('Filter by status: draft, published, scheduled, archived'),
    limit: z.number().optional().describe('Max results to return'),
    offset: z.number().optional().describe('Offset for pagination'),
  },
  async ({ projectId, status, limit, offset }) => {
    try {
      return ok(await client.listArticles(projectId, { status, limit, offset }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'get_article',
  'Get full article details including content, SEO scores, metadata, and generation history',
  {
    articleId: z.string().describe('Article ID'),
  },
  async ({ articleId }) => {
    try {
      return ok(await client.getArticle(articleId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'generate_article',
  'Generate a new SEO-optimized article. Starts an async generation job and polls until completion (up to 5 minutes). Returns the completed article or timeout status. Pass sourceMaterial/referenceUrls/angle/mustInclude to seed the article with your own research (e.g. a changelog, PR notes, or competitor findings gathered in this session).',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    keyword: z.string().describe('Primary target keyword for the article'),
    briefId: z.string().optional().describe('Content brief ID to base article on'),
    templateId: z.string().optional().describe('Article template ID'),
    tone: z.string().optional().describe('Writing tone: professional, casual, authoritative, friendly'),
    wordCount: z.number().optional().describe('Target word count'),
    targetAudience: z.string().optional().describe('Target audience description'),
    additionalInstructions: z.string().optional().describe('Extra instructions for the AI writer'),
    sourceMaterial: z.string().optional().describe('Free-text research to ground the article (changelog, PR diff, competitor notes you gathered)'),
    referenceUrls: z.array(z.string()).optional().describe('Reference URLs to ground the article on'),
    angle: z.string().optional().describe('Desired angle / hook for the piece'),
    mustInclude: z.array(z.string()).optional().describe('Facts or terms that must appear in the article'),
    webhookUrl: z.string().optional().describe('One-shot callback URL fired when generation completes'),
  },
  async ({ projectId, keyword, briefId, templateId, tone, wordCount, targetAudience, additionalInstructions, sourceMaterial, referenceUrls, angle, mustInclude, webhookUrl }) => {
    try {
      const job = await client.generateArticle(projectId, {
        keyword,
        briefId,
        templateId,
        tone,
        wordCount,
        targetAudience,
        additionalInstructions,
        sourceMaterial,
        referenceUrls,
        angle,
        mustInclude,
        webhookUrl,
      });
      const jobId = job.jobId || job.id;
      if (!jobId) {
        return ok(job);
      }
      const result = await pollJob(jobId);
      return ok(result);
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'optimize_article',
  'Trigger auto-optimization on an existing article to improve SEO, AEO, and NLP scores. Calls the dedicated /v1/articles/:id/optimize endpoint and returns the result synchronously.',
  {
    articleId: z.string().describe('Article ID to optimize'),
    targetScore: z.number().optional().describe('Desired score after optimization (50-100, default 85)'),
    mode: z.enum(['light', 'aggressive']).optional().describe('Optimization aggressiveness (default light)'),
  },
  async ({ articleId, targetScore, mode }) => {
    try {
      return ok(await client.optimizeArticle(articleId, { targetScore, mode }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'publish_article',
  'Publish a draft article. This enables monitoring, keyword tracking, and pushes to connected CMS integrations.',
  {
    articleId: z.string().describe('Article ID to publish'),
  },
  async ({ articleId }) => {
    try {
      return ok(await client.publishArticle(articleId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'create_brief',
  'Create a content brief for a keyword. Returns structured brief with outline, competitor analysis, and recommended structure.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    keyword: z.string().describe('Target keyword for the brief'),
    targetAudience: z.string().optional().describe('Target audience description'),
    additionalInstructions: z.string().optional().describe('Extra guidance for brief creation'),
  },
  async ({ projectId, keyword, targetAudience, additionalInstructions }) => {
    try {
      const result = await client.generateArticle(projectId, {
        keyword,
        targetAudience,
        additionalInstructions: `brief_only:true${additionalInstructions ? ` ${additionalInstructions}` : ''}`,
      });
      return ok(result);
    } catch (e) {
      return err(e);
    }
  }
);

// ── Keywords ────────────────────────────────────────────────────────────────

server.tool(
  'list_keywords',
  'List tracked keywords for a project. Filter by status (active, dismissed, approved, starred, generated) or topic cluster.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    status: z.string().optional().describe('Filter: active, dismissed, approved, starred, generated, failed'),
    clusterId: z.string().optional().describe('Filter by topic cluster ID'),
    limit: z.number().optional().describe('Max results'),
    offset: z.number().optional().describe('Pagination offset'),
  },
  async ({ projectId, status, clusterId, limit, offset }) => {
    try {
      return ok(await client.listKeywords(projectId, { status, clusterId, limit, offset }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'add_keywords',
  'Add new keywords to track for a project. Optionally assign to a topic cluster.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    keywords: z.array(z.string()).describe('Array of keyword strings to add'),
    clusterId: z.string().optional().describe('Topic cluster ID to assign keywords to'),
  },
  async ({ projectId, keywords, clusterId }) => {
    try {
      return ok(await client.addKeywords(projectId, { keywords, clusterId }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'generate_keywords',
  'Run the keyword research pipeline for a project (live search-volume + SERP data + AI clustering + content-gap discovery). Inserts new keyword rows and returns the generated set.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    seedTopics: z.array(z.string()).optional().describe('Optional seed topics to bias expansion'),
    count: z.number().optional().describe('Target keyword count (5-100, default 30)'),
    expansionMode: z.enum(['full', 'gaps_only', 'similar_only', 'brand_only']).optional().describe('Expansion strategy (default full)'),
    forceRefresh: z.boolean().optional().describe('Re-run even if the pool is already above the threshold'),
  },
  async ({ projectId, seedTopics, count, expansionMode, forceRefresh }) => {
    try {
      return ok(
        await client.generateKeywords(projectId, {
          topicSeeds: seedTopics,
          count,
          expansionMode,
          forceRefresh,
        }),
      );
    } catch (e) {
      return err(e);
    }
  }
);

// ── Topic Clusters ──────────────────────────────────────────────────────────

server.tool(
  'get_topic_clusters',
  'Get all topic clusters for a project. Each cluster has a pillar keyword plus supporting keywords with roles, intent, AEO scores, and buyer journey stage.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
  },
  async ({ projectId }) => {
    try {
      return ok(await client.getTopicClusters(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Visibility ──────────────────────────────────────────────────────────────

server.tool(
  'get_visibility_summary',
  'Get AI visibility summary for a project. Includes LLM citation tracking across ChatGPT, Claude, Gemini, and Perplexity, plus traditional SERP rankings.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
  },
  async ({ projectId }) => {
    try {
      return ok(await client.getVisibilitySummary(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Insights ────────────────────────────────────────────────────────────────

server.tool(
  'get_insights',
  'Get AI-generated insights for a project. Types: rank_change, content_freshness, content_gaps, visibility_drift, gsc_performance, llm_citation_lost. Priority: critical, high, medium, low.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    type: z.string().optional().describe('Filter by insight type'),
    priority: z.string().optional().describe('Filter by priority: critical, high, medium, low'),
    limit: z.number().optional().describe('Max results'),
  },
  async ({ projectId, type, priority, limit }) => {
    try {
      return ok(await client.getInsights(projectId, { type, priority, limit }));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Opportunities ───────────────────────────────────────────────────────────

server.tool(
  'get_opportunities',
  'Get daily curated opportunities for a project. Three categories: outreach (link building), optimization (content improvements), creation (new content ideas).',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
  },
  async ({ projectId }) => {
    try {
      return ok(await client.getOpportunities(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Reddit (AEO distribution loop) ────────────────────────────────────────────

server.tool(
  'list_reddit_opportunities',
  'List Reddit engagement opportunities discovered for a project (RSS-discovered, optionally engagement-enriched). Ranked by opportunity score. Filter by status: new, draft, replied, dismissed.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    status: z.string().optional().describe('Filter by status: new, draft, replied, dismissed'),
    limit: z.number().optional().describe('Max results (default 25, max 100)'),
  },
  async ({ projectId, status, limit }) => {
    try {
      return ok(await client.listRedditOpportunities(projectId, { status, limit }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'check_subreddit_rules',
  "Get a subreddit's rules and link/self-promo policy (allowed/restricted/banned). Pass checkText to test whether a draft reply would violate the rules before posting — e.g. a reply containing a URL in a no-links subreddit.",
  {
    subreddit: z.string().describe('Subreddit name (with or without r/ prefix)'),
    checkText: z.string().optional().describe('Optional draft text to check against the rules'),
  },
  async ({ subreddit, checkText }) => {
    try {
      return ok(await client.getSubredditRules(subreddit, checkText));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'get_reddit_attribution',
  'Reddit -> AI citation closed-loop attribution: posts made, reddit.com citations in LLM answers before vs after posting began, direct hits on our own posts, and the lift. Proves Reddit activity grows AI visibility.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
  },
  async ({ projectId }) => {
    try {
      return ok(await client.getRedditAttribution(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Usage ───────────────────────────────────────────────────────────────────

server.tool(
  'get_usage',
  'Get account usage stats including article generation count vs limit, subscription tier, and feature availability.',
  {},
  async () => {
    try {
      return ok(await client.getUsage());
    } catch (e) {
      return err(e);
    }
  }
);

// ── Content Schedule ────────────────────────────────────────────────────────

server.tool(
  'get_content_schedule',
  'Get the content publishing schedule for a project. Shows upcoming scheduled articles with dates and status.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
  },
  async ({ projectId }) => {
    try {
      return ok(await client.getContentSchedule(projectId));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'schedule_content',
  'Schedule a new article for generation and publishing on a specific date.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    keyword: z.string().describe('Target keyword for the scheduled article'),
    scheduledDate: z.string().describe('Publication date in YYYY-MM-DD format'),
    templateId: z.string().optional().describe('Article template ID'),
    priority: z.number().optional().describe('Priority 1-5 (1 = highest)'),
  },
  async ({ projectId, keyword, scheduledDate, templateId, priority }) => {
    try {
      return ok(
        await client.scheduleContent(projectId, { keyword, scheduledDate, templateId, priority })
      );
    } catch (e) {
      return err(e);
    }
  }
);

// ── Jobs ────────────────────────────────────────────────────────────────────

server.tool(
  'get_job_status',
  'Check the status of an article generation or optimization job. Returns status (queued, processing, completed, failed), progress percentage, and result data.',
  {
    jobId: z.string().describe('Job ID to check'),
  },
  async ({ jobId }) => {
    try {
      return ok(await client.getJobStatus(jobId));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Grids (programmatic content plans) ────────────────────────────────────────

server.tool(
  'create_content_plan_grid',
  'Create a programmatic content-plan grid in Outserp from a list of planned articles. Use this after conversationally working out a strategy (e.g. "an article per recipe/business/SKU in the user\'s list") — supply one row per planned article with its title, primary keyword, and angle. Returns a grid id plus a dashboard link the user can watch fill. Then call run_grid to bulk-generate.',
  {
    projectId: z.string().optional().describe('Project ID (uses default if not set)'),
    name: z.string().optional().describe('Name for the content plan'),
    rows: z.array(z.object({
      keyword: z.string().optional().describe('Primary target keyword'),
      title: z.string().optional().describe('Planned article title'),
      angle: z.string().optional().describe('Angle / hook for the article'),
      templateType: z.string().optional().describe('Programmatic template: comparison, alternative, glossary, integration, location'),
      nicheContext: z.record(z.string(), z.any()).optional().describe('Per-row data from the user (e.g. the recipe/business/SKU fields)'),
    })).describe('Planned articles, one per row'),
  },
  async ({ projectId, name, rows }) => {
    try {
      return ok(await client.createGrid({ projectId, name, rows }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'add_grid_rows',
  'Append more planned-article rows to an existing content-plan grid.',
  {
    gridId: z.string().describe('Grid id returned by create_content_plan_grid'),
    rows: z.array(z.object({
      keyword: z.string().optional(),
      title: z.string().optional(),
      angle: z.string().optional(),
      templateType: z.string().optional(),
      nicheContext: z.record(z.string(), z.any()).optional(),
    })).describe('Rows to append'),
  },
  async ({ gridId, rows }) => {
    try {
      return ok(await client.addGridRows(gridId, rows));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'run_grid',
  'Bulk-generate articles for a content-plan grid. Each row spends the monthly allowance, then credits; the run stops cleanly when capacity is exhausted and reports how many ran vs. were skipped for credits (call request_credits to top up). Mode: all, remaining (default), first10, errors.',
  {
    gridId: z.string().describe('Grid id to run'),
    mode: z.enum(['all', 'remaining', 'first10', 'errors']).optional().describe('Which rows to run (default remaining)'),
  },
  async ({ gridId, mode }) => {
    try {
      return ok(await client.runGrid(gridId, { mode }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'get_grid_results',
  'Get the status of every row in a content-plan grid (empty/running/done/error) plus a status summary, to track a bulk run.',
  {
    gridId: z.string().describe('Grid id'),
  },
  async ({ gridId }) => {
    try {
      return ok(await client.getGridResults(gridId));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Account / Discovery ───────────────────────────────────────────────────────

server.tool(
  'whoami',
  'Confirm the connected Outserp account: subscription tier, usage vs limits, available projects, and current credit balance. Call this first to understand what the account can do.',
  {},
  async () => {
    try {
      const [usage, credits, projects] = await Promise.all([
        client.getUsage().catch(() => null),
        client.getCredits().catch(() => null),
        client.listProjects().catch(() => null),
      ]);
      return ok({ usage, credits, projects });
    } catch (e) {
      return err(e);
    }
  }
);

// ── Credits (wallet + on-demand top-up) ───────────────────────────────────────

server.tool(
  'get_credit_balance',
  'Get the consumable credit balance and recent ledger. Credits back generation/grid runs once the monthly plan allowance is exhausted.',
  {},
  async () => {
    try {
      return ok(await client.getCredits());
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'request_credits',
  'Request an on-demand credit top-up when an action is blocked by INSUFFICIENT_CREDITS or the plan allowance is exhausted. Returns a Stripe Checkout URL the human approves — credits are never charged silently. Specify a pack (credits_50/credits_100/credits_500) or a custom credits amount.',
  {
    pack: z.enum(['credits_50', 'credits_100', 'credits_500']).optional().describe('Named credit pack'),
    credits: z.number().optional().describe('Custom number of credits to buy (if no pack given)'),
    currency: z.enum(['USD', 'GBP', 'EUR']).optional().describe('Billing currency (default USD)'),
  },
  async ({ pack, credits, currency }) => {
    try {
      return ok(await client.requestCredits({ pack, credits, currency }));
    } catch (e) {
      return err(e);
    }
  }
);

// ── Webhooks (outbound notifications) ─────────────────────────────────────────

server.tool(
  'register_webhook',
  'Register an outbound webhook so external tools are notified when long jobs finish (instead of polling). Returns a signing secret once — store it to verify the X-Outserp-Signature HMAC.',
  {
    url: z.string().describe('HTTPS endpoint to receive events'),
    events: z.array(z.enum(['article.completed', 'article.failed', 'grid.completed', 'credits.low', 'credits.purchased'])).describe('Events to subscribe to'),
  },
  async ({ url, events }) => {
    try {
      return ok(await client.registerWebhook({ url, events }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  'list_webhooks',
  'List registered outbound webhook endpoints for the account.',
  {},
  async () => {
    try {
      return ok(await client.listWebhooks());
    } catch (e) {
      return err(e);
    }
  }
);

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Outserp MCP server error:', err);
  process.exit(1);
});
