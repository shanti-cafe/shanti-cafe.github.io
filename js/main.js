/* Shanti Café — interações do site
   Idioma, menu, galeria, status de abertura, navegação e lightbox. */

(function () {
  "use strict";

  const DATA = window.SHANTI;
  if (!DATA) return;

  const STORAGE_KEY = "shanti-lang";
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let lang = readLang();
  let activeCat = DATA.menu[0] ? DATA.menu[0].id : "menus";
  let galleryIndex = 0;
  let lastFocus = null;
  let fbLang = "";
  let fbWidth = 0;

  const hoursRows = [
    { day: 1, key: "visit.mon" },
    { day: 2, key: "visit.tue" },
    { day: 3, key: "visit.wed" },
    { day: 4, key: "visit.thu" },
    { day: 5, key: "visit.fri" },
    { day: 6, key: "visit.sat" },
    { day: 0, key: "visit.sun" }
  ];

  const dayKeys = ["visit.sun", "visit.mon", "visit.tue", "visit.wed", "visit.thu", "visit.fri", "visit.sat"];

  /* ---------- Idioma ---------- */
  function readLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "pt" || saved === "en") return saved;
    } catch (err) { /* sem armazenamento */ }
    return "pt";
  }

  function t(key, vars) {
    const dict = DATA.ui[lang] || {};
    const fallback = DATA.ui.pt || {};
    let value = dict[key];
    if (value === undefined) value = fallback[key];
    if (value === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach((name) => {
        value = value.replace(new RegExp("\\{" + name + "\\}", "g"), vars[name]);
      });
    }
    return value;
  }

  function pick(obj) {
    if (obj === null || obj === undefined) return "";
    if (typeof obj === "string") return obj;
    return obj[lang] !== undefined ? obj[lang] : (obj.pt !== undefined ? obj.pt : "");
  }

  function applyLanguage() {
    document.documentElement.setAttribute("lang", lang === "pt" ? "pt-PT" : "en");

    $$("[data-i18n]").forEach((el) => {
      const value = t(el.dataset.i18n);
      if (value !== el.dataset.i18n) el.textContent = value;
    });

    $$("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });

    $$("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });

    $$("[data-i18n-alt]").forEach((el) => {
      el.setAttribute("alt", t(el.dataset.i18nAlt));
    });

    $$("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.dataset.i18nTitle));
    });

    $$("[data-lang]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });

    document.title = t("meta.title");
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute("content", t("meta.description"));

    const ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", t("meta.title"));
    const ogDesc = $('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", t("meta.description"));
    const ogLocale = $('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute("content", lang === "pt" ? "pt_PT" : "en_GB");

    const toggle = $("#menuToggle");
    if (toggle) {
      const open = document.body.classList.contains("nav-open");
      toggle.setAttribute("aria-label", t(open ? "nav.close" : "nav.open"));
    }

    renderMenu();
    renderGallery();
    renderTestimonials();
    renderHours();
    updateStatus();
    updateFbLocale();
    updateLightboxCaption();
  }

  function setLanguage(next) {
    if (next !== "pt" && next !== "en") return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (err) { /* ignore */ }
    applyLanguage();
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains("menu-tab")) {
      const tab = $('.menu-tab[aria-selected="true"]');
      if (tab) tab.focus({ preventScroll: true });
    }
  }

  function bindLanguage() {
    $$("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
    });
  }

  /* ---------- Menu ---------- */
  function renderMenu() {
    const tabs = $("#menuTabs");
    const panels = $("#menuPanels");
    if (!tabs || !panels) return;

    if (!DATA.menu.some((cat) => cat.id === activeCat)) {
      activeCat = DATA.menu[0].id;
    }

    tabs.innerHTML = DATA.menu.map((cat) => {
      const selected = cat.id === activeCat;
      return '<button type="button" class="menu-tab" role="tab" id="tab-' + cat.id + '"' +
        ' aria-controls="panel-' + cat.id + '" aria-selected="' + selected + '"' +
        ' tabindex="' + (selected ? "0" : "-1") + '" data-cat="' + cat.id + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-' + cat.icon + '"/></svg>' +
        "<span>" + pick(cat.title) + "</span></button>";
    }).join("");

    panels.innerHTML = DATA.menu.map((cat) => {
      const selected = cat.id === activeCat;
      const note = cat.note ? '<p class="menu-note-cat">' + pick(cat.note) + "</p>" : "";
      const body = cat.layout === "cards" ? renderMenuCards(cat) : renderMenuList(cat);
      return '<div class="menu-panel" role="tabpanel" id="panel-' + cat.id + '"' +
        ' aria-labelledby="tab-' + cat.id + '" tabindex="0"' + (selected ? "" : " hidden") + ">" +
        note + body + "</div>";
    }).join("");
  }

  function renderMenuList(cat) {
    return '<div class="menu-list">' + cat.items.map((item) => {
      const tag = item.tag ? '<span class="menu-tag">' + pick(item.tag) + "</span>" : "";
      const desc = item.desc ? "<p>" + pick(item.desc) + "</p>" : "";
      return '<div class="menu-item">' +
        '<div class="menu-item-main"><h3>' + pick(item.name) + tag + "</h3>" + desc + "</div>" +
        '<span class="menu-dots" aria-hidden="true"></span>' +
        '<span class="menu-price">' + item.price + " €</span>" +
        "</div>";
    }).join("") + "</div>";
  }

  function renderMenuCards(cat) {
    return '<div class="menu-cards">' + cat.items.map((item) => {
      const tag = item.tag ? '<span class="menu-tag">' + pick(item.tag) + "</span>" : "";
      const desc = item.desc ? "<p>" + pick(item.desc) + "</p>" : "";
      return '<article class="menu-card">' +
        '<span class="menu-card-icon"><svg class="icon" aria-hidden="true"><use href="#i-' + cat.icon + '"/></svg></span>' +
        '<div class="menu-card-body">' +
        '<div class="menu-card-head"><h3>' + pick(item.name) + '</h3><span class="menu-card-price">' + item.price + " €</span></div>" +
        desc + tag +
        "</div></article>";
    }).join("") + "</div>";
  }

  function selectCategory(id, focusTab) {
    if (!DATA.menu.some((cat) => cat.id === id)) return;
    activeCat = id;
    renderMenu();

    if (focusTab) {
      const tab = $("#tab-" + id);
      if (tab) {
        tab.focus({ preventScroll: true });
        if (tab.scrollIntoView) {
          tab.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
        }
      }
    }
  }

  function bindMenu() {
    const tabs = $("#menuTabs");
    if (!tabs) return;

    tabs.addEventListener("click", (event) => {
      const btn = event.target.closest(".menu-tab");
      if (btn) selectCategory(btn.dataset.cat, false);
    });

    tabs.addEventListener("keydown", (event) => {
      const btn = event.target.closest(".menu-tab");
      if (!btn) return;
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;

      event.preventDefault();
      const current = DATA.menu.findIndex((cat) => cat.id === btn.dataset.cat);
      let next = current;

      if (event.key === "ArrowRight") next = (current + 1) % DATA.menu.length;
      if (event.key === "ArrowLeft") next = (current - 1 + DATA.menu.length) % DATA.menu.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = DATA.menu.length - 1;

      selectCategory(DATA.menu[next].id, true);
    });

    $$("[data-menu-jump]").forEach((link) => {
      link.addEventListener("click", () => selectCategory(link.dataset.menuJump, true));
    });
  }

  /* ---------- Galeria ---------- */
  function renderGallery() {
    const grid = $("#galleryGrid");
    if (!grid) return;

    grid.innerHTML = DATA.gallery.map((item, index) => {
      const caption = pick(item.caption);
      const alt = pick(item.alt);
      const label = t("gallery.open", { caption });
      return '<button type="button" class="gallery-item" data-index="' + index + '"' +
        ' aria-label="' + escapeAttr(label) + '">' +
        "<picture>" +
        '<source srcset="assets/img/' + item.img + '.webp" type="image/webp">' +
        '<img src="assets/img/' + item.img + '.jpg" alt="' + escapeAttr(alt) + '"' +
        ' width="' + item.w + '" height="' + item.h + '" loading="lazy" decoding="async">' +
        "</picture>" +
        '<span class="gallery-cap">' + caption + "</span>" +
        "</button>";
    }).join("");
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function bindGallery() {
    const grid = $("#galleryGrid");
    if (!grid) return;
    grid.addEventListener("click", (event) => {
      const btn = event.target.closest(".gallery-item");
      if (!btn) return;
      openLightbox(Number(btn.dataset.index));
    });
  }

  /* ---------- Lightbox ---------- */
  function openLightbox(index) {
    const box = $("#lightbox");
    if (!box) return;
    lastFocus = document.activeElement;
    galleryIndex = (index + DATA.gallery.length) % DATA.gallery.length;
    box.hidden = false;
    document.body.classList.add("lightbox-open");
    showLightboxImage();
    const close = $("#lbClose");
    if (close) close.focus({ preventScroll: true });
    preloadNeighbours();
  }

  function showLightboxImage() {
    const item = DATA.gallery[galleryIndex];
    if (!item) return;
    const img = $("#lbImage");
    if (img) {
      img.src = "assets/img/" + item.img + ".jpg";
      img.alt = pick(item.alt);
    }
    updateLightboxCaption();
    preloadNeighbours();
  }

  function updateLightboxCaption() {
    const box = $("#lightbox");
    if (!box || box.hidden) return;
    const item = DATA.gallery[galleryIndex];
    if (!item) return;
    const caption = $("#lbCaption");
    const count = $("#lbCount");
    if (caption) caption.textContent = pick(item.caption);
    if (count) count.textContent = (galleryIndex + 1) + " / " + DATA.gallery.length;
  }

  function preloadNeighbours() {
    if (!DATA.gallery.length) return;
    [1, -1].forEach((offset) => {
      const item = DATA.gallery[(galleryIndex + offset + DATA.gallery.length) % DATA.gallery.length];
      if (item) {
        const preload = new Image();
        preload.src = "assets/img/" + item.img + ".jpg";
      }
    });
  }

  function stepLightbox(dir) {
    galleryIndex = (galleryIndex + dir + DATA.gallery.length) % DATA.gallery.length;
    showLightboxImage();
  }

  function closeLightbox() {
    const box = $("#lightbox");
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove("lightbox-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function bindLightbox() {
    const box = $("#lightbox");
    if (!box) return;
    const close = $("#lbClose");
    const prev = $("#lbPrev");
    const next = $("#lbNext");

    if (close) close.addEventListener("click", closeLightbox);
    if (prev) prev.addEventListener("click", () => stepLightbox(-1));
    if (next) next.addEventListener("click", () => stepLightbox(1));

    box.addEventListener("click", (event) => {
      if (event.target === box) closeLightbox();
    });

    box.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepLightbox(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stepLightbox(1);
      } else if (event.key === "Tab") {
        const focusable = [close, prev, next].filter(Boolean);
        const at = focusable.indexOf(document.activeElement);
        const move = event.shiftKey ? -1 : 1;
        const target = focusable[(at + move + focusable.length) % focusable.length];
        if (target) {
          event.preventDefault();
          target.focus();
        }
      }
    });

    let touchStartX = null;
    const figure = $(".lb-figure");
    if (figure) {
      figure.addEventListener("touchstart", (event) => {
        touchStartX = event.touches[0].clientX;
      }, { passive: true });
      figure.addEventListener("touchend", (event) => {
        if (touchStartX === null) return;
        const delta = event.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) > 45) stepLightbox(delta < 0 ? 1 : -1);
      }, { passive: true });
    }
  }

  /* ---------- Testemunhos ---------- */
  function renderTestimonials() {
    const grid = $("#testimonialGrid");
    if (!grid) return;

    const stars = Array.from({ length: 5 }, () =>
      '<svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>').join("");

    const cards = DATA.testimonials.map((item) =>
      '<article class="testimonial">' +
      '<div class="stars" aria-hidden="true">' + stars + "</div>" +
      '<span class="sr-only">' + t("common.stars") + "</span>" +
      "<blockquote>“" + pick(item.quote) + "”</blockquote>" +
      "<footer>" +
      '<span class="avatar" aria-hidden="true">' + item.initials + "</span>" +
      "<div><span class=\"testimonial-name\">" + pick(item.name) + "</span>" +
      '<span class="testimonial-city">' + pick(item.meta) + "</span></div>" +
      "</footer></article>"
    );

    cards.push(
      '<article class="testimonial testimonial--cta">' +
      '<div class="stars" aria-hidden="true">' + stars + "</div>" +
      '<p class="cta-eyebrow">' + t("testi.ctaEyebrow") + "</p>" +
      '<h3 class="cta-title">' + t("testi.ctaTitle") + "</h3>" +
      '<p class="cta-text">' + t("testi.ctaText") + "</p>" +
      '<a class="btn btn-peach btn-sm" href="https://search.google.com/local/writereview?placeid=ChIJpZ__rsgvGQ0RxtqpPKJ5J8Q" target="_blank" rel="noopener">' +
      t("testi.ctaButton") +
      '<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>' +
      "</article>"
    );

    grid.innerHTML = cards.join("");
  }

  /* ---------- Horário e estado ---------- */
  function renderHours() {
    const body = $("#hoursBody");
    if (!body) return;

    body.innerHTML = hoursRows.map((row) => {
      const schedule = DATA.hours[row.day];
      const time = schedule ? schedule.open + "–" + schedule.close : t("visit.closed");
      return '<tr class="hours-row' + (schedule ? "" : " is-closed") + '" data-day="' + row.day + '">' +
        '<td><span class="day">' + t(row.key) + "</span></td>" +
        "<td>" + time + "</td></tr>";
    }).join("");

    markTodayRow();
  }

  function markTodayRow() {
    const body = $("#hoursBody");
    if (!body) return;
    $$(".hours-row", body).forEach((row) => {
      row.classList.remove("is-today");
      const old = $(".today-pill", row);
      if (old) old.remove();
    });

    const now = getLisbonNow();
    const row = $('.hours-row[data-day="' + now.day + '"]', body);
    if (!row) return;
    row.classList.add("is-today");
    const day = $(".day", row);
    if (day) {
      const pill = document.createElement("span");
      pill.className = "today-pill";
      pill.textContent = t("common.today");
      day.appendChild(pill);
    }
  }

  function getLisbonNow() {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Lisbon",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date());
      const get = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value : "";
      };
      const shortDay = get("weekday").slice(0, 3);
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(shortDay);
      const minutes = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
      return { day: day >= 0 ? day : 0, minutes: isNaN(minutes) ? 0 : minutes };
    } catch (err) {
      const date = new Date();
      return { day: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
    }
  }

  function parseHM(value) {
    const bits = value.split(":");
    return parseInt(bits[0], 10) * 60 + parseInt(bits[1], 10);
  }

  function dayName(day) {
    let name = t(dayKeys[day]);
    if (lang === "pt" && name) name = name.charAt(0).toLowerCase() + name.slice(1);
    return name;
  }

  function statusInfo(now) {
    const schedule = DATA.hours[now.day];

    if (schedule) {
      const opens = parseHM(schedule.open);
      const closes = parseHM(schedule.close);
      if (now.minutes >= opens && now.minutes < closes) {
        return { open: true, label: t("common.openNow"), detail: t("common.closesAt", { time: schedule.close }) };
      }
      if (now.minutes < opens) {
        return { open: false, label: t("common.closed"), detail: t("common.opensToday", { time: schedule.open }) };
      }
    }

    for (let offset = 1; offset <= 7; offset += 1) {
      const nextDay = (now.day + offset) % 7;
      const next = DATA.hours[nextDay];
      if (!next) continue;
      let detail;
      if (offset === 1) {
        detail = t("common.opensTomorrow", { time: next.open });
      } else {
        detail = t("common.opensDay", { day: dayName(nextDay), time: next.open });
      }
      return { open: false, label: t("common.closed"), detail };
    }

    return { open: false, label: t("common.closed"), detail: "" };
  }

  function updateStatus() {
    const now = getLisbonNow();
    const info = statusInfo(now);

    $$("[data-open-status]").forEach((el) => { el.textContent = info.label; });
    $$("[data-open-detail]").forEach((el) => { el.textContent = info.detail; });
    $$("[data-open-wrap]").forEach((el) => {
      el.classList.toggle("is-closed", !info.open);
      el.classList.toggle("is-open", info.open);
    });
  }

  /* ---------- Facebook ---------- */
  function fbWidthFor(iframe) {
    const holder = iframe.closest ? iframe.closest(".fb-frame") : null;
    const raw = holder ? holder.clientWidth : 0;
    const width = Math.max(180, Math.min(500, Math.round(raw || 500)));
    return width;
  }

  function updateFbLocale(force) {
    const iframe = $("#fbFrame");
    if (!iframe) return;
    const target = lang === "pt" ? "pt_PT" : "en_GB";
    const width = fbWidthFor(iframe);
    if (!force && fbLang === target && Math.abs(width - fbWidth) < 16) return;
    fbLang = target;
    fbWidth = width;

    const params = new URLSearchParams({
      href: "https://www.facebook.com/profile.php?id=61558972124053",
      tabs: "timeline",
      width: String(width),
      height: "680",
      small_header: "false",
      adapt_container_width: "true",
      hide_cover: "false",
      show_facepile: "false",
      locale: target
    });
    iframe.setAttribute("width", String(width));
    iframe.src = "https://www.facebook.com/plugins/page.php?" + params.toString();
  }

  /* ---------- Navegação / cabeçalho ---------- */
  function bindNav() {
    const header = $("#siteHeader");
    const toggle = $("#menuToggle");
    const nav = $("#mainNav");
    const toTop = $("#toTop");
    const desktop = window.matchMedia("(min-width: 960px)");

    const setNav = (open, restoreFocus) => {
      document.body.classList.toggle("nav-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", t(open ? "nav.close" : "nav.open"));
      }
      if (open) {
        const first = $(".nav-list a", nav);
        if (first) first.focus({ preventScroll: true });
      } else if (restoreFocus && toggle) {
        toggle.focus({ preventScroll: true });
      }
    };

    if (toggle) {
      toggle.addEventListener("click", () => {
        setNav(!document.body.classList.contains("nav-open"), false);
      });
    }

    if (nav) {
      $$("a", nav).forEach((link) => {
        link.addEventListener("click", () => {
          if (!desktop.matches) setNav(false, false);
        });
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        setNav(false, true);
      }
    });

    if (desktop.addEventListener) {
      desktop.addEventListener("change", (event) => {
        if (event.matches && document.body.classList.contains("nav-open")) setNav(false, false);
      });
    }

    const onScroll = () => {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
      if (toTop) toTop.classList.toggle("is-visible", window.scrollY > 650);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }

    initActiveNav();
  }

  function initActiveNav() {
    if (!("IntersectionObserver" in window)) return;
    const links = $$('.nav-list a[href^="#"]');
    const map = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
    const sections = Array.from(map.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove("is-active"));
        const link = map.get(entry.target.id);
        if (link) link.classList.add("is-active");
      });
    }, { rootMargin: "-42% 0px -54% 0px", threshold: 0 });

    sections.forEach((section) => observer.observe(section));

    const clearAtTop = () => {
      if (window.scrollY < 200) {
        links.forEach((link) => link.classList.remove("is-active"));
      }
    };
    window.addEventListener("scroll", clearAtTop, { passive: true });
    clearAtTop();
  }

  /* ---------- Reveal ---------- */
  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    // Rede de segurança: com scroll rápido o observer pode não receber nenhuma
    // entrada "isIntersecting" para um elemento que já passou pelo ecrã.
    // Esta varredura garante que nada fica invisível.
    let ticking = false;
    const sweep = () => {
      ticking = false;
      const limit = window.innerHeight * 0.92;
      items.forEach((el) => {
        if (el.classList.contains("is-in")) return;
        if (el.getBoundingClientRect().top < limit) {
          el.classList.add("is-in");
          observer.unobserve(el);
        }
      });
    };
    const requestSweep = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    };

    window.addEventListener("scroll", requestSweep, { passive: true });
    window.addEventListener("resize", requestSweep, { passive: true });
    sweep();

    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Arranque ---------- */
  function init() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    bindLanguage();
    bindMenu();
    bindGallery();
    bindLightbox();
    bindNav();
    applyLanguage();
    initReveal();
    setInterval(updateStatus, 60000);

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => updateFbLocale(false), 320);
    }, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
