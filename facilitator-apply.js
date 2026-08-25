const facilitatorApplicationForm = document.querySelector("[data-facilitator-apply-form]");

if (facilitatorApplicationForm) {
  facilitatorApplicationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitFacilitatorApplication(facilitatorApplicationForm);
  });
}

async function submitFacilitatorApplication(form) {
  const messageElement = form.querySelector("[data-application-message]");
  const submitButton = form.querySelector("button[type='submit']");

  if (!publicSupabase) {
    showApplicationMessage(
      messageElement,
      "The application form is not connected yet. Please try again after the public backend configuration is available.",
      "error"
    );
    return;
  }

  const formData = new FormData(form);
  const honeypotValue = normalizeValue(formData.get("bot-field"));

  if (honeypotValue) {
    form.reset();
    showApplicationMessage(messageElement, "Application received.", "success");
    return;
  }

  const payload = {
    full_name: normalizeValue(formData.get("full_name")),
    email: normalizeValue(formData.get("email")),
    phone: normalizeValue(formData.get("phone")),
    city: normalizeValue(formData.get("city")),
    background: normalizeValue(formData.get("background")),
    experience_summary: normalizeValue(formData.get("experience_summary")),
    audience_interest: formData.getAll("audience_interest").map(normalizeValue).filter(Boolean),
    product_interest: [],
    availability: null,
    motivation: normalizeValue(formData.get("motivation")),
    source_page: "website:become-a-facilitator"
  };

  if (!payload.full_name || !payload.email || !payload.phone || !payload.city || !payload.motivation) {
    showApplicationMessage(
      messageElement,
      "Please complete the required fields before sending your application.",
      "error"
    );
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending application...";
  }

  showApplicationMessage(messageElement, "Saving your application...", "info");

  const { error } = await publicSupabase
    .from("facilitator_applications")
    .insert([payload]);

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Send application";
  }

  if (error) {
    const errorText = String(error.message || "");
    const tableMissing = errorText.includes("facilitator_applications") && (
      errorText.includes("does not exist")
      || errorText.includes("schema cache")
      || errorText.includes("permission denied")
      || errorText.includes("row-level")
    );

    showApplicationMessage(
      messageElement,
      tableMissing
        ? "The facilitator application system is not fully enabled yet. Please try again shortly, or contact CoreXformer directly for now."
        : "Your application could not be saved yet. Please try once more in a moment.",
      "error"
    );
    console.warn("CoreXformer facilitator application failed.", error);
    return;
  }

  await window.COREXFORMER_ANALYTICS?.trackFormSuccess("facilitator_application", {
    formContext: payload.source_page,
    metadata: {
      audienceInterestCount: payload.audience_interest.length,
    }
  });

  form.reset();
  showApplicationMessage(
    messageElement,
    "Your application has been received. CoreXformer will review it before any private login is created.",
    "success"
  );
}

function showApplicationMessage(element, text, tone) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove("hidden", "is-error", "is-success", "is-info");
  element.classList.add(`is-${tone || "info"}`);
}
