const { pool } = require("../config/db");

/**
 * Upsert a GitHub profile and its insights into the DB.
 * Returns the saved profile row.
 */
async function upsertProfile(githubUser, insights) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      login,
      name,
      bio,
      avatar_url,
      html_url,
      location,
      email,
      company,
      blog,
      twitter_username,
      public_repos,
      public_gists,
      followers,
      following,
      hireable,
      site_admin,
      created_at,
      updated_at,
    } = githubUser;

    const {
      account_age_days,
      repo_to_follower_ratio,
      avg_stars_per_repo,
      avg_forks_per_repo,
      total_stars,
      total_forks,
      total_watchers,
      total_open_issues,
      top_languages,
      language_count,
      activity_score,
      influence_score,
      overall_score,
    } = insights;

    const [result] = await conn.execute(
      `INSERT INTO github_profiles (
          username, name, bio, avatar_url, profile_url, location, email,
          company, blog, twitter_username, public_repos, public_gists,
          followers, following, account_age_days, repo_to_follower_ratio,
          avg_stars_per_repo, avg_forks_per_repo, total_stars, total_forks,
          total_watchers, total_open_issues, top_languages, language_count,
          hireable, site_admin, github_created_at, github_updated_at,
          activity_score, influence_score, overall_score, analyzed_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
          name=VALUES(name), bio=VALUES(bio), avatar_url=VALUES(avatar_url),
          profile_url=VALUES(profile_url), location=VALUES(location), email=VALUES(email),
          company=VALUES(company), blog=VALUES(blog), twitter_username=VALUES(twitter_username),
          public_repos=VALUES(public_repos), public_gists=VALUES(public_gists),
          followers=VALUES(followers), following=VALUES(following),
          account_age_days=VALUES(account_age_days),
          repo_to_follower_ratio=VALUES(repo_to_follower_ratio),
          avg_stars_per_repo=VALUES(avg_stars_per_repo),
          avg_forks_per_repo=VALUES(avg_forks_per_repo),
          total_stars=VALUES(total_stars), total_forks=VALUES(total_forks),
          total_watchers=VALUES(total_watchers), total_open_issues=VALUES(total_open_issues),
          top_languages=VALUES(top_languages), language_count=VALUES(language_count),
          hireable=VALUES(hireable), site_admin=VALUES(site_admin),
          github_created_at=VALUES(github_created_at),
          github_updated_at=VALUES(github_updated_at),
          activity_score=VALUES(activity_score), influence_score=VALUES(influence_score),
          overall_score=VALUES(overall_score), analyzed_at=NOW()`,
      [
  login,
  name,
  bio,
  avatar_url,
  html_url,
  location,
  email,
  company,
  blog,
  twitter_username,
  public_repos,
  public_gists,
  followers,
  following,
  account_age_days,
  repo_to_follower_ratio,
  avg_stars_per_repo,
  avg_forks_per_repo,
  total_stars,
  total_forks,
  total_watchers,
  total_open_issues,
  top_languages,
  language_count,
  hireable ? 1 : 0,
  site_admin ? 1 : 0,
  created_at ? new Date(created_at) : null,
  updated_at ? new Date(updated_at) : null,
  activity_score,
  influence_score,
  overall_score,
]
    );

    // Get the profile id (insert or existing)
    const [[profileRow]] = await conn.execute(
      "SELECT id FROM github_profiles WHERE username = ?",
      [login]
    );
    const profileId = profileRow.id;

    // Log to analysis_history
    await conn.execute(
      `INSERT INTO analysis_history
         (username, profile_id, followers_at_analysis, public_repos_at_analysis, overall_score_at_analysis)
       VALUES (?,?,?,?,?)`,
      [login, profileId, followers, public_repos, overall_score]
    );

    await conn.commit();
    return profileId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Insert / replace top repos for a profile
 */
async function replaceTopRepos(profileId, username, repos) {
  const conn = await pool.getConnection();
  try {
    // Remove stale repos
    await conn.execute("DELETE FROM github_top_repos WHERE profile_id = ?", [profileId]);

    if (!repos.length) return;

    const values = repos.map((r) => [
      profileId,
      username,
      r.name,
      r.full_name,
      r.description || null,
      r.language || null,
      r.stargazers_count || 0,
      r.forks_count || 0,
      r.watchers_count || 0,
      r.open_issues_count || 0,
      r.fork ? 1 : 0,
      r.html_url,
      r.created_at ? new Date(r.created_at) : null,
      r.pushed_at ? new Date(r.pushed_at) : null,
    ]);

    const placeholders = values.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    await conn.execute(
      `INSERT INTO github_top_repos
         (profile_id,username,repo_name,full_name,description,language,stars,forks,watchers,open_issues,is_fork,repo_url,created_at,pushed_at)
       VALUES ${placeholders}`,
      values.flat()
    );
  } finally {
    conn.release();
  }
}

/**
 * Get all profiles with pagination & optional sorting
 */
async function getAllProfiles({ page = 1, limit = 20, sort = "analyzed_at", order = "desc" } = {}) {
  const validSorts = ["overall_score", "followers", "total_stars", "public_repos", "analyzed_at"];
  const validOrders = ["asc", "desc"];
  const safeSort = validSorts.includes(sort) ? sort : "analyzed_at";
  const safeOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : "DESC";

  const offset = (Math.max(1, page) - 1) * limit;

  const [[{ total }]] = await pool.execute(
    "SELECT COUNT(*) as total FROM github_profiles"
  );

  const [rows] = await pool.execute(
    `SELECT id, username, name, avatar_url, profile_url, location,
            public_repos, followers, following, total_stars, overall_score,
            activity_score, influence_score, top_languages, analyzed_at
     FROM github_profiles
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return {
    total,
    page: parseInt(page),
    limit,
    total_pages: Math.ceil(total / limit),
    profiles: rows,
  };
}

/**
 * Get a single profile by username, including top repos + history
 */
async function getProfileByUsername(username) {
  const [[profile]] = await pool.execute(
    "SELECT * FROM github_profiles WHERE username = ?",
    [username]
  );
  if (!profile) return null;

  const [topRepos] = await pool.execute(
    `SELECT repo_name, full_name, description, language, stars, forks, watchers,
            open_issues, is_fork, repo_url, created_at, pushed_at
     FROM github_top_repos WHERE profile_id = ?
     ORDER BY stars DESC`,
    [profile.id]
  );

  const [history] = await pool.execute(
    `SELECT followers_at_analysis, public_repos_at_analysis,
            overall_score_at_analysis, analyzed_at
     FROM analysis_history WHERE username = ?
     ORDER BY analyzed_at DESC LIMIT 10`,
    [username]
  );

  return { ...profile, top_repos: topRepos, analysis_history: history };
}

/**
 * Delete a profile and all related data
 */
async function deleteProfile(username) {
  const [[row]] = await pool.execute(
    "SELECT id FROM github_profiles WHERE username = ?",
    [username]
  );
  if (!row) return false;
  await pool.execute("DELETE FROM github_profiles WHERE username = ?", [username]);
  return true;
}

module.exports = { upsertProfile, replaceTopRepos, getAllProfiles, getProfileByUsername, deleteProfile };