const express = require('express');
const router = express.Router();
const { getProfile, getEditProfile, updateProfile } = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateProfileUpdate } = require('../middleware/validation.middleware');

// Protected route: View own profile
// GET /profile
router.get('/', requireAuth, getProfile);

// Protected route: Render profile edit form
// GET /profile/edit
router.get('/edit', requireAuth, getEditProfile);

// Protected route: Process profile edit form submission
// POST /profile/edit
router.post('/edit', requireAuth, validateProfileUpdate, updateProfile);

module.exports = router;
