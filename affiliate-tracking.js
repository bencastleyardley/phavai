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

  function cleanPayload(payload) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined && value !== "")
    );
  }

  function track(eventName, payload = {}) {
    const eventPayload = cleanPayload({
      ...payload,
      page_path: window.location.pathname,
      page_title: document.title,
      transport_type: "beacon"
    });

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, eventPayload);
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...eventPayload });
  }

  function productPayload(element) {
    return {
      event_category: "product_decision",
      event_label: element.dataset.productName || element.textContent.trim(),
      retailer: element.dataset.retailer || linkDomain(element.href),
      product_name: element.dataset.productName || "",
      guide_title: element.dataset.guide || document.title,
      site_section: element.dataset.section || "",
      product_rank: asNumber(element.dataset.productRank),
      product_score: asNumber(element.dataset.productScore),
      shopping_label: element.dataset.shoppingLabel || "",
      cta_placement: element.dataset.shoppingPlacement || "",
      link_domain: element.href ? linkDomain(element.href) : "",
      link_status: element.dataset.shoppingPending !== undefined ? "pending" : "active"
    };
  }

  document.addEventListener("click", function (event) {
    const productCta = event.target.closest("[data-product-cta]");
    if (productCta) {
      const payload = productPayload(productCta);
      if (productCta.matches("[data-affiliate-link]")) {
        track("outbound_retailer_click", {
          ...payload,
          event_category: "outbound_retailer"
        });
      } else {
        track("product_cta_click", payload);
      }
      return;
    }

    const sourceLink = event.target.closest("[data-source-link]");
    if (sourceLink) {
      const sourceType = sourceLink.dataset.sourceType || "";
      const normalizedType = sourceType.toLowerCase();
      const sourcePayload = {
        event_category: "source_trust",
        event_label: sourceLink.dataset.sourceTitle || sourceLink.textContent.trim(),
        source_type: sourceType,
        source_title: sourceLink.dataset.sourceTitle || "",
        product_name: sourceLink.dataset.productName || "",
        guide_title: sourceLink.dataset.guide || document.title,
        link_domain: linkDomain(sourceLink.href)
      };
      track("source_link_click", {
        ...sourcePayload
      });
      if (normalizedType.includes("expert")) track("expert_source_click", sourcePayload);
      if (normalizedType.includes("video") || normalizedType.includes("youtube")) track("youtube_source_click", sourcePayload);
      if (normalizedType.includes("owner") || normalizedType.includes("reddit")) track("reddit_source_click", sourcePayload);
      return;
    }

    const categoryCard = event.target.closest(".category-card");
    if (categoryCard) {
      track("category_card_click", {
        event_category: "navigation",
        event_label: categoryCard.querySelector("h3")?.textContent?.trim() || categoryCard.textContent.trim(),
        destination_path: categoryCard.getAttribute("href") || ""
      });
      return;
    }

    const detailsLink = event.target.closest("[data-view-details]");
    if (detailsLink) {
      track("view_details_click", {
        event_category: "product_decision",
        event_label: detailsLink.dataset.productName || detailsLink.textContent.trim(),
        product_name: detailsLink.dataset.productName || "",
        guide_title: detailsLink.dataset.guide || document.title
      });
    }
  });

  document.addEventListener("toggle", function (event) {
    const detail = event.target;
    if (!(detail instanceof HTMLDetailsElement) || !detail.open) return;

    if (detail.matches("[data-source-dropdown]")) {
      const sourceDrawerPayload = {
        event_category: "source_trust",
        event_label: `${detail.dataset.productName || "Product"} ${detail.dataset.sourceType || "sources"}`,
        product_name: detail.dataset.productName || "",
        source_type: detail.dataset.sourceType || "",
        guide_title: detail.dataset.guide || document.title
      };
      track("source_dropdown_opened", sourceDrawerPayload);
      track("view_sources_opened", sourceDrawerPayload);
      track("product_card_expand", {
        event_category: "product_decision",
        event_label: detail.dataset.productName || "",
        product_name: detail.dataset.productName || "",
        expansion_type: "source_drawer"
      });
      return;
    }

    if (detail.closest(".product")) {
      track("product_detail_expanded", {
        event_category: "product_decision",
        event_label: detail.closest(".product")?.dataset.productName || "",
        product_name: detail.closest(".product")?.dataset.productName || ""
      });
      track("product_card_expand", {
        event_category: "product_decision",
        event_label: detail.closest(".product")?.dataset.productName || "",
        product_name: detail.closest(".product")?.dataset.productName || "",
        expansion_type: "details"
      });
    }
  }, true);

  document.addEventListener("phavai:decision_helper", function (event) {
    track("help_me_choose_interaction", {
      event_category: "decision_helper",
      selected_priorities: event.detail?.selectedPriorities || "",
      recommended_products: event.detail?.recommendedProducts || "",
      fit_score: asNumber(event.detail?.fitScore)
    });
  });
})();
