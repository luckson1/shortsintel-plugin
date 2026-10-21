# ShortsIntel

ShortsIntel is our own analysis of public short-form video, creator and ad data on TikTok, Instagram Reels, YouTube Shorts and Facebook. This repository connects an AI assistant (Claude, ChatGPT or Codex) to the ShortsIntel server and adds three skills, so you can ask in plain language and the assistant picks the right tools.

## What's inside

- **Connection**: the ShortsIntel remote server at `https://www.shortsintel.com/api/mcp`, with tools for searching and looking up videos, creators, hashtags, sounds and comments, running Research, tracking targets, organising Collections, searching ad libraries, and reading your balance and usage.
- **Skills** (shared by both formats, under `skills/`):
  - `niche-research`: turns "what's working in my niche" into a Research and a short summary of themes, hooks and angles.
  - `tracking`: tracks creators, hashtags, sounds and Meta advertisers, groups them into Collections, and reports what changed.
  - `ad-research`: searches the Meta Ad Library and the TikTok ad library and summarises the ads.
- **Icons** in `assets/`.

There are no hooks, local servers or binaries. The package is Markdown, JSON and PNG. `scripts/` holds the release build script, which is not part of either package.

### Layout

| File | Used by |
| --- | --- |
| `.claude-plugin/plugin.json`, `.mcp.json` | Claude Code, Cowork, claude.ai |
| `plugin.json`, `mcp.json`, `assets/` | OpenAI Agent Plugins (ChatGPT, Codex) |
| `skills/` | both |

## Install

**Claude.** Install ShortsIntel from the Claude plugin directory, then connect it when asked. To try this repository directly in Claude Code:

```bash
git clone https://github.com/luckson1/shortsintel-plugin
claude --plugin-dir ./shortsintel-plugin
```

**ChatGPT and Codex.** Install ShortsIntel from the plugin directory. To test a local copy, add the cloned folder to a local marketplace (`~/.agents/plugins/marketplace.json`) with `"source": {"source": "local", "path": "./path/to/shortsintel-plugin"}`.

## Sign in

The first time the assistant calls a ShortsIntel tool, you sign in to your ShortsIntel account through OAuth in your browser. No API key, client secret or token is stored in this package.

## Credits

Free tools (balance, usage, reading Trackers, Collections, Change Reports and past Research) cost nothing. Paid tools, such as Research, searches, lookups, tracking cycles and ad searches, spend Credits from your ShortsIntel balance. Every paid tool accepts an estimate option that returns the cost in Credits without running anything, and the skills tell the assistant to state the cost before a paid call. Ask the assistant for your balance at any time.

## Data and privacy

The package connects to one service only: `www.shortsintel.com`. It sends your queries and the ids, handles, URLs and settings you ask about (for example a keyword, a creator handle or a Tracker id), together with your OAuth access token. It does not read files, other conversations or personal data from your machine, and it sends nothing to any other service. Results come back from ShortsIntel into your conversation. ShortsIntel keeps data as described in its [privacy policy](https://www.shortsintel.com/privacy).

## Example prompts

1. "What hooks are working for AI video tools on TikTok this week?"
2. "Track @nike on TikTok and tell me what changed since yesterday."
3. "Show me Meta ads running for protein powder in the US."

## Links

- Docs: https://www.shortsintel.com/docs/mcp
- Website: https://www.shortsintel.com
- Support: https://www.shortsintel.com/support
- Privacy policy: https://www.shortsintel.com/privacy
- Terms: https://www.shortsintel.com/terms
- Security reports: https://www.shortsintel.com/.well-known/security.txt

## Release (OpenAI)

Each upload to platform.openai.com/plugins must carry a new version.

1. Bump `version` in `plugin.json` (semver) and keep `.claude-plugin/plugin.json` at the same version.
2. Run `node scripts/build-openai-zip.mjs`. It checks the listing limits and writes `dist/shortsintel-openai-<version>.zip`, with `plugin.json` at the ZIP root. It exits non-zero and lists every problem if a check fails.
3. Upload the ZIP at platform.openai.com/plugins and fix any scan findings.

`node scripts/build-openai-zip.test.mjs` proves the checks reject bad manifests. On the Claude side, run `claude plugin validate .`.

## License

MIT. See [LICENSE](LICENSE).
