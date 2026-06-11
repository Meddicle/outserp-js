---
description: Run an Outserp AI-visibility audit on a prospect or competitor domain and get a shareable branded report. Use when an agency/admin wants to audit a website they don't own (e.g. before a sales pitch).
---

# Outserp: audit a prospect domain

The user wants to audit a domain they don't own (a prospect or competitor). Target: "$ARGUMENTS".

1. Confirm the domain (e.g. `acme.com`).
2. Call `run_audit` with the domain. It spends one audit credit, runs a multi-engine
   AI-visibility audit, and returns the visibility score, the competitors who outrank
   them, the top content gaps, and a **public report URL** with graphs.
3. Share the takeaways and the report URL — it's a branded page you can send straight
   to the prospect (visibility vs competitors, visibility on key questions, gaps).
4. If it returns `INSUFFICIENT_CREDITS`, offer `request_credits` to top up.

This is ideal for agencies qualifying a lead: audit their site, send the report, open
the conversation.
