(() => {
  "use strict";

  const accordion = document.getElementById("accordion");
  const triggers = [...document.querySelectorAll(".step-trigger")];
  const expandAllButton = document.getElementById("expandAll");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const totalSteps = triggers.length;

  function updateProgress() {
    const opened = triggers.filter((trigger) => trigger.getAttribute("aria-expanded") === "true").length;
    progressBar.style.width = `${(opened / totalSteps) * 100}%`;
    progressText.textContent = `${opened} із ${totalSteps} етапів`;
    const allOpen = opened === totalSteps;
    expandAllButton.innerHTML = allOpen
      ? 'Згорнути все <span>−</span>'
      : 'Розгорнути все <span>＋</span>';
  }

  function setStep(trigger, shouldOpen) {
    const panelId = trigger.getAttribute("aria-controls");
    const panel = document.getElementById(panelId);
    const card = trigger.closest(".step-card");

    trigger.setAttribute("aria-expanded", String(shouldOpen));
    card.classList.toggle("is-open", shouldOpen);

    if (shouldOpen) {
      panel.hidden = false;
    } else {
      // Keep the panel in the layout while the closing transition runs.
      panel.hidden = false;
      window.setTimeout(() => {
        if (trigger.getAttribute("aria-expanded") === "false") {
          panel.hidden = true;
        }
      }, 370);
    }
    updateProgress();
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      setStep(trigger, !isOpen);
    });
  });

  expandAllButton.addEventListener("click", () => {
    const allOpen = triggers.every((trigger) => trigger.getAttribute("aria-expanded") === "true");
    triggers.forEach((trigger) => setStep(trigger, !allOpen));
  });

  // Copy the code from the nearest code block or the prompt card.
  document.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const container = button.closest("pre, .prompt-card");
      const code = container?.querySelector("code");
      const text = code ? code.innerText : [...(container?.querySelectorAll("p") || [])]
        .map((paragraph) => paragraph.innerText).join("\n\n");

      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Скопійовано";
        button.classList.add("copied");
      } catch {
        const temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.appendChild(temporary);
        temporary.select();
        const copied = document.execCommand("copy");
        temporary.remove();
        button.textContent = copied ? "Скопійовано" : "Не вдалося";
        button.classList.toggle("copied", copied);
      }

      window.setTimeout(() => {
        button.textContent = "Копіювати";
        button.classList.remove("copied");
      }, 1800);
    });
  });

  document.getElementById("helloBtn").addEventListener("click", () => {
    window.alert("Вітаю! Ти створив свій перший сайт 🚀");
  });

  document.getElementById("year").textContent = new Date().getFullYear();
  updateProgress();
})();
