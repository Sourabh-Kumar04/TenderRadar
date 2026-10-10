# TenderRadar Vercel Deployment Guide

This guide details how to deploy the TenderRadar FastAPI application to **Vercel** serverless.

## Prerequisites
- Node.js & npm installed (for Vercel CLI)
- A free or pro [Vercel account](https://vercel.com)
- (Optional) [SerpApi account](https://serpapi.com) & [Fireworks AI account](https://fireworks.ai) for live searches and AI summarization

---

## 1. Quick Deploy via Vercel CLI

```bash
# 1. Install the Vercel CLI globally if not already installed:
npm install -g vercel

# 2. Log in to your Vercel account:
vercel login

# 3. Deploy to production:
vercel --prod
```

When prompted by the CLI on the first run:
- **Set up and deploy?** `yes`
- **Which scope?** Select your account/team
- **Link to existing project?** `no` (creates a new project)
- **What's your project's name?** `tenderradar`
- **In which directory is your code located?** `./`
- **Want to modify build settings?** `no` (uses `vercel.json`)

---

## 2. Serverless Adaptations

The repository has been adapted for Vercel serverless functions:
- **Runtime Entrypoint:** `api/index.py` boots the FastAPI app and ensures proper `sys.path`.
- **Configuration:** `vercel.json` configures `@vercel/python` and routes all traffic `/(.*)` to `api/index.py`.
- **Pre-Seeded Database:** `data/tenders.db` (containing Indian government tenders with verdicts, match scores, and reasons) is bundled in the deployment via `includeFiles` in `vercel.json`.
- **Read-Only SQLite Graceful Fallback:** Because AWS Lambda / Vercel serverless has a read-only root filesystem, SQLite opens in `?mode=ro` mode. Write operations (scan logs, bidder profile updates, saved tender bookmarks) gracefully use in-memory fallback storage, preventing crashes.
- **Background Scheduler Suppression:** Lifespan APScheduler background threads are disabled in serverless (`is_vercel`), avoiding execution timeouts.
- **Local Dev Untouched:** When running locally (`uvicorn app.main:app`), SQLite operates in standard read-write WAL mode with APScheduler background tasks enabled.

---

## 3. Environment Variables Configuration

In the Vercel dashboard:
Navigate to **Project Settings → Environment Variables** and add the following keys:

| Environment Variable | Recommended Value | Purpose |
|----------------------|-------------------|---------|
| `MOCK_SERPAPI` | `true` (or `false` for live) | Enables offline mock search fixtures when `true`. Set to `false` when using live SerpApi credits. |
| `MOCK_LLM` | `true` (or `false` for live) | Enables deterministic mock AI verdicts when `true`. Set to `false` when using live Fireworks AI API. |
| `SERPAPI_API_KEY` | *(your secret key)* | Required only if `MOCK_SERPAPI=false`. Queries Google Search across Indian government portals. |
| `FIREWORKS_API_KEY` | *(your secret key)* | Required only if `MOCK_LLM=false`. Queries DeepSeek V4P1 Flash for extraction & BidAdvisor scoring. |

> **Note:** The deployment comes configured with `MOCK_SERPAPI: true` and `MOCK_LLM: true` by default in `vercel.json`, allowing the dashboard to function immediately out-of-the-box upon deployment without exposing API keys.

---

## 4. Verification

After deployment, test that the deployment URL is active:
1. `GET /` should return `200 OK` and render the TenderRadar dashboard with Indian government tenders and BidAdvisor cards.
2. `GET /watchlists` displays procurement tracking watchlists.
3. `GET /saved` displays bookmarked tenders.
4. `GET /profile` displays bidder organizational criteria.
5. `GET /scans` displays audit scan logs.
