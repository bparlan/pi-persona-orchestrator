---
name: last30days
description: "Research what people actually say about any topic in the last 30 days. Searches web, news, Reddit, Hacker News, GitHub - wherever recent conversation exists. Uses Brave Search API as primary provider."
argument-hint: 'last30days nvidia earnings reaction | last30days AI video tools | last30days react patterns'
allowed-tools: Bash, Read, WebSearch
homepage: https://github.com/mvanhorn/last30days-skill
license: MIT
user-invocable: true
metadata:
  emoji: "📰"
  tags:
    - research
    - deep-research
    - recency
    - news
    - analysis
    - web-search
---

# /last30days - Recent Conversation Research

Research what people actually say about any topic in the last 30 days. Finds discussions, news, and community reactions - not editorial summaries.

## Auth

Uses `~/.pi/agent/skills/brave-search/scripts/brave-search.py` for web search via Brave Search API. API key read from:

1. `$BRAVE_API_KEY` or `$BRAVE_SEARCH_API_KEY`
2. `~/.config/pi/brave-search-token.json`
3. `~/.config/pi/brave-search-token`

For web content extraction, set `$OPENROUTER_API_KEY` or use any key that works with your pi provider.

## Usage

```bash
# From the skill directory (preferred)
cd ~/.pi/agent/skills/last30days/
./scripts/last30days.sh "topic"

# Or invoke via skill command
/skill:last30days "topic"
```

The script searches multiple sources in parallel and synthesizes findings.

## Search Sources

| Source | Query Pattern | Notes |
|--------|---------------|-------|
| Web | `{topic} 2026 site:reddit.com OR site:hackernews OR site:twitter.com OR "past week"` | Community discussions |
| News | `{topic} past month` | Editorial coverage |
| Fresh | `{topic} site:github.com "last week"` | Recent code activity |

## Invocation

When invoked, I will:

1. **Discover handles/entities** - Find relevant @handles, subreddits, GitHub repos for the topic
2. **Run parallel searches** - Query multiple sources simultaneously with recency bias
3. **Score by engagement** - Rank results by upvotes, likes, comments, views where available
4. **Synthesize findings** - Transform evidence into concise narrative with citations
5. **Suggest follow-ups** - Offer specific questions based on what surfaced

## Query Types

### GENERAL - Topic research
```
/last30days nvidia earnings reaction
```

### COMPARISON - Side-by-side analysis
```
/last30days OpenAI vs Anthropic
/last30days React vs Svelte
```

### RECOMMENDATIONS - What people recommend
```
/last30days best AI video tools 2026
/last30days coding agents for mac
```

## Output Contract

**Badge (first line):**
```
🌐 last30days · synced 2026-MM-DD
```

**General/News format:**
```
What I learned:

**{Headline phrase}** - {1-2 sentences with sources}

KEY PATTERNS from the research:
1. {Pattern} - per [@handle](url)
2. {Pattern} - per [r/sub](url)
```

**Comparison format:**
```
# {Topic A} vs {Topic B}: What the Community Says (/Last30Days)

## Quick Verdict
{One paragraph with scale stats + community framing}

## {Entity 1}
Community Sentiment: {Positive/Mixed/Negative}
**Strengths:** ...
**Weaknesses:** ...
```

## Notes

This pi-integrated version provides core last30days functionality via Brave Search. For full social media coverage (X/Twitter, TikTok, Instagram, YouTube, Polymarket), install the [full last30days-skill](https://github.com/mvanhorn/last30days-skill) in Claude Code or other agentskills.io-compatible hosts.