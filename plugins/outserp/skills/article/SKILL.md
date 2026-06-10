---
description: Generate or optimize an Outserp SEO/AEO article. Use when the user wants to turn a keyword, a shipped feature, a changelog, or their own research into a published‑ready article via Outserp.
---

# Outserp: write an article

The user wants to create an article with Outserp. Input (if any): "$ARGUMENTS".

Use the Outserp MCP tools:

1. If you're unsure which project/account is connected, call `whoami` first.
2. Gather grounding. If the user pointed at a PR, changelog, feature, or notes —
   or if you've done web/repo research in this session — pass it as
   `sourceMaterial` (plus `referenceUrls`, `angle`, and `mustInclude` when useful)
   to `generate_article`. This is what makes the article reflect *their* work, not
   a generic post.
3. Call `generate_article` with the target `keyword` (+ the context above). It
   returns a `jobId` + `pollUrl`; poll with `get_job_status` until complete.
4. If the user asks to improve an existing piece, use `optimize_article`; to push
   it live, `publish_article`.

If a tool returns `INSUFFICIENT_CREDITS`, tell the user and offer to call
`request_credits` (it returns a checkout link they approve — never charge silently).
