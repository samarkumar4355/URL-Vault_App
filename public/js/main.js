// LinkVault client-side entry script
(function () {
  function initMobileNav() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const header = document.querySelector('header');

    if (!navToggle || !navLinks) return;

    function toggleMenu() {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isExpanded));
      navLinks.classList.toggle('is-open');
    }

    function closeMenu() {
      navToggle.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('is-open');
    }

    // Toggle on hamburger button click
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Close when clicking outside of the header / nav
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('is-open') && header && !header.contains(e.target)) {
        closeMenu();
      }
    });

    // Close when pressing Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        closeMenu();
        navToggle.focus();
      }
    });

    // Close when clicking any nav link
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Automatically close mobile menu if screen resized to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && navLinks.classList.contains('is-open')) {
        closeMenu();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
