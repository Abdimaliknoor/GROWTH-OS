/* ==========================================================================
   GROWTH OS — LANDING PAGE INTERACTIVITY
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // ── 1. SCROLL REVEAL (Animate elements into view on scroll) ──
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Applies both utility visibility classes used in your workspace
          entry.target.classList.add('on');
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
  );

  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // ── 2. NAV SCROLL TINT (Toggle header background transparency on scroll) ──
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  // ── 3. MOBILE MENU (Full-screen mobile drawer overlay handling) ──
  const mobileMenu = document.getElementById('mobile-menu');
  const hamburgerBtn = document.getElementById('hamburger');
  const closeBtn = document.getElementById('menu-close');

  const openMenu = () => {
    if (mobileMenu) {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden'; // Prevents background page scrolling
    }
  };

  const closeMenu = () => {
    if (mobileMenu) {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = ''; // Restores window scrolling
    }
  };

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // Automatically collapse the mobile drawer when clicking internal section anchors
  document.querySelectorAll('.mobile-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  // ── 4. BUTTON PRESS FEEDBACK (Micro-interactions for clickable elements) ──
  document.querySelectorAll('button, a.btn').forEach((el) => {
    el.addEventListener('mousedown',  () => { el.style.transform = 'scale(0.97)'; });
    el.addEventListener('mouseup',    () => { el.style.transform = ''; });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    el.addEventListener('touchstart', () => { el.style.transform = 'scale(0.97)'; }, { passive: true });
    el.addEventListener('touchend',   () => { el.style.transform = ''; });
  });

});