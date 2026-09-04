const bcrypt = require('bcryptjs');

// Number of salt rounds for key expansion
const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password using bcrypt.
 * @param {string} password - The plain-text password to hash
 * @returns {Promise<string>} The resulting secure password hash
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

/**
 * Compare a plain-text password with an existing bcrypt hash.
 * @param {string} password - Plain-text password entered by user
 * @param {string} hashedPassword - The hashed password stored in the database
 * @returns {Promise<boolean>} True if the password matches, false otherwise
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword
};
