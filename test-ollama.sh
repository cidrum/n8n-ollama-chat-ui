#!/bin/bash

echo "==================================="
echo "Ollama Integration Test Script"
echo "==================================="
echo ""

# Test 1: Check if Ollama is running
echo "Test 1: Checking if Ollama is running..."
if docker ps | grep -q ollama; then
    echo "✅ Ollama container is running"
else
    echo "❌ Ollama container is not running"
    echo "   Starting Ollama..."
    docker start ollama || docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama ollama/ollama:latest
    sleep 3
fi
echo ""

# Test 2: Check Ollama API
echo "Test 2: Checking Ollama API..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama API is accessible"
    echo "   Available models:"
    curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | sed 's/"name":"/   - /' | sed 's/"$//'
else
    echo "❌ Ollama API is not accessible"
fi
echo ""

# Test 3: Check if llama3.2 model exists
echo "Test 3: Checking for llama3.2 model..."
if curl -s http://localhost:11434/api/tags | grep -q "llama3.2"; then
    echo "✅ llama3.2 model is available"
else
    echo "❌ llama3.2 model not found"
    echo "   Pulling llama3.2 model (this may take a while)..."
    docker exec ollama ollama pull llama3.2
fi
echo ""

# Test 4: Test Ollama chat
echo "Test 4: Testing Ollama chat..."
RESPONSE=$(curl -s http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [{"role": "user", "content": "Say hello in 5 words or less"}],
  "stream": false
}')

if echo "$RESPONSE" | grep -q "content"; then
    echo "✅ Ollama chat is working"
    echo "   Response:"
    echo "$RESPONSE" | grep -o '"content":"[^"]*"' | sed 's/"content":"/   /' | sed 's/"$//'
else
    echo "❌ Ollama chat failed"
    echo "   Response: $RESPONSE"
fi
echo ""

# Test 5: Check if node_modules exist
echo "Test 5: Checking for node_modules..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules exist"
else
    echo "⚠️  node_modules not found"
    echo "   Run: npm install"
fi
echo ""

# Test 6: Check environment configuration
echo "Test 6: Checking environment configuration..."
if grep -q "VITE_USE_OLLAMA=true" .env; then
    echo "✅ Ollama is enabled in .env"
    echo "   Configuration:"
    grep "VITE_OLLAMA" .env | sed 's/^/   /'
else
    echo "⚠️  Ollama is not enabled in .env"
    echo "   Set VITE_USE_OLLAMA=true in .env file"
fi
echo ""

echo "==================================="
echo "Test Summary Complete"
echo "==================================="
echo ""
echo "To start the chat UI:"
echo "  1. cd /home/ai/n8n-chat-ui-main"
echo "  2. npm install (if not already done)"
echo "  3. npm run dev"
echo ""
echo "To test with curl:"
echo "  curl http://localhost:11434/api/chat -d '{\"model\":\"llama3.2\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}],\"stream\":false}'"
echo ""
