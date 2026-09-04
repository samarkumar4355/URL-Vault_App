const mongoose = require('mongoose');
const Link = require('../models/Link');
const Like = require('../models/Like');
const AppError = require('../utils/AppError');
const { fetchMetadata } = require('../services/metadata.service');

/**
 * Render the form to create a new link.
 * GET /links/create
 */
const getCreateLink = (req, res) => {
  res.render('links/create', {
    title: 'Add New Link | LinkVault',
    error: null,
    formData: {
      visibility: 'public'
    }
  });
};

/**
 * Handle submission of the new link form.
 * POST /links
 * Note: Input validation is handled by validateCreateLink middleware before this runs.
 *
 * Flow:
 *   1. Receive form data (url, title, description, visibility, …)
 *   2. Fetch Open Graph metadata from the URL (best-effort, never blocks save)
 *   3. Apply metadata fallbacks: only fill fields the user left empty
 *   4. Save the Link document to MongoDB
 */
const createLink = async (req, res, next) => {
  const { url, title, description, category, tags, visibility } = req.body;

  // ── Step 1: Fetch metadata from the external URL ──────────────────────
  // fetchMetadata() NEVER throws — if the site is down or returns an error
  // it simply returns { title: '', description: '', image: '' }.
  const metadata = await fetchMetadata(url.trim());

  // ── Step 2: Apply fallback rules ──────────────────────────────────────
  // User-provided values always take priority.
  // Metadata values are only used when the user left a field blank.
  const finalTitle = (title && title.trim()) || metadata.title || 'Untitled';
  const finalDescription = (description && description.trim()) || metadata.description || '';
  const finalImage = metadata.image || ''; // image always comes from metadata (form has no image field)

  try {
    const processedTags = typeof tags === 'string'
      ? tags
          .split(',')
          .map(tag => tag.trim().toLowerCase())
          .filter(tag => tag.length > 0)
      : [];

    // Security: Owner ID always comes from the verified JWT user
    const ownerId = req.user.id;

    const link = await Link.create({
      url: url.trim(),
      title: finalTitle,
      description: finalDescription,
      image: finalImage,
      category: category && category.trim().length > 0 ? category.trim() : 'General',
      tags: processedTags,
      visibility: visibility,
      owner: ownerId
    });

    console.log("Created Link:", link._id);
    console.log(`[Link] Created "${link.title}" (${link.visibility}) by ${req.user.username || req.user.id}`);

    return res.redirect('/?linkCreated=true');
  } catch (error) {
    if (error.name === 'ValidationError') {
      const firstErrorMessage = Object.values(error.errors)[0].message;
      return res.status(400).render('links/create', {
        title: 'Add New Link | LinkVault',
        error: firstErrorMessage,
        formData: req.body
      });
    }
    return next(error);
  }
};

/**
 * Fetch and display all links owned by the currently logged-in user.
 * GET /links/my (Protected)
 */
const getMyLinks = async (req, res, next) => {
  try {
    // Security: Filter strictly by the authenticated user's verified JWT ID
    const userId = req.user.id;

    const links = await Link.find({ owner: userId }).sort({ createdAt: -1 });

    res.render('links/my-links', {
      title: 'My Links | LinkVault',
      links: links
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Fetch and display all public links in the platform.
 * GET /links (Public)
 */
const getPublicLinks = async (req, res, next) => {
  try {
    // Security: Only return documents marked with visibility: "public"
    const links = await Link.find({ visibility: 'public' })
      .populate('owner', 'username')
      .sort({ createdAt: -1 });

    res.render('links/index', {
      title: 'Public Links | LinkVault',
      links: links
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Render the form to edit an existing link.
 * GET /links/:id/edit (Protected)
 */
const getEditLink = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    const link = await Link.findById(id);

    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    // Authorization: Check whether the logged-in user owns the link
    if (link.owner.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to edit this link.', 403));
    }

    res.render('links/edit', {
      title: `Edit ${link.title} | LinkVault`,
      link: link,
      error: null
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Process updates to an existing link.
 * POST /links/:id/edit (Protected)
 * Note: Input validation is handled by validateUpdateLink middleware before this runs.
 */
const updateLink = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    const link = await Link.findById(id);

    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    // Authorization check: Verify ownership before doing anything
    if (link.owner.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to update this link.', 403));
    }

    const { url, title, description, category, tags, visibility } = req.body;

    // Process tags into array
    const processedTags = typeof tags === 'string'
      ? tags
          .split(',')
          .map(tag => tag.trim().toLowerCase())
          .filter(tag => tag.length > 0)
      : (Array.isArray(tags) ? tags : []);

    // Update ONLY allowed fields
    link.url = url.trim();
    link.title = title.trim();
    link.description = description ? description.trim() : '';
    link.category = category && category.trim().length > 0 ? category.trim() : 'General';
    link.tags = processedTags;
    link.visibility = visibility;
    link.updatedAt = Date.now();

    await link.save();

    console.log(`[Link] Updated link "${link.title}" (${link._id}) by user ${req.user.username || req.user.id}`);

    return res.redirect('/links/my');
  } catch (error) {
    if (error.name === 'ValidationError') {
      const firstErrorMessage = Object.values(error.errors)[0].message;
      return res.status(400).render('links/edit', {
        title: 'Edit Link | LinkVault',
        link: { ...req.body, _id: id },
        error: firstErrorMessage
      });
    }
    return next(error);
  }
};

/**
 * Handle deletion of an existing link.
 * POST /links/:id/delete (Protected)
 *
 * Authorization: Only the owner of the link may delete it.
 * Owner ID comes from req.user.id — never req.body.
 */
const deleteLink = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    const link = await Link.findById(id);

    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    if (link.owner.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to delete this link.', 403));
    }

    // Delete any associated likes first
    await Like.deleteMany({ link: id });
    await Link.findByIdAndDelete(id);

    console.log(`[Link] Deleted link "${link.title}" (${link._id}) and associated likes by user ${req.user.username || req.user.id}`);

    return res.redirect('/links/my');
  } catch (error) {
    return next(error);
  }
};

/**
 * Handle public link search with filtering, sorting, and debounced AJAX support.
 * GET /search
 *
 * Query parameters:
 *   - q: text search query
 *   - category: filter by category
 *   - tag: filter by tag
 *   - sort: sorting option ('newest', 'oldest', 'views')
 *
 * Security: ALWAYS strictly enforces visibility: "public".
 * Private links can NEVER appear in results under any circumstances.
 */
/**
 * Search public links by query string, category, tag, with ranking and pagination.
 * GET /search
 *
 * Query parameters:
 *   - q: text search query
 *   - category: filter by category
 *   - tag: filter by tag
 *   - sort: sorting option ('relevance', 'likes', 'views', 'newest', 'oldest')
 *   - page: page number (defaults to 1)
 *   - limit: items per page (defaults to 10)
 *
 * Security: ALWAYS strictly enforces visibility: "public".
 * Private links can NEVER appear in search results under any circumstances.
 */
const searchLinks = async (req, res, next) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
  
  // Supported sorts: 'relevance', 'likes', 'views', 'newest', 'oldest'. Default / fallback is 'relevance'.
  const rawSort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : 'relevance';
  const validSorts = ['relevance', 'likes', 'views', 'newest', 'oldest'];
  const sort = validSorts.includes(rawSort) ? rawSort : 'relevance';

  // Pagination parameters
  const parsedPage = parseInt(req.query.page, 10);
  const page = (!isNaN(parsedPage) && parsedPage > 0) ? parsedPage : 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  // Check if client expects JSON (AJAX fetch request from frontend debouncer)
  const isJsonRequest = req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    req.query.format === 'json';

  // If no search parameters provided at all, return empty result
  if (!q && !category && !tag) {
    const emptyPagination = {
      page: 1,
      limit,
      total: 0,
      totalPages: 1
    };

    if (isJsonRequest) {
      return res.json({
        success: true,
        links: [],
        pagination: emptyPagination
      });
    }

    return res.render('search', {
      title: 'Search | LinkVault',
      query: '',
      category: '',
      tag: '',
      sort,
      links: [],
      pagination: emptyPagination,
      searched: false
    });
  }

  try {
    // 1. Build MongoDB filter — ALWAYS enforce visibility: "public"
    // The client CANNOT override this under any circumstances.
    const filter = {
      visibility: 'public'
    };

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Tag filter: match tag in tags array case-insensitively
    if (tag) {
      filter.tags = { $regex: new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    // Progressive partial search across title, description, and tags
    // Matches prefixes and substrings character-by-character (e.g. "c" -> "co" -> "cod" -> "code")
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedQ, 'i');
      filter.$or = [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } }
      ];
    }

    // 2. Execute search with ranking or standard sort
    let paginatedLinks = [];
    let total = 0;

    if (sort === 'relevance') {
      // Composite relevance ranking:
      // Combines text relevance with popularity (likes, views) and recency.
      //
      // Why weights exist:
      // 1. textScore * 10: Multiplied by 10 so keyword relevance acts as the primary gatekeeper.
      // 2. likes * 2: Strong social endorsement signal; boosts higher-liked results among relevant links.
      // 3. views * 0.1: Secondary engagement metric, discounted so raw clicks do not overpower genuine likes.
      // 4. recencyScore: A gentle decay bonus (0 to 10 points) ensuring fresh relevant content is not buried.
      const allMatches = await Link.find(filter)
        .select('title description url category tags views likes image createdAt owner')
        .populate('owner', 'username');

      const scored = allMatches.map(link => {
        let textScore = 0;
        if (q) {
          const qLower = q.toLowerCase();
          const titleLower = (link.title || '').toLowerCase();
          const descLower = (link.description || '').toLowerCase();
          const tagsList = Array.isArray(link.tags) ? link.tags : [];

          // Exact title match gets highest priority
          if (titleLower === qLower) {
            textScore += 5;
          } else if (titleLower.startsWith(qLower)) {
            // Title begins with query prefix (e.g. "code..." for query "cod")
            textScore += 4;
          } else if (titleLower.includes(qLower)) {
            textScore += 2.5;
          }

          // Exact or partial tag match
          if (tagsList.some(t => t.toLowerCase() === qLower)) {
            textScore += 3;
          } else if (tagsList.some(t => t.toLowerCase().includes(qLower))) {
            textScore += 2;
          }

          // Description match
          if (descLower.includes(qLower)) {
            textScore += 1;
          }
        }

        const likes = Number(link.likes) || 0;
        const views = Number(link.views) || 0;
        const daysOld = Math.max(0, (Date.now() - new Date(link.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const recencyScore = Math.max(0, 10 - (daysOld * 0.1));
        const finalScore = (textScore * 10) + (likes * 2) + (views * 0.1) + recencyScore;
        return { link, finalScore };
      });

      // Sort in memory by composite finalScore descending
      scored.sort((a, b) => b.finalScore - a.finalScore);

      total = scored.length;
      paginatedLinks = scored.slice(skip, skip + limit).map(item => item.link);
    } else {
      // Standard database sorting
      let sortOptions;
      if (sort === 'likes') {
        sortOptions = { likes: -1, createdAt: -1 };
      } else if (sort === 'views') {
        sortOptions = { views: -1, createdAt: -1 };
      } else if (sort === 'oldest') {
        sortOptions = { createdAt: 1 };
      } else {
        // 'newest'
        sortOptions = { createdAt: -1 };
      }

      total = await Link.countDocuments(filter);
      paginatedLinks = await Link.find(filter)
        .select('title description url category tags views likes image createdAt owner')
        .populate('owner', 'username')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
    }

    const totalPages = Math.ceil(total / limit) || 1;
    const pagination = {
      page,
      limit,
      total,
      totalPages
    };

    if (isJsonRequest) {
      return res.json({
        success: true,
        links: paginatedLinks,
        pagination
      });
    }

    return res.render('search', {
      title: q ? `Search: "${q}" | LinkVault` : 'Search | LinkVault',
      query: q,
      category,
      tag,
      sort,
      links: paginatedLinks,
      pagination,
      searched: true
    });
  } catch (error) {
    if (isJsonRequest) {
      return res.status(500).json({
        success: false,
        error: 'An error occurred while searching.'
      });
    }
    return next(error);
  }
};

/**
 * Show the details page for a single link.
 * GET /links/:id
 *
 * Public links  → anyone may view (no login required)
 * Private links → only the owner may view (identified via req.user.id)
 *
 * Authorization cases:
 *   1. Public  + logged out  → allow
 *   2. Public  + logged in   → allow
 *   3. Private + logged out  → 403
 *   4. Private + logged in, not owner → 403
 *   5. Private + logged in, is owner  → allow
 *
 * Views are incremented ONLY after a successful authorization check.
 */
const getLinkDetails = async (req, res, next) => {
  const { id } = req.params;

  // Guard against a malformed MongoDB ObjectId — avoids a confusing CastError
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    // Populate owner.username so the view can display it.
    // select('-password') is not needed here because populate's second argument
    // is a field-selection string: 'username' means ONLY username is fetched.
    const link = await Link.findById(id).populate('owner', 'username');

    // 404 — link does not exist in the database
    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    // ── Authorization ─────────────────────────────────────────────────────
    // Public links: anyone can view — no authentication check needed.
    // Private links: must be logged in AND must be the owner.
    if (link.visibility === 'private') {
      // Not logged in at all
      if (!req.user) {
        return next(new AppError('This link is private. Please log in to view it.', 403));
      }

      // Logged in, but not the owner
      // link.owner._id comes from populate(); compare as strings
      if (link.owner._id.toString() !== req.user.id) {
        return next(new AppError('You do not have permission to view this link.', 403));
      }
    }

    // ── Authorization passed — increment views ─────────────────────────
    // We only reach here if the user is authorized to see this link.
    link.views = (link.views || 0) + 1;
    await link.save();
    console.log("Updated Link views count:", link.views, "for Link:", link._id);

    // Determine whether the currently logged-in user is the owner
    // (used in the view to decide whether to show Edit/Delete buttons)
    const isOwner = req.user
      ? link.owner._id.toString() === req.user.id
      : false;

    // Check whether the currently logged-in user has already liked this link
    let hasLiked = false;
    if (req.user) {
      const existingLike = await Like.findOne({
        user: req.user.id,
        link: link._id
      });
      hasLiked = Boolean(existingLike);
    }

    return res.render('links/details', {
      title: `${link.title} | LinkVault`,
      link: link,
      isOwner: isOwner,
      hasLiked: hasLiked
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Like a link.
 * POST /links/:id/like (Protected — requireAuth)
 */
const likeLink = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    const link = await Link.findById(id);

    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    // Authorization: only users allowed to access the link can like it
    if (link.visibility === 'private' && link.owner.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to like this link.', 403));
    }

    // Application-level duplicate check
    const existingLike = await Like.findOne({
      user: req.user.id,
      link: id
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: 'You have already liked this link.',
        liked: true,
        likes: link.likes || 0
      });
    }

    // Database-level creation (compound unique index protects against race conditions)
    let like;
    try {
      like = await Like.create({
        user: req.user.id,
        link: link._id
      });
      console.log("Created Like:", like._id);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'You have already liked this link.',
          liked: true,
          likes: link.likes || 0
        });
      }
      return next(err);
    }

    // Increment like count
    link.likes = (link.likes || 0) + 1;
    await link.save();
    console.log("Updated Link likes count:", link.likes, "for Link:", link._id);

    return res.json({
      success: true,
      liked: true,
      likes: link.likes
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Unlike a link.
 * POST /links/:id/unlike (Protected — requireAuth)
 */
const unlikeLink = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    const link = await Link.findById(id);

    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    // Authorization: only users allowed to view the link can unlike it
    if (link.visibility === 'private' && link.owner.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to access this link.', 403));
    }

    const existingLike = await Like.findOne({
      user: req.user.id,
      link: id
    });

    if (!existingLike) {
      return res.status(400).json({
        success: false,
        message: 'You have not liked this link.',
        liked: false,
        likes: link.likes || 0
      });
    }

    await Like.findByIdAndDelete(existingLike._id);
    console.log("Deleted Like:", existingLike._id);

    // Decrement like count, ensuring it never drops below 0
    link.likes = Math.max(0, (link.likes || 0) - 1);
    await link.save();
    console.log("Updated Link likes count:", link.likes, "for Link:", link._id);

    return res.json({
      success: true,
      liked: false,
      likes: link.likes
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Check if the current user has liked a link.
 * GET /links/:id/like-status (Protected — requireAuth)
 */
const getLikeStatus = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('The link ID provided is invalid.', 400));
  }

  try {
    const link = await Link.findById(id);

    if (!link) {
      return next(new AppError('Link not found.', 404));
    }

    if (link.visibility === 'private' && link.owner.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to view this link.', 403));
    }

    const existingLike = await Like.findOne({
      user: req.user.id,
      link: id
    });

    return res.json({
      success: true,
      liked: Boolean(existingLike),
      likes: link.likes || 0
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};

