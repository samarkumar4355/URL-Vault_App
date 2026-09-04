/**
 * Debounce utility function.
 * Delays invoking callback until after 'delay' milliseconds have elapsed
 * since the last time the debounced function was invoked.
 *
 * @param {Function} callback - The function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(callback, delay) {
  let timer;

  return function (...args) {
    clearTimeout(timer);

    timer = setTimeout(() => {
      callback.apply(this, args);
    }, delay);
  };
}

/**
 * Escapes HTML characters to prevent Cross-Site Scripting (XSS).
 *
 * @param {string} str - Raw string.
 * @returns {string} - Escaped string.
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Initialize client-side handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // ── SEARCH LOGIC ──────────────────────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const tagFilter = document.getElementById('tagFilter');
  const sortFilter = document.getElementById('sort');
  const searchResults = document.getElementById('searchResults');
  const paginationControls = document.getElementById('paginationControls');
  const searchForm = document.getElementById('searchForm');

  if (searchInput && searchResults) {
    // Track current in-flight search request and sequence ID to prevent race conditions
    let currentAbortController = null;
    let latestRequestId = 0;
    let currentPage = 1;
    let debounceTimer = null;

    /**
     * Performs the asynchronous search request.
     *
     * @param {number} page - The page number to request.
     */
    async function performSearch(page = 1) {
      currentPage = page;
      const thisRequestId = ++latestRequestId;
      const query = searchInput.value.trim();
      const category = categoryFilter ? categoryFilter.value.trim() : '';
      const tag = tagFilter ? tagFilter.value.trim() : '';
      const sort = sortFilter ? sortFilter.value.trim() : 'relevance';

      // 7. EMPTY SEARCH: If input and filters are empty, clear results and stop
      if (!query && !category && !tag) {
        if (currentAbortController) {
          currentAbortController.abort();
        }
        searchResults.innerHTML = '';
        if (paginationControls) {
          paginationControls.innerHTML = '';
        }
        return;
      }

      // 8. LOADING STATE: Show simple "Searching..." indicator
      searchResults.innerHTML = '<p style="color: var(--text-secondary); padding: 1.5rem 0; font-size: 1rem;">Searching...</p>';

      // 6. RACE CONDITION HANDLING: Abort any pending previous request
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();

      try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (category) params.append('category', category);
        if (tag) params.append('tag', tag);
        if (sort) params.append('sort', sort);
        params.append('page', currentPage);

        const response = await fetch(`/search?${params.toString()}`, {
          signal: currentAbortController.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        // Discard result if a newer search request was initiated
        if (thisRequestId !== latestRequestId) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Server returned status: ${response.status}`);
        }

        const data = await response.json();

        // Discard result if a newer search request was initiated while parsing JSON
        if (thisRequestId !== latestRequestId) {
          return;
        }

        // 9. NO RESULTS: Display "No links found."
        if (!data.success || !Array.isArray(data.links) || data.links.length === 0) {
          searchResults.innerHTML = '<p style="color: var(--text-secondary); padding: 1.5rem 0; font-size: 1rem;">No links found.</p>';
          if (paginationControls) {
            paginationControls.innerHTML = '';
          }
          return;
        }

        // 6. RENDER SEARCH RESULTS: Display returned public links
        renderResults(data.links);

        // 12. RENDER PAGINATION CONTROLS
        if (paginationControls && data.pagination) {
          renderPagination(data.pagination);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }
        if (thisRequestId !== latestRequestId) {
          return;
        }
        console.error('[Search] Request error:', error);
        searchResults.innerHTML = '<p style="color: #ef4444; padding: 1.5rem 0;">An error occurred while searching. Please try again.</p>';
        if (paginationControls) {
          paginationControls.innerHTML = '';
        }
      }
    }

    /**
     * Renders link cards into #searchResults container.
     *
     * @param {Array} links - List of link objects from the API.
     */
    function renderResults(links) {
      const cardsHtml = links.map(link => {
        const title = escapeHTML(link.title || 'Untitled');
        const description = escapeHTML(link.description || '');
        const category = escapeHTML(link.category || 'General');
        const views = Number(link.views || 0);
        const likes = Number(link.likes || 0);
        const linkId = encodeURIComponent(link._id);
        const ownerName = escapeHTML(link.owner && link.owner.username ? link.owner.username : 'Anonymous');
        const createdDate = link.createdAt ? new Date(link.createdAt).toLocaleDateString() : '';

        // Render tags list
        let tagsHtml = '';
        if (Array.isArray(link.tags) && link.tags.length > 0) {
          tagsHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem;">
              ${link.tags.map(t => {
                const safeTag = escapeHTML(t);
                return `<span style="font-size: 0.75rem; background: rgba(51, 65, 85, 0.5); color: var(--text-secondary); padding: 0.15rem 0.5rem; border-radius: 4px;">#${safeTag}</span>`;
              }).join('')}
            </div>
          `;
        }

        // Render image if available
        let imageHtml = '';
        if (link.image) {
          const safeImage = escapeHTML(link.image);
          imageHtml = `
            <div style="margin-bottom: 0.75rem; border-radius: 6px; overflow: hidden; max-height: 140px;">
              <img src="${safeImage}" alt="${title}" style="width: 100%; height: 140px; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none'" loading="lazy">
            </div>
          `;
        }

        return `
          <div class="feature-box" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.4rem;">
                <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #a5b4fc; background: var(--accent-glow); padding: 0.2rem 0.6rem; border-radius: 4px;">
                  ${category}
                </span>
                <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; color: var(--text-secondary);">
                  <span>👁️ ${views} view${views === 1 ? '' : 's'}</span>
                  <span style="color: #f43f5e;">❤️ ${likes}</span>
                </div>
              </div>

              ${imageHtml}

              <h2 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; line-height: 1.3;">
                <a href="/links/${linkId}" style="color: var(--text-primary); text-decoration: none;">
                  ${title}
                </a>
              </h2>

              ${description ? `<p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">${description}</p>` : ''}
            </div>

            <div>
              ${tagsHtml}

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                <span>📅 ${createdDate}</span>
                <span>By ${ownerName}</span>
              </div>

              <div style="display: flex; justify-content: flex-end; align-items: center; font-size: 0.75rem; border-top: 1px solid rgba(51, 65, 85, 0.5); padding-top: 0.75rem;">
                <a href="/links/${linkId}" style="color: #60a5fa; text-decoration: none; font-weight: 500;">
                  View Details →
                </a>
              </div>
            </div>
          </div>
        `;
      }).join('');

      searchResults.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; margin-top: 1.5rem;">
          ${cardsHtml}
        </div>
      `;
    }

    /**
     * Renders pagination controls.
     *
     * @param {Object} pagination - { page, limit, total, totalPages }
     */
    function renderPagination(pagination) {
      if (!pagination || pagination.totalPages <= 1) {
        paginationControls.innerHTML = '';
        return;
      }

      let html = '';
      if (pagination.page > 1) {
        html += `<button id="prevPageBtn" class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">← Previous</button>`;
      }

      html += `<span style="color: var(--text-secondary); font-size: 0.9rem;">Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)</span>`;

      if (pagination.page < pagination.totalPages) {
        html += `<button id="nextPageBtn" class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Next →</button>`;
      }

      paginationControls.innerHTML = html;

      const prevBtn = document.getElementById('prevPageBtn');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          performSearch(pagination.page - 1);
        });
      }

      const nextBtn = document.getElementById('nextPageBtn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          performSearch(pagination.page + 1);
        });
      }
    }

    // 1. PROGRESSIVE 300MS DEBOUNCE LOGIC
    // Resets timer on every keystroke.
    // If input becomes empty, immediately clears results and cancels in-flight requests.
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);

      const query = searchInput.value.trim();
      const category = categoryFilter ? categoryFilter.value.trim() : '';
      const tag = tagFilter ? tagFilter.value.trim() : '';

      if (!query && !category && !tag) {
        if (currentAbortController) {
          currentAbortController.abort();
        }
        searchResults.innerHTML = '';
        if (paginationControls) {
          paginationControls.innerHTML = '';
        }
        return;
      }

      debounceTimer = setTimeout(() => {
        performSearch(1);
      }, 300);
    });

    if (tagFilter) {
      tagFilter.addEventListener('input', () => {
        clearTimeout(debounceTimer);

        const query = searchInput.value.trim();
        const category = categoryFilter ? categoryFilter.value.trim() : '';
        const tag = tagFilter.value.trim();

        if (!query && !category && !tag) {
          if (currentAbortController) {
            currentAbortController.abort();
          }
          searchResults.innerHTML = '';
          if (paginationControls) {
            paginationControls.innerHTML = '';
          }
          return;
        }

        debounceTimer = setTimeout(() => {
          performSearch(1);
        }, 300);
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        clearTimeout(debounceTimer);
        performSearch(1);
      });
    }

    if (sortFilter) {
      sortFilter.addEventListener('change', () => {
        clearTimeout(debounceTimer);
        performSearch(1);
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearTimeout(debounceTimer);
        performSearch(1);
      });
    }
  }

  // ── LIKE / UNLIKE LOGIC (DETAILS PAGE) ──────────────────────────────────
  const likeBtn = document.getElementById('likeBtn');
  const likeCountSpan = document.getElementById('likeCount');
  const likeIconSpan = document.getElementById('likeIcon');
  const topLikeCountSpan = document.getElementById('topLikeCount');

  if (likeBtn && likeCountSpan) {
    likeBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const linkId = likeBtn.dataset.linkId;
      const isCurrentlyLiked = likeBtn.dataset.liked === 'true';
      const endpoint = isCurrentlyLiked ? `/links/${linkId}/unlike` : `/links/${linkId}/like`;

      // Disable button briefly to prevent double clicks
      likeBtn.disabled = true;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          }
        });

        // If user session expired and server redirected to login
        if (response.redirected && response.url.includes('/auth/login')) {
          window.location.href = '/auth/login';
          return;
        }

        const data = await response.json();

        if (response.ok && data.success) {
          likeCountSpan.textContent = data.likes;
          likeBtn.dataset.liked = data.liked ? 'true' : 'false';

          if (likeIconSpan) {
            likeIconSpan.textContent = data.liked ? '❤️' : '🤍';
          }
          likeBtn.title = data.liked ? 'Unlike' : 'Like';

          if (topLikeCountSpan) {
            topLikeCountSpan.textContent = data.likes;
          }
        } else if (data.message) {
          alert(data.message);
        }
      } catch (err) {
        console.error('[Like] Network error:', err);
      } finally {
        likeBtn.disabled = false;
      }
    });
  }
});
