#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting SCA Agent Full Stack...${NC}"
echo ""

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_DIR"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating default .env...${NC}"
    cat > .env << 'ENVEOF'
# LLM Configuration (LM Studio)
LLM_API_URL=http://localhost:1234/v1
LLM_MODEL=google/gemma-3-12b

# RAG API Configuration
RAG_API_URL=http://localhost:3000

# SCA Agent Server Configuration
PORT=4000
ENVEOF
    echo -e "${GREEN}✅ Created .env file${NC}"
fi

# Load environment variables
set -a
source .env
set +a

# Check services
echo -e "${BLUE}🔍 Checking required services...${NC}"
echo ""

# Check Test Forum
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test Forum (port 3001) is running${NC}"
else
    echo -e "${YELLOW}⚠️  Test Forum not running. Starting...${NC}"
    cd "$PROJECT_DIR/../test-forum" && npm start > /tmp/test-forum.log 2>&1 &
    FORUM_PID=$!
    echo "   Test Forum started (PID: $FORUM_PID)"
    sleep 2
    cd "$PROJECT_DIR"
fi

# Check RAG API
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ RAG API (port 3000) is running${NC}"
else
    echo -e "${RED}❌ RAG API (port 3000) is not running${NC}"
    echo "   Start it with: cd .. && docker-compose up nestjs-api"
    exit 1
fi

# Check LM Studio
if curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}✅ LM Studio (port 1234) is running${NC}"
else
    echo -e "${RED}❌ LM Studio (port 1234) is not running${NC}"
    echo "   Please start LM Studio and load the Gemma model"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo -e "${BLUE}🚀 Starting SCA Agent API server on port ${PORT:-4000}...${NC}"
echo ""

# Start SCA Agent server
npm run dev
