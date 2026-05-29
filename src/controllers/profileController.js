const {
  fetchUserProfile,
  fetchUserRepos,
  computeInsights,
} = require("../services/githubService");

const {
  upsertProfile,
  replaceTopRepos,
  getAllProfiles,
  getProfileByUsername,
  deleteProfile,
} = require("../models/profileModel");

/**
 * POST /api/profiles/analyze/:username
 * Fetch from GitHub, compute insights, save to DB
 */
async function analyzeProfile(req, res) {
  const { username } = req.params;

  if (!username || !/^[a-zA-Z0-9-]+$/.test(username)) {
    return res.status(400).json({
      success: false,
      message: "Invalid GitHub username format",
    });
  }

  try {
    // Fetch from GitHub
    const [githubUser, repos] = await Promise.all([
      fetchUserProfile(username),
      fetchUserRepos(username),
    ]);

    // Compute insights
    const { insights, topRepos } = computeInsights(githubUser, repos);

    // Persist
    const profileId = await upsertProfile(githubUser, insights);
    await replaceTopRepos(profileId, githubUser.login, topRepos);

    // Fetch the full saved record to return
    const saved = await getProfileByUsername(githubUser.login);

    return res.status(200).json({
      success: true,
      message: `Profile for '${githubUser.login}' analyzed and stored successfully`,
      data: saved,
    });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: `GitHub user '${username}' not found`,
      });
    }
    if (err.response?.status === 403) {
      return res.status(429).json({
        success: false,
        message:
          "GitHub API rate limit exceeded. Add a GITHUB_TOKEN to your .env for higher limits.",
      });
    }
    console.error("FULL ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/profiles
 * List all stored profiles with pagination + sorting
 */
async function listProfiles(req, res) {
  try {
    const { page = 1, limit = 20, sort = "analyzed_at", order = "desc" } = req.query;
    const result = await getAllProfiles({
      page: parseInt(page),
      limit: Math.min(parseInt(limit) || 20, 100),
      sort,
      order,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("listProfiles error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/profiles/:username
 * Fetch a single stored profile with top repos + history
 */
async function getSingleProfile(req, res) {
  const { username } = req.params;
  try {
    const profile = await getProfileByUsername(username);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: `Profile '${username}' not found in database. Analyze it first via POST /api/profiles/analyze/${username}`,
      });
    }
    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("getSingleProfile error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * DELETE /api/profiles/:username
 * Remove a profile and all associated data
 */
async function removeProfile(req, res) {
  const { username } = req.params;
  try {
    const deleted = await deleteProfile(username);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Profile '${username}' not found`,
      });
    }
    return res.status(200).json({
      success: true,
      message: `Profile '${username}' deleted successfully`,
    });
  } catch (err) {
    console.error("removeProfile error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/profiles/:username/compare?compare=username2
 * Quick side-by-side comparison of two stored profiles
 */
async function compareProfiles(req, res) {
  const { username } = req.params;
  const { compare } = req.query;

  if (!compare) {
    return res.status(400).json({
      success: false,
      message: "Provide ?compare=otherUsername query parameter",
    });
  }

  try {
    const [p1, p2] = await Promise.all([
      getProfileByUsername(username),
      getProfileByUsername(compare),
    ]);

    const missing = [!p1 && username, !p2 && compare].filter(Boolean);
    if (missing.length) {
      return res.status(404).json({
        success: false,
        message: `Profile(s) not yet analyzed: ${missing.join(", ")}`,
      });
    }

    const fields = [
      "public_repos", "followers", "following", "total_stars",
      "total_forks", "account_age_days", "activity_score",
      "influence_score", "overall_score",
    ];

    const comparison = {};
    for (const f of fields) {
      comparison[f] = {
        [p1.username]: p1[f],
        [p2.username]: p2[f],
        winner: p1[f] > p2[f] ? p1.username : p2[f] > p1[f] ? p2.username : "tie",
      };
    }

    return res.status(200).json({ success: true, comparison });
  } catch (err) {
    console.error("compareProfiles error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = {
  analyzeProfile,
  listProfiles,
  getSingleProfile,
  removeProfile,
  compareProfiles,
};