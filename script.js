document.addEventListener('DOMContentLoaded', function() {
  var getLang = function() {
    var stored = localStorage.getItem('siteLang');
    return stored === 'en' ? 'en' : 'it';
  };

  var setLang = function(lang) {
    var normalized = lang === 'en' ? 'en' : 'it';
    localStorage.setItem('siteLang', normalized);
    document.documentElement.setAttribute('lang', normalized);

    var titleKey = normalized === 'en' ? 'titleEn' : 'titleIt';
    var bodyTitle = document.body && document.body.dataset && document.body.dataset[titleKey];
    if (bodyTitle) {
      document.title = bodyTitle;
    }

    var nodes = document.querySelectorAll('[data-i18n-en], [data-i18n-it]');
    nodes.forEach(function(el) {
      if (!el.dataset.i18nIt) {
        el.dataset.i18nIt = el.innerHTML;
      }
      var html = normalized === 'en' ? el.dataset.i18nEn : el.dataset.i18nIt;
      if (typeof html === 'string') {
        el.innerHTML = html;
      }
    });

    var attrNodes = document.querySelectorAll('[data-i18n-en-alt],[data-i18n-en-title],[data-i18n-en-placeholder],[data-i18n-en-aria-label],[data-i18n-it-alt],[data-i18n-it-title],[data-i18n-it-placeholder],[data-i18n-it-aria-label]');
    attrNodes.forEach(function(el) {
      var attrs = [
        ['alt', 'i18nEnAlt', 'i18nItAlt'],
        ['title', 'i18nEnTitle', 'i18nItTitle'],
        ['placeholder', 'i18nEnPlaceholder', 'i18nItPlaceholder'],
        ['aria-label', 'i18nEnAriaLabel', 'i18nItAriaLabel']
      ];
      attrs.forEach(function(def) {
        var attr = def[0];
        var enKey = def[1];
        var itKey = def[2];
        if (!el.dataset[itKey] && el.getAttribute(attr)) {
          el.dataset[itKey] = el.getAttribute(attr);
        }
        var value = normalized === 'en' ? el.dataset[enKey] : el.dataset[itKey];
        if (value) {
          el.setAttribute(attr, value);
        }
      });
    });

    var switcher = document.querySelector('.lang-switcher');
    if (switcher) {
      switcher.querySelectorAll('button[data-lang]').forEach(function(btn) {
        btn.setAttribute('aria-pressed', btn.dataset.lang === normalized ? 'true' : 'false');
      });
    }
  };

  var ensureLangSwitcher = function() {
    if (document.querySelector('.lang-switcher')) return;
    var wrap = document.createElement('div');
    wrap.className = 'lang-switcher';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Cambia lingua');

    var mk = function(code, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = code;
      b.textContent = label;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function() { setLang(code); });
      return b;
    };

    wrap.appendChild(mk('it', 'IT'));
    wrap.appendChild(mk('en', 'EN'));
    document.body.appendChild(wrap);
  };

  ensureLangSwitcher();
  setLang(getLang());

  var setupHeaderFade = function() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
    } catch (e) {}

    var lastY = window.scrollY || 0;
    var ticking = false;

    var update = function() {
      ticking = false;
      var y = window.scrollY || 0;
      var goingDown = y > lastY;
      lastY = y;

      if (y < 10) {
        header.classList.remove('is-hidden');
        return;
      }

      if (goingDown && y > 80) {
        header.classList.add('is-hidden');
      } else {
        header.classList.remove('is-hidden');
      }
    };

    window.addEventListener('scroll', function() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  };

  setupHeaderFade();

  var setupReveal = function() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
    } catch (e) {}

    var selector = '.section-title, .order-card, .info-box, .sub-card, .news-card, .fav-item, .menu-image, .gallery-item';
    var targets = document.querySelectorAll(selector);
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function(el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function(entries, obs) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-visible');
        obs.unobserve(el);
        // a fine animazione liberiamo transform per gli effetti hover (tilt)
        setTimeout(function() {
          el.classList.remove('reveal', 'is-visible');
          el.style.removeProperty('--reveal-delay');
        }, 1000 + (parseInt(el.style.getPropertyValue('--reveal-delay'), 10) || 0));
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

    var sectionCount = new Map();
    targets.forEach(function(el) {
      var section = el.closest('section') || document.body;
      var idx = sectionCount.get(section) || 0;
      sectionCount.set(section, idx + 1);
      el.style.setProperty('--reveal-delay', Math.min(idx * 80, 320) + 'ms');
      el.classList.add('reveal');
    });

    requestAnimationFrame(function() {
      targets.forEach(function(el) {
        io.observe(el);
      });
    });
  };

  setupReveal();

  // Hero a scorrimento: la sezione resta fissa e lo scroll fa avanzare le tappe
  var setupHeroScroll = function() {
    var hero = document.querySelector('.hero');
    if (!hero || !hero.querySelector('.hero-sticky')) return;
    var intro = hero.querySelector('.hero-inner');
    var steps = hero.querySelectorAll('.hero-step');
    var smooth = function(a, b, x) {
      var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    var ticking = false;

    var update = function() {
      ticking = false;
      var r = hero.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      hero.style.setProperty('--p', p.toFixed(4));
      hero.classList.toggle('is-scrolled', p > 0.02);

      if (intro) {
        var out = smooth(0.04, 0.15, p);
        intro.style.opacity = 1 - out;
        intro.style.transform = 'translateY(' + (-70 * out) + 'px)';
        intro.style.visibility = out > 0.99 ? 'hidden' : '';
      }
      steps.forEach(function(step) {
        var from = parseFloat(step.dataset.from), to = parseFloat(step.dataset.to);
        step.classList.toggle('is-active', p >= from && p < to);
      });
    };

    var onScroll = function() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  };

  setupHeroScroll();

  var markCurrentPage = function() {
    var page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function(link) {
      if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
    });
  };

  markCurrentPage();

  var setupTilt = function() {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(hover: hover)').matches) return;
    } catch (e) {}

    document.querySelectorAll('.fav-item, .order-card').forEach(function(card) {
      card.addEventListener('pointermove', function(e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 14) + 'deg) translateY(-6px)';
      });
      card.addEventListener('pointerleave', function() {
        card.style.transform = '';
      });
    });
  };

  setupTilt();

  var form = document.querySelector('.news-form');
  if (form) {
    var consent = document.getElementById('cookie-consent');
    var submitBtn = form.querySelector('.button');
    if (consent && submitBtn) {
      var persisted = localStorage.getItem('cookieConsentNewsletter');
      if (persisted !== null) {
        consent.checked = persisted === 'true';
      }
      submitBtn.disabled = !consent.checked;
      consent.addEventListener('change', function() {
        submitBtn.disabled = !consent.checked;
        localStorage.setItem('cookieConsentNewsletter', consent.checked ? 'true' : 'false');
      });
    }
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (consent && !consent.checked) {
        alert(getLang() === 'en' ? 'To continue, you must accept cookies.' : 'Per proseguire, devi accettare i cookie.');
        return;
      }
      var input = form.querySelector('input[type="email"]');
      if (input && input.value.trim()) {
        alert((getLang() === 'en' ? 'Thanks for subscribing: ' : 'Grazie per l’iscrizione: ') + input.value.trim());
        input.value = '';
        if (consent) {
          consent.checked = false;
          submitBtn && (submitBtn.disabled = true);
          localStorage.setItem('cookieConsentNewsletter', 'false');
        }
      }
    });
  }

  var consentToggle = document.getElementById('consent-toggle');
  if (consentToggle) {
    var persistedToggle = localStorage.getItem('cookieConsentNewsletter');
    if (persistedToggle !== null) {
      consentToggle.checked = persistedToggle === 'true';
    }
    consentToggle.addEventListener('change', function() {
      localStorage.setItem('cookieConsentNewsletter', consentToggle.checked ? 'true' : 'false');
      alert(
        (getLang() === 'en' ? 'Preference updated: ' : 'Preferenza aggiornata: ') +
        (consentToggle.checked ? (getLang() === 'en' ? 'consent enabled' : 'consenso attivo') : (getLang() === 'en' ? 'consent disabled' : 'consenso disattivato'))
      );
    });
  }

  var pulse = function(el) {
    el.classList.add('is-active');
    setTimeout(function() { el.classList.remove('is-active'); }, 900);
  };

  document.querySelectorAll('.info-box, .sub-card, .news-card').forEach(function(el) {
    el.addEventListener('click', function() { pulse(el); });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulse(el); }
    });
  });

  var galleryItems = document.querySelectorAll('.gallery-grid .gallery-item');
  if (galleryItems && galleryItems.length) {
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightbox-image');
    var btnClose = document.querySelector('.lightbox-close');
    var btnPrev = document.querySelector('.lightbox-prev');
    var btnNext = document.querySelector('.lightbox-next');
    var sources = Array.prototype.map.call(galleryItems, function(img) { return img.getAttribute('src'); });
    var alts = Array.prototype.map.call(galleryItems, function(img) { return img.getAttribute('alt') || ''; });
    var current = 0;

    var openAt = function(i) {
      current = i;
      lightboxImg.src = sources[current];
      lightboxImg.alt = alts[current];
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };
    var close = function() {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    var next = function() { openAt((current + 1) % sources.length); };
    var prev = function() { openAt((current - 1 + sources.length) % sources.length); };

    galleryItems.forEach(function(img, i) {
      img.style.cursor = 'pointer';
      img.addEventListener('click', function() { openAt(i); });
    });
    if (btnClose) btnClose.addEventListener('click', close);
    if (btnNext) btnNext.addEventListener('click', next);
    if (btnPrev) btnPrev.addEventListener('click', prev);
    if (lightbox) {
      lightbox.addEventListener('click', function(e) { if (e.target === lightbox) close(); });
    }
    document.addEventListener('keydown', function(e) {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });
  }
});
