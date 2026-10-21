---
name: niche-research
description: Research what is working in a short-form video niche on TikTok, Instagram Reels, YouTube Shorts or Facebook, using the ShortsIntel connector. Use when the user asks what hooks, formats, angles, creators, hashtags or sounds are performing for a topic, product category or audience, or wants a summary of an earlier ShortsIntel Research.
---

# Niche research

Turn a question like "what's working for AI video tools on TikTok this week?" into one ShortsIntel Research and a short, readable summary.

## Terms

- **Research**: a paid Run that searches the platforms for an intent, drops off-topic videos, ranks the rest by how far each beat its creator's usual reach, analyses the shortlist and returns a Digest (themes, verbatim hooks, winning formulas, audience gaps, recommended angles).
- **Run**: one unit of charged work. Its result stays readable for free.
- **Credits**: the unit every price is counted in. Each paid tool's description states its price.

## Steps

1. **Check for an earlier Research.** If the user refers to a Research they already ran, or `get_usage` shows a recent one on the same topic, read it with `get_research` (free) instead of running a new one.
2. **Pin down the brief.** Get the intent (topic, product or audience), the platforms if the user named any, and the time window ("this week" means a week). Ask only if the topic is unclear.
3. **Quote the price first.** Call `research` with `estimate: true` and tell the user the price in Credits. Run it only after they agree, or when they already asked you to go ahead. `get_balance` shows what they have left.
4. **Run it.** Call `research`. It waits up to about a minute, then may return a run id; poll `get_run` every 5 to 15 seconds until it is completed or partial.
5. **Drill in for free.** Use `get_research` with an aspect (`digest`, `videos`, `creators`, `hashtags`, `sounds`) and filters, such as TikTok only or over 100k views, to answer follow-up questions without paying again.

For a quick look at a single keyword instead of a full Research, `search_videos` is cheaper; to judge one video, use `get_video` or `score_video`. State the price before each paid call.

## Output

Keep it short:

- 3 to 5 themes or formulas, each with one verbatim hook and a linked example video.
- Standout creators, hashtags or sounds, one line each.
- 2 or 3 recommended angles.
- The Credits spent, and the run id so the user can ask follow-ups.

Do not paste raw tool output.
