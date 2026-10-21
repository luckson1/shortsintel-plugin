---
name: ad-research
description: Research competitor and category ads in the Meta Ad Library and the TikTok ad library with the ShortsIntel connector. Use when the user asks which ads a brand or advertiser is running, what ads are running for a keyword or product in a country, which ads look like winners, or wants a Meta ad or advertiser looked up.
---

# Ad research

Answer requests like "show me Meta ads running for 'protein powder' in the US" with a short, sorted list of ads.

## Terms

- **Credits**: the unit every price is counted in. Each paid tool's description states its price. Meta results are charged per ad delivered; TikTok results per page.
- **Winner score**: a 0 to 100 score on each Meta ad, from how long it has run and how many variants the advertiser added, relative to that advertiser's other ads.

## Steps

1. **Pick the library and query.** Meta Ad Library unless the user says TikTok. Search by keyword or by advertiser, exactly one. For Meta, set `country` when the user names one, and keep the defaults (active, commercial) unless they ask otherwise.
2. **Quote the price first.** Call `search_ads` with `estimate: true` and tell the user the price in Credits for the number of ads you plan to fetch. Start with a small `limit` and offer more with `next_cursor`.
3. **Search.** Call `search_ads`. Use `order_by: "winner"` or `"days_running"` when the user wants the best-performing ads.
4. **Go deeper only when asked.** `analyze: true` on Meta adds analysis of hook, offer, CTA and format for extra Credits per ad. `get_ad` looks up one Meta ad by `library_id`, or one advertiser by Facebook `page_id`. Say the price before each paid call.
5. **Keep watching.** To follow an advertiser's new and stopped ads daily, use the tracking skill (`track` with kind `advertiser`).

## Output

A compact list or table: advertiser, first line of copy, CTA, format, days running, winner score, and a link to the ad. Then 2 or 3 patterns across the set (angles, offers, formats). State the Credits spent. Do not paste raw tool output.
