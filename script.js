const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const refreshButton = document.getElementById("refreshButton");
const interestForm = document.querySelector(".interest-form");
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
    objective: [interestValue, objectiveValue].filter(Boolean).join(" | "),
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

  form.reset();
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
