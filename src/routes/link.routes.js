const express = require('express');
const router = express.Router();
const {
  getCreateLink,
  createLink,
  getMyLinks,
  getPublicLinks,
  getLinkDetails,
  getEditLink,
  updateLink,
  deleteLink,
  searchLinks,
  likeLink,
  unlikeLink,
  getLikeStatus
} = require('../controllers/link.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateCreateLink, validateUpdateLink } = require('../middleware/validation.middleware');

// Public route: Browse all public links
// GET /links
router.get('/', getPublicLinks);

// Public route: Full-text search across public links only
// GET /search?q=<term>
router.get('/search', searchLinks);

// Protected route: Render create link form
// GET /links/create
router.get('/create', requireAuth, getCreateLink);

// Protected route: Process create link form submission
// POST /links
router.post('/', requireAuth, validateCreateLink, createLink);

// Protected route: View personal links (public + private owned by current user)
// GET /links/my
router.get('/my', requireAuth, getMyLinks);

// Protected route: Render edit link form (checks ownership)
// GET /links/:id/edit
router.get('/:id/edit', requireAuth, getEditLink);

// Protected route: Process edit link form submission (checks ownership)
// POST /links/:id/edit
router.post('/:id/edit', requireAuth, validateUpdateLink, updateLink);

// Protected route: Delete a link (checks ownership — 403 if not owner)
// POST /links/:id/delete
router.post('/:id/delete', requireAuth, deleteLink);

// Protected route: Like a link
// POST /links/:id/like
router.post('/:id/like', requireAuth, likeLink);

// Protected route: Unlike a link
// POST /links/:id/unlike
router.post('/:id/unlike', requireAuth, unlikeLink);

// Protected route: Check whether current user liked the link
// GET /links/:id/like-status
router.get('/:id/like-status', requireAuth, getLikeStatus);

// Public-or-private route: Link details page
// GET /links/:id — NO global requireAuth: the controller enforces per-link visibility rules
// Must be declared AFTER all other /links/... routes to avoid swallowing them
router.get('/:id', getLinkDetails);

module.exports = router;

