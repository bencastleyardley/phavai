(function () {
  const numberFrom = (element) => Number(element?.value);
  const formatHours = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)} h`;
  const setText = (root, selector, value) => {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  };

  function announce(toolName, toolAction, resultBand, visibleResults) {
    document.dispatchEvent(new CustomEvent("phavai:data_tool_interaction", {
      detail: {
        toolName,
        toolAction,
        resultBand,
        visibleResults
      }
    }));
  }

  function initializeGpsPlanner() {
    const root = document.querySelector("[data-gps-planner]");
    const dataElement = document.querySelector("#gps-planner-data");
    if (!root || !dataElement) return;

    let modes = [];
    try {
      modes = JSON.parse(dataElement.textContent || "[]");
    } catch {
      return;
    }
    if (!Array.isArray(modes) || !modes.length) return;

    const modesById = new Map(modes.map((mode) => [mode.id, mode]));
    const form = root.querySelector("[data-gps-form]");
    const output = root.querySelector("[data-gps-output]");
    const error = root.querySelector("[data-gps-error]");
    const modeSelect = root.querySelector("[data-gps-mode]");
    const sourceLink = root.querySelector("[data-gps-source]");
    if (!form || !output || !error || !modeSelect) return;

    function showError(message, shouldTrack, action) {
      error.textContent = message;
      error.hidden = false;
      if (shouldTrack) announce("gps_battery_planner", action, "invalid", 0);
    }

    function render(shouldTrack = false, action = "calculate") {
      error.hidden = true;
      const mode = modesById.get(modeSelect.value);
      const hours = numberFrom(root.querySelector("[data-gps-hours]"));
      const minutes = numberFrom(root.querySelector("[data-gps-minutes]"));
      const startingCharge = numberFrom(root.querySelector("[data-gps-start]"));
      const reserve = numberFrom(root.querySelector("[data-gps-reserve]"));
      const contingency = numberFrom(root.querySelector("[data-gps-contingency]"));

      if (!mode || [hours, minutes, startingCharge, reserve, contingency].some((value) => !Number.isFinite(value))) {
        showError("Enter valid numbers in every scenario field.", shouldTrack, action);
        return;
      }
      if (hours < 0 || hours > 168 || minutes < 0 || minutes > 59 || hours + minutes <= 0) {
        showError("Expected elapsed time must be greater than zero and no more than 168 hours, with 0–59 minutes.", shouldTrack, action);
        return;
      }
      if (startingCharge < 1 || startingCharge > 100 || reserve < 0 || reserve > 80 || reserve >= startingCharge) {
        showError("Starting charge must be 1–100%, and finish reserve must be lower than starting charge.", shouldTrack, action);
        return;
      }
      if (contingency < 0 || contingency > 100) {
        showError("Time contingency must be between 0% and 100%.", shouldTrack, action);
        return;
      }

      const raceHours = hours + minutes / 60;
      const bufferedHours = raceHours * (1 + contingency / 100);
      const usableHours = mode.officialHours * ((startingCharge - reserve) / 100);
      const headroom = usableHours - bufferedHours;
      const finishCharge = startingCharge - (raceHours / mode.officialHours * 100);
      const minimumCharge = reserve + (bufferedHours / mode.officialHours * 100);
      const unbufferedFits = raceHours <= mode.officialHours * startingCharge / 100;
      const band = !unbufferedFits ? "recharge" : headroom < 0 ? "tight" : "fits";
      const status = band === "recharge" ? "Recharge plan needed" : band === "tight" ? "Fits only without the full buffer" : "Fits selected assumptions";
      const raceLabel = Number.isInteger(raceHours) ? `${raceHours} hours` : `${raceHours.toFixed(1)} hours`;
      const summary = band === "recharge"
        ? `${mode.watchName} in ${mode.modeLabel} is listed for up to ${mode.officialHours} hours. The ${raceLabel} scenario exceeds the claim-based runtime available from the selected starting charge.`
        : band === "tight"
          ? `${mode.watchName} in ${mode.modeLabel} is listed for up to ${mode.officialHours} hours. The ${raceLabel} scenario fits the published ceiling, but not the full contingency and finish reserve.`
          : `${mode.watchName} in ${mode.modeLabel} is listed for up to ${mode.officialHours} hours. The scenario fits the selected contingency and finish reserve on paper.`;

      output.classList.remove("planner-output--fits", "planner-output--tight", "planner-output--recharge");
      output.classList.add(`planner-output--${band}`);
      setText(root, "[data-gps-status]", status);
      setText(root, "[data-gps-summary]", summary);
      setText(root, "[data-gps-ceiling]", `${mode.officialHours.toFixed(1)} h`);
      setText(root, "[data-gps-buffered]", `${bufferedHours.toFixed(1)} h`);
      setText(root, "[data-gps-finish]", `${Math.max(0, finishCharge).toFixed(1)}%`);
      setText(root, "[data-gps-headroom]", formatHours(headroom));
      setText(root, "[data-gps-minimum]", `${minimumCharge.toFixed(1)}%`);
      setText(root, "[data-gps-fidelity]", mode.fidelityLabel);

      const selectedFactors = [...root.querySelectorAll("[data-gps-factor]:checked")]
        .map((checkbox) => checkbox.closest("label")?.querySelector("span")?.textContent?.trim())
        .filter(Boolean);
      const advisory = root.querySelector("[data-gps-advisory]");
      if (advisory) {
        const advisoryHeading = advisory.querySelector("strong");
        const advisoryCopy = advisory.querySelector("p");
        if (advisoryHeading) advisoryHeading.textContent = selectedFactors.length ? "Extra runtime risks selected" : "Before race day";
        if (advisoryCopy) advisoryCopy.textContent = selectedFactors.length
          ? `${selectedFactors.join(", ")} may shorten runtime. No unsupported drain penalty was applied; rehearse this exact setup and keep a charging contingency.`
          : "Rehearse this exact mode and feature setup on a long effort. Published maxima are not a safety guarantee.";
      }

      if (sourceLink) {
        sourceLink.href = mode.sourceUrl;
        sourceLink.dataset.sourceTitle = mode.sourceLabel;
        sourceLink.dataset.productName = mode.watchName;
      }

      document.querySelectorAll("[data-gps-mode-row]").forEach((row) => {
        const rowHours = Number(row.dataset.hours);
        const rowUnbufferedFits = raceHours <= rowHours * startingCharge / 100;
        const rowHeadroom = rowHours * ((startingCharge - reserve) / 100) - bufferedHours;
        const rowBand = !rowUnbufferedFits ? "recharge-plan" : rowHeadroom < 0 ? "tight" : "fits-assumptions";
        const rowStatus = rowBand === "recharge-plan" ? "Recharge plan" : rowBand === "tight" ? "Tight" : "Fits assumptions";
        const statusElement = row.querySelector("[data-gps-row-status]");
        if (statusElement) {
          statusElement.textContent = rowStatus;
          statusElement.className = `matrix-label matrix-label--${rowBand}`;
        }
        const headroomElement = row.querySelector("[data-gps-row-headroom]");
        if (headroomElement) headroomElement.textContent = formatHours(rowHeadroom);
      });

      if (shouldTrack) announce("gps_battery_planner", action, band, modes.length);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render(true, "calculate");
    });
    form.addEventListener("change", () => render(false));
    form.addEventListener("reset", () => window.setTimeout(() => render(true, "reset"), 0));
    render(false);
  }

  function initializeTrailMatrix() {
    const root = document.querySelector("[data-trail-matrix]");
    if (!root) return;
    const form = root.querySelector("[data-matrix-form]");
    const count = root.querySelector("[data-matrix-count]");
    const context = root.querySelector("[data-matrix-context]");
    const zero = root.querySelector("[data-matrix-zero]");
    const rows = [...root.querySelectorAll("[data-matrix-row]")];
    if (!form || !count || !context || !zero || !rows.length) return;

    const rowGroups = new Map();
    rows.forEach((row) => {
      const id = row.dataset.matrixRow;
      if (!rowGroups.has(id)) rowGroups.set(id, []);
      rowGroups.get(id).push(row);
    });

    function matchesCushion(actual, selected) {
      if (selected === "any") return true;
      if (selected === "moderate") return actual.startsWith("moderate");
      if (selected === "protective") return actual.startsWith("protective");
      return actual === selected;
    }

    function update(shouldTrack = false, action = "filter") {
      const terrain = form.elements.terrain.value;
      const forefoot = form.elements.forefoot.value;
      const cushion = form.elements.cushion.value;
      const distance = form.elements.distance.value;
      const drop = form.elements.drop.value;
      let visible = 0;

      rowGroups.forEach((group) => {
        const sample = group[0];
        const terrainValue = terrain === "any" ? "" : sample.dataset[`terrain${terrain.charAt(0).toUpperCase()}${terrain.slice(1)}`];
        const terrainMatch = terrain === "any" || terrainValue === "primary-match" || terrainValue === "capable";
        const forefootMatch = forefoot === "any" || sample.dataset.forefoot === forefoot;
        const cushionMatch = matchesCushion(sample.dataset.cushion || "", cushion);
        const distanceMatch = distance === "any" || sample.dataset.distance === distance;
        const dropMatch = drop === "any" || sample.dataset.drop === drop;
        const isVisible = terrainMatch && forefootMatch && cushionMatch && distanceMatch && dropMatch;
        group.forEach((row) => { row.hidden = !isVisible; });
        if (isVisible) visible += 1;
      });

      count.textContent = `${visible} model${visible === 1 ? "" : "s"} shown`;
      zero.hidden = visible !== 0;
      const selectedLabels = [...form.querySelectorAll("select")]
        .filter((select) => select.value !== "any")
        .map((select) => select.selectedOptions[0]?.textContent?.trim())
        .filter(Boolean);
      context.textContent = selectedLabels.length
        ? `Matching: ${selectedLabels.join(" · ")}. “Capable” is included as a terrain match; “Limited” is not.`
        : "Showing the full evidence set. “Capable” is included as a terrain match; “Limited” is not.";

      if (shouldTrack) {
        const band = visible === 0 ? "zero_results" : selectedLabels.length ? "filtered_results" : "all_results";
        announce("trail_shoe_matrix", action, band, visible);
      }
    }

    form.addEventListener("change", () => update(true, "filter"));
    form.addEventListener("reset", () => window.setTimeout(() => update(true, "reset"), 0));
    update(false);
  }

  initializeGpsPlanner();
  initializeTrailMatrix();
})();
