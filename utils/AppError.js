/**
 * AppError — a custom Error subclass that carries an HTTP status code.
 *
 * Instead of creating raw Error objects and setting status separately,
 * we attach the status code directly to the error so the centralized
 * error-handling middleware can use it automatically.
 *
 * Usage:
 *   throw new AppError('Link not found', 404);
 *   return next(new AppError('You do not own this link', 403));
 */
class AppError extends Error {
  /**
   * @param {string} message  - User-facing error message (keep it friendly)
   * @param {number} statusCode - HTTP status code (400, 403, 404, 500, …)
   */
  constructor(message, statusCode) {
    super(message);           // sets this.message via the built-in Error class
    this.statusCode = statusCode;
    this.name = 'AppError';   // makes error type easy to identify in logs

    // Capture a clean stack trace (skips this constructor frame)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
