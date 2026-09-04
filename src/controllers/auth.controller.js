const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/hash');

/**
 * Render the user registration form.
 * GET /auth/register
 */
const getRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Create Account | LinkVault',
    error: null,
    formData: {}
  });
};

/**
 * Process user registration form submission with password hashing.
 * POST /auth/register
 */
const postRegister = async (req, res, next) => {
  const { username, email, password } = req.body;

  // Basic validation for missing fields
  if (!username || !email || !password) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Please fill in all required fields.',
      formData: { username, email }
    });
  }

  // Validate plain password length before hashing
  if (password.length < 6) {
    return res.status(400).render('auth/register', {
      title: 'Create Account | LinkVault',
      error: 'Password must be at least 6 characters long.',
      formData: { username, email }
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).render('auth/register', {
        title: 'Create Account | LinkVault',
        error: 'An account with this email already exists.',
        formData: { username, email }
      });
    }

    // Hash the plain-text password securely before persisting
    const hashedPassword = await hashPassword(password);

    // Create and save the new User in MongoDB
    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    console.log("Created User:", user._id);
    console.log(`[Auth] User registered successfully: ${user.username} (${user.email})`);

    // Redirect to login page or home with success indicator
    return res.redirect('/auth/login?registered=true');
  } catch (error) {
    // Handle Mongoose duplicate key error (code 11000)
    if (error.code === 11000) {
      return res.status(400).render('auth/register', {
        title: 'Create Account | LinkVault',
        error: 'An account with this email already exists.',
        formData: { username, email }
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const firstErrorMessage = Object.values(error.errors)[0].message;
      return res.status(400).render('auth/register', {
        title: 'Create Account | LinkVault',
        error: firstErrorMessage,
        formData: { username, email }
      });
    }

    // Pass unexpected errors to central error handling middleware
    return next(error);
  }
};

/**
 * Render the user login form.
 * GET /auth/login
 */
const getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login | LinkVault',
    error: null,
    success: req.query.registered === 'true' ? 'Registration successful! Please log in.' : null,
    email: ''
  });
};

/**
 * Process user login credentials and issue JWT in HTTP-only cookie.
 * POST /auth/login
 */
const postLogin = async (req, res, next) => {
  const { email, password } = req.body;

  // Validate missing fields
  if (!email || !password) {
    return res.status(400).render('auth/login', {
      title: 'Login | LinkVault',
      error: 'Please provide both email and password.',
      success: null,
      email: email || ''
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find the user by email in MongoDB
    const user = await User.findOne({ email: normalizedEmail });

    // 2. Generic error message if user not found (prevents email enumeration)
    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Login | LinkVault',
        error: 'Invalid email or password.',
        success: null,
        email: normalizedEmail
      });
    }

    // 3. Compare the entered password with the hashed password stored in the database
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).render('auth/login', {
        title: 'Login | LinkVault',
        error: 'Invalid email or password.',
        success: null,
        email: normalizedEmail
      });
    }

    // 4. Generate JWT with minimal payload (userId only - never store passwords or sensitive data)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Store JWT inside an HTTP-only cookie
    // Cookie flags:
    // - httpOnly: true (prevents client-side JS/XSS from accessing the token)
    // - maxAge: 7 days (matches the JWT lifespan)
    // - sameSite: 'lax' (CSRF defense for common navigations)
    // - secure: true in production HTTPS, false in local HTTP development
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: isProduction
    });

    console.log(`[Auth] User logged in successfully: ${user.username} (${user.email})`);

    // 6. Redirect user to home page
    return res.redirect('/');
  } catch (error) {
    return next(error);
  }
};

/**
 * Log out user by clearing the authentication cookie.
 * POST /auth/logout
 *
 * JWT authentication is stateless, so logout on the server side is handled
 * here by removing the browser's authentication cookie using matching options.
 */
const postLogout = (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  });
  return res.redirect('/');
};

module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  postLogout
};

