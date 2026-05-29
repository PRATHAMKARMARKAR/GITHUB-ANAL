/**
 * 404 handler — catches any route not matched above
 */
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
}

module.exports = { notFound, errorHandler };