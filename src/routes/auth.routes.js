const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../middleware/validation.middleware');

// Registration routes
// validateRegister runs first — if invalid, re-renders the form and never calls postRegister
router.get('/register', authController.getRegister);
router.post('/register', validateRegister, authController.postRegister);

// Login routes
// validateLogin runs first — rejects malformed input before hitting the database
router.get('/login', authController.getLogin);
router.post('/login', validateLogin, authController.postLogin);

// Logout route
router.post('/logout', authController.postLogout);

module.exports = router;
