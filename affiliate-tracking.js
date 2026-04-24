(function () {
  function asNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function linkDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest("[data-affiliate-link]");
    if (!link) return;

    const payload = {
      event_category: "affiliate",
      event_label: link.dataset.productName || link.textContent.trim(),
      retailer: link.dataset.retailer || linkDomain(link.href),
      product_name: link.dataset.productName || "",
      guide_title: link.dataset.guide || document.title,
      site_section: link.dataset.section || "",
      product_rank: asNumber(link.dataset.productRank),
      product_score: asNumber(link.dataset.productScore),
      link_domain: linkDomain(link.href),
      page_path: window.location.pathname,
      transport_type: "beacon"
    };

    if (typeof window.gtag === "function") {
      window.gtag("event", "affiliate_click", payload);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "affiliate_click", ...payload });
    }
  });
})();
