# last30days - pi-integrated version

Research what people actually say about any topic in the last 30 days.

This is a pi-integrated adaptation of [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) that works with pi's simpler skill system. Instead of the full Python engine with social media APIs, this version uses:

- **Brave Search API** for web search (already available in your pi setup)
- **Simple synthesis** without TikTok/X/Instagram/Polymarket (requires separate API keys)

## Comparison with Full Version

| Feature | Full Skill | Pi Version |
|---------|------------|------------|
| Reddit comments | ✅ Free public API | ✅ Via Brave Search |
| Hacker News | ✅ Direct API | ✅ Via Brave Search |
| GitHub activity | ✅ API | ✅ Via Brave Search |
| X/Twitter | ✅ Browser auth or API | ❌ (requires auth) |
| TikTok/Instagram | ✅ ScrapeCreators API | ❌ (requires API key) |
| YouTube transcripts | ✅ yt-dlp | ❌ (requires yt-dlp) |
| Polymarket odds | ✅ Public API | ❌ (not implemented) |
| Comparison mode | ✅ Full template | ✅ Basic template |
| Recommendation mode | ✅ Signal-ranked | ⚠️ Basic ranking |

## Setup

Requires Brave Search API key. Set one of:
- `BRAVE_SEARCH_API_KEY` environment variable
- `~/.config/pi/brave-search-token.json` with `apiKey` field

## Usage

```bash
# Direct invocation
cd ~/.pi/agent/skills/last30days/
./scripts/last30days.sh "topic"

# Or via pi skill command
/skill:last30days "topic"
```

## Options

- `--days N` - Days to search (default: 30, options: 7, 30, 90)
- `--json` - Raw JSON output

## For Full Experience

Install the complete skill in Claude Code or other agentskills.io hosts:

```bash
npx skills add mvanhorn/last30days-skill -g
```

Requires additional setup for social media sources (see original README).