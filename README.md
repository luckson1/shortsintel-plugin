# ShortsIntel plugin

ShortsIntel is first-party analysis of public short-form video, creator and ad data on TikTok, Instagram Reels, YouTube Shorts and Facebook, served from the ShortsIntel API. This plugin connects Claude to the ShortsIntel MCP server and adds three skills, so you can ask in plain language and Claude picks the right tools.

## What's inside

- **Connector**: the ShortsIntel remote MCP server at `https://www.shortsintel.com/api/mcp`, with tools for searching and looking up videos, creators, hashtags, sounds and comments, running Research, tracking targets, organising Collections, searching ad libraries, and reading your balance and usage.
- **Skills**:
  - `niche-research`: turns "what's working in my niche" into a Research and a short summary of themes, hooks and angles.
  - `tracking`: tracks creators, hashtags, sounds and Meta advertisers, and reports what changed.
  - `ad-research`: searches the Meta Ad Library and the TikTok ad library and summarises the ads.

The plugin has no hooks, scripts or local servers. It is only Markdown and JSON.

## Install

Install ShortsIntel from the Claude plugin directory on claude.ai, in Cowork or in Claude Code, then connect ShortsIntel from the plugin's Connectors tab when asked. To try this repository directly in Claude Code, clone it and start a session with it loaded:

```bash
git clone https://github.com/luckson1/shortsintel-plugin
claude --plugin-dir ./shortsintel-plugin
```

## Sign in

The first time Claude calls a ShortsIntel tool, you sign in to your ShortsIntel account through OAuth in your browser. No API key is stored in the plugin. New accounts get a Starter Grant of free Credits.

## Credits

Free tools (balance, usage, listing and reading Trackers, Collections, Change Reports and past Research) cost nothing. Paid tools, such as Research, searches, lookups, tracking cycles and ad searches, spend Credits from your ShortsIntel balance. Every paid tool accepts an estimate option that returns the price without running anything, and the skills tell Claude to quote the price before a paid call. Check your balance any time by asking Claude, or in the ShortsIntel console.

## Data and privacy

The plugin connects to one service only: `www.shortsintel.com`. It sends your queries and the ids, handles, URLs and settings you ask about (for example a keyword, a creator handle or a Tracker id), together with your OAuth access token. It does not read files, other conversations or personal data from your machine, and it sends nothing to any other service. Results come back from ShortsIntel into your conversation. ShortsIntel keeps data as described in its [privacy policy](https://www.shortsintel.com/privacy).

## Example prompts

1. "What hooks are working for AI video tools on TikTok this week?"
2. "Track @creator on TikTok and tell me what changed since yesterday."
3. "Show me Meta ads running for 'protein powder' in the US."

## Links

- MCP docs: https://www.shortsintel.com/docs/mcp
- Website: https://www.shortsintel.com
- Privacy policy: https://www.shortsintel.com/privacy
- Terms: https://www.shortsintel.com/terms
- Support: support@shortsintel.com
- Security reports: https://www.shortsintel.com/.well-known/security.txt

## License

MIT. See [LICENSE](LICENSE).
