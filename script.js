const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const refreshButton = document.getElementById("refreshButton");
const interestForm = document.querySelector("[data-inquiry-form]");
const tabButtons = document.querySelectorAll(".tab-button");
const journeyPanels = document.querySelectorAll(".journey-panel");
const publicConfig = window.COREXFORMER_PUBLIC_CONFIG;
const supabaseLib = window.supabase;
const publicSupabase =
  publicConfig?.supabaseUrl && publicConfig?.supabaseAnonKey && supabaseLib?.createClient
    ? supabaseLib.createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;

const publicAnalytics = publicSupabase ? createCoreXformerAnalytics(publicSupabase) : createNoopAnalytics();
window.COREXFORMER_ANALYTICS = publicAnalytics;

if (publicAnalytics.isReady) {
  void publicAnalytics.trackPageView();
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

initHomeStoryRail();
initMissionChapterNav();
initNestedStoryRails();
initProgramDetailModal();
initProgramObjectiveCart();
initExperienceProgramJourney();
initAudienceProgramRail();
initImpactPathway();

function createNoopAnalytics() {
  return {
    isReady: false,
    async trackPageView() {},
    async trackFormSuccess() {}
  };
}

function initHomeStoryRail() {
  const shell = document.querySelector(".home-story");
  const rail = shell?.querySelector("[data-home-rail]");
  const panels = rail ? [...rail.querySelectorAll("[data-home-rail-panel]")] : [];
  const tabs = shell ? [...shell.querySelectorAll("[data-home-rail-tab]")] : [];
  const dots = shell ? [...shell.querySelectorAll("[data-home-rail-dot]")] : [];
  const progress = shell?.querySelector("[data-home-rail-progress]");
  const stage = shell?.querySelector(".home-story-stage");
  const previousButton = shell?.querySelector("[data-home-rail-prev]");
  const nextButton = shell?.querySelector("[data-home-rail-next]");

  if (!shell || !rail || !stage || !panels.length || !tabs.length) {
    return;
  }

  const panelIds = panels.map((panel) => panel.dataset.homeRailPanel || panel.id).filter(Boolean);
  const getPanelThemeId = (panelId) => panelId === "program-journey" ? "programs" : panelId;
  const headerRailLinks = siteNav
    ? [...siteNav.querySelectorAll('a[href^="#"]')].filter((link) => {
        const href = link.getAttribute("href") || "";
        return panelIds.includes(href.replace(/^#/, "")) || panelIds.map(getPanelThemeId).includes(href.replace(/^#/, ""));
      })
    : [];
  let activeIndex = 0;
  let scrollFrame = 0;
  let hasDismissedMobileCue = false;
  let touchSwipeState = null;
  const compactViewport = window.matchMedia("(max-width: 900px)");
  const swipeIgnoreSelector = "a, button, input, select, textarea, label, [data-impact-slide-track]";

  function dismissMobileCue() {
    if (hasDismissedMobileCue) {
      return;
    }

    hasDismissedMobileCue = true;
    shell.classList.add("has-interacted");
  }

  function setActiveState(nextIndex) {
    const clampedIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
    activeIndex = clampedIndex;
    const activePanelId = panelIds[clampedIndex] || "intro";
    const activeThemeId = getPanelThemeId(activePanelId);
    shell.dataset.homeRailTheme = activeThemeId;
    headerRailLinks.forEach((link) => {
      link.classList.toggle("is-current", link.getAttribute("href") === `#${activeThemeId}`);
    });

    tabs.forEach((tab) => {
      const isActive = tab.dataset.homeRailTab === activeThemeId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));

      if (isActive) {
        tab.scrollIntoView({
          behavior: compactViewport.matches ? "auto" : "smooth",
          inline: "center",
          block: "nearest"
        });
      }
    });

    panels.forEach((panel, index) => {
      const isActive = index === clampedIndex;
      panel.classList.toggle("is-active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === clampedIndex);
    });

    if (progress) {
      progress.textContent = `${clampedIndex + 1} / ${panels.length}`;
    }

    if (previousButton) {
      previousButton.disabled = clampedIndex === 0;
    }

    if (nextButton) {
      nextButton.disabled = clampedIndex === panels.length - 1;
    }
  }

  function getNearestIndex() {
    if (!rail.clientWidth) {
      return activeIndex;
    }

    return Math.max(0, Math.min(Math.round(rail.scrollLeft / rail.clientWidth), panels.length - 1));
  }

  function getPanelRailLeft(index) {
    return Math.max(0, index * rail.clientWidth);
  }

  function goToPanel(nextIndex, behavior = "smooth") {
    const clampedIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
    const targetPanel = panels[clampedIndex];

    if (!targetPanel) {
      return;
    }

    setActiveState(clampedIndex);
    rail.scrollTo({
      left: getPanelRailLeft(clampedIndex),
      behavior
    });
  }

  function stabilizePanelAlignment(panelIndex) {
    const realign = () => goToPanel(panelIndex, "auto");

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(realign);
    });

    [120, 360, 800].forEach((delay) => {
      window.setTimeout(realign, delay);
    });

    if (document.readyState !== "complete") {
      window.addEventListener("load", () => {
        realign();
        window.setTimeout(realign, 180);
      }, { once: true });
    }
  }

  function resetTouchSwipeState() {
    touchSwipeState = null;
  }

  function getSwipeDistanceThreshold() {
    return Math.max(44, Math.min(72, rail.clientWidth * 0.12));
  }

  function clearDirectionalCue() {
    stage.classList.remove("is-cue-left", "is-cue-right");
  }

  function updateDirectionalCue(event) {
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!supportsHover) {
      clearDirectionalCue();
      return;
    }

    const bounds = stage.getBoundingClientRect();
    const midpoint = bounds.left + bounds.width / 2;
    const isLeftSide = event.clientX < midpoint;

    stage.classList.toggle("is-cue-left", isLeftSide);
    stage.classList.toggle("is-cue-right", !isLeftSide);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.homeRailTab || "";
      const targetIndex = panelIds.indexOf(targetId);

      if (targetIndex === -1) {
        return;
      }

      dismissMobileCue();
      goToPanel(targetIndex);
    });
  });

  previousButton?.addEventListener("click", () => {
    dismissMobileCue();
    goToPanel(activeIndex - 1);
  });

  nextButton?.addEventListener("click", () => {
    dismissMobileCue();
    goToPanel(activeIndex + 1);
  });

  shell.addEventListener("pointermove", updateDirectionalCue, { passive: true });
  shell.addEventListener("pointerleave", clearDirectionalCue, { passive: true });
  rail.addEventListener("pointerdown", dismissMobileCue, { passive: true });
  rail.addEventListener("touchstart", dismissMobileCue, { passive: true });

  rail.addEventListener("touchstart", (event) => {
    if (!compactViewport.matches || event.touches.length !== 1 || event.target.closest(swipeIgnoreSelector)) {
      resetTouchSwipeState();
      return;
    }

    const touch = event.touches[0];
    touchSwipeState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startedAt: window.performance.now(),
      startIndex: activeIndex
    };
  }, { passive: true });

  rail.addEventListener("touchend", (event) => {
    if (!compactViewport.matches || !touchSwipeState || event.changedTouches.length !== 1) {
      resetTouchSwipeState();
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchSwipeState.startX;
    const deltaY = touch.clientY - touchSwipeState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Math.max(1, window.performance.now() - touchSwipeState.startedAt);
    const hasHorizontalIntent = absX > absY * 1.15;
    const isQuickSwipe = elapsed <= 240 && absX >= 24;
    const passedDistanceThreshold = absX >= getSwipeDistanceThreshold();

    if (hasHorizontalIntent && (isQuickSwipe || passedDistanceThreshold)) {
      dismissMobileCue();
      goToPanel(touchSwipeState.startIndex + (deltaX < 0 ? 1 : -1), "smooth");
    } else if (absX > 18) {
      goToPanel(touchSwipeState.startIndex, "smooth");
    }

    resetTouchSwipeState();
  }, { passive: true });

  rail.addEventListener("touchcancel", resetTouchSwipeState, { passive: true });

  rail.addEventListener("scroll", () => {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      if (Math.abs(rail.scrollLeft - getPanelRailLeft(activeIndex)) > 14) {
        dismissMobileCue();
      }

      const nearestIndex = getNearestIndex();

      if (nearestIndex !== activeIndex) {
        setActiveState(nearestIndex);
      }
    });
  });

  function handleHomeStoryHash(hash, behavior = "smooth") {
    const panelIndex = panelIds.indexOf(hash.replace(/^#/, ""));

    if (panelIndex === -1) {
      return false;
    }

    shell.scrollIntoView({ behavior, block: "start" });

    if (behavior === "auto") {
      goToPanel(panelIndex, "auto");
      stabilizePanelAlignment(panelIndex);
      return true;
    }

    window.setTimeout(() => {
      goToPanel(panelIndex, "smooth");
      stabilizePanelAlignment(panelIndex);
    }, 180);

    return true;
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute("href") || "";

    if (!href || href === "#top" || !panelIds.includes(href.slice(1))) {
      return;
    }

    link.addEventListener("click", (event) => {
      event.preventDefault();
      handleHomeStoryHash(href);
    });
  });

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      goToPanel(activeIndex, "auto");
    });
  });

  if ("IntersectionObserver" in window) {
    const storyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          shell.classList.toggle("is-awake", entry.isIntersecting);
        });
      },
      {
        threshold: 0.35
      }
    );

    storyObserver.observe(shell);
  } else {
    shell.classList.add("is-awake");
  }

  const initialHash = window.location.hash || "";

  if (!handleHomeStoryHash(initialHash, "auto")) {
    const resetInitialPanel = () => goToPanel(0, "auto");
    resetInitialPanel();
    window.requestAnimationFrame(resetInitialPanel);
    window.setTimeout(resetInitialPanel, 120);
    window.addEventListener("pageshow", resetInitialPanel, { once: true });
  }
}

