---
description: Build a programmatic content plan in Outserp from a list (recipes, products, businesses, locations…) and bulk‑generate it. Use when the user wants many articles from a dataset or a programmatic SEO strategy.
---

# Outserp: programmatic content plan

The user wants a programmatic content plan. Input / dataset hint: "$ARGUMENTS".

1. Get the list of entities to build around — from the user's message, a file, or a
   database query they run. Each becomes one planned article.
2. For each entity, work out a `title`, primary `keyword`, and `angle`. Pick a
   `templateType` when it fits: `comparison`, `alternative`, `glossary`,
   `integration`, or `location`. Put any per‑item fields in `nicheContext`.
3. Call `create_content_plan_grid` with the `rows`. It returns a grid id + a
   dashboard link — share the link so the user can watch it fill.
4. Confirm scale with the user, then `run_grid` (start with `mode: "first10"` for a
   sanity check). Each row spends allowance then credits and stops at the ceiling,
   reporting how many ran vs. were skipped.
5. Track progress with `get_grid_results`. If it stops for credits, offer
   `request_credits`.

Keep the user in control of volume — confirm before running the full set.
