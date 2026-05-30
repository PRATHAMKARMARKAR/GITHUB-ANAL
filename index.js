require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { testConnection } = require("./src/config/db");
const profileRoutes = require("./src/routes/profileRoutes.js");
const { notFound, errorHandler } = require("./src/middlewares/errorHandler.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
app.use(limiter);


app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + "s",
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "GitHub Profile Analyzer API",
    version: "1.0.0",
    endpoints: {
      "POST   /api/profiles/analyze/:username": "Analyze & store a GitHub profile",
      "GET    /api/profiles":                   "List all stored profiles (supports ?page, ?limit, ?sort, ?order)",
      "GET    /api/profiles/:username":         "Get a single stored profile with top repos & history",
      "GET    /api/profiles/:username/compare": "Compare two profiles (?compare=other_username)",
      "DELETE /api/profiles/:username":         "Delete a stored profile",
      "GET    /health":                         "Health check",
    },
    sortOptions:  ["overall_score", "followers", "total_stars", "public_repos", "analyzed_at"],
    orderOptions: ["asc", "desc"],
  });
});

app.use("/api/profiles", profileRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API docs at http://localhost:${PORT}/`);
  });
}

start();