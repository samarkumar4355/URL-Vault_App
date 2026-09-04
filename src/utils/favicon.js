/**
 * Favicon Utility
 *
 * Generates a Google S2 favicon service URL from a website URL.
 * Safely extracts the hostname using the URL API.
 * Never makes backend network requests or scrapes external HTML.
 * Returns null if the URL is invalid or malformed.
 */
const getFaviconUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return null;

  try {
    const parsed = new URL(urlString.trim());
    const hostname = parsed.hostname;
    if (!hostname) return null;

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return null;
  }
};

module.exports = { getFaviconUrl };
