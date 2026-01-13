#!/bin/bash

echo "========================================="
echo "N8N + Ollama Integration Test"
echo "========================================="
echo ""

# Configuration
N8N_WEBHOOK="https://ai.realsolutions.ai/webhook/chat/ollama"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check Ollama is running
echo "Test 1: Checking Ollama container..."
if docker ps | grep -q ollama; then
    echo -e "${GREEN}✅ Ollama container is running${NC}"
else
    echo -e "${RED}❌ Ollama container is not running${NC}"
    echo "   Starting Ollama..."
    docker start ollama || docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama ollama/ollama:latest
    sleep 3
fi
echo ""

# Test 2: Check Ollama API
echo "Test 2: Checking Ollama API..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo -e "${GREEN}✅ Ollama API is accessible${NC}"
else
    echo -e "${RED}❌ Ollama API is not accessible${NC}"
fi
echo ""

# Test 3: Check if llama3.2 is available
echo "Test 3: Checking llama3.2 model..."
if curl -s http://localhost:11434/api/tags | grep -q "llama3.2"; then
    echo -e "${GREEN}✅ llama3.2 model is available${NC}"
else
    echo -e "${RED}❌ llama3.2 model not found${NC}"
fi
echo ""

# Test 4: Test n8n webhook (simple test)
echo "Test 4: Testing n8n webhook..."
echo "   Endpoint: $N8N_WEBHOOK"
echo "   Sending test message..."

RESPONSE=$(curl -s -X POST "$N8N_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! Respond with just one word: OK",
    "threadId": "test-'$(date +%s)'",
    "history": [],
    "systemPrompt": "You are a helpful assistant. Always respond concisely.",
    "user": {
      "email": "test@example.com",
      "vendor_slug": "test-vendor",
      "vendor_id": "1",
      "roles": ["vendor"]
    }
  }' 2>&1)

# Check if response contains success
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ n8n webhook is responding${NC}"
    echo "   Response preview:"
    echo "$RESPONSE" | grep -o '"response":"[^"]*"' | head -1 | sed 's/^/   /'
elif echo "$RESPONSE" | grep -qi "error\|failed\|could not resolve"; then
    echo -e "${RED}❌ n8n webhook returned an error${NC}"
    echo "   Error: $RESPONSE" | head -c 200
    echo ""
    echo -e "${YELLOW}⚠️  Possible issues:${NC}"
    echo "   1. Workflow is not activated in n8n UI"
    echo "   2. Network connectivity issue"
    echo "   3. Ollama is not accessible from n8n container"
    echo ""
    echo "   To activate workflow:"
    echo "   1. Go to https://ai.realsolutions.ai"
    echo "   2. Find 'Ollama Chat API' workflow"
    echo "   3. Click 'Activate' button"
else
    echo -e "${YELLOW}⚠️  Unexpected response from n8n webhook${NC}"
    echo "   Response: $RESPONSE" | head -c 300
fi
echo ""

# Test 5: Check environment configuration
echo "Test 5: Checking environment configuration..."
if [ -f ".env" ]; then
    if grep -q "VITE_N8N_CHAT_API" .env; then
        echo -e "${GREEN}✅ .env file is configured${NC}"
        echo "   Configuration:"
        grep "VITE_N8N_CHAT_API" .env | sed 's/^/   /'
    else
        echo -e "${YELLOW}⚠️  VITE_N8N_CHAT_API not found in .env${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
fi
echo ""

# Test 6: Check if OpenAI is removed
echo "Test 6: Verifying OpenAI removal..."
if grep -q '"openai"' package.json; then
    echo -e "${RED}❌ OpenAI is still in package.json${NC}"
else
    echo -e "${GREEN}✅ OpenAI dependency removed from package.json${NC}"
fi

if [ -f "src/api/openaiService.js" ]; then
    echo -e "${RED}❌ openaiService.js still exists${NC}"
else
    echo -e "${GREEN}✅ openaiService.js removed${NC}"
fi

if [ -f "src/api/chatService.js" ]; then
    echo -e "${GREEN}✅ chatService.js exists${NC}"
else
    echo -e "${RED}❌ chatService.js not found${NC}"
fi
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo "Architecture:"
echo "  Chat UI → n8n Webhook → Ollama → Response"
echo ""
echo "Endpoints:"
echo "  n8n Webhook: $N8N_WEBHOOK"
echo "  Ollama API: http://localhost:11434"
echo ""
echo "Next Steps:"
echo "  1. Activate the workflow in n8n UI if not already active"
echo "  2. Run: npm install"
echo "  3. Run: npm run dev"
echo "  4. Open: http://localhost:5173"
echo ""
echo "For your surgbay.com integration:"
echo "  Use the example in N8N_INTEGRATION_GUIDE.md"
echo "  Endpoint: POST $N8N_WEBHOOK"
echo ""
