(function () {
  const helper = document.querySelector("[data-decision-helper]");
  const products = Array.from(document.querySelectorAll("[data-decision-graph]"));
  if (!helper || !products.length) return;

  const status = helper.querySelector("[data-decision-status]");
  const buttons = Array.from(helper.querySelectorAll("[data-decision-option]"));
  const resetButton = helper.querySelector("[data-decision-reset]");
  const result = helper.querySelector("[data-decision-result]");
  const matchName = helper.querySelector("[data-decision-match-name]");
  const matchReason = helper.querySelector("[data-decision-match-reason]");

  function readJson(value, fallback) {
    try {
      return JSON.parse(value || "");
    } catch {
      return fallback;
    }
  }

  function graphFor(product) {
    return readJson(product.dataset.decisionGraph, { attributes: {}, highlights: [] });
  }

  function weightsFor(button) {
    return readJson(button.dataset.decisionWeights, {});
  }

  function productName(product) {
    return product.dataset.productName || product.querySelector("h2")?.textContent?.trim() || "this pick";
  }

  function topAttribute(graph, weights) {
    const weightedAttributes = Object.entries(weights)
      .map(([key, weight]) => {
        const attribute = graph.attributes?.[key];
        if (!attribute) return null;
        return { ...attribute, weighted: attribute.score * weight };
      })
      .filter(Boolean)
      .sort((a, b) => b.weighted - a.weighted);

    return weightedAttributes[0] || graph.highlights?.[0];
  }

  function selectedButtons() {
    return buttons.filter((button) => button.getAttribute("aria-pressed") === "true");
  }

  function combinedWeights() {
    const weights = {};
    for (const button of selectedButtons()) {
      for (const [key, value] of Object.entries(weightsFor(button))) {
        weights[key] = (weights[key] || 0) + Number(value || 0);
      }
    }
    return weights;
  }

  function matchScore(product, weights) {
    const graph = graphFor(product);
    const entries = Object.entries(weights);
    if (!entries.length) return 0;

    let total = 0;
    let usedWeight = 0;
    for (const [key, weight] of entries) {
      const score = graph.attributes?.[key]?.score;
      if (typeof score !== "number") continue;
      total += score * weight;
      usedWeight += weight;
    }

    const editorialScore = Number(product.dataset.defaultScore || 0);
    return usedWeight ? total / usedWeight * 0.86 + editorialScore * 0.14 : 0;
  }

  function setBadge(product, text, visible) {
    const badge = product.querySelector("[data-recommended-badge]");
    if (!badge) return;
    badge.textContent = text;
    badge.hidden = !visible;
  }

  function clearMatches() {
    buttons.forEach((button) => button.setAttribute("aria-pressed", "false"));
    products.forEach((product) => {
      product.classList.remove("recommended-product", "strong-match-product");
      product.removeAttribute("data-recommended-match");
      product.style.removeProperty("--match-score");
      setBadge(product, "Recommended for you", false);
    });
    if (status) status.textContent = "Pick a priority to get a cleaner shortlist.";
    if (result) result.hidden = true;
  }

  function explainMatch(product, weights) {
    const graph = graphFor(product);
    const attribute = topAttribute(graph, weights);
    const strength = graph.biggestStrength || product.querySelector(".consensus-snapshot p")?.textContent?.trim();
    const complaint = graph.biggestComplaint;
    const attributeText = attribute ? `${attribute.label.toLowerCase()} (${attribute.score}/100)` : "its strongest attributes";
    const caution = complaint ? ` Main watch-out: ${complaint.replace(/\.$/, "")}.` : "";
    return `${productName(product)} fits because it scores well for ${attributeText}. ${strength || "It has the clearest fit for the priorities selected."}${caution}`;
  }

  function applyMatches() {
    const activeButtons = selectedButtons();
    const weights = combinedWeights();
    const activeLabels = activeButtons.map((button) => button.querySelector("span")?.textContent?.trim() || button.textContent.trim());

    products.forEach((product) => {
      product.classList.remove("recommended-product", "strong-match-product");
      setBadge(product, "Recommended for you", false);
      product.style.removeProperty("--match-score");
    });

    if (!activeButtons.length) {
      clearMatches();
      return;
    }

    const ranked = products
      .map((product) => ({ product, score: matchScore(product, weights) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Number(a.product.dataset.editorialRank || 999) - Number(b.product.dataset.editorialRank || 999);
      });

    const top = ranked[0];
    const strongMatches = ranked.filter((row) => row.score >= top.score - 6).slice(0, 3);

    strongMatches.forEach((row, index) => {
      row.product.classList.add(index === 0 ? "recommended-product" : "strong-match-product");
      row.product.dataset.recommendedMatch = activeLabels.join(", ");
      row.product.style.setProperty("--match-score", `${Math.round(row.score)}%`);
      setBadge(row.product, index === 0 ? "Best match for you" : "Strong fit", true);
    });

    if (status) {
      status.textContent = `Matching for ${activeLabels.join(" + ")}: ${strongMatches.map((row) => productName(row.product)).join(", ")}.`;
    }

    if (result && matchName && matchReason) {
      matchName.textContent = productName(top.product);
      matchReason.textContent = explainMatch(top.product, weights);
      result.hidden = false;
    }

    document.dispatchEvent(new CustomEvent("phavai:decision_helper", {
      detail: {
        selectedPriorities: activeLabels.join(", "),
        recommendedProducts: strongMatches.map((row) => productName(row.product)).join(", ")
      }
    }));
  }

  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const isPressed = button.getAttribute("aria-pressed") === "true";
      const activeCount = selectedButtons().length;
      if (!isPressed && activeCount >= 2) {
        const oldest = selectedButtons()[0];
        oldest?.setAttribute("aria-pressed", "false");
      }
      button.setAttribute("aria-pressed", String(!isPressed));
      applyMatches();
    });
  });

  resetButton?.addEventListener("click", clearMatches);
})();