function initMissionChapterNav() {
  const nav = document.querySelector(".mission-chapter-nav");
  const links = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];
  const chapters = links
    .map((link) => {
      const id = (link.getAttribute("href") || "").replace(/^#/, "");
      const section = id ? document.getElementById(id) : null;

      return section ? { id, link, section } : null;
    })
    .filter(Boolean);

  if (!nav || !chapters.length) {
    return;
  }

  let activeChapterId = "";
  let scrollFrame = 0;

  function setActiveChapter(nextId, behavior = "smooth", forceCenter = false) {
    if (!nextId || (nextId === activeChapterId && !forceCenter)) {
      return;
    }

    activeChapterId = nextId;

    chapters.forEach(({ id, link }) => {
      const isActive = id === nextId;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "true");
        link.scrollIntoView({
          behavior,
          block: "nearest",
          inline: "center"
        });
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function getChapterNearestViewportCenter() {
    const targetY = window.innerHeight * 0.45;
    let nearest = chapters[0];
    let nearestDistance = Number.POSITIVE_INFINITY;

    chapters.forEach((chapter) => {
      const rect = chapter.section.getBoundingClientRect();
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      const referenceY = rect.top <= targetY && rect.bottom >= targetY
        ? targetY
        : rect.top + rect.height / 2;
      const distance = Math.abs(referenceY - targetY);

      if (isVisible && distance < nearestDistance) {
        nearest = chapter;
        nearestDistance = distance;
      }
    });

    return nearest.id;
  }

  function updateActiveChapter(behavior = "smooth") {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      setActiveChapter(getChapterNearestViewportCenter(), behavior);
    });
  }

  function scrollToChapter(chapter, behavior = "smooth") {
    const sectionTop = chapter.section.getBoundingClientRect().top + window.scrollY;
    const scrollMarginTop = Number.parseFloat(window.getComputedStyle(chapter.section).scrollMarginTop) || 0;
    const targetTop = Math.max(0, sectionTop - scrollMarginTop);

    if (behavior === "auto") {
      window.scrollTo(0, targetTop);
    } else {
      window.scrollTo({ top: targetTop, behavior });
    }

    setActiveChapter(chapter.id, behavior === "auto" ? "auto" : "smooth", true);
  }

  function stabilizeHashChapter(chapter) {
    const realign = () => scrollToChapter(chapter, "auto");
    const restoreHash = () => {
      if (window.COREXFORMER_PENDING_MISSION_HASH && window.history?.replaceState) {
        window.history.replaceState(null, "", window.COREXFORMER_PENDING_MISSION_HASH);
      }
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        realign();
        restoreHash();
      });
    });

    [240, 700, 1200].forEach((delay) => {
      window.setTimeout(() => {
        realign();
        restoreHash();
      }, delay);
    });

    if (document.readyState === "complete") {
      window.setTimeout(() => {
        realign();
        restoreHash();
      }, 0);
      return;
    }

    window.addEventListener("load", () => {
      realign();
      restoreHash();
      window.setTimeout(realign, 260);
    }, { once: true });
  }

  chapters.forEach(({ id, link, section }) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToChapter({ id, section }, "smooth");

      if (window.history?.pushState) {
        window.history.pushState(null, "", `#${id}`);
      }
    });
  });

  window.addEventListener("scroll", () => updateActiveChapter(), { passive: true });
  window.addEventListener("resize", () => updateActiveChapter("auto"));

  const requestedHash = window.COREXFORMER_PENDING_MISSION_HASH || window.location.hash;
  const hashChapter = chapters.find(({ id }) => `#${id}` === requestedHash);
  setActiveChapter(hashChapter?.id || getChapterNearestViewportCenter(), "auto");

  if (hashChapter) {
    stabilizeHashChapter(hashChapter);
  }
}

