const express = require("express");
const router = express.Router();
const {
  analyzeProfile,
  listProfiles,
  getSingleProfile,
  removeProfile,
  compareProfiles,
} = require("../controllers/profileController");

/**
 * @route   POST /api/profiles/analyze/:username
 * @desc    Fetch GitHub user, compute insights, save to DB
 * @access  Public
 */
router.post("/analyze/:username", analyzeProfile);

/**
 * @route   GET /api/profiles
 * @desc    List all stored profiles
 * @query   page, limit, sort (overall_score|followers|total_stars|public_repos|analyzed_at), order (asc|desc)
 * @access  Public
 */
router.get("/", listProfiles);

/**
 * @route   GET /api/profiles/:username
 * @desc    Get a single stored profile with top repos & history
 * @access  Public
 */
router.get("/:username", getSingleProfile);

/**
 * @route   GET /api/profiles/:username/compare?compare=username2
 * @desc    Side-by-side comparison of two stored profiles
 * @access  Public
 */
router.get("/:username/compare", compareProfiles);

/**
 * @route   DELETE /api/profiles/:username
 * @desc    Remove a profile from the database
 * @access  Public
 */
router.delete("/:username", removeProfile);

module.exports = router;