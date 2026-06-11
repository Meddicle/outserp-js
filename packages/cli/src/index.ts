#!/usr/bin/env node

import { Command } from 'commander';
import { OutserpClient } from './client.js';
import { loadConfig, saveConfig, clearConfig, type CliConfig } from './config.js';
import { formatTable, formatJson, spinner, success, error, info, warn } from './ui.js';

const VERSION = '0.1.0';

function getClient(): OutserpClient {
  const config = loadConfig();
  if (!config.apiKey) {
    error('Not authenticated. Run `outserp auth login` first.');
    process.exit(1);
  }
  return new OutserpClient(config.apiKey, config.baseUrl, config.projectId);
}

function outputResult(data: unknown, format: string) {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

const program = new Command();

program
  .name('outserp')
  .description('Outserp CLI — AI SEO & AEO content platform')
  .version(VERSION);

// ── Auth ─────────────────────────────────────────────────────────────────────

const auth = program.command('auth').description('Manage authentication');

auth
  .command('login')
  .description('Authenticate with your Outserp API key')
  .argument('<api-key>', 'Your Outserp API key')
  .option('--base-url <url>', 'API base URL', 'https://outserp.ai')
  .action(async (apiKey: string, opts: { baseUrl: string }) => {
    const s = spinner('Validating API key...');
    try {
      const client = new OutserpClient(apiKey, opts.baseUrl);
      const projects = await client.listProjects();
      saveConfig({ apiKey, baseUrl: opts.baseUrl });
      s.stop();
      success(`Authenticated successfully. Found ${(projects as any)?.length || 0} project(s).`);
    } catch (err: any) {
      s.stop();
      error(`Authentication failed: ${err.message}`);
      process.exit(1);
    }
  });

auth
  .command('logout')
  .description('Clear stored credentials')
  .action(() => {
    clearConfig();
    success('Logged out. Credentials cleared.');
  });

auth
  .command('status')
  .description('Show current auth status')
  .action(() => {
    const config = loadConfig();
    if (config.apiKey) {
      info(`Authenticated to ${config.baseUrl || 'https://outserp.ai'}`);
      info(`API key: ${config.apiKey.slice(0, 8)}...`);
      if (config.projectId) info(`Default project: ${config.projectId}`);
    } else {
      warn('Not authenticated. Run `outserp auth login <key>`.');
    }
  });

// ── Init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Select a default project')
  .argument('[project-id]', 'Project ID to set as default')
  .action(async (projectId?: string) => {
    const client = getClient();
    if (projectId) {
      const config = loadConfig();
      saveConfig({ ...config, projectId });
      success(`Default project set to ${projectId}`);
      return;
    }

    const s = spinner('Fetching projects...');
    const projects = (await client.listProjects()) as any[];
    s.stop();

    if (!projects?.length) {
      warn('No projects found. Create one at https://outserp.ai');
      return;
    }

    console.log('\nAvailable projects:\n');
    projects.forEach((p: any, i: number) => {
      console.log(`  ${i + 1}. ${p.name || p.domain || p.id}  (${p.id})`);
    });

    const first = projects[0];
    const config = loadConfig();
    saveConfig({ ...config, projectId: first.id });
    success(`Default project set to ${first.name || first.id}`);
  });

// ── Status ───────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Project dashboard overview')
  .option('--format <fmt>', 'Output format: table or json', 'table')
  .action(async (opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Loading dashboard...');
    try {
      const [usage, articles, keywords] = await Promise.all([
        client.getUsage(),
        client.listArticles(undefined, { limit: 5 }),
        client.listKeywords(undefined, { limit: 5 }),
      ]);
      s.stop();

      if (opts.format === 'json') {
        outputResult({ usage, recentArticles: articles, recentKeywords: keywords }, 'json');
        return;
      }

      console.log('\n📊 Usage');
      console.log(JSON.stringify(usage, null, 2));
      console.log('\n📝 Recent Articles');
      if (Array.isArray(articles)) {
        articles.slice(0, 5).forEach((a: any) => {
          console.log(`  • ${a.title || a.keyword} [${a.status}]`);
        });
      }
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Generate ─────────────────────────────────────────────────────────────────

program
  .command('generate')
  .description('Generate an article for a keyword')
  .argument('<keyword>', 'Target keyword')
  .option('--tone <tone>', 'Writing tone')
  .option('--word-count <n>', 'Target word count', parseInt)
  .option('--no-wait', 'Start and return immediately')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (keyword: string, opts: any) => {
    const client = getClient();
    const s = spinner(`Generating article for "${keyword}"...`);
    try {
      const result = await client.generateArticle(undefined, {
        keyword,
        tone: opts.tone,
        wordCount: opts.wordCount,
      }) as any;

      if (opts.wait === false || !result.jobId) {
        s.stop();
        success(`Job started: ${result.jobId || 'unknown'}`);
        outputResult(result, opts.format);
        return;
      }

      s.update(`Generating... (job: ${result.jobId})`);

      const start = Date.now();
      const maxMs = 300_000;
      while (Date.now() - start < maxMs) {
        await new Promise((r) => setTimeout(r, 5000));
        const status = await client.getJobStatus(result.jobId);
        if ((status as any).status === 'completed') {
          s.stop();
          success('Article generated successfully!');
          outputResult(status, opts.format);
          return;
        }
        if ((status as any).status === 'failed' || (status as any).status === 'error') {
          s.stop();
          error(`Generation failed: ${(status as any).error || 'Unknown error'}`);
          return;
        }
        const stage = (status as any).stage || 'processing';
        const progress = (status as any).overall_progress || 0;
        s.update(`Generating... ${stage} (${progress}%)`);
      }

      s.stop();
      warn(`Job ${result.jobId} still running. Check with: outserp articles get ${result.jobId}`);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Optimize ─────────────────────────────────────────────────────────────────

program
  .command('optimize')
  .description('Optimize an existing article (SEO + AEO + NLP rewrite pass)')
  .argument('<article-id>', 'Article ID to optimize')
  .option('--target-score <n>', 'Desired score after optimization (50-100, default 85)', (v) => Number.parseInt(v, 10))
  .option('--mode <mode>', 'Optimization mode: light or aggressive', 'light')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (articleId: string, opts: { format: string; targetScore?: number; mode?: string }) => {
    const client = getClient();
    const s = spinner(`Optimizing article ${articleId}...`);
    try {
      const mode = opts.mode === 'aggressive' ? 'aggressive' : 'light';
      const result = await client.optimizeArticle(articleId, {
        targetScore: opts.targetScore,
        mode,
      });
      s.stop();
      success('Optimization complete');
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Publish ──────────────────────────────────────────────────────────────────

program
  .command('publish')
  .description('Publish an article to connected CMS')
  .argument('<article-id>', 'Article ID to publish')
  .option('--platform <platform>', 'Target platform (wordpress, ghost, webflow, etc.)')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (articleId: string, opts: { platform?: string; format: string }) => {
    const client = getClient();
    const s = spinner(`Publishing article ${articleId}...`);
    try {
      const result = await client.publishArticle(articleId);
      s.stop();
      success('Article published');
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Audit ────────────────────────────────────────────────────────────────────

program
  .command('audit')
  .description('Run an AI-visibility audit on any domain (spends 1 audit credit). Returns a shareable report URL.')
  .argument('<domain>', 'Domain to audit, e.g. acme.com')
  .option('--shallow', 'Faster, single-engine audit')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (domain: string, opts: { shallow?: boolean; format: string }) => {
    const client = getClient();
    const s = spinner(`Auditing ${domain}...`);
    try {
      const result = await client.runAudit(domain, { deep: !opts.shallow });
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Articles CRUD ────────────────────────────────────────────────────────────

const articles = program.command('articles').description('Manage articles');

articles
  .command('list')
  .description('List articles')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Max results', '20')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: any) => {
    const client = getClient();
    const s = spinner('Fetching articles...');
    try {
      const result = await client.listArticles(undefined, {
        status: opts.status,
        limit: parseInt(opts.limit),
      });
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

articles
  .command('get')
  .description('Get article details')
  .argument('<id>', 'Article ID')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (id: string, opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Fetching article...');
    try {
      const result = await client.getArticle(id);
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Keywords CRUD ────────────────────────────────────────────────────────────

const keywords = program.command('keywords').description('Manage keywords');

keywords
  .command('list')
  .description('List tracked keywords')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Max results', '50')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: any) => {
    const client = getClient();
    const s = spinner('Fetching keywords...');
    try {
      const result = await client.listKeywords(undefined, {
        status: opts.status,
        limit: parseInt(opts.limit),
      });
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

keywords
  .command('add')
  .description('Add keywords to track')
  .argument('<keywords...>', 'Keywords to add')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (kws: string[], opts: { format: string }) => {
    const client = getClient();
    const s = spinner(`Adding ${kws.length} keyword(s)...`);
    try {
      const result = await client.addKeywords(undefined, { keywords: kws });
      s.stop();
      success(`Added ${kws.length} keyword(s)`);
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Visibility ───────────────────────────────────────────────────────────────

const visibility = program.command('visibility').description('AI visibility tracking');

visibility
  .command('summary')
  .description('Get visibility summary across AI platforms')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Fetching visibility data...');
    try {
      const result = await client.getVisibilitySummary();
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Credits ────────────────────────────────────────────────────────────────────

const credits = program.command('credits').description('Credit wallet & on-demand top-up');

credits
  .command('balance')
  .description('Show consumable credit balance and recent ledger')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Fetching credit balance...');
    try {
      const result = await client.getCredits();
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

credits
  .command('buy')
  .description('Get a Stripe Checkout URL to buy credits (a human approves the charge)')
  .option('--pack <pack>', 'Named pack: credits_50, credits_100, credits_500')
  .option('--credits <n>', 'Custom number of credits to buy')
  .option('--currency <cur>', 'USD, GBP or EUR', 'USD')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: { pack?: string; credits?: string; currency: string; format: string }) => {
    const client = getClient();
    const s = spinner('Creating checkout...');
    try {
      const result = await client.requestCredits({
        pack: opts.pack as any,
        credits: opts.credits ? Number(opts.credits) : undefined,
        currency: opts.currency as any,
      });
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Reddit ───────────────────────────────────────────────────────────────────

const reddit = program.command('reddit').description('Reddit AEO distribution loop');

reddit
  .command('opportunities')
  .description('List Reddit engagement opportunities for the current project')
  .option('--status <status>', 'Filter: new, draft, replied, dismissed')
  .option('--limit <n>', 'Max results', '25')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: { status?: string; limit: string; format: string }) => {
    const client = getClient();
    const s = spinner('Fetching Reddit opportunities...');
    try {
      const result = await client.listRedditOpportunities(undefined, {
        status: opts.status,
        limit: Number(opts.limit),
      });
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

reddit
  .command('rules <subreddit>')
  .description("Show a subreddit's rules + link policy (optionally check a draft)")
  .option('--check <text>', 'Draft text to check against the rules')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (subreddit: string, opts: { check?: string; format: string }) => {
    const client = getClient();
    const s = spinner(`Fetching r/${subreddit} rules...`);
    try {
      const result = await client.getSubredditRules(subreddit, opts.check);
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

reddit
  .command('attribution')
  .description('Reddit -> AI citation attribution report for the current project')
  .option('--format <fmt>', 'Output format', 'json')
  .action(async (opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Computing Reddit citation attribution...');
    try {
      const result = await client.getRedditAttribution();
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Projects ─────────────────────────────────────────────────────────────────

const projects = program.command('projects').description('Manage projects');

projects
  .command('list')
  .description('List all projects')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Fetching projects...');
    try {
      const result = await client.listProjects();
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

// ── Schedule ─────────────────────────────────────────────────────────────────

const schedule = program.command('schedule').description('Content scheduling');

schedule
  .command('list')
  .description('View content schedule')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (opts: { format: string }) => {
    const client = getClient();
    const s = spinner('Fetching schedule...');
    try {
      const result = await client.getContentSchedule();
      s.stop();
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

schedule
  .command('add')
  .description('Schedule content generation')
  .argument('<keyword>', 'Keyword to schedule')
  .option('--date <date>', 'Scheduled date (ISO)')
  .option('--format <fmt>', 'Output format', 'table')
  .action(async (keyword: string, opts: { date?: string; format: string }) => {
    const client = getClient();
    const s = spinner(`Scheduling "${keyword}"...`);
    try {
      const result = await client.scheduleContent(undefined, {
        keyword,
        scheduledDate: opts.date || new Date().toISOString(),
      });
      s.stop();
      success('Content scheduled');
      outputResult(result, opts.format);
    } catch (err: any) {
      s.stop();
      error(err.message);
    }
  });

program.parse();
