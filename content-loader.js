(function initCoreXformerContentLoader() {
  const config = window.COREXFORMER_PUBLIC_CONFIG;
  const supabaseLib = window.supabase;
  const pageSlug = document.body?.dataset?.pageSlug;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseLib?.createClient || !pageSlug) {
    return;
  }

  const supabase = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  void loadPublicContent(supabase, pageSlug);
})();

async function loadPublicContent(supabase, pageSlug) {
  try {
    const [pageResult, settingsResult] = await Promise.all([
      supabase
        .from("pages")
        .select("id, slug, title, meta_title, meta_description")
        .eq("slug", pageSlug)
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("site_settings")
        .select("key, value")
        .eq("is_public", true)
    ]);

    if (pageResult.error || !pageResult.data) {
      return;
    }

    const { data: sectionRows, error: sectionsError } = await supabase
      .from("page_sections")
      .select("slug, eyebrow, heading, summary, body")
      .eq("page_id", pageResult.data.id)
      .eq("status", "published")
      .eq("visible", true)
      .order("sort_order", { ascending: true });

    if (sectionsError) {
      return;
    }

    const settingsByKey = (settingsResult.data || []).reduce((accumulator, setting) => {
      accumulator[setting.key] = setting.value || {};
      return accumulator;
    }, {});

    const sectionsBySlug = (sectionRows || []).reduce((accumulator, section) => {
      accumulator[section.slug] = section;
      return accumulator;
    }, {});

    applyGlobalSettings(settingsByKey);
    applyPageMeta(pageResult.data);
    applyPageSections(sectionsBySlug);
  } catch (error) {
    console.warn("CoreXformer public content loader fell back to static content.", error);
  }
}

function applyGlobalSettings(settingsByKey) {
  const brand = settingsByKey.brand || {};
  const siteName = normalizeText(brand.site_name);
  const tagline = normalizeText(brand.tagline);

  if (siteName) {
    document.querySelectorAll(".brand-text strong, .footer-shell strong").forEach((element) => {
      element.textContent = siteName;
    });
  }

  if (tagline) {
    document.querySelectorAll(".brand-text small, .footer-shell > div > p").forEach((element) => {
      element.textContent = tagline;
    });
  }
}

function applyPageMeta(page) {
  if (page.meta_title) {
    document.title = page.meta_title;
  }

  const descriptionTag = document.querySelector('meta[name="description"]');

  if (descriptionTag && page.meta_description) {
    descriptionTag.setAttribute("content", page.meta_description);
  }
}

function applyPageSections(sectionsBySlug) {
  document.querySelectorAll("[data-section-slug]").forEach((sectionElement) => {
    const slug = sectionElement.dataset.sectionSlug;
    const section = sectionsBySlug[slug];

    if (!section) {
      return;
    }

    const hasInlineFields = sectionElement.querySelector("[data-content]");

    if (hasInlineFields) {
      applyInlineContent(sectionElement, section);
      return;
    }

    if (sectionElement.classList.contains("page-hero")) {
      applyPageHero(sectionElement, section);
      return;
    }

    if (sectionElement.classList.contains("prose-card")) {
      applyProseCard(sectionElement, section);
    }
  });
}

function applyInlineContent(sectionElement, section) {
  sectionElement.querySelectorAll("[data-content]").forEach((target) => {
    const fieldName = target.dataset.content;
    const text = selectInlineField(section, fieldName);

    if (text) {
      target.textContent = text;
    }
  });
}

function applyPageHero(sectionElement, section) {
  const intro = sectionElement.querySelector(".page-intro");

  if (!intro) {
    return;
  }

  const eyebrow = intro.querySelector(".eyebrow");
  const heading = intro.querySelector("h1");
  const heroText = intro.querySelector(".hero-text");

  if (eyebrow && section.eyebrow) {
    eyebrow.textContent = section.eyebrow;
  }

  if (heading && section.heading) {
    heading.textContent = section.heading;
  }

  if (heroText) {
    const text = normalizeText(section.body) || normalizeText(section.summary);

    if (text) {
      heroText.textContent = text;
    }
  }
}

function applyProseCard(sectionElement, section) {
  const eyebrow = sectionElement.querySelector(".eyebrow");
  const heading = sectionElement.querySelector("h3, h2");

  if (eyebrow && section.eyebrow) {
    eyebrow.textContent = section.eyebrow;
  }

  if (heading && section.heading) {
    heading.textContent = section.heading;
  }

  const paragraphTexts = splitIntoParagraphs(normalizeText(section.body) || normalizeText(section.summary));

  if (!paragraphTexts.length || !heading) {
    return;
  }

  Array.from(sectionElement.children).forEach((child) => {
    if (child.tagName === "P" && !child.classList.contains("eyebrow")) {
      child.remove();
    }
  });

  let anchor = heading;

  paragraphTexts.forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    anchor.insertAdjacentElement("afterend", paragraph);
    anchor = paragraph;
  });
}

function selectInlineField(section, fieldName) {
  const fieldValue = normalizeText(section[fieldName]);

  if (fieldValue) {
    return fieldValue;
  }

  if (fieldName === "summary") {
    return normalizeText(section.body);
  }

  return "";
}

function splitIntoParagraphs(text) {
  return (text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
