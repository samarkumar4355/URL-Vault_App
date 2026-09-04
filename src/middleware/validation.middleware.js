/**
 * Validation Middleware
 *
 * Each exported function is an Express middleware that validates
 * a specific form's input BEFORE the request reaches a controller.
 *
 * If validation fails, it renders the form again with an error message
 * and a 400 status — the controller is never called.
 *
 * If validation passes, it calls next() so Express continues to the controller.
 *
 * This keeps validation concerns separate from business logic in controllers.
 */

// Simple regex for basic email format checking
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates whether a string is a well-formed HTTP/HTTPS URL using JavaScript's URL class.
 *
 * @param {string} urlString - URL candidate.
 * @returns {boolean} - True if valid HTTP/HTTPS URL.
 */
const isValidUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────
// AUTH VALIDATION
// ─────────────────────────────────────────────

/**
 * Validate the user registration form.
 * POST /auth/register
 */
const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;

  const trimmedUsername = (username || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '');

  if (!trimmedUsername) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Username is required.',
      formData: { username, email }
    });
  }

  if (trimmedUsername.length < 3) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Username must be at least 3 characters long.',
      formData: { username, email }
    });
  }

  if (trimmedUsername.length > 30) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Username cannot exceed 30 characters.',
      formData: { username, email }
    });
  }

  if (!trimmedEmail) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Email address is required.',
      formData: { username, email }
    });
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Please enter a valid email address.',
      formData: { username, email }
    });
  }

  if (!trimmedPassword) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Password is required.',
      formData: { username, email }
    });
  }

  if (trimmedPassword.length < 6) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Password must be at least 6 characters long.',
      formData: { username, email }
    });
  }

  if (trimmedPassword.length > 100) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Password cannot exceed 100 characters.',
      formData: { username, email }
    });
  }

  // All checks passed — proceed to controller
  next();
};

/**
 * Validate the user login form.
 * POST /auth/login
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '');

  if (!trimmedEmail) {
    return res.status(400).render('auth/login', {
      title: 'Login | LinkVault',
      error: 'Email address is required.',
      success: null,
      email: ''
    });
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return res.status(400).render('auth/login', {
      title: 'Login | LinkVault',
      error: 'Please enter a valid email address.',
      success: null,
      email: trimmedEmail
    });
  }

  if (!trimmedPassword) {
    return res.status(400).render('auth/login', {
      title: 'Login | LinkVault',
      error: 'Password is required.',
      success: null,
      email: trimmedEmail
    });
  }

  next();
};

// ─────────────────────────────────────────────
// LINK VALIDATION (shared between create & update)
// ─────────────────────────────────────────────

/**
 * Core link field validation — common rules for both create and update.
 * requireTitle = false during creation (defaults to 'Untitled' if left blank)
 * requireTitle = true during update (user should always provide a title when editing)
 */
const getLinkValidationError = ({ url, title, description, category, tags, visibility }, requireTitle = true) => {
  const trimmedUrl = (url || '').trim();
  const trimmedTitle = (title || '').trim();
  const trimmedDescription = (description || '').trim();
  const trimmedCategory = (category || '').trim();

  if (!trimmedUrl) return 'URL is required.';
  if (!isValidUrl(trimmedUrl)) return 'Please enter a valid URL starting with http:// or https://';

  // Title is required for updates but optional for creates (defaults to 'Untitled' if blank)
  if (requireTitle && !trimmedTitle) return 'Title is required.';
  if (trimmedTitle.length > 150) return 'Title cannot exceed 150 characters.';

  if (trimmedDescription.length > 500) return 'Description cannot exceed 500 characters.';
  if (trimmedCategory.length > 50) return 'Category cannot exceed 50 characters.';

  // Tags validation: max 10 tags, each max 30 characters
  if (tags) {
    const tagList = typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : (Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(t => t.length > 0) : []);

    if (tagList.length > 10) {
      return 'You can provide at most 10 tags.';
    }

    for (const t of tagList) {
      if (t.length > 30) {
        return 'Each tag cannot exceed 30 characters.';
      }
    }
  }

  if (!visibility) return 'Visibility is required.';
  if (visibility !== 'public' && visibility !== 'private') {
    return 'Visibility must be either "public" or "private".';
  }

  return null; // No error
};

/**
 * Validate the create link form.
 * POST /links
 * Title is optional here (defaults to 'Untitled' if blank).
 * Visibility and URL are still always required.
 */
const validateCreateLink = (req, res, next) => {
  const error = getLinkValidationError(req.body, false); // requireTitle = false

  if (error) {
    return res.status(400).render('links/create', {
      title: 'Add New Link | LinkVault',
      error: error,
      formData: req.body
    });
  }

  next();
};

/**
 * Validate the update link form.
 * POST /links/:id/edit
 * Title IS required on update — metadata is not re-fetched during edits.
 */
const validateUpdateLink = (req, res, next) => {
  const error = getLinkValidationError(req.body, true); // requireTitle = true

  if (error) {
    return res.status(400).render('links/edit', {
      title: 'Edit Link | LinkVault',
      error: error,
      link: { ...req.body, _id: req.params.id }
    });
  }

  next();
};

// ─────────────────────────────────────────────
// PROFILE VALIDATION
// ─────────────────────────────────────────────

/**
 * Validate the profile edit form.
 * POST /profile/edit
 */
const validateProfileUpdate = async (req, res, next) => {
  const User = require('../models/User');
  const { username, bio } = req.body;

  const trimmedUsername = (username || '').trim();
  const trimmedBio = (bio || '').trim();

  // Fetch the existing user for re-rendering the form with current data
  const renderWithError = async (errorMessage) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      return res.status(400).render('profile-edit', {
        title: 'Edit Profile | LinkVault',
        user: user || { username: trimmedUsername, bio: trimmedBio, email: '' },
        error: errorMessage,
        success: null
      });
    } catch {
      return next(new (require('../utils/AppError'))('Could not load profile.', 500));
    }
  };

  if (!trimmedUsername) {
    return renderWithError('Username is required.');
  }
  if (trimmedUsername.length < 3) {
    return renderWithError('Username must be at least 3 characters long.');
  }
  if (trimmedUsername.length > 30) {
    return renderWithError('Username cannot exceed 30 characters.');
  }
  if (trimmedBio.length > 300) {
    return renderWithError('Bio cannot exceed 300 characters.');
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateLink,
  validateUpdateLink,
  validateProfileUpdate
};
