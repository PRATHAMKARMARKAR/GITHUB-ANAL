-- GitHub Analyzer Database Schema
-- Run this SQL file to set up your MySQL database

CREATE DATABASE IF NOT EXISTS github_analyzer;
USE github_analyzer;

-- Main profiles table
CREATE TABLE IF NOT EXISTS github_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200),
    bio TEXT,
    avatar_url VARCHAR(500),
    profile_url VARCHAR(500),
    location VARCHAR(200),
    email VARCHAR(200),
    company VARCHAR(200),
    blog VARCHAR(500),
    twitter_username VARCHAR(100),

    -- Core stats
    public_repos INT DEFAULT 0,
    public_gists INT DEFAULT 0,
    followers INT DEFAULT 0,
    following INT DEFAULT 0,

    -- Computed insights
    account_age_days INT DEFAULT 0,
    repo_to_follower_ratio DECIMAL(10,4) DEFAULT 0,
    avg_stars_per_repo DECIMAL(10,4) DEFAULT 0,
    avg_forks_per_repo DECIMAL(10,4) DEFAULT 0,
    total_stars INT DEFAULT 0,
    total_forks INT DEFAULT 0,
    total_watchers INT DEFAULT 0,
    total_open_issues INT DEFAULT 0,

    -- Language insights (stored as JSON)
    top_languages JSON,
    language_count INT DEFAULT 0,

    -- Activity insights
    hireable BOOLEAN DEFAULT FALSE,
    site_admin BOOLEAN DEFAULT FALSE,
    github_created_at DATETIME,
    github_updated_at DATETIME,

    -- Scoring (0-100 composite score based on activity, reach, contributions)
    activity_score DECIMAL(5,2) DEFAULT 0,
    influence_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,

    -- Metadata
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_username (username),
    INDEX idx_overall_score (overall_score DESC),
    INDEX idx_analyzed_at (analyzed_at DESC)
);

-- Repository snapshots table (top repos per profile)
CREATE TABLE IF NOT EXISTS github_top_repos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    username VARCHAR(100) NOT NULL,
    repo_name VARCHAR(200) NOT NULL,
    full_name VARCHAR(300),
    description TEXT,
    language VARCHAR(100),
    stars INT DEFAULT 0,
    forks INT DEFAULT 0,
    watchers INT DEFAULT 0,
    open_issues INT DEFAULT 0,
    is_fork BOOLEAN DEFAULT FALSE,
    repo_url VARCHAR(500),
    created_at DATETIME,
    pushed_at DATETIME,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES github_profiles(id) ON DELETE CASCADE,
    INDEX idx_profile_id (profile_id),
    INDEX idx_stars (stars DESC)
);

-- Analysis history table (track re-analyses)
CREATE TABLE IF NOT EXISTS analysis_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    profile_id INT,
    followers_at_analysis INT,
    public_repos_at_analysis INT,
    overall_score_at_analysis DECIMAL(5,2),
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_username (username),
    INDEX idx_analyzed_at (analyzed_at DESC)
);