function initNestedStoryRails() {
  const rails = [...document.querySelectorAll("[data-nested-story-rail]")];

  if (!rails.length) {
    return;
  }

  rails.forEach((shell) => {
    const track = shell.querySelector("[data-nested-story-track]");
    const panels = track ? [...track.querySelectorAll("[data-nested-story-panel]")] : [];
    const previousButton = shell.querySelector("[data-nested-story-prev]");
    const nextButton = shell.querySelector("[data-nested-story-next]");
    const progress = shell.querySelector("[data-nested-story-progress]");
    const dotContainer = shell.querySelector("[data-nested-story-dots]");

    if (!track || !panels.length) {
      return;
    }

    let activeIndex = 0;
    let scrollFrame = 0;
    const dots = [];

    if (dotContainer) {
      dotContainer.removeAttribute("aria-hidden");
      dotContainer.innerHTML = "";

      panels.forEach((panel, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Go to story ${index + 1}`);
        dot.addEventListener("click", () => {
          goToPanel(index);
        });
        dotContainer.append(dot);
        dots.push(dot);
      });
    }

    function setActiveState(nextIndex) {
      const clampedIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
      activeIndex = clampedIndex;

      panels.forEach((panel, index) => {
        panel.classList.toggle("is-active", index === clampedIndex);
      });

      dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === clampedIndex);
        dot.setAttribute("aria-current", index === clampedIndex ? "true" : "false");
      });

      if (progress) {
        progress.textContent = `${clampedIndex + 1} / ${panels.length}`;
      }

      if (previousButton) {
        previousButton.disabled = clampedIndex === 0;
      }

      if (nextButton) {
        nextButton.disabled = clampedIndex === panels.length - 1;
      }
    }

    function getNearestIndex() {
      const trackLeft = track.scrollLeft;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      panels.forEach((panel, index) => {
        const distance = Math.abs(panel.offsetLeft - trackLeft);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    }

    function goToPanel(nextIndex, behavior = "smooth") {
      const clampedIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
      const targetPanel = panels[clampedIndex];

      if (!targetPanel) {
        return;
      }

      setActiveState(clampedIndex);
      track.scrollTo({
        left: targetPanel.offsetLeft,
        behavior
      });
    }

    previousButton?.addEventListener("click", () => {
      goToPanel(activeIndex - 1);
    });

    nextButton?.addEventListener("click", () => {
      goToPanel(activeIndex + 1);
    });

    track.addEventListener("scroll", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        const nearestIndex = getNearestIndex();

        if (nearestIndex !== activeIndex) {
          setActiveState(nearestIndex);
        }
      });
    });

    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        goToPanel(activeIndex, "auto");
      });
    });

    goToPanel(0, "auto");
  });
}

function initImpactPathway() {
  const shells = [...document.querySelectorAll("[data-impact-pathway]")];

  if (!shells.length) {
    return;
  }

  shells.forEach((shell) => {
    const tabs = [...shell.querySelectorAll("[data-impact-audience-tab]")];
    const panels = [...shell.querySelectorAll("[data-impact-audience-panel]")];
    const previousButton = shell.querySelector("[data-impact-slide-prev]");
    const nextButton = shell.querySelector("[data-impact-slide-next]");
    const audienceLabel = shell.querySelector("[data-impact-audience-label]");
    const progress = shell.querySelector("[data-impact-slide-progress]");
    const audienceIndexes = new Map();
    let activeAudience = panels[0]?.dataset.impactAudiencePanel || "";
    let scrollFrame = 0;

    if (!tabs.length || !panels.length || !activeAudience) {
      return;
    }

    function getActivePanel() {
      return panels.find((panel) => panel.dataset.impactAudiencePanel === activeAudience) || panels[0];
    }

    function getSlides(panel) {
      return panel ? [...panel.querySelectorAll("[data-impact-slide]")] : [];
    }

    function getTrack(panel) {
      return panel?.querySelector("[data-impact-slide-track]") || null;
    }

    function getAudienceLabel(audience) {
      const tab = tabs.find((button) => button.dataset.impactAudienceTab === audience);
      return tab?.textContent?.trim() || audience;
    }

    function getNearestSlideIndex(track, slides) {
      if (!track || !slides.length) {
        return 0;
      }

      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      slides.forEach((slide, index) => {
        const distance = Math.abs(slide.offsetLeft - track.scrollLeft);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    }

    function setSlideState(panel, nextIndex) {
      const audience = panel.dataset.impactAudiencePanel || activeAudience;
      const slides = getSlides(panel);
      const clampedIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));

      audienceIndexes.set(audience, clampedIndex);
      slides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === clampedIndex);
      });

      if (panel === getActivePanel()) {
        if (progress) {
          progress.textContent = `${clampedIndex + 1} / ${slides.length}`;
        }

        if (previousButton) {
          previousButton.disabled = clampedIndex === 0;
        }

        if (nextButton) {
          nextButton.disabled = clampedIndex === slides.length - 1;
        }
      }
    }

    function goToSlide(nextIndex, behavior = "smooth") {
      const panel = getActivePanel();
      const track = getTrack(panel);
      const slides = getSlides(panel);
      const clampedIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));
      const targetSlide = slides[clampedIndex];

      if (!track || !targetSlide) {
        return;
      }

      setSlideState(panel, clampedIndex);
      track.scrollTo({
        left: targetSlide.offsetLeft,
        behavior
      });
    }

    function activateAudience(audience, behavior = "auto") {
      if (!audience) {
        return;
      }

      activeAudience = audience;

      tabs.forEach((tab) => {
        const isActive = tab.dataset.impactAudienceTab === audience;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));

        if (isActive) {
          tab.scrollIntoView({
            behavior,
            inline: "center",
            block: "nearest"
          });
        }
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.impactAudiencePanel === audience;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
      });

      if (audienceLabel) {
        audienceLabel.textContent = getAudienceLabel(audience);
      }

      goToSlide(audienceIndexes.get(audience) || 0, behavior);
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateAudience(tab.dataset.impactAudienceTab || "", "smooth");
      });
    });

    previousButton?.addEventListener("click", () => {
      const index = audienceIndexes.get(activeAudience) || 0;
      goToSlide(index - 1);
    });

    nextButton?.addEventListener("click", () => {
      const index = audienceIndexes.get(activeAudience) || 0;
      goToSlide(index + 1);
    });

    panels.forEach((panel) => {
      const track = getTrack(panel);

      if (!track) {
        return;
      }

      track.addEventListener("scroll", () => {
        window.cancelAnimationFrame(scrollFrame);
        scrollFrame = window.requestAnimationFrame(() => {
          const slides = getSlides(panel);
          const nearestIndex = getNearestSlideIndex(track, slides);

          if ((audienceIndexes.get(panel.dataset.impactAudiencePanel || "") || 0) !== nearestIndex) {
            setSlideState(panel, nearestIndex);
          }
        });
      });
    });

    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        activateAudience(activeAudience, "auto");
      });
    });

    panels.forEach((panel) => setSlideState(panel, 0));
    activateAudience(activeAudience, "auto");
  });
}

function initProgramDetailModal() {
  const openButtons = [...document.querySelectorAll("[data-program-modal-open]")];

  if (!openButtons.length) {
    return;
  }

  openButtons.forEach((button) => {
    const modalKey = button.dataset.programModalOpen;
    const modal = modalKey ? document.querySelector(`[data-program-modal="${modalKey}"]`) : null;

    if (!modal) {
      return;
    }

    const closeButtons = [...modal.querySelectorAll("[data-program-modal-close]")];
    const modalNumber = modal.querySelector("[data-program-modal-number]");
    const modalTitle = modal.querySelector("[data-program-modal-title]");
    const modalBrief = modal.querySelector("[data-program-modal-brief]");

    function openModal() {
      if (modalNumber && button.dataset.programNumber) {
        modalNumber.textContent = button.dataset.programNumber;
      }

      if (modalTitle && button.dataset.programTitle) {
        modalTitle.textContent = button.dataset.programTitle;
      }

      if (modalBrief && button.dataset.programBrief) {
        modalBrief.textContent = button.dataset.programBrief;
      }

      if (typeof modal.showModal === "function") {
        modal.showModal();
      } else {
        modal.setAttribute("open", "");
      }

      modal.querySelector("[data-program-modal-close]")?.focus({ preventScroll: true });
    }

    function closeModal() {
      if (typeof modal.close === "function") {
        modal.close();
      } else {
        modal.removeAttribute("open");
      }

      button.focus({ preventScroll: true });
    }

    button.addEventListener("click", openModal);

    closeButtons.forEach((closeButton) => {
      closeButton.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    modal.addEventListener("cancel", () => {
      window.setTimeout(() => button.focus({ preventScroll: true }), 0);
    });
  });
}

function initProgramObjectiveCart() {
  const storageKey = "corexformer.programObjectives.v1";
  const toggles = [...document.querySelectorAll("[data-program-cart-toggle]")];
  const objectiveSelect = document.querySelector("[data-program-objective-select]");
  const hiddenInput = document.querySelector("[data-program-objective-hidden]");
  const summary = document.querySelector("[data-program-cart-summary]");
  const itemList = document.querySelector("[data-program-cart-items]");
  const clearButton = document.querySelector("[data-program-cart-clear]");

  if (!toggles.length && !objectiveSelect) {
    return;
  }

  const programMap = new Map();

  toggles.forEach((button) => {
    const title = normalizeValue(button.dataset.programTitle);
    const number = normalizeValue(button.dataset.programNumber);

    if (title) {
      programMap.set(getProgramObjectiveId(title), { id: getProgramObjectiveId(title), number, title });
    }
  });

  let selectedPrograms = readSelectedPrograms();

  function getProgramObjectiveId(title) {
    return normalizeValue(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function normalizeProgram(program) {
    const title = normalizeValue(program?.title);

    if (!title) {
      return null;
    }

    const id = getProgramObjectiveId(title);
    const knownProgram = programMap.get(id);

    return {
      id,
      number: normalizeValue(program?.number) || knownProgram?.number || "",
      title
    };
  }

  function readSelectedPrograms() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(storageKey) || "[]");

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(normalizeProgram).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function saveSelectedPrograms() {
    try {
      window.localStorage?.setItem(storageKey, JSON.stringify(selectedPrograms));
    } catch (error) {
      // The selection still works for the current page even if storage is unavailable.
    }
  }

  function formatProgram(program) {
    return [program.number, program.title].filter(Boolean).join(" - ");
  }

  function hasProgram(title) {
    const id = getProgramObjectiveId(title);
    return selectedPrograms.some((program) => program.id === id);
  }

  function setSelectedPrograms(nextPrograms, options = {}) {
    const uniquePrograms = [];
    const seenIds = new Set();

    nextPrograms.forEach((program) => {
      const normalized = normalizeProgram(program);

      if (!normalized || seenIds.has(normalized.id)) {
        return;
      }

      seenIds.add(normalized.id);
      uniquePrograms.push(normalized);
    });

    selectedPrograms = uniquePrograms;
    saveSelectedPrograms();
    renderSelectedPrograms(options);
  }

  function showProgramToast(message) {
    let toast = document.querySelector("[data-program-toast]");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "program-objective-toast";
      toast.dataset.programToast = "";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }

    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showProgramToast.hideTimer);
    showProgramToast.hideTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function addProgram(program, options = {}) {
    const normalized = normalizeProgram(program);

    if (!normalized) {
      return;
    }

    if (hasProgram(normalized.title)) {
      if (options.notify) {
        showProgramToast(`${normalized.title} is already selected.`);
      }

      return;
    }

    setSelectedPrograms([...selectedPrograms, normalized], { latestTitle: normalized.title });

    if (options.notify) {
      showProgramToast(`${normalized.title} added as an objective for further connect.`);
    }
  }

  function removeProgram(title, options = {}) {
    const id = getProgramObjectiveId(title);
    const nextPrograms = selectedPrograms.filter((program) => program.id !== id);

    setSelectedPrograms(nextPrograms, { clearSelectWhenEmpty: true });

    if (options.notify) {
      showProgramToast("Program removed from selected objectives.");
    }
  }

  function renderSelectedPrograms(options = {}) {
    toggles.forEach((button) => {
      const title = normalizeValue(button.dataset.programTitle);
      const isSelected = hasProgram(title);

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
      button.textContent = isSelected ? "Remove objective" : "Add objective";
      button.closest(".home-program-row, .program-library-card")?.classList.toggle("is-objective-selected", isSelected);
    });

    if (hiddenInput) {
      hiddenInput.value = selectedPrograms.map(formatProgram).join("; ");
    }

    if (objectiveSelect) {
      const latestTitle = options.latestTitle || selectedPrograms[selectedPrograms.length - 1]?.title || "";

      if (latestTitle && [...objectiveSelect.options].some((option) => option.value === latestTitle || option.textContent === latestTitle)) {
        objectiveSelect.value = latestTitle;
      } else if (!selectedPrograms.length && options.clearSelectWhenEmpty) {
        objectiveSelect.value = "";
      }
    }

    if (summary) {
      summary.hidden = selectedPrograms.length === 0;
    }

    if (itemList) {
      itemList.innerHTML = "";

      selectedPrograms.forEach((program) => {
        const chip = document.createElement("span");
        const label = document.createElement("span");
        const removeButton = document.createElement("button");

        chip.className = "objective-cart-chip";
        label.textContent = formatProgram(program);
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.setAttribute("aria-label", `Remove ${program.title} from selected objectives`);
        removeButton.addEventListener("click", () => removeProgram(program.title, { notify: true }));

        chip.append(label, removeButton);
        itemList.append(chip);
      });
    }
  }

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      const program = {
        number: button.dataset.programNumber,
        title: button.dataset.programTitle
      };

      if (hasProgram(program.title)) {
        removeProgram(program.title, { notify: true });
      } else {
        addProgram(program, { notify: true });
      }
    });
  });

  objectiveSelect?.addEventListener("change", () => {
    const title = normalizeValue(objectiveSelect.value);
    const program = programMap.get(getProgramObjectiveId(title));

    if (program) {
      addProgram(program, { notify: true });
    } else if (title) {
      setSelectedPrograms([], { clearSelectWhenEmpty: false });
    }
  });

  clearButton?.addEventListener("click", () => {
    setSelectedPrograms([], { clearSelectWhenEmpty: true });
    showProgramToast("Selected program objectives cleared.");
  });

  renderSelectedPrograms();
}

function initExperienceProgramJourney() {
  const shell = document.querySelector("[data-experience-journey]");
  const rail = shell?.querySelector("[data-experience-rail]");
  const cards = rail ? [...rail.querySelectorAll("[data-experience-card]")] : [];
  const previousButton = shell?.querySelector("[data-experience-prev]");
  const nextButton = shell?.querySelector("[data-experience-next]");
  const ball = shell?.querySelector("[data-experience-ball]");

  if (!shell || !rail || !cards.length) {
    return;
  }

  let activeIndex = 0;
  let scrollFrame = 0;
  let ballPosition = 5;

  function startRandomBallMotion() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!ball || prefersReducedMotion) {
      return;
    }

    function pickNextPosition() {
      const step = Math.round(12 + Math.random() * 28);
      return Math.min(96, ballPosition + step);
    }

    function resetBall() {
      ball.style.transitionDuration = "0ms";
      ball.style.left = "5%";
      ballPosition = 5;
      window.setTimeout(moveBall, 700 + Math.random() * 600);
    }

    function moveBall() {
      const nextPosition = pickNextPosition();
      const distance = Math.abs(nextPosition - ballPosition);
      const speedFactor = 12 + Math.random() * 22;
      const duration = Math.round(380 + distance * speedFactor);

      ball.style.transitionDuration = `${duration}ms`;
      ball.style.left = `${nextPosition}%`;
      ballPosition = nextPosition;

      if (ballPosition >= 96) {
        window.setTimeout(resetBall, duration + 1000);
      } else {
        window.setTimeout(moveBall, duration + 750 + Math.random() * 900);
      }
    }

    window.setTimeout(moveBall, 900);
  }

  function updateActiveState(index, shouldScroll = true) {
    activeIndex = Math.max(0, Math.min(index, cards.length - 1));

    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === activeIndex;
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-hidden", String(!isActive));
    });

    if (previousButton) {
      previousButton.disabled = activeIndex === 0;
    }

    if (nextButton) {
      nextButton.disabled = activeIndex === cards.length - 1;
    }

    if (shouldScroll) {
      rail.scrollTo({
        left: cards[activeIndex].offsetLeft - rail.offsetLeft,
        behavior: "smooth"
      });
    }
  }

  function getNearestIndex() {
    const railLeft = rail.scrollLeft;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - rail.offsetLeft - railLeft);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }

  previousButton?.addEventListener("click", () => {
    updateActiveState(activeIndex - 1);
  });

  nextButton?.addEventListener("click", () => {
    updateActiveState(activeIndex + 1);
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => {
      updateActiveState(index);
    });
  });

  rail.addEventListener(
    "scroll",
    () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        updateActiveState(getNearestIndex(), false);
      });
    },
    { passive: true }
  );

  updateActiveState(0, false);
  startRandomBallMotion();
}

function initAudienceProgramRail() {
  const shells = [...document.querySelectorAll("[data-audience-program-rail]")];

  if (!shells.length) {
    return;
  }

  shells.forEach((shell) => {
    const tabs = [...shell.querySelectorAll("[data-audience-program-tab]")];
    const track = shell.querySelector("[data-audience-program-track]");
    const tabIds = tabs.map((tab) => tab.dataset.audienceProgramTab || "");
    const panels = track
      ? [...track.querySelectorAll("[data-audience-program-panel]")].filter((panel) =>
          tabIds.includes(panel.dataset.audienceProgramPanel || "")
        )
      : [];
    const stage = shell.querySelector(".audience-program-stage");
    const previousButton = shell.querySelector("[data-audience-program-prev]");
    const nextButton = shell.querySelector("[data-audience-program-next]");
    const label = shell.querySelector("[data-audience-program-label]");
    const progress = shell.querySelector("[data-audience-program-progress]");
    const params = new URLSearchParams(window.location.search);
    const isExplorerOnlyView = params.get("view") === "explore" || params.has("audience");

    if (!tabs.length || !track || !panels.length) {
      return;
    }

    const panelIds = panels.map((panel) => panel.dataset.audienceProgramPanel || "");
    const requestedAudience = getRequestedAudience(panelIds);
    let activeIndex = Math.max(0, requestedAudience ? panelIds.indexOf(requestedAudience) : 0);
    let scrollFrame = 0;

    function getRequestedAudience(validIds) {
      const queryAudience = new URLSearchParams(window.location.search).get("audience") || "";
      const hashAudience = (window.location.hash || "").replace(/^#audience-/, "");
      const candidates = [queryAudience, hashAudience].map((value) => value.trim().toLowerCase()).filter(Boolean);
      return candidates.find((value) => validIds.includes(value)) || "";
    }

    function getNearestIndex() {
      const trackLeft = track.scrollLeft;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      panels.forEach((panel, index) => {
        const distance = Math.abs(panel.offsetLeft - trackLeft);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      return nearestIndex;
    }

    function setActiveState(nextIndex) {
      activeIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
      const activePanel = panels[activeIndex];
      const activeId = activePanel?.dataset.audienceProgramPanel || "";

      panels.forEach((panel, index) => {
        panel.classList.toggle("is-active", index === activeIndex);
      });

      tabs.forEach((tab) => {
        const isActive = tab.dataset.audienceProgramTab === activeId;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));

        if (isActive) {
          tab.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
          });
        }
      });

      if (label) {
        label.textContent = tabs.find((tab) => tab.dataset.audienceProgramTab === activeId)?.textContent?.trim() || "";
      }

      if (progress) {
        progress.textContent = `${activeIndex + 1} / ${panels.length}`;
      }

      if (previousButton) {
        previousButton.disabled = activeIndex === 0;
      }

      if (nextButton) {
        nextButton.disabled = activeIndex === panels.length - 1;
      }
    }

    function goToPanel(nextIndex, behavior = "smooth") {
      const clampedIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
      const targetPanel = panels[clampedIndex];

      if (!targetPanel) {
        return;
      }

      setActiveState(clampedIndex);
      track.scrollTo({
        left: targetPanel.offsetLeft,
        behavior
      });
    }

    function clearDirectionalCue() {
      stage?.classList.remove("is-cue-left", "is-cue-right");
    }

    function updateDirectionalCue(event) {
      const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

      if (!supportsHover || !stage) {
        clearDirectionalCue();
        return;
      }

      const bounds = stage.getBoundingClientRect();
      const midpoint = bounds.left + bounds.width / 2;
      const isLeftSide = event.clientX < midpoint;

      stage.classList.toggle("is-cue-left", isLeftSide);
      stage.classList.toggle("is-cue-right", !isLeftSide);
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetIndex = panelIds.indexOf(tab.dataset.audienceProgramTab || "");
        goToPanel(targetIndex);
      });
    });

    previousButton?.addEventListener("click", () => {
      goToPanel(activeIndex - 1);
    });

    nextButton?.addEventListener("click", () => {
      goToPanel(activeIndex + 1);
    });

    shell.addEventListener("pointermove", updateDirectionalCue, { passive: true });
    shell.addEventListener("pointerleave", clearDirectionalCue, { passive: true });

    track.addEventListener(
      "scroll",
      () => {
        window.cancelAnimationFrame(scrollFrame);
        scrollFrame = window.requestAnimationFrame(() => {
          const nearestIndex = getNearestIndex();

          if (nearestIndex !== activeIndex) {
            setActiveState(nearestIndex);
          }
        });
      },
      { passive: true }
    );

    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        goToPanel(activeIndex, "auto");
      });
    });

    goToPanel(activeIndex, "auto");

    if (requestedAudience || isExplorerOnlyView || window.location.hash === "#explore-programs") {
      window.requestAnimationFrame(() => {
        const siteHeader = document.querySelector(".site-header");
        const headerOffset = (siteHeader?.getBoundingClientRect().height || 0) + 12;
        const targetTop = shell.getBoundingClientRect().top + window.scrollY - headerOffset;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "auto"
        });
      });
    }
  });
}

function createCoreXformerAnalytics(supabase) {
  const sessionStorageKey = "corexformer.analytics.session.v1";
  const sessionTimeoutMs = 30 * 60 * 1000;
  const currentHost = window.location.hostname;
  const searchEngines = [
    { label: "Google", pattern: /(^|\.)google\./i, queryParams: ["q"] },
    { label: "Bing", pattern: /(^|\.)bing\.com$/i, queryParams: ["q"] },
    { label: "Yahoo", pattern: /(^|\.)search\.yahoo\./i, queryParams: ["p"] },
    { label: "DuckDuckGo", pattern: /(^|\.)duckduckgo\.com$/i, queryParams: ["q"] },
    { label: "Ecosia", pattern: /(^|\.)ecosia\.org$/i, queryParams: ["q"] },
    { label: "Yandex", pattern: /(^|\.)yandex\./i, queryParams: ["text"] },
    { label: "Baidu", pattern: /(^|\.)baidu\.com$/i, queryParams: ["wd", "word"] }
  ];
  const socialHosts = [
    { label: "LinkedIn", pattern: /(^|\.)linkedin\.com$/i },
    { label: "Instagram", pattern: /(^|\.)instagram\.com$/i },
    { label: "Facebook", pattern: /(^|\.)facebook\.com$/i },
    { label: "X", pattern: /(^|\.)x\.com$/i },
    { label: "Twitter", pattern: /(^|\.)twitter\.com$/i },
    { label: "WhatsApp", pattern: /(^|\.)whatsapp\.com$/i },
    { label: "Telegram", pattern: /(^|\.)t\.me$/i }
  ];

  return {
    isReady: true,
    async trackPageView() {
      const sessionContext = registerPageViewSession();
      await insertAnalyticsEvent(
        buildAnalyticsPayload(sessionContext, "page_view", null, {
          metadata: {
            pageIndex: sessionContext.pageIndex,
            sessionStartedAt: toIsoString(sessionContext.startedAt)
          }
        })
      );
    },
    async trackFormSuccess(formName, options = {}) {
      const sessionContext = touchAnalyticsSession();
      await insertAnalyticsEvent(
        buildAnalyticsPayload(sessionContext, "form_submit", formName, options)
      );
    }
  };

  async function insertAnalyticsEvent(payload) {
    const { error } = await supabase.from("website_analytics_events").insert([payload]);

    if (error) {
      console.warn("CoreXformer website analytics event could not be saved.", error);
    }
  }

  function buildAnalyticsPayload(sessionContext, eventName, formName, options = {}) {
    const normalizedPath = getAnalyticsPath();
    const referrerInfo = getReferrerInfo();
    const utm = getUtmParameters();

    return {
      session_id: sessionContext.id,
      event_name: eventName,
      page_path: normalizedPath,
      page_slug: getPageSlug(normalizedPath),
      page_title: sanitizeAnalyticsText(document.title),
      full_url: window.location.href,
      landing_path: sessionContext.landingPath,
      previous_path: sessionContext.previousPath,
      referrer: referrerInfo.rawReferrer,
      referrer_host: referrerInfo.host,
      referrer_type: referrerInfo.type,
      search_engine: referrerInfo.searchEngine,
      search_query: referrerInfo.searchQuery,
      source_label: buildSourceLabel(referrerInfo, utm),
      utm_source: utm.source,
      utm_medium: utm.medium,
      utm_campaign: utm.campaign,
      utm_term: utm.term,
      utm_content: utm.content,
      device_type: getDeviceType(),
      browser_name: getBrowserName(),
      os_name: getOsName(),
      screen_width: Number(window.innerWidth || window.screen?.width || 0) || null,
      screen_height: Number(window.innerHeight || window.screen?.height || 0) || null,
      language: sanitizeAnalyticsText(navigator.language),
      timezone: sanitizeAnalyticsText(getViewerTimezone()),
      form_name: formName,
      form_context: sanitizeAnalyticsText(options.formContext),
      metadata: buildAnalyticsMetadata(options.metadata, sessionContext)
    };
  }

  function buildAnalyticsMetadata(metadata, sessionContext) {
    const base = {
      sessionStartedAt: toIsoString(sessionContext.startedAt)
    };

    if (typeof sessionContext.pageIndex === "number") {
      base.pageIndex = sessionContext.pageIndex;
    }

    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return base;
    }

    return { ...base, ...metadata };
  }

  function getAnalyticsPath() {
    return normalizeAnalyticsPath(window.location.pathname || "/");
  }

  function normalizeAnalyticsPath(pathname) {
    const rawPath = sanitizeAnalyticsText(pathname) || "/";
    let normalized = rawPath.replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");

    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }

    return normalized || "/";
  }

  function getPageSlug(pagePath) {
    if (pagePath === "/") {
      return "home";
    }

    const bits = pagePath.split("/").filter(Boolean);
    return bits.length ? bits[bits.length - 1] : "home";
  }

  function getUtmParameters() {
    const params = new URLSearchParams(window.location.search);

    return {
      source: sanitizeAnalyticsText(params.get("utm_source")),
      medium: sanitizeAnalyticsText(params.get("utm_medium")),
      campaign: sanitizeAnalyticsText(params.get("utm_campaign")),
      term: sanitizeAnalyticsText(params.get("utm_term")),
      content: sanitizeAnalyticsText(params.get("utm_content"))
    };
  }

  function getReferrerInfo() {
    const rawReferrer = sanitizeAnalyticsText(document.referrer);

    if (!rawReferrer) {
      return {
        rawReferrer: null,
        host: null,
        type: "direct",
        searchEngine: null,
        searchQuery: null,
        socialLabel: null
      };
    }

    let url;

    try {
      url = new URL(rawReferrer);
    } catch (_error) {
      return {
        rawReferrer,
        host: null,
        type: "referral",
        searchEngine: null,
        searchQuery: null,
        socialLabel: null
      };
    }

    const host = sanitizeAnalyticsText(url.hostname?.replace(/^www\./i, ""));

    if (!host) {
      return {
        rawReferrer,
        host: null,
        type: "referral",
        searchEngine: null,
        searchQuery: null,
        socialLabel: null
      };
    }

    if (host === currentHost || host.endsWith(`.${currentHost}`)) {
      return {
        rawReferrer,
        host,
        type: "internal",
        searchEngine: null,
        searchQuery: null,
        socialLabel: null
      };
    }

    const matchedSearchEngine = searchEngines.find((entry) => entry.pattern.test(host));

    if (matchedSearchEngine) {
      return {
        rawReferrer,
        host,
        type: "search",
        searchEngine: matchedSearchEngine.label,
        searchQuery: extractSearchQuery(url, matchedSearchEngine.queryParams),
        socialLabel: null
      };
    }

    const matchedSocial = socialHosts.find((entry) => entry.pattern.test(host));

    if (matchedSocial) {
      return {
        rawReferrer,
        host,
        type: "social",
        searchEngine: null,
        searchQuery: null,
        socialLabel: matchedSocial.label
      };
    }

    return {
      rawReferrer,
      host,
      type: "referral",
      searchEngine: null,
      searchQuery: null,
      socialLabel: null
    };
  }

  function extractSearchQuery(url, queryParams) {
    for (const key of queryParams) {
      const value = sanitizeAnalyticsText(url.searchParams.get(key));

      if (value) {
        return value;
      }
    }

    return null;
  }

  function buildSourceLabel(referrerInfo, utm) {
    if (utm.source) {
      return [utm.source, utm.medium].filter(Boolean).join(" / ");
    }

    if (referrerInfo.type === "direct") {
      return "Direct";
    }

    if (referrerInfo.type === "internal") {
      return "Internal";
    }

    if (referrerInfo.type === "search") {
      return referrerInfo.searchEngine ? `${referrerInfo.searchEngine} search` : "Search";
    }

    if (referrerInfo.type === "social") {
      return referrerInfo.socialLabel || "Social";
    }

    return referrerInfo.host || "Referral";
  }

  function getDeviceType() {
    const width = Number(window.innerWidth || window.screen?.width || 0);

    if (width && width < 768) {
      return "mobile";
    }

    if (width && width < 1100) {
      return "tablet";
    }

    return "desktop";
  }

  function getBrowserName() {
    const agent = navigator.userAgent || "";

    if (/Edg\//.test(agent)) {
      return "Edge";
    }

    if (/SamsungBrowser\//.test(agent)) {
      return "Samsung Internet";
    }

    if (/OPR\//.test(agent)) {
      return "Opera";
    }

    if (/Chrome\//.test(agent)) {
      return "Chrome";
    }

    if (/Firefox\//.test(agent)) {
      return "Firefox";
    }

    if (/Safari\//.test(agent) && !/Chrome\//.test(agent)) {
      return "Safari";
    }

    return "Unknown";
  }

  function getOsName() {
    const agent = navigator.userAgent || "";

    if (/Android/i.test(agent)) {
      return "Android";
    }

    if (/iPhone|iPad|iPod/i.test(agent)) {
      return "iOS";
    }

    if (/Windows/i.test(agent)) {
      return "Windows";
    }

    if (/Mac OS X/i.test(agent)) {
      return "macOS";
    }

    if (/Linux/i.test(agent)) {
      return "Linux";
    }

    return "Unknown";
  }

  function getViewerTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (_error) {
      return "";
    }
  }

  function registerPageViewSession() {
    const session = ensureAnalyticsSession();
    const previousPath = session.lastPath || null;
    const nextPath = getAnalyticsPath();

    session.pageCount = Number(session.pageCount || 0) + 1;
    session.lastPath = nextPath;
    session.lastActivityAt = Date.now();
    writeAnalyticsSession(session);

    return {
      id: session.id,
      startedAt: session.startedAt,
      landingPath: session.landingPath,
      previousPath,
      pageIndex: session.pageCount
    };
  }

  function touchAnalyticsSession() {
    const session = ensureAnalyticsSession();
    session.lastActivityAt = Date.now();
    writeAnalyticsSession(session);

    return {
      id: session.id,
      startedAt: session.startedAt,
      landingPath: session.landingPath,
      previousPath: session.lastPath || null,
      pageIndex: Number(session.pageCount || 0)
    };
  }

  function ensureAnalyticsSession() {
    const now = Date.now();
    const currentPath = getAnalyticsPath();
    const existing = readAnalyticsSession();

    if (!existing || !existing.id || !existing.startedAt || now - Number(existing.lastActivityAt || 0) > sessionTimeoutMs) {
      const freshSession = {
        id: createAnalyticsSessionId(),
        startedAt: now,
        lastActivityAt: now,
        landingPath: currentPath,
        lastPath: null,
        pageCount: 0
      };

      writeAnalyticsSession(freshSession);
      return freshSession;
    }

    return existing;
  }

  function readAnalyticsSession() {
    try {
      const raw = window.localStorage.getItem(sessionStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeAnalyticsSession(session) {
    try {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    } catch (_error) {
      // Ignore storage errors and keep analytics non-blocking.
    }
  }

  function createAnalyticsSessionId() {
    return `cxs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function toIsoString(value) {
    if (!value) {
      return null;
    }

    try {
      return new Date(value).toISOString();
    } catch (_error) {
      return null;
    }
  }

  function sanitizeAnalyticsText(value) {
    return typeof value === "string" ? value.trim().slice(0, 400) || null : null;
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;

    tabButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });

    journeyPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === targetId);
    });
  });
});

