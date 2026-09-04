const mongoose = require('mongoose');
const User = require('../models/User');
const Link = require('../models/Link');
const AppError = require('../utils/AppError');

const isProduction = process.env.NODE_ENV === 'production';
const clearCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction
};

/**
 * Display the logged-in user's profile page.
 * GET /profile  (protected — requireAuth)
 *
 * Profile data always comes from MongoDB, not from the token,
 * so the page always reflects the real, current database state.
 */
const getProfile = async (req, res, next) => {
  try {
    // req.user.id is the source of truth for "who is logged in".
    // select('-password') ensures the password hash is never sent to the view.
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      // User exists in token but was removed from DB — clear cookie
      res.clearCookie('token', clearCookieOptions);
      return res.redirect('/auth/login');
    }

    return res.render('profile', {
      title: `${user.username}'s Profile | LinkVault`,
      user: user
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Render the profile edit form with existing user data pre-filled.
 * GET /profile/edit  (protected — requireAuth)
 */
const getEditProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      res.clearCookie('token', clearCookieOptions);
      return res.redirect('/auth/login');
    }

    return res.render('profile-edit', {
      title: 'Edit Profile | LinkVault',
      user: user,
      error: null,
      success: null
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Process the profile edit form submission.
 * POST /profile/edit  (protected — requireAuth)
 *
 * Input validation is handled by validateProfileUpdate middleware before this runs.
 * Only allows updating: username, bio
 * Never allows changing: _id, email, password, createdAt
 */
const updateProfile = async (req, res, next) => {
  const trimmedUsername = req.body.username.trim();
  const trimmedBio = req.body.bio ? req.body.bio.trim() : '';

  try {
    // Identity comes from the verified JWT (req.user.id) — cannot be forged
    const user = await User.findById(req.user.id);

    if (!user) {
      res.clearCookie('token', clearCookieOptions);
      return res.redirect('/auth/login');
    }

    // Update ONLY the allowed fields — _id, email, password, createdAt are untouched
    user.username = trimmedUsername;
    user.bio = trimmedBio;

    await user.save();

    console.log("Updated User:", user._id);
    console.log(`[Profile] User ${user.email} updated profile — new username: ${user.username}`);

    if (req.user) {
      req.user.username = user.username;
    }

    return res.redirect('/profile');
  } catch (error) {
    // Handle Mongoose schema-level validation errors (e.g. minlength on username)
    if (error.name === 'ValidationError') {
      const firstErrorMessage = Object.values(error.errors)[0].message;
      const user = await User.findById(req.user.id).select('-password').catch(() => null);
      return res.status(400).render('profile-edit', {
        title: 'Edit Profile | LinkVault',
        user: user || { username: trimmedUsername, bio: trimmedBio, email: '' },
        error: firstErrorMessage,
        success: null
      });
    }

    return next(error);
  }
};

/**
 * Render user dashboard with aggregated personal analytics and statistics.
 * GET /dashboard (protected — requireAuth)
 *
 * All analytics are strictly filtered by req.user.id to ensure users can only
 * see statistics for their own links.
 */
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch all links belonging to the logged-in user
    const userLinks = await Link.find({ owner: userId });

    const totalLinks = userLinks.length;
    let publicLinks = 0;
    let privateLinks = 0;
    let totalViews = 0;
    let totalLikes = 0;

    for (const link of userLinks) {
      if (link.visibility === 'public') publicLinks++;
      if (link.visibility === 'private') privateLinks++;
      totalViews += link.views || 0;
      totalLikes += link.likes || 0;
    }

    // Most viewed and most liked links
    const mostViewedLink = await Link.findOne({ owner: userId })
      .sort({ views: -1, createdAt: -1 });

    const mostLikedLink = await Link.findOne({ owner: userId })
      .sort({ likes: -1, createdAt: -1 });

    // Fetch user from MongoDB using req.user.id
    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.clearCookie('token', clearCookieOptions);
      return res.redirect('/auth/login');
    }

    return res.render('dashboard', {
      title: 'Dashboard & Analytics | LinkVault',
      user: user,
      stats: {
        totalLinks,
        publicLinks,
        privateLinks,
        totalViews,
        totalLikes,
        mostViewedLink,
        mostLikedLink
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProfile,
  getEditProfile,
  updateProfile,
  getDashboard
};
