(() => {
  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function initSpecificationFilter() {
    const input = document.querySelector("[data-spec-search]");
    const status = document.querySelector("[data-spec-results]");
    const rows = Array.from(document.querySelectorAll("[data-spec-row]"));
    if (!input || !rows.length) return;

    function render() {
      const query = normalize(input.value);
      let visible = 0;

      for (const row of rows) {
        const matches = !query || normalize(row.dataset.searchText).includes(query);
        row.hidden = !matches;
        if (matches) visible += 1;
      }

      if (status) status.textContent = `${visible} product${visible === 1 ? "" : "s"} shown`;
    }

    input.addEventListener("input", render);
    render();
  }

  window.addEventListener("DOMContentLoaded", initSpecificationFilter);
})();