if (publicSupabase && document.querySelector("[data-public-facilitator-list]")) {
  void loadPublicFacilitators(publicSupabase);
}

const planningStates = [
  ["Warm-up", "Action", "Pause", "Insight"],
  ["Arrival", "Challenge", "Reflection", "Takeaway"],
  ["Connect", "Engage", "Observe", "Apply"],
  ["Gather", "Respond", "Reflect", "Learn"],
];

let planningIndex = 0;

function refreshPlanningFeed() {
  const inquiryValue = document.getElementById("inquiryValue");
  const programValue = document.getElementById("programValue");
  const opsValue = document.getElementById("opsValue");
  const backendValue = document.getElementById("backendValue");

  if (!inquiryValue || !programValue || !opsValue || !backendValue) {
    return;
  }

  planningIndex = (planningIndex + 1) % planningStates.length;
  const [inquiry, program, ops, backend] = planningStates[planningIndex];

  inquiryValue.textContent = inquiry;
  programValue.textContent = program;
  opsValue.textContent = ops;
  backendValue.textContent = backend;
}

if (refreshButton) {
  refreshButton.addEventListener("click", refreshPlanningFeed);
}

if (interestForm && publicSupabase) {
  interestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitInquiry(publicSupabase, interestForm);
  });
}

const journeyFinder = document.getElementById("journeyFinder");

