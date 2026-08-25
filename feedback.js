const RECENT_FEEDBACK_SUMMARY = {
  source: "CoreXformer Cohort 1 completed feedback forms",
  participantLabel: "Doon University participant",
  responseCount: 6,
  programRating: 4.83,
  programRatingCount: 30,
  recommendationPercent: 100,
  recommendationCount: 6,
  recommendationTotal: 6,
  learningTakeaways: [
    "Structuring my thoughts. Breaking complex tasks into small steps will help in achieving goals. Taking the lead and communicating among teammates.",
    "It was a wonderful session. I learned new things about myself and life. I learned that everything is possible and we should never give up.",
    "Make small goals first and think of possible solutions to a problem. Set your goals and have a structure. My personal experience was very good.",
    "Structured thought process, teamwork, setting priorities and setting short-term goals.",
    "Have a structure. Set small goals. Set priorities.",
    "Never give up. Do not fear. Think carefully about what you can do."
  ]
};

initCoreXformerFeedbackSummary();

function initCoreXformerFeedbackSummary() {
  const shell = document.querySelector("[data-feedback-summary]");

  if (!shell) {
    return;
  }

  renderFeedbackSummary(RECENT_FEEDBACK_SUMMARY);
}

function renderFeedbackSummary(summary) {
  setElementText("[data-feedback-overall]", `${summary.programRating.toFixed(2)} / 5`);
  setElementText("[data-feedback-recommend]", `${summary.recommendationPercent}%`);
  renderLearningTakeaways(summary.learningTakeaways);
}

function renderLearningTakeaways(takeaways) {
  const grid = document.querySelector("[data-feedback-library-grid]");

  if (!grid) {
    return;
  }

  grid.innerHTML = "";

  if (!Array.isArray(takeaways) || !takeaways.length) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "feedback-learning-card feedback-learning-card-empty";
    emptyCard.innerHTML = "<p>Learning takeaways will appear here.</p>";
    grid.appendChild(emptyCard);
    return;
  }

  const participantLabel = RECENT_FEEDBACK_SUMMARY.participantLabel || "CoreXformer participant";

  takeaways.forEach((takeaway) => {
    const article = document.createElement("article");
    article.className = "feedback-learning-card";
    article.innerHTML = `
      <p>${escapeHtml(takeaway)}</p>
      <span>${escapeHtml(participantLabel)}</span>
    `;
    grid.appendChild(article);
  });
}

function setElementText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
