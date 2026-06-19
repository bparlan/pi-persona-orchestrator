#!/bin/bash
# Health check for last30days skill
# Run from ~/.pi/agent/skills/last30days/

echo "=== Last30Days Skill Health Check ==="
echo ""

# Check skill structure
echo "1. Skill Structure:"
for f in SKILL.md scripts/last30days.py scripts/last30days.sh; do
    if [ -f "$f" ]; then
        echo "   ✓ $f exists"
    else
        echo "   ✗ $f missing"
    fi
done

# Check brave-search dependency
echo ""
echo "2. Brave Search Integration:"
if [ -f "../brave-search/scripts/brave-search.py" ]; then
    echo "   ✓ brave-search.py found"
else
    echo "   ✗ brave-search.py not found at ../brave-search/scripts/"
fi

# Check API key
echo ""
echo "3. API Key Status:"
if [ -n "$BRAVE_SEARCH_API_KEY" ] || [ -n "$BRAVE_API_KEY" ]; then
    echo "   ✓ BRAVE_API_KEY set in environment"
elif [ -f ~/.config/pi/brave-search-token.json ]; then
    echo "   ✓ brave-search-token.json found"
elif [ -f ~/.config/pi/brave-search-token ]; then
    echo "   ✓ brave-search-token found"
else
    echo "   ⚠ No Brave API key configured"
    echo "   Set BRAVE_SEARCH_API_KEY or create ~/.config/pi/brave-search-token.json"
fi

# Check Python version
echo ""
echo "4. Python Version:"
python3 --version

# Test dry-run
echo ""
echo "5. Dry Run Test (uses --help flag):"
python3 scripts/last30days.py --help

echo ""
echo "=== Skill ready ==="