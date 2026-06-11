/**
 * @outserp/sdk
 *
 * Typed client for the Outserp REST API v1. Used by:
 *   • @outserp/mcp-server  (MCP server for Cursor / Claude Desktop / Cline)
 *   • @outserp/cli         (terminal CLI)
 *   • any third-party Node.js / browser integration
 *
 * Documentation: https://outserp.ai/docs/api
 */

export const DEFAULT_BASE_URL = 'https://outserp.ai';

// ─── Types ────────────────────────────────────────────────────────────

export interface OutserpClientOptions {
  /** API key. Defaults to `process.env.OUTSERP_API_KEY`. */
  apiKey?: string;
  /** API base URL. Defaults to `process.env.OUTSERP_BASE_URL` or `https://outserp.ai`. */
  baseUrl?: string;
  /** Default project ID to use when one isn't passed per-call. */
  projectId?: string;
  /** Custom fetch implementation (for testing or non-standard runtimes). */
  fetchImpl?: typeof fetch;
  /** Optional human-readable label appended to the User-Agent. */
  userAgent?: string;
}

export interface ListArticlesOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ListKeywordsOptions {
  status?: string;
  clusterId?: string;
  limit?: number;
  offset?: number;
}

export interface GetInsightsOptions {
  type?: string;
  priority?: string;
  limit?: number;
}

export interface AddKeywordsData {
  keywords: string[];
  clusterId?: string;
}

export interface GenerateKeywordsOptions {
  count?: number;
  expansionMode?: 'full' | 'gaps_only' | 'similar_only' | 'brand_only';
  forceRefresh?: boolean;
  topicSeeds?: string[];
}

export interface ScheduleContentData {
  keyword: string;
  scheduledDate: string;
  templateId?: string;
  priority?: number;
}

export interface GenerateArticleData {
  keyword: string;
  briefId?: string;
  templateId?: string;
  tone?: string;
  wordCount?: number;
  targetAudience?: string;
  additionalInstructions?: string;
  /** Free-text research the caller gathered (changelog, PR notes, competitor findings). */
  sourceMaterial?: string;
  /** Reference URLs to ground the article on. */
  referenceUrls?: string[];
  /** Desired angle / hook for the piece. */
  angle?: string;
  /** Facts/terms that must appear in the article. */
  mustInclude?: string[];
  /** One-shot callback fired when the job completes (in addition to registered webhooks). */
  webhookUrl?: string;
}

export interface CreditCheckoutOptions {
  pack?: 'credits_50' | 'credits_100' | 'credits_500';
  credits?: number;
  currency?: 'USD' | 'GBP' | 'EUR';
}

export interface RegisterWebhookData {
  url: string;
  events: Array<'article.completed' | 'article.failed' | 'grid.completed' | 'credits.low' | 'credits.purchased'>;
}

export interface OptimizeArticleOptions {
  targetScore?: number;
  mode?: 'light' | 'aggressive';
}

/**
 * Loose response shapes. The REST API may include extra fields not modelled
 * here; the [key: string]: unknown allows callers to still access them.
 */
export interface JobStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'error' | 'timeout' | string;
  jobId?: string;
  id?: string;
  progress?: number;
  result?: unknown;
  message?: string;
  [key: string]: unknown;
}

export interface GenerateArticleResponse {
  jobId?: string;
  id?: string;
  status?: string;
  article?: { id: string; title: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface OptimizeArticleResponse {
  article_id: string;
  job_id?: string;
  target_score: number;
  mode: 'light' | 'aggressive';
  [key: string]: unknown;
}

// ─── Error ────────────────────────────────────────────────────────────

export class OutserpAPIError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'OutserpAPIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ─── Client ───────────────────────────────────────────────────────────

export class OutserpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultProjectId: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(
    optionsOrApiKey: OutserpClientOptions | string | undefined = undefined,
    legacyBaseUrl?: string,
    legacyProjectId?: string,
  ) {
    // Accept three forms:
    //   new OutserpClient({ apiKey, baseUrl, projectId })  // preferred
    //   new OutserpClient('sk_…')                            // shorthand
    //   new OutserpClient(apiKey, baseUrl, projectId)        // legacy positional (used by @outserp/cli and @outserp/mcp-server 0.1.x)
    const opts: OutserpClientOptions = typeof optionsOrApiKey === 'object' && optionsOrApiKey !== null
      ? optionsOrApiKey
      : {
          apiKey: optionsOrApiKey,
          baseUrl: legacyBaseUrl,
          projectId: legacyProjectId,
        };

    this.apiKey = opts.apiKey || readEnv('OUTSERP_API_KEY') || '';
    this.baseUrl = (opts.baseUrl || readEnv('OUTSERP_BASE_URL') || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.defaultProjectId = opts.projectId || readEnv('OUTSERP_PROJECT_ID') || undefined;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.userAgent = opts.userAgent || '@outserp/sdk';

    if (!this.apiKey) {
      throw new Error(
        '[outserp] API key is required. Pass `{ apiKey }` to OutserpClient or set OUTSERP_API_KEY.',
      );
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new Error(
        '[outserp] No fetch implementation available. Pass `fetchImpl` for Node < 18 / non-standard runtimes.',
      );
    }
  }

  private resolveProjectId(projectId?: string): string {
    const id = projectId || this.defaultProjectId;
    if (!id) {
      throw new Error(
        '[outserp] projectId is required. Pass it as a parameter or set OUTSERP_PROJECT_ID.',
      );
    }
    return id;
  }

  /**
   * Low-level request helper. Throws `OutserpAPIError` on non-2xx responses.
   * Public so consumers can call un-typed endpoints (e.g. future routes not
   * yet wrapped by SDK methods).
   */
  async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await this.fetchImpl(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': this.userAgent,
        ...(init.headers ?? {}),
      },
    });

