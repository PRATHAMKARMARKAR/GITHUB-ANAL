const axios = require("axios");
require("dotenv").config();

const GITHUB_API = "https://api.github.com";

// Build headers — token is optional but strongly recommended
function getHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Fetch basic user profile from GitHub
 */
async function fetchUserProfile(username) {
  const response = await axios.get(`${GITHUB_API}/users/${username}`, {
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Fetch all public repos (paginated, up to 500)
 */
async function fetchUserRepos(username) {
  const repos = [];
  let page = 1;
  const perPage = 100;

  while (repos.length < 500) {
    const response = await axios.get(`${GITHUB_API}/users/${username}/repos`, {
      headers: getHeaders(),
      params: {
        per_page: perPage,
        page,
        sort: "updated",
        type: "owner",
      },
    });

    const data = response.data;
    if (!data.length) break;
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

/**
 * Compute rich insights from raw GitHub data
 */
function computeInsights(profile, repos) {
  // --- Aggregate repo stats ---
  let totalStars = 0;
  let totalForks = 0;
  let totalWatchers = 0;
  let totalOpenIssues = 0;
  const languageCounts = {};

  for (const repo of repos) {
    if (!repo.fork) {
      totalStars += repo.stargazers_count || 0;
      totalForks += repo.forks_count || 0;
      totalWatchers += repo.watchers_count || 0;
      totalOpenIssues += repo.open_issues_count || 0;
    }
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
  }

  // Sort languages by usage
  const topLanguages = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang, count]) => ({ language: lang, repo_count: count }));

  // --- Time-based insights ---
  const createdAt = new Date(profile.created_at);
  const now = new Date();
  const accountAgeDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

  // --- Ratios ---
  const ownRepos = repos.filter((r) => !r.fork).length;
  const repoToFollowerRatio =
    profile.followers > 0
      ? parseFloat((ownRepos / profile.followers).toFixed(4))
      : ownRepos;

  const avgStarsPerRepo =
    ownRepos > 0 ? parseFloat((totalStars / ownRepos).toFixed(4)) : 0;
  const avgForksPerRepo =
    ownRepos > 0 ? parseFloat((totalForks / ownRepos).toFixed(4)) : 0;

  // --- Scoring (0-100 each) ---
  // Activity score: repos, gists, commit frequency proxy
  const activityScore = Math.min(
    100,
    Math.round(
      (Math.min(profile.public_repos, 100) / 100) * 40 +
        (Math.min(totalStars, 1000) / 1000) * 30 +
        (Math.min(profile.public_gists, 50) / 50) * 10 +
        (accountAgeDays > 365 ? 20 : (accountAgeDays / 365) * 20)
    )
  );

  // Influence score: followers, stars, forks
  const influenceScore = Math.min(
    100,
    Math.round(
      (Math.min(profile.followers, 10000) / 10000) * 50 +
        (Math.min(totalStars, 5000) / 5000) * 30 +
        (Math.min(totalForks, 2000) / 2000) * 20
    )
  );

  const overallScore = Math.round((activityScore + influenceScore) / 2);

  // --- Top 10 repos by stars ---
  const topRepos = repos
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10);

  return {
    insights: {
      account_age_days: accountAgeDays,
      repo_to_follower_ratio: repoToFollowerRatio,
      avg_stars_per_repo: avgStarsPerRepo,
      avg_forks_per_repo: avgForksPerRepo,
      total_stars: totalStars,
      total_forks: totalForks,
      total_watchers: totalWatchers,
      total_open_issues: totalOpenIssues,
      top_languages: JSON.stringify(topLanguages),
      language_count: Object.keys(languageCounts).length,
      activity_score: activityScore,
      influence_score: influenceScore,
      overall_score: overallScore,
    },
    topRepos,
  };
}

module.exports = { fetchUserProfile, fetchUserRepos, computeInsights };