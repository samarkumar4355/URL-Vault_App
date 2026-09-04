require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// Initialize Express application
const app = express();

// View engine setup (EJS templates located in src/views)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets (located in root public directory)
app.use(express.static(path.join(__dirname, '../public')));

// Built-in middleware with body size limits to mitigate Denial-of-Service (DoS)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));

// Cookie parser middleware
app.use(cookieParser());

// Disable HTTP caching on all dynamic routes so browser refreshes always fetch live MongoDB Atlas data
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Cookie clearing options helper
const isProduction = process.env.NODE_ENV === 'production';
const clearCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction
};

// Authentication state middleware: extracts user identity from JWT HTTP-only cookie
// Populates req.user and exposes res.locals.user (and res.locals.currentUser) to all views
app.use(async (req, res, next) => {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    req.user = null;
    res.locals.user = null;
    res.locals.currentUser = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('username email');

    if (user) {
      req.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      };
      res.locals.user = req.user;
      res.locals.currentUser = req.user;
    } else {
      res.clearCookie('token', clearCookieOptions);
      req.user = null;
      res.locals.user = null;
      res.locals.currentUser = null;
    }
  } catch (err) {
    // Expired or invalid token: clear cookie and treat request as unauthenticated
    res.clearCookie('token', clearCookieOptions);
    req.user = null;
    res.locals.user = null;
    res.locals.currentUser = null;
  }

  next();
});

// Route imports
const authRoutes = require('./routes/auth.routes');
const linkRoutes = require('./routes/link.routes');
const userRoutes = require('./routes/user.routes');
const { requireAuth } = require('./middleware/auth.middleware');
const { searchLinks } = require('./controllers/link.controller');
const { getDashboard } = require('./controllers/user.controller');
const { errorHandler } = require('./middleware/error.middleware');

// Public Home route
app.get('/', (req, res) => {
  res.render('index', {
    registered: req.query.registered === 'true',
    linkCreated: req.query.linkCreated === 'true'
  });
});

// Authentication routes (/auth/register, /auth/login, /auth/logout)
app.use('/auth', authRoutes);

// Public search route — top-level clean URL: GET /search?q=...
// No login required. Only returns visibility: "public" links.
app.get('/search', searchLinks);

// All link routes (browse, create, my-links, edit, delete)
app.use('/links', linkRoutes);

// User profile routes (view and edit own profile)
app.use('/profile', userRoutes);

// Protected Dashboard route with analytics
app.get('/dashboard', requireAuth, getDashboard);

// 404 Handler — catches any request that didn't match a route above
// Must be registered AFTER all valid routes
app.use((req, res, next) => {
  res.status(404).render('404', { title: '404 — Not Found | LinkVault' });
});

// Centralized error-handling middleware
// Must be the LAST middleware registered and must have exactly 4 parameters: (err, req, res, next)
app.use(errorHandler);

module.exports = app;
