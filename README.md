# GitHub Profile Analyzer

A REST API backend that fetches public GitHub user profiles using the GitHub API, computes meaningful insights, and stores the results in a MySQL database. Built with Node.js, Express, and MySQL, and deployed on Railway.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started (Local)](#getting-started-local)
- [Deploying to Railway](#deploying-to-railway)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Scoring System](#scoring-system)
- [Error Codes](#error-codes)

---

## Overview

This service accepts a GitHub username, pulls the public profile and repository data from the GitHub REST API, computes a set of derived metrics (account age, average stars, language breakdown, activity and influence scores), and persists everything to MySQL. You can then query the stored profiles, compare two users head-to-head, and track how a profile changes over multiple analyses.

---

## Tech Stack

| Layer         | Technology              |
|---------------|-------------------------|
| Runtime       | Node.js 18+             |
| Framework     | Express.js 5            |
| Database      | MySQL 8                 |
| HTTP Client   | Axios                   |
| Security      | Helmet, CORS, express-rate-limit |
| Deployment    | Railway                 |

---

## Project Structure

```
github-analyzer/
├── index.js                          Entry point, server bootstrap
├── migrate.js                        Auto-creates DB tables on startup
├── railway.toml                      Railway deployment config
├── .env.example                      Environment variable template
├── sql/
│   └── schema.sql                    Raw SQL schema (for reference)
└── src/
    ├── config/
    │   └── db.js                     MySQL connection pool
    ├── services/
    │   └── githubService.js          GitHub API calls + insight computation
    ├── models/
    │   └── profileModel.js           All database queries
    ├── controllers/
    │   └── profileController.js      Request and response handling
    ├── routes/
    │   └── profileRoutes.js          Route definitions
    └── middleware/
        └── errorHandler.js           404 and global error handling
```

---

## Getting Started (Local)

### Prerequisites

- Node.js 18 or higher
- MySQL 8 running locally

### Steps

**1. Clone the repository and install dependencies**

```bash
git clone https://github.com/your-username/github-analyzer.git
cd github-analyzer
npm install
```

**2. Set up the database**

```bash
mysql -u root -p < sql/schema.sql
```

**3. Configure environment variables**

```bash
cp .env.example .env
```

Open `.env` and fill in your MySQL credentials and optionally a GitHub token.

**4. Start the server**

```bash
npm start        # production
npm run dev      # development with auto-restart (Node 18+)
```

The server starts at `http://localhost:3000`.

---

## Deploying to Railway

### Step 1 — Push code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-username/github-analyzer.git
git push -u origin main
```

### Step 2 — Create a Railway project

Go to [railway.app](https://railway.app), click New Project, and choose Deploy from GitHub repo. Select your repository. Railway detects Node.js automatically.

### Step 3 — Add a MySQL database

Inside your Railway project, click New, then Database, then MySQL. Railway provisions a MySQL instance and automatically injects the `MYSQL_URL` environment variable into your app. No manual connection string needed.

### Step 4 — Set up the database tables

In the Railway dashboard, click on the MySQL service, go to the Database tab, and run each of the three CREATE TABLE statements from `sql/schema.sql` one at a time in the query box. Skip the `CREATE DATABASE` and `USE` lines — Railway already handles that.

### Step 5 — Add environment variables

In Railway, go to your Node.js service, open the Variables tab, and add:

| Variable | Value |
|---|---|
| NODE_ENV | production |
| GITHUB_TOKEN | your GitHub personal access token |

`MYSQL_URL` is injected automatically — do not add it manually.

### Step 6 — Generate a public URL

Railway → your service → Settings → Networking → Generate Domain.

Your API will be live at a URL like `https://github-analyzer-production.up.railway.app`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MYSQL_URL` | Yes (Railway) | Full MySQL connection string. Injected automatically by Railway. |
| `DB_HOST` | Local only | MySQL host (default: localhost) |
| `DB_PORT` | Local only | MySQL port (default: 3306) |
| `DB_USER` | Local only | MySQL user (default: root) |
| `DB_PASSWORD` | Local only | MySQL password |
| `DB_NAME` | Local only | Database name (default: github_analyzer) |
| `GITHUB_TOKEN` | Recommended | GitHub personal access token. Without it, GitHub limits requests to 60/hour. With it, the limit is 5000/hour. Generate one at github.com/settings/tokens — no scopes required. |
| `PORT` | No | Server port (default: 3000) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in milliseconds (default: 900000 = 15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default: 100) |

---

## API Reference

Base URL (local): `http://localhost:3000`

---

### GET /

Returns a summary of all available endpoints.

---

### GET /health

Health check endpoint. Returns server status and uptime.

**Response**
```json
{
  "success": true,
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": "120s"
}
```

---

### POST /api/profiles/analyze/:username

Fetches a GitHub user profile and their repositories, computes insights, and stores the result in the database. If the profile already exists, it is updated and a new entry is added to the analysis history.

**Example**
```bash
curl -X POST http://localhost:3000/api/profiles/analyze/torvalds
```

**Response (200)**
```json
{
  "success": true,
  "message": "Profile for 'torvalds' analyzed and stored successfully",
  "data": {
    "username": "torvalds",
    "name": "Linus Torvalds",
    "followers": 240000,
    "total_stars": 18000,
    "overall_score": 95,
    "top_repos": [...],
    "analysis_history": [...]
  }
}
```

---

### GET /api/profiles

Returns all stored profiles with pagination and sorting.

**Query Parameters**

| Parameter | Default | Options |
|---|---|---|
| page | 1 | any integer |
| limit | 20 | 1 to 100 |
| sort | analyzed_at | overall_score, followers, total_stars, public_repos, analyzed_at |
| order | desc | asc, desc |

**Example**
```bash
curl "http://localhost:3000/api/profiles?sort=overall_score&order=desc&limit=10"
```

**Response (200)**
```json
{
  "success": true,
  "total": 42,
  "page": 1,
  "limit": 10,
  "total_pages": 5,
  "profiles": [...]
}
```

---

### GET /api/profiles/:username

Returns the full stored profile for a username, including their top 10 repositories and the last 10 analysis history entries.

**Example**
```bash
curl http://localhost:3000/api/profiles/torvalds
```

---

### GET /api/profiles/:username/compare?compare=username2

Returns a side-by-side comparison of two stored profiles across key metrics. Both profiles must already be analyzed before comparing.

**Example**
```bash
curl "http://localhost:3000/api/profiles/torvalds/compare?compare=gvanrossum"
```

**Response (200)**
```json
{
  "success": true,
  "comparison": {
    "followers": {
      "torvalds": 240000,
      "gvanrossum": 9000,
      "winner": "torvalds"
    },
    "overall_score": {
      "torvalds": 95,
      "gvanrossum": 72,
      "winner": "torvalds"
    }
  }
}
```

---

### DELETE /api/profiles/:username

Removes a profile and all its associated top repos and analysis history from the database.

**Example**
```bash
curl -X DELETE http://localhost:3000/api/profiles/torvalds
```

---

## Database Schema

The database uses three tables.

**github_profiles** — the main table storing one row per GitHub user along with all computed insights.

**github_top_repos** — stores the top 10 non-forked repositories (by star count) for each profile. Linked to `github_profiles` via a foreign key. Refreshed on every re-analysis.

**analysis_history** — logs every time a profile is analyzed, capturing follower count, repo count, and overall score at that point in time. Useful for tracking growth over time.

---

## Scoring System

Each profile receives three scores between 0 and 100.

**Activity Score** — measures how actively the user builds things.

| Factor | Weight |
|---|---|
| Public repository count (capped at 100) | 40% |
| Total stars across own repos (capped at 1000) | 30% |
| Public gist count (capped at 50) | 10% |
| Account age (full weight at 1 year+) | 20% |

**Influence Score** — measures how much reach and impact the user has.

| Factor | Weight |
|---|---|
| Followers (capped at 10,000) | 50% |
| Total stars (capped at 5,000) | 30% |
| Total forks (capped at 2,000) | 20% |

**Overall Score** — the average of activity score and influence score.

---

## Error Codes

| Code | Meaning |
|---|---|
| 400 | Invalid or malformed username |
| 404 | GitHub user not found, or profile not yet analyzed |
| 429 | GitHub API rate limit hit. Add a GITHUB_TOKEN to resolve. |
| 500 | Internal server error |
