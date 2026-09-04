/**
 * Centralized Error-Handling Middleware
 *
 * Express identifies this as an error handler because it accepts
 * FOUR arguments: (err, req, res, next).
 * Normal middleware only has three: (req, res, next).
 *
 * When any controller calls next(error) or next(new AppError(...)),
 * Express skips all remaining normal middleware and routes and calls
 * this function directly.
 *
 * Register this AFTER all routes in app.js.
 */
const errorHandler = (err, req, res, next) => {
  // Determine HTTP status code
  let statusCode = err.statusCode || 500;
  let userMessage = err.message || 'Something went wrong.';

  // ── Handle known Mongoose / MongoDB error types ────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    userMessage = Object.values(err.errors)[0].message;
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    userMessage = 'The resource ID provided is invalid.';
  } else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    userMessage = `An account with this ${field} already exists.`;
  } else if (statusCode === 500) {
    // Production safety: never expose raw 500 error messages or DB internals to clients
    userMessage = 'Something went wrong. Please try again later.';
  }

  // ── Server-side logging ────────────────────────────────────────────────
  // Log real technical details internally for debugging — never expose to client
  if (statusCode >= 500) {
    console.error(`[Server Error ${statusCode}] ${err.stack || err.message}`);
  } else {
    console.warn(`[Client Warning ${statusCode}] ${err.message}`);
  }

  // ── Check if client expects JSON (AJAX / Fetch API) ────────────────────
  const isJsonRequest = req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    (req.path && (req.path.endsWith('/like') || req.path.endsWith('/unlike') || req.path.endsWith('/like-status')));

  if (isJsonRequest) {
    return res.status(statusCode).json({
      success: false,
      message: userMessage
    });
  }

  // ── Send clean, safe HTML error response ──────────────────────────────
  // Stack traces, database strings, and internals are NEVER sent to the browser
  res.status(statusCode).render('error', {
    title: `${statusCode} | LinkVault`,
    statusCode: statusCode,
    message: userMessage
  });
};

module.exports = { errorHandler };
