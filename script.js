const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const refreshButton = document.getElementById("refreshButton");
const interestForm = document.querySelector(".interest-form");
const tabButtons = document.querySelectorAll(".tab-button");
const journeyPanels = document.querySelectorAll(".journey-panel");

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

if (interestForm) {
  interestForm.addEventListener("submit", () => {
    const submitButton = interestForm.querySelector("button[type='submit']");

    if (submitButton) {
      submitButton.textContent = "Sending your request...";
      submitButton.disabled = true;
    }
  });
}