    let data: any = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const message = (data && (data.error?.message || data.error || data.message)) || `API error: ${res.status}`;
      const code = data?.error?.code || data?.code;
      throw new OutserpAPIError(message, res.status, code, data);
    }
    return data as T;
  }

  // ── Projects ─────────────────────────────────────────────────────────

  listProjects() {
    return this.request('/projects');
  }

  // ── Articles ─────────────────────────────────────────────────────────

  listArticles(projectId?: string, opts?: ListArticlesOptions) {
    const pid = this.resolveProjectId(projectId);
    const params = new URLSearchParams({ projectId: pid });
    if (opts?.status) params.set('status', opts.status);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    return this.request(`/articles?${params.toString()}`);
  }

  getArticle(id: string) {
    return this.request(`/articles/${id}`);
  }

  generateArticle(projectId?: string, data?: GenerateArticleData) {
    const pid = this.resolveProjectId(projectId);
    return this.request<GenerateArticleResponse>('/articles/generate', {
      method: 'POST',
      body: JSON.stringify({ projectId: pid, ...data }),
    });
  }

  optimizeArticle(articleId: string, opts?: OptimizeArticleOptions) {
    return this.request<OptimizeArticleResponse>(`/articles/${articleId}/optimize`, {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    });
  }

  publishArticle(articleId: string) {
    return this.request(`/articles/${articleId}/publish`, { method: 'POST' });
  }

  // ── Keywords ─────────────────────────────────────────────────────────

  listKeywords(projectId?: string, opts?: ListKeywordsOptions) {
    const pid = this.resolveProjectId(projectId);
    const params = new URLSearchParams({ projectId: pid });
    if (opts?.status) params.set('status', opts.status);
    if (opts?.clusterId) params.set('clusterId', opts.clusterId);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    return this.request(`/keywords?${params.toString()}`);
  }

  addKeywords(projectId?: string, data?: AddKeywordsData) {
    const pid = this.resolveProjectId(projectId);
    return this.request('/keywords', {
      method: 'POST',
      body: JSON.stringify({ projectId: pid, ...data }),
    });
  }

  /**
   * Triggers the keyword research pipeline (live search data + AI expansion).
   * Inserts new keyword rows into the project.
   */
  generateKeywords(projectId?: string, opts?: GenerateKeywordsOptions) {
    const pid = this.resolveProjectId(projectId);
    return this.request('/keywords/generate', {
      method: 'POST',
      body: JSON.stringify({ projectId: pid, ...opts }),
    });
  }

  // ── Topic Clusters ───────────────────────────────────────────────────

  getTopicClusters(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/topics?projectId=${pid}`);
  }

  // ── Visibility ───────────────────────────────────────────────────────

  getVisibilitySummary(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/visibility?projectId=${pid}`);
  }

  // ── Insights ─────────────────────────────────────────────────────────

  getInsights(projectId?: string, opts?: GetInsightsOptions) {
    const pid = this.resolveProjectId(projectId);
    const params = new URLSearchParams({ projectId: pid });
    if (opts?.type) params.set('type', opts.type);
    if (opts?.priority) params.set('priority', opts.priority);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.request(`/insights?${params.toString()}`);
  }

  // ── Opportunities ────────────────────────────────────────────────────

  getOpportunities(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/opportunities?projectId=${pid}`);
  }

  // ── Usage ────────────────────────────────────────────────────────────

  getUsage() {
    return this.request('/usage');
  }

  // ── Content Schedule ─────────────────────────────────────────────────

  getContentSchedule(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/content-schedule?projectId=${pid}`);
  }

  scheduleContent(projectId?: string, data?: ScheduleContentData) {
    const pid = this.resolveProjectId(projectId);
    return this.request('/content-schedule', {
      method: 'POST',
      body: JSON.stringify({ projectId: pid, ...data }),
    });
  }

  // ── Jobs ─────────────────────────────────────────────────────────────

  getJobStatus(jobId: string) {
    return this.request<JobStatusResponse>(`/jobs/${jobId}`);
  }

  // ── Reddit (AEO distribution loop) ───────────────────────────────────

  listRedditOpportunities(projectId?: string, opts?: { status?: string; limit?: number }) {
    const pid = this.resolveProjectId(projectId);
    const params = new URLSearchParams({ projectId: pid });
    if (opts?.status) params.set('status', opts.status);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.request(`/reddit/opportunities?${params.toString()}`);
  }

  getSubredditRules(subreddit: string, checkText?: string) {
    const params = new URLSearchParams({ subreddit });
    if (checkText) params.set('checkText', checkText);
    return this.request(`/reddit/subreddit-rules?${params.toString()}`);
  }

  getRedditAttribution(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/reddit/attribution?projectId=${pid}`);
  }

  // ── Brand intelligence (read) ────────────────────────────────────────

  getCompetitors(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/competitors?projectId=${pid}`);
  }

  getCitations(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/citations?projectId=${pid}`);
  }

  getMentions(projectId?: string, opts?: { platform?: string; limit?: number }) {
    const pid = this.resolveProjectId(projectId);
    const params = new URLSearchParams({ projectId: pid });
    if (opts?.platform) params.set('platform', opts.platform);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.request(`/mentions?${params.toString()}`);
  }

  getBrandProfile(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/brand-profile?projectId=${pid}`);
  }

  getSiteHealth(projectId?: string) {
    const pid = this.resolveProjectId(projectId);
    return this.request(`/site-health?projectId=${pid}`);
  }

  // ── Prospect audit (agencies/admins) ─────────────────────────────────

  /**
   * Run an AI-visibility audit on ANY domain and get a shareable report URL.
   * Spends one audit credit. Returns { auditId, reportUrl, visibilityScore, ... }.
   */
  runAudit(domain: string, opts?: { deep?: boolean }) {
    return this.request<{ auditId: string; reportUrl: string; visibilityScore: number; competitors: string[]; topGaps: string[]; domain: string; brandName?: string }>(
      '/audit',
      { method: 'POST', body: JSON.stringify({ domain, ...opts }) },
    );
  }

  // ── Credits (wallet + on-demand top-up) ──────────────────────────────

  /** Current consumable credit balance + recent ledger entries. */
  getCredits() {
    return this.request('/credits');
  }

  getCreditHistory(opts?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const q = params.toString();
    return this.request(`/credits/history${q ? `?${q}` : ''}`);
  }

  /**
   * Create a Stripe Checkout URL to buy credits. Returns `{ url }` for a human
   * to approve — credits are granted once payment completes. Backs `request_credits`.
   */
  requestCredits(opts: CreditCheckoutOptions) {
    return this.request<{ url: string; credits: number; amount: number; currency: string }>(
      '/credits/checkout',
      { method: 'POST', body: JSON.stringify(opts) },
    );
  }

  // ── Webhooks (outbound) ──────────────────────────────────────────────

  listWebhooks() {
    return this.request('/webhooks');
  }

  registerWebhook(data: RegisterWebhookData) {
    return this.request('/webhooks', { method: 'POST', body: JSON.stringify(data) });
  }

  deleteWebhook(id: string) {
    return this.request(`/webhooks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ── Grids (programmatic content plans) ───────────────────────────────

  createGrid(data: { projectId?: string; name?: string; template?: string; columns?: unknown[]; rows?: unknown[] }) {
    const pid = this.resolveProjectId(data.projectId);
    return this.request('/grids', { method: 'POST', body: JSON.stringify({ ...data, projectId: pid }) });
  }

  addGridRows(gridId: string, rows: unknown[]) {
    return this.request(`/grids/${gridId}/rows`, { method: 'POST', body: JSON.stringify({ rows }) });
  }

  runGrid(gridId: string, opts?: { mode?: 'all' | 'remaining' | 'first10' | 'errors'; concurrency?: number }) {
    return this.request(`/grids/${gridId}/run`, { method: 'POST', body: JSON.stringify(opts ?? {}) });
  }

  getGrid(gridId: string) {
    return this.request(`/grids/${gridId}`);
  }

  getGridResults(gridId: string) {
    return this.request(`/grids/${gridId}/results`);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}
