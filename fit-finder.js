(() => {
  const MAX_ACTIVE_OPTIONS = 2;

  function decodeJsonAttribute(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch {
      return fallback;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function aggregateWeights(options) {
    const weights = {};
    for (const option of options) {
      for (const [key, value] of Object.entries(option.weights || {})) {
        weights[key] = (weights[key] || 0) + Number(value || 0);
      }
    }
    return weights;
  }

  function productFromElement(element) {
    const profile = decodeJsonAttribute(element.getAttribute("data-fit-profile"), {});
    return {
      element,
      profile,
      defaultScore: Number(profile.defaultScore || element.getAttribute("data-default-score") || 0),
      editorialRank: Number(profile.rank || element.getAttribute("data-editorial-rank") || 999),
      badge: element.querySelector("[data-recommended-badge]")
    };
  }

  function contributorRows(profile, weights) {
    const attributes = profile.attributeGraph?.attributes || {};
    return Object.entries(weights)
      .map(([key, weight]) => {
        const attribute = attributes[key];
        return attribute ? {
          key,
          label: attribute.label || key,
          score: Number(attribute.score || 0),
          weight: Number(weight || 0)
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.score * b.weight) - (a.score * a.weight));
  }

  function scoreProduct(product, activeOptions) {
    if (!activeOptions.length) {
      return {
        ...product,
        fitScore: product.defaultScore,
        matchScore: null,
        reason: product.profile.tag || product.profile.bestFor || "Editorial starting point."
      };
    }

    const weights = aggregateWeights(activeOptions);
    const contributors = contributorRows(product.profile, weights);
    const weightedTotal = contributors.reduce((total, row) => total + row.score * row.weight, 0);
    const weightTotal = contributors.reduce((total, row) => total + row.weight, 0);
    const attributeScore = weightTotal ? weightedTotal / weightTotal : product.defaultScore;
    const tagBoost = activeOptions.some((option) => (product.profile.decisionTags || []).includes(option.key)) ? 5 : 0;
    const editorialBonus = clamp(product.defaultScore, 0, 100) * 0.22;
    const fitScore = clamp(Math.round(attributeScore * 0.74 + editorialBonus + tagBoost), 0, 99);
    const topSignals = contributors.slice(0, 2).map((row) => `${row.label} ${Math.round(row.score)}/100`);
    const signalText = topSignals.length ? `Strongest fit signals: ${topSignals.join(", ")}.` : "This is the closest fit from the available guide data.";
    const warning = product.profile.biggestComplaint ? ` Watch-out: ${product.profile.biggestComplaint}` : "";

    return {
      ...product,
      fitScore,
      matchScore: fitScore,
      reason: `${signalText}${warning}`
    };
  }

  function sortMatches(products, activeOptions) {
    return products
      .map((product) => scoreProduct(product, activeOptions))
      .sort((a, b) => {
        if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
        if (b.defaultScore !== a.defaultScore) return b.defaultScore - a.defaultScore;
        return a.editorialRank - b.editorialRank;
      });
  }

  function optionByKey(options, key) {
    return options.find((option) => option.key === key);
  }

  function storageKey() {
    return `phavai.fitFinder.${window.location.pathname}`;
  }

  function readStoredKeys(validKeys) {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey()) || "[]");
      return Array.isArray(stored) ? stored.filter((key) => validKeys.includes(key)).slice(0, MAX_ACTIVE_OPTIONS) : [];
    } catch {
      return [];
    }
  }

  function writeStoredKeys(keys) {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(keys));
    } catch {
      // Storage can be unavailable in private contexts; the tool still works for the current page.
    }
  }

  function initFitFinder(finder) {
    const options = decodeJsonAttribute(finder.getAttribute("data-fit-options"), []);
    if (!options.length) return;

    const products = Array.from(document.querySelectorAll(".product[data-fit-profile]")).map(productFromElement);
    if (!products.length) return;

    const buttons = Array.from(finder.querySelectorAll("[data-fit-option]"));
    const clearButton = finder.querySelector("[data-fit-clear]");
    const cards = Array.from(finder.querySelectorAll("[data-fit-card]"));
    const resultLabel = finder.querySelector("[data-fit-result-label]");
    const resultName = finder.querySelector("[data-fit-result-name]");
    const resultReason = finder.querySelector("[data-fit-result-reason]");
    const resultLink = finder.querySelector("[data-fit-result-link]");
    const validKeys = options.map((option) => option.key);
    let selectedKeys = readStoredKeys(validKeys);

    function activeOptions() {
      return selectedKeys.map((key) => optionByKey(options, key)).filter(Boolean);
    }

    function syncButtons() {
      for (const button of buttons) {
        button.setAttribute("aria-pressed", selectedKeys.includes(button.dataset.fitOption) ? "true" : "false");
      }
    }

    function clearHighlights() {
      for (const product of products) {
        product.element.classList.remove("fit-match-product");
        product.element.removeAttribute("data-fit-match");
        if (product.badge) {
          product.badge.hidden = true;
          product.badge.textContent = "Recommended for you";
        }
      }
    }

    function renderCards(matches, hasActiveOptions) {
      cards.forEach((card, index) => {
        const match = matches[index];
        if (!match) {
          card.hidden = true;
          return;
        }

        card.hidden = false;
        card.href = `#${match.profile.id}`;
        card.querySelector("[data-fit-card-rank]").textContent = hasActiveOptions
          ? `#${index + 1} fit match`
          : `#${match.editorialRank} editorial`;
        card.querySelector("[data-fit-card-name]").textContent = match.profile.name;
        card.querySelector("[data-fit-card-reason]").textContent = hasActiveOptions
          ? `${match.fitScore}/100 fit - ${match.profile.tag || match.profile.bestFor || "Strong match"}`
          : (match.profile.tag || match.profile.bestFor || "Editorial starting point");
      });
    }

    function render() {
      const selectedOptions = activeOptions();
      const hasActiveOptions = selectedOptions.length > 0;
      const matches = sortMatches(products, selectedOptions);
      const winner = matches[0];

      clearHighlights();
      syncButtons();
      writeStoredKeys(selectedKeys);
      renderCards(matches.slice(0, 3), hasActiveOptions);

      if (!winner) return;

      if (hasActiveOptions) {
        winner.element.classList.add("fit-match-product");
        winner.element.setAttribute("data-fit-match", "true");
        if (winner.badge) {
          winner.badge.hidden = false;
          winner.badge.textContent = "Fit match";
        }
      }

      if (resultLabel) resultLabel.textContent = hasActiveOptions ? "Your fit match" : "Editorial starting point";
      if (resultName) resultName.textContent = winner.profile.name;
      if (resultReason) {
        const priorities = selectedOptions.map((option) => option.label.toLowerCase()).join(" + ");
        resultReason.textContent = hasActiveOptions
          ? `${winner.fitScore}/100 fit for ${priorities}. ${winner.reason}`
          : "Start with the editorial winner, or select priorities above to get a buyer-specific match from the same evidence.";
      }
      if (resultLink) {
        resultLink.href = `#${winner.profile.id}`;
        resultLink.textContent = hasActiveOptions ? "Jump to fit match" : "Jump to current pick";
      }
    }

    for (const button of buttons) {
      button.addEventListener("click", () => {
        const key = button.dataset.fitOption;
        if (!key) return;

        if (selectedKeys.includes(key)) {
          selectedKeys = selectedKeys.filter((item) => item !== key);
        } else {
          selectedKeys = [...selectedKeys, key].slice(-MAX_ACTIVE_OPTIONS);
        }

        render();
      });
    }

    clearButton?.addEventListener("click", () => {
      selectedKeys = [];
      render();
    });

    render();
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-fit-finder]").forEach(initFitFinder);
  });
})();