if (journeyFinder) {
  const finderAudience = document.getElementById("finderAudience");
  const finderStage = document.getElementById("finderStage");
  const finderChallenge = document.getElementById("finderChallenge");
  const primaryOfferingTitle = document.getElementById("primaryOfferingTitle");
  const primaryOfferingSummary = document.getElementById("primaryOfferingSummary");
  const primaryOfferingChips = document.getElementById("primaryOfferingChips");
  const primaryOfferingFit = document.getElementById("primaryOfferingFit");
  const secondaryOfferingTitle = document.getElementById("secondaryOfferingTitle");
  const secondaryOfferingSummary = document.getElementById("secondaryOfferingSummary");
  const secondaryOfferingChips = document.getElementById("secondaryOfferingChips");
  const secondaryOfferingFit = document.getElementById("secondaryOfferingFit");

  const audienceLabels = {
    schools: "school groups",
    colleges: "college groups",
    corporates: "corporate teams",
    government: "government teams",
    communities: "community groups"
  };

  const stageReasons = {
    "new-formation": "the group is still forming and needs a safer base for participation",
    "early-coordination": "the group is still learning how to listen, communicate, and work in rhythm",
    "strengthening-growth": "the group is functioning but needs stronger ownership, leadership, or alignment",
    "pressure-transition": "the group is under change, urgency, or uncertainty that is shaping behavior",
    "difference-misalignment": "different styles and perspectives are starting to block collaboration",
    "fatigue-conflict-drift": "the group is carrying fatigue, friction, or repeating patterns that need repair"
  };

  const challengeReasons = {
    "trust-safety": "trust, openness, and psychological safety are the clearest need right now",
    "communication-listening": "listening, clarity, and miscommunication feel like the main constraint",
    "leadership-ownership": "shared responsibility, leadership, and role ownership need attention",
    "pressure-adaptability": "the group needs a steadier response to pressure, urgency, and change",
    "difference-empathy": "perspective differences and empathy need more space and skill",
    "alignment-execution": "coordination, role clarity, and movement toward the objective need strengthening",
    "fatigue-reset": "the group needs reconnection, reset, and emotional recovery",
    "conflict-repair": "friction, recurring breakdowns, and safer repair are the immediate need"
  };

  const offeringOrder = [
    {
      id: "trust-in-motion",
      title: "Trust in Motion",
      summary: "Build trust, openness, and psychological safety through shared challenge and guided reflection.",
      chips: ["New groups", "Safer participation", "Belonging"],
      stages: ["new-formation", "early-coordination"],
      challenges: ["trust-safety"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This is usually the best place to begin when people need emotional safety and trust before deeper work can happen."
    },
    {
      id: "communicate-to-connect",
      title: "Communicate to Connect",
      summary: "Help people notice how listening, assumptions, tone, and clarity affect shared outcomes.",
      chips: ["Listening", "Clarity", "Coordination"],
      stages: ["early-coordination", "difference-misalignment", "strengthening-growth"],
      challenges: ["communication-listening"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This works well when the group is participating, but communication patterns are still creating unnecessary friction."
    },
    {
      id: "lead-and-support",
      title: "Lead and Support",
      summary: "Explore leadership, followership, delegation, and shared responsibility in team situations.",
      chips: ["Leadership", "Ownership", "Support"],
      stages: ["strengthening-growth", "early-coordination"],
      challenges: ["leadership-ownership"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This is a strong choice when a group needs clearer ownership, healthier delegation, or more mature leadership behavior."
    },
    {
      id: "adapt-under-pressure",
      title: "Adapt Under Pressure",
      summary: "Understand how timelines, urgency, and change shape behavior, planning, and decision-making.",
      chips: ["Urgency", "Resilience", "Adaptability"],
      stages: ["pressure-transition", "strengthening-growth"],
      challenges: ["pressure-adaptability"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This becomes especially useful when time pressure and change quickly alter how people think, feel, and coordinate."
    },
    {
      id: "different-minds-one-objective",
      title: "Different Minds, One Objective",
      summary: "Work better across varied perspectives, styles, emotions, and ways of responding.",
      chips: ["Empathy", "Perspective", "Mixed groups"],
      stages: ["difference-misalignment", "pressure-transition"],
      challenges: ["difference-empathy"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This is helpful when difference itself is not the problem, but the way people interpret and respond to difference is."
    },
    {
      id: "align-and-execute",
      title: "Align and Execute",
      summary: "Clarify shared goals, role coordination, and collective movement toward a common objective.",
      chips: ["Alignment", "Execution", "Role clarity"],
      stages: ["strengthening-growth", "early-coordination", "pressure-transition"],
      challenges: ["alignment-execution"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This fits groups that are willing but scattered, and need to move from intention into coordinated action."
    },
    {
      id: "reflect-and-reset",
      title: "Reflect and Reset",
      summary: "Help groups pause, process fatigue, reconnect emotionally, and regain honest participation.",
      chips: ["Reset", "Reconnection", "Recovery"],
      stages: ["fatigue-conflict-drift", "pressure-transition"],
      challenges: ["fatigue-reset"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This is valuable when the group is still together on the surface, but energy, attention, or emotional connection have started fading."
    },
    {
      id: "conflict-into-clarity",
      title: "Conflict into Clarity",
      summary: "Explore friction, recurring breakdowns, and safer pathways toward repair and understanding.",
      chips: ["Repair", "Clarity", "Conflict navigation"],
      stages: ["fatigue-conflict-drift", "difference-misalignment"],
      challenges: ["conflict-repair"],
      audiences: ["schools", "colleges", "corporates", "government", "communities"],
      fitLine: "This is usually the right place to begin when the real need is not more activity, but safer repair and clearer understanding."
    }
  ];

  function scoreOffering(offering, audience, stage, challenge) {
    let score = 0;

    if (offering.challenges.includes(challenge)) {
      score += 6;
    }

    if (offering.stages.includes(stage)) {
      score += 4;
    }

    if (offering.audiences.includes(audience)) {
      score += 1;
    }

    if (challenge === "conflict-repair" && offering.id === "reflect-and-reset") {
      score += 2;
    }

    if (challenge === "fatigue-reset" && offering.id === "conflict-into-clarity") {
      score += 1;
    }

    if (stage === "new-formation" && offering.id === "communicate-to-connect") {
      score += 2;
    }

    if (stage === "strengthening-growth" && offering.id === "align-and-execute") {
      score += 2;
    }

    if (stage === "pressure-transition" && offering.id === "reflect-and-reset") {
      score += 2;
    }

    return score;
  }

  function buildFitMessage(offering, audience, stage, challenge) {
    const audienceLabel = audienceLabels[audience] || "this group";
    const stageReason = stageReasons[stage] || "the group is moving through a meaningful transition";
    const challengeReason = challengeReasons[challenge] || "this is the clearest need in the room";

    return `For ${audienceLabel}, this is a strong fit when ${stageReason} and ${challengeReason}. ${offering.fitLine}`;
  }

  function renderChips(target, offering, audience) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
    [...offering.chips, audienceLabels[audience]].forEach((chipText) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = chipText;
      target.appendChild(chip);
    });
  }

  function renderFinderResults() {
    const audience = finderAudience?.value || "schools";
    const stage = finderStage?.value || "new-formation";
    const challenge = finderChallenge?.value || "trust-safety";

    const rankedOfferings = offeringOrder
      .map((offering, index) => ({
        offering,
        score: scoreOffering(offering, audience, stage, challenge),
        index
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      });

    const [primary, secondary] = rankedOfferings;

    if (!primary?.offering || !secondary?.offering) {
      return;
    }

    primaryOfferingTitle.textContent = primary.offering.title;
    primaryOfferingSummary.textContent = primary.offering.summary;
    primaryOfferingFit.textContent = buildFitMessage(primary.offering, audience, stage, challenge);
    renderChips(primaryOfferingChips, primary.offering, audience);

    secondaryOfferingTitle.textContent = secondary.offering.title;
    secondaryOfferingSummary.textContent = secondary.offering.summary;
    secondaryOfferingFit.textContent = buildFitMessage(secondary.offering, audience, stage, challenge);
    renderChips(secondaryOfferingChips, secondary.offering, audience);
  }

  [finderAudience, finderStage, finderChallenge].forEach((field) => {
    field?.addEventListener("change", renderFinderResults);
  });

  renderFinderResults();
}

async function submitInquiry(supabase, form) {
  const submitButton = form.querySelector("button[type='submit']");
  const messageElement = form.querySelector("[data-inquiry-message]");
  const formData = new FormData(form);
  const honeypotValue = normalizeValue(formData.get("bot-field"));

  if (honeypotValue) {
    form.reset();
    window.location.href = form.getAttribute("action") || "thank-you.html";
    return;
  }

  const interestValue = normalizeValue(formData.get("interest"));
  const objectiveValue = normalizeValue(formData.get("objective"));
  const selectedProgramsValue = normalizeValue(formData.get("selectedPrograms"));
  const messageValue = normalizeValue(formData.get("message"));

  const payload = {
    full_name: normalizeValue(formData.get("name")),
    organization_name: normalizeValue(formData.get("organization")),
    audience_type: normalizeValue(formData.get("audience")),
    email: normalizeValue(formData.get("email")),
    phone: normalizeValue(formData.get("phone")),
    city: normalizeValue(formData.get("location")),
    preferred_date: normalizeValue(formData.get("timeline")),
    group_size: normalizeValue(formData.get("groupSize")),
    objective: [interestValue, selectedProgramsValue || objectiveValue].filter(Boolean).join(" | "),
    message: messageValue,
    source_page: "website:home-contact"
  };

  if (!payload.full_name || !payload.email || !payload.organization_name || !payload.city) {
    showInquiryMessage(
      messageElement,
      "Please complete the required contact details before sending your request.",
      "error"
    );
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending your request...";
  }

  showInquiryMessage(messageElement, "Saving your inquiry...", "info");

  const { error } = await supabase
    .from("inquiries")
    .insert([payload]);

  if (error) {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send Your Request";
    }

    showInquiryMessage(
      messageElement,
      "Your inquiry could not be saved yet. Please try once more in a moment, or use the direct WhatsApp or email links.",
      "error"
    );
    console.warn("CoreXformer inquiry submission failed.", error);
    return;
  }

  await window.COREXFORMER_ANALYTICS?.trackFormSuccess("inquiry", {
    formContext: payload.source_page,
    metadata: {
      audienceType: payload.audience_type || null,
      interest: interestValue || null,
      objective: selectedProgramsValue || objectiveValue || null
    }
  });

  form.reset();
  try {
    window.localStorage?.removeItem("corexformer.programObjectives.v1");
  } catch (error) {
    // Ignore storage cleanup failures after a successful inquiry.
  }
  window.location.href = form.getAttribute("action") || "thank-you.html";
}

function showInquiryMessage(element, text, tone) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove("hidden", "is-error", "is-success", "is-info");
  element.classList.add(`is-${tone || "info"}`);
}

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadPublicFacilitators(supabase) {
  const shell = document.querySelector("[data-public-facilitator-list]");
  const productSlug = normalizeValue(document.body?.dataset.feedbackProductSlug);

  if (!shell || !productSlug) {
    return;
  }

  const { data, error } = await supabase
    .from("product_facilitators")
    .select("facilitator_name, facilitator_role, facilitator_bio, public_note")
    .eq("product_slug", productSlug)
    .eq("is_public", true)
    .order("sort_order", { ascending: true })
    .limit(3);

  if (error) {
    console.warn("CoreXformer facilitator details could not be loaded.", error);
    return;
  }

  const facilitators = Array.isArray(data) ? data.filter((row) => normalizeValue(row.facilitator_name)) : [];

  if (!facilitators.length) {
    return;
  }

  shell.innerHTML = facilitators
    .map((facilitator) => {
      const name = escapeHtml(facilitator.facilitator_name);
      const role = humanizeFacilitatorRole(facilitator.facilitator_role);
      const bio = escapeHtml(normalizeValue(facilitator.facilitator_bio));
      const note = escapeHtml(normalizeValue(facilitator.public_note));

      return `
        <article class="product-facilitator-card">
          <p class="eyebrow">Conducting this session</p>
          <h4>${name}</h4>
          <p class="product-facilitator-role">${escapeHtml(role)}</p>
          ${bio ? `<p>${bio}</p>` : ""}
          ${note ? `<p class="product-facilitator-note">${note}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function humanizeFacilitatorRole(role) {
  switch (role) {
    case "lead_facilitator":
      return "Lead facilitator";
    case "co_facilitator":
      return "Co-facilitator";
    case "shadow":
      return "Shadow facilitator";
    case "approved":
      return "Approved facilitator";
    default:
      return "Facilitator";
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
