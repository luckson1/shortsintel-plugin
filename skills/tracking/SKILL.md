---
name: tracking
description: Track TikTok, Instagram or Facebook creators, TikTok or Instagram hashtags, TikTok sounds and Meta advertisers with ShortsIntel Trackers, group them into Collections, and report what changed. Use when the user wants to monitor, follow or keep an eye on an account, hashtag, sound or advertiser, or asks what changed since a given time.
---

# Tracking and what changed

## Terms

- **Tracker**: a standing daily check on one creator, hashtag, sound or Meta advertiser. Each cycle is a paid Run. A user has at most one Tracker per target.
- **Change Report**: what a cycle found different from the last one, such as new videos, outliers, follower moves, view or video-count shifts, and new or stopped ads.
- **Collection**: a named set of Trackers of one kind, such as "Competitors". It is only a grouping: each Tracker is charged once per cycle however many Collections it is in.
- **Credits**: the unit every price is counted in. Each paid tool's description states its price.

## Start tracking

1. Call `list_trackers` (free) first. If the target is already tracked, use that Tracker instead of creating one.
2. Call `track` with `estimate: true` and tell the user the price per daily cycle in Credits. Creating a Tracker runs and charges the first cycle at once, and every later cycle is charged too, so confirm before creating it.
3. Call `track` with the kind, platform and target (handle, tag, sound id or Facebook Page id). Pass `collection` to also put it in a Collection by name.
4. Mention that analysis of new videos (`set_tracker_intelligence`) costs extra Credits per video, and only switch it on if the user asks.

## Report what changed

1. Call `get_changes` (free) for the Tracker, or for a whole Collection by name, with `since` set to the time the user means ("since yesterday" means 24 hours ago).
2. If the user wants fresh numbers now rather than waiting for the next daily cycle, `track` with `refresh: true` and the `tracker_id` runs a cycle now at the same price. Say the price first.

## Manage

- Pause or resume: `set_tracker_state` (free). Paused Trackers are not charged.
- Inspect one: `get_tracker` (free).
- Collections: `list_collections`, `create_collection`, `rename_collection`, `add_to_collection`, `remove_from_collection`. Adding a target that is not tracked yet starts a paid Tracker, so say the price first.
- Bulk pause, resume, refresh or analysis for every member: `act_on_collection`. A refresh is charged per member; quote it with `estimate` first.
- Delete: `delete_tracker` or `delete_collection`. Deletion is final, so confirm with the user first.

## Output

Lead with what changed, newest first, with before and after numbers and a link per item. Group by Tracker. If nothing changed, say so in one line. Keep it to a short list.
