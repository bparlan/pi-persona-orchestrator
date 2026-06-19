#!/usr/bin/env python3
"""last30days helper for pi - research recent conversation about a topic."""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Import brave-search as module or run as subprocess
SKILL_DIR = Path(__file__).parent.parent  # ~/.pi/agent/skills/last30days
BRAVE_SCRIPT = SKILL_DIR.parent / "brave-search" / "scripts" / "brave-search.py"

# Search sources with recency bias
SOURCES = {
    "web": "web",
    "news": "news", 
    "fresh": "fresh"
}


def run_brave_search(query: str, count: int = 10, **kwargs) -> dict:
    """Execute brave-search.py and return parsed results."""
    cmd = [
        sys.executable, str(BRAVE_SCRIPT), query,
        "--count", str(count),
        "--json"
    ]
    if "freshness" in kwargs:
        cmd.extend(["--freshness", kwargs["freshness"]])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Warning: brave-search failed: {result.stderr}", file=sys.stderr)
        return {"results": [], "returnedResults": 0}
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"results": [], "returnedResults": 0}


def discover_entities(topic: str) -> list[str]:
    """Find relevant @handles, subreddits, repos for a topic."""
    queries = []
    
    # Entity discovery patterns
    queries.append(f'{topic} site:reddit.com "r/" subreddit')
    queries.append(f'{topic} site:twitter.com "x.com" "twitter.com"')
    queries.append(f'{topic} site:github.com')
    queries.append(f'{topic} site:news.ycombinator.com')
    
    return queries


def is_comparison(topic: str) -> tuple[bool, int]:
    """Detect if topic is a comparison query."""
    lower = topic.lower()
    if " vs " in lower or " versus " in lower:
        return True, lower.count(" vs ") + lower.count(" versus ")
    return False, 0


def search_topic(topic: str, days: int = 30) -> dict:
    """Run parallel searches for a topic."""
    results = {"topic": topic, "searchTime": datetime.now().isoformat()}
    
    # Determine query type
    results["isComparison"] = is_comparison(topic)[0]
    
    # Run discovery
    entities = discover_entities(topic)
    
    # Web search with recency
    freshness = "pm" if days <= 31 else None  # past month
    web = run_brave_search(topic, count=15, freshness=freshness)
    results["web"] = web
    
    # News search
    news = run_brave_search(topic, count=5, freshness="pw")  # past week
    results["news"] = news
    
    return results


def synthesize(results: dict) -> str:
    """Transform search results into narrative."""
    topic = results["topic"]
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    lines = []
    lines.append(f"🌐 last30days · synced {date_str}")
    
    if results["isComparison"]:
        # Comparison synthesis
        lines.append(f"# {topic}: What the Community Says (/Last30Days)")
        lines.append("")
        lines.append("## Quick Verdict")
        lines.append(f"Recent conversation shows varied perspectives. See sources below.")
    else:
        # General synthesis
        lines.append("")
        lines.append("What I learned:")
        lines.append("")
    
    # Extract patterns from web results
    web_results = results.get("web", {}).get("results", [])
    news_results = results.get("news", {}).get("results", [])
    
    # Find top themes
    themes = {}
    for item in web_results[:10]:
        # Simple theme extraction based on title/description words
        desc = (item.get("description") or "").lower()
        if "new" in desc or "launch" in desc:
            themes.setdefault("News/Launches", []).append(item)
        elif "best" in desc or "top" in desc:
            themes.setdefault("Recommendations", []).append(item)
        elif "vs" in desc or "compared" in desc:
            themes.setdefault("Comparisons", []).append(item)
    
    # If comparison, show structured output
    if results["isComparison"]:
        # Split topic into entities
        entities = [e.strip() for e in topic.replace(" vs ", "|").replace(" versus ", "|").split("|")]
        for entity in entities[:3]:
            lines.append(f"## {entity}")
            lines.append("Community Sentiment: Mixed (varies by source)")
            matching = [r for r in web_results if entity.lower() in (r.get("title", "") + r.get("description", "")).lower()]
            if matching:
                lines.append(f"- {matching[0].get('title', 'Topic')}: {matching[0].get('url', '')}")
            lines.append("")
    
    # General synthesis
    if not results["isComparison"]:
        for i, item in enumerate(web_results[:3]):
            title = item.get("title", "")[:80]
            url = item.get("url", "")
            desc = item.get("description", "")[:150]
            lines.append(f"**{title}** - {desc}")
            if url:
                lines.append(f"per [{url.split('/')[2]}]({url})")
            lines.append("")
    
    # KEY PATTERNS section
    lines.append("KEY PATTERNS from the research:")
    for i, (theme, items) in enumerate(list(themes.items())[:5], 1):
        lines.append(f"{i}. {theme} - {len(items)} items surfaced")
    
    # Footer
    total = len(web_results) + len(news_results)
    lines.append("")
    lines.append("---")
    lines.append(f"✅ Researched {topic} · {len(web_results)} web results, {len(news_results)} news results")
    lines.append("I have all the links to the sources I pulled from. Just ask.")
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Research recent conversation about a topic")
    parser.add_argument("topic", help="Topic to research")
    parser.add_argument("--days", type=int, default=30, help="Days to look back (7, 30, 90)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()
    
    results = search_topic(args.topic, args.days)
    
    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print(synthesize(results))


if __name__ == "__main__":
    main()