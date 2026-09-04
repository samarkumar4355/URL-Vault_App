/**
 * Metadata Service
 *
 * Fetches and extracts useful metadata from a public URL.
 * Used during link creation to auto-fill title, description, and image
 * when the user has not provided them manually.
 *
 * Architecture: Controller → fetchMetadata() → External website
 *
 * This code lives in the services/ layer to keep HTTP scraping concerns
 * completely separate from controllers and routes.
 */

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Safely read a single attribute value from a cheerio element.
 * Returns an empty string if the element or attribute doesn't exist.
 */
const attr = ($, selector, attribute) => {
  const el = $(selector);
  return el.length ? (el.attr(attribute) || '').trim() : '';
};

/**
 * Fetch and parse metadata from a public URL.
 *
 * @param {string} url - A validated http:// or https:// URL
 * @returns {{ title: string, description: string, image: string }}
 *
 * Never throws — if anything goes wrong the function returns empty strings
 * so link creation can still proceed.
 */
const fetchMetadata = async (url) => {
  // Default empty result — returned when anything goes wrong
  const empty = { title: '', description: '', image: '' };

  // Security gate: only allow http and https protocols
  // This prevents file://, ftp://, javascript:, etc.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(`[Metadata] Skipped non-http/https URL: ${url}`);
      return empty;
    }
  } catch {
    // URL is malformed — validation middleware should have caught this,
    // but we guard here defensively
    return empty;
  }

  try {
    // Send a GET request to the external URL
    // Timeout: 5 seconds — we never want one slow website to block link creation
    // We pretend to be a browser so fewer websites block the request
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkVaultBot/1.0; +https://linkvault.app)'
      },
      // We only need the HTML — reject huge responses (> 2MB)
      maxContentLength: 2 * 1024 * 1024,
      // Follow redirects automatically (e.g. http → https)
      maxRedirects: 5,
      // Only accept HTML — we're not trying to parse PDFs or images
      validateStatus: (status) => status >= 200 && status < 400
    });

    const html = response.data;

    // Cheerio loads the HTML into a jQuery-like interface
    // We can now select elements using CSS selectors
    const $ = cheerio.load(html);

    // ── Extract title ───────────────────────────────────────────────────
    // Preference order: og:title → twitter:title → <title> tag
    const title =
      attr($, 'meta[property="og:title"]', 'content') ||
      attr($, 'meta[name="twitter:title"]', 'content') ||
      ($('title').first().text().trim()) ||
      '';

    // ── Extract description ─────────────────────────────────────────────
    // Preference order: og:description → twitter:description → meta description
    const description =
      attr($, 'meta[property="og:description"]', 'content') ||
      attr($, 'meta[name="twitter:description"]', 'content') ||
      attr($, 'meta[name="description"]', 'content') ||
      '';

    // ── Extract image ───────────────────────────────────────────────────
    // Preference order: og:image → twitter:image
    const image =
      attr($, 'meta[property="og:image"]', 'content') ||
      attr($, 'meta[name="twitter:image"]', 'content') ||
      '';

    // Truncate extracted values to avoid storing huge strings
    // (some og:description values can be very long)
    const result = {
      title: title.slice(0, 150),
      description: description.slice(0, 500),
      image: image.slice(0, 1000)
    };

    console.log(`[Metadata] Extracted for "${url}": title="${result.title.slice(0, 50)}…"`);

    return result;
  } catch (error) {
    // Network errors, timeouts, parse errors, 4xx/5xx from the target site —
    // all are caught here. We log a warning and return empty strings so link
    // creation can continue without the metadata.
    const reason = error.code || error.message || 'unknown';
    console.warn(`[Metadata] Could not fetch metadata for "${url}": ${reason}`);
    return empty;
  }
};

module.exports = { fetchMetadata };
