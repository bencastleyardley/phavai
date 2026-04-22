(function () {
  document.addEventListener("toggle", (event) => {
    const detail = event.target;
    if (!(detail instanceof HTMLDetailsElement)) return;
    if (!detail.classList.contains("quick-source-drop") || !detail.open) return;

    const group = detail.closest(".quick-source-actions");
    if (!group) return;

    for (const sibling of group.querySelectorAll(".quick-source-drop[open]")) {
      if (sibling !== detail) sibling.open = false;
    }
  }, true);

  const controls = document.querySelector("[data-score-controls]");
  const list = document.querySelector("[data-product-list]");
  if (!controls || !list) return;

  const storageKey = `phavai.scoreWeights.${location.pathname}`;
  const inputs = Array.from(controls.querySelectorAll("[data-weight-input]"));
  const defaults = Object.fromEntries(inputs.map((input) => [input.dataset.weightInput, Number(input.value)]));
  const saveNote = controls.querySelector("[data-save-note]");
  const products = Array.from(document.querySelectorAll(".product")).map((element) => ({
    element,
    name: element.dataset.productName,
    defaultScore: Number(element.dataset.defaultScore),
    scores: JSON.parse(element.dataset.channelScores || "{}")
  }));
  const defaultOrder = products.map((product) => product.name);

  function loadSavedWeights() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  }

  function saveWeights(message) {
    const raw = Object.fromEntries(inputs.map((input) => [input.dataset.weightInput, Number(input.value)]));
    localStorage.setItem(storageKey, JSON.stringify(raw));
    if (message && saveNote) saveNote.textContent = message;
  }

  function applySavedWeights() {
    const saved = loadSavedWeights();
    if (!saved) return;

    for (const input of inputs) {
      const value = saved[input.dataset.weightInput];
      if (typeof value === "number") input.value = value;
    }
  }

  function normalizeWeights() {
    const raw = Object.fromEntries(inputs.map((input) => [input.dataset.weightInput, Number(input.value)]));
    const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
    const safeTotal = total || 1;

    return Object.fromEntries(
      Object.entries(raw).map(([channel, value]) => [channel, value / safeTotal])
    );
  }

  function weightedScore(scores, weights) {
    let total = 0;
    let usedWeight = 0;

    for (const [channel, weight] of Object.entries(weights)) {
      if (typeof scores[channel] !== "number") continue;
      total += scores[channel] * weight;
      usedWeight += weight;
    }

    return usedWeight ? total / usedWeight : 0;
  }

  function consensus(scores, weights, mean) {
    let variance = 0;
    let usedWeight = 0;

    for (const [channel, weight] of Object.entries(weights)) {
      if (typeof scores[channel] !== "number") continue;
      variance += weight * Math.pow(scores[channel] - mean, 2);
      usedWeight += weight;
    }

    if (!usedWeight) return 0;
    return Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance / usedWeight) * 4)));
  }

  function updateWeightLabels(weights) {
    for (const input of inputs) {
      const channel = input.dataset.weightInput;
      const label = controls.querySelector(`[data-weight-label="${channel}"]`);
      if (label) label.textContent = `${Math.round(weights[channel] * 100)}%`;
    }
  }

  function updateMiniRanks(ranked) {
    const miniRanks = new Map(
      Array.from(document.querySelectorAll("[data-mini-rank]")).map((element) => [
        element.dataset.miniRank,
        element
      ])
    );

    ranked.forEach((product, index) => {
      const mini = miniRanks.get(product.name);
      if (!mini) return;
      mini.querySelector("span").textContent = `#${index + 1} ${product.name}`;
      mini.querySelector("strong").textContent = String(Math.round(product.score));
      mini.parentElement.appendChild(mini);
    });
  }

  function strongestWeightSummary(weights) {
    const sorted = Object.entries(weights)
      .map(([channel, weight]) => ({ channel, percent: Math.round(weight * 100), weight }))
      .sort((a, b) => b.weight - a.weight);
    const topWeight = sorted[0]?.weight ?? 0;
    const leaders = sorted.filter((row) => Math.abs(row.weight - topWeight) < 0.005);

    if (leaders.length > 1) {
      return `${leaders.map((row) => row.channel).join(" and ")} evenly (${leaders[0].percent}%)`;
    }

    return `${sorted[0].channel} (${sorted[0].percent}%)`;
  }

  function updateRankingNote(ranked, weights) {
    const note = controls.querySelector("[data-ranking-note]");
    if (!note) return;

    const sameOrder = ranked.every((product, index) => product.name === defaultOrder[index]);
    if (sameOrder) {
      note.textContent = "Ranking matches the Phavai editorial default.";
      return;
    }

    const changed = ranked
      .map((product, index) => ({
        name: product.name,
        currentRank: index + 1,
        defaultRank: defaultOrder.indexOf(product.name) + 1
      }))
      .filter((product) => product.currentRank !== product.defaultRank)
      .sort((a, b) => Math.abs(b.defaultRank - b.currentRank) - Math.abs(a.defaultRank - a.currentRank))[0];

    const movement = changed
      ? ` ${changed.name} moved from #${changed.defaultRank} to #${changed.currentRank}.`
      : "";

    note.textContent = `Ranking changed because your weights emphasize ${strongestWeightSummary(weights)}.${movement}`;
  }

  function recalculate({ persist = true } = {}) {
    const weights = normalizeWeights();
    updateWeightLabels(weights);
    if (persist) saveWeights();

    const ranked = products
      .map((product) => {
        const score = weightedScore(product.scores, weights);
        const agreement = consensus(product.scores, weights, score);
        return { ...product, score, consensus: agreement };
      })
      .sort((a, b) => {
        if (Math.round(b.score) !== Math.round(a.score)) return b.score - a.score;
        const expertDelta = (b.scores.Expert || 0) - (a.scores.Expert || 0);
        if (Math.abs(expertDelta) >= 0.1) return expertDelta;
        if (b.score !== a.score) return b.score - a.score;
        return b.consensus - a.consensus;
      });

    ranked.forEach((product, index) => {
      product.element.querySelector("[data-rank]").textContent = `#${index + 1}`;
      product.element.querySelector("[data-bestpick]").textContent = String(Math.round(product.score));
      product.element.querySelector("[data-consensus]").textContent = `${product.consensus}%`;
      product.element.querySelector("[data-raw-score]").textContent = product.score.toFixed(1);
      const delta = Math.round(product.score) - product.defaultScore;
      product.element.querySelector("[data-score-delta]").textContent = delta > 0 ? `+${delta}` : String(delta);
      list.appendChild(product.element);
    });

    updateMiniRanks(ranked);
    updateRankingNote(ranked, weights);
  }

  for (const input of inputs) {
    input.addEventListener("input", recalculate);
  }

  controls.querySelector("[data-save-weights]")?.addEventListener("click", () => {
    saveWeights("Preference saved in this browser.");
  });

  controls.querySelector("[data-reset-weights]")?.addEventListener("click", () => {
    for (const input of inputs) {
      input.value = defaults[input.dataset.weightInput];
    }
    localStorage.removeItem(storageKey);
    if (saveNote) saveNote.textContent = "Editorial default restored. No custom preference is saved.";
    recalculate({ persist: false });
  });

  applySavedWeights();
  recalculate();
})();
