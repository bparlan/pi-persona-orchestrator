# init-spec-project.sh - Instantly scaffolds a simple Pi project

echo "Initializing Project..."

# 1. Create directory structure
mkdir -p src/ tests/

# 2. Initialize Git
git init
touch .gitignore README.md
cat << 'EOF' > .gitignore
# Python
__pycache__/
*.py[cod]
.venv/
.env
.pytest_cache/
.coverage
.DS_Store

# Node
node_modules/
npm-debug.log

# Pi agent
.pi/
EOF

echo "Project initialized. src/ and tests/ directories created."