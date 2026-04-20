# Phavai Scoring Model

Phavai should optimize for defensible recommendations, not artificially high scores. A score must be reproducible from visible evidence on the page.

## Current Production Rule

BestPick Score is generated at build time from each product's `evidence` items. The scoring pipeline has two stages:

```text
Channel Score = sum(evidence score * evidence quality weight) / sum(evidence quality weights)
BestPick Score = sum(channel score * category channel weight) / sum(available category channel weights)
```

Evidence scores are normalized to a 0-100 scale before weighting. If a channel is missing, the remaining channel weights are normalized by the total available weight instead of filling the missing channel with a guess.

Each evidence item must include a `verifiedAt` date so readers can see when Phavai last checked the source. Category pages also expose the newest source verification pass near the page update date.

Default channel weights:

- Expert reviews: 40%
- YouTube reviews: 30%
- Reddit sentiment: 30%

These weights are defaults, not permanent law. A category can override them when the source landscape is materially different. Trail running currently uses 40% Expert, 30% YouTube, and 30% Reddit. Social is excluded until Phavai has a reliable API-backed collection process.

## User-Adjustable Weights

Category pages can expose scoring sliders for active channels. The client-side calculator normalizes the selected weights to 100%, recalculates BestPick and consensus in the browser, saves the preference to `localStorage`, and reorders the visible ranking.

This does not change the underlying evidence. It lets readers apply their own trust model to the same transparent source data.

## Evidence Quality Weight

Each evidence item receives an internal quality weight:

```text
Evidence Quality Weight = reviewer tier weight * freshness weight * sample weight * category relevance
```

Current reviewer tier weights:

- Tier 1: 1.00
- Tier 2: 0.78
- Tier 3: 0.58

Freshness decays by age from the category update date. Sample weight increases with sample size but is capped so crowd volume cannot overpower expert evidence by itself. Category relevance is a 0.35-1.00 editorial field that indicates how directly the evidence applies to the product and use case.

## Consensus

Consensus measures cross-channel agreement, not popularity. It is calculated from the weighted standard deviation of channel scores:

```text
Consensus = 100 - (weighted standard deviation * 4)
```

The result is clamped to 0-100. A product can have a high BestPick Score and lower consensus when experts and real owners disagree.

## Signal Strength

Signal Strength is intentionally separate from BestPick. It tells readers how much confidence to place in the evidence base and is computed at build time.

Signal currently reflects:

- Source count
- Source freshness
- Channel diversity
- Reviewer tier quality
- Sample strength
- Channel depth

Signal is expressed on a 1-5 scale with one decimal place.

A 5/5 should be rare. The current formula does not give full credit for source count or channel depth until a product has roughly a dozen evidence items across the category's expected channels.

## Guardrails

- Never hand-enter a final BestPick Score.
- Never hand-enter Signal Strength.
- Never let affiliate availability affect score, rank, verdict, or source weighting.
- Show channel rollups and evidence-level details beside the score.
- Show last verified dates for evidence items.
- Do not include Social until the source set can be collected, de-duplicated, and audited reliably.
- Do not compare BestPick Scores across unrelated categories.
- Lower confidence should be visible to readers, even when a product ranks well.

## Next Upgrade

Improve evidence collection quality:

1. Keep Social out of rankings until there is an auditable source collection pipeline.
2. Add quote-safe paraphrase provenance and source extraction notes.
3. Track dimension-level product scores such as grip, cushion, durability, fit, value, and support.
4. Add category-specific scoring dimensions in addition to category-specific channel weights.
5. Add automated tests that fail when final scores cannot be reproduced from evidence.
