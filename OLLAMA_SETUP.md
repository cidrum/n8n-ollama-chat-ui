# Ollama Integration Setup Guide

This guide explains how to set up and use the n8n-chat-ui with Ollama instead of OpenAI.

## What Was Changed

1. **Created Ollama Service** (`src/api/ollamaService.js`)
   - Replaces OpenAI Assistant API with Ollama
   - Supports conversation threading
   - Implements tool calling for SQL queries, chart generation, and market value lookups
   - Compatible with the existing chat UI interface

2. **Created Unified AI Service** (`src/api/aiService.js`)
   - Wrapper that switches between OpenAI and Ollama based on environment variable
   - Allows easy switching between AI providers

3. **Updated Components**
   - `src/store/slices/chatSlice.js` - Now uses `aiService` instead of `openaiService`
   - `src/components/MessageBubble.jsx` - Updated to use `aiService`

4. **Environment Configuration**
   - Added Ollama configuration variables to `.env`
   - Added `VITE_USE_OLLAMA=true` to enable Ollama

5. **Created n8n Workflow**
   - `n8n-ollama-chat-workflow.json` - Workflow that uses Ollama for chat
   - Supports tool calling and conversation history
   - Can be imported into n8n

## Prerequisites

- Docker installed and running
- Node.js and npm (for running the React app)
- Access to an n8n instance (optional, for the workflow)

## Setup Instructions

### 1. Ollama Setup (Already Done!)

Ollama is already running in a Docker container on your machine:

```bash
# Verify Ollama is running
docker ps | grep ollama

# Check available models
curl http://localhost:11434/api/tags

# You should see llama3.2 in the list
```

### 2. Install Dependencies

```bash
cd /home/ai/n8n-chat-ui-main
npm install
```

### 3. Configure Environment

The `.env` file has already been updated with Ollama configuration:

```env
# Ollama Configuration
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.2
VITE_USE_OLLAMA=true
```

To switch back to OpenAI, set:
```env
VITE_USE_OLLAMA=false
```

### 4. Start the Chat UI

```bash
npm run dev
```

The application will start on `http://localhost:5173` (or the next available port).

### 5. Import n8n Workflow (Optional)

If you want to use the n8n workflow:

1. Open your n8n instance (http://localhost:5678)
2. Go to Workflows → Import
3. Select the file: `n8n-ollama-chat-workflow.json`
4. Activate the workflow
5. The webhook will be available at: `http://localhost:5678/webhook/ollama-chat`

**Note:** The workflow uses `host.docker.internal:11434` to access Ollama from within the n8n Docker container.

## How It Works

### Chat UI Flow

1. User sends a message through the React UI
2. The message is added to a conversation thread (stored in memory)
3. The Ollama service formats the conversation history and sends it to Ollama
4. Ollama processes the message and may call tools (functions) if needed
5. Tool calls are executed (SQL queries, chart generation, etc.)
6. Results are sent back to Ollama for final processing
7. The response is displayed to the user

### n8n Workflow Flow

1. Webhook receives a POST request with: `{ message, threadId, history, systemPrompt, user }`
2. The message is processed and formatted for Ollama
3. Ollama API is called at `http://host.docker.internal:11434/api/chat`
4. If Ollama returns tool calls, they are extracted and executed
5. Tool results are sent back to Ollama
6. Final response is returned to the webhook caller

## Testing the Setup

### Test Ollama Directly

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {"role": "user", "content": "Hello! How are you?"}
  ],
  "stream": false
}'
```

### Test the Chat UI

1. Start the development server: `npm run dev`
2. Open http://localhost:5173
3. Log in with your credentials
4. Start a new conversation
5. Send a message - it should be processed by Ollama

### Test the n8n Workflow

```bash
curl -X POST http://localhost:5678/webhook/ollama-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how can you help me?",
    "threadId": "test-thread-123",
    "history": [],
    "systemPrompt": "You are a helpful assistant."
  }'
```

## Supported Features

### ✅ Working Features

- Basic chat functionality
- Conversation threading (in-memory storage)
- Tool calling:
  - SQL query execution
  - Chart generation
  - Market value lookups
- Markdown rendering
- Code syntax highlighting
- User authentication (via WooCommerce)

### ⚠️ Limited Features

- File uploads: Ollama doesn't have native file storage like OpenAI
  - Files are stored as metadata only
  - You may need to implement custom file handling
- Conversation persistence: Currently in-memory
  - Can be extended to use Supabase for persistent storage
  - The existing Supabase integration can be used

## Switching Between OpenAI and Ollama

The setup allows you to switch between OpenAI and Ollama by changing the `.env` file:

**Use Ollama:**
```env
VITE_USE_OLLAMA=true
```

**Use OpenAI:**
```env
VITE_USE_OLLAMA=false
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_ASSISTANT_ID=your_assistant_id
```

Restart the development server after changing the environment variables.

## Troubleshooting

### Ollama Not Responding

```bash
# Check if Ollama container is running
docker ps | grep ollama

# Restart Ollama if needed
docker restart ollama

# Check Ollama logs
docker logs ollama
```

### Chat UI Not Connecting to Ollama

1. Verify the `VITE_OLLAMA_BASE_URL` in `.env`
2. Check browser console for errors
3. Ensure Ollama is accessible at `http://localhost:11434`

### n8n Workflow Not Working

1. Ensure Ollama is accessible from Docker: `http://host.docker.internal:11434`
2. Check n8n execution logs
3. Verify the webhook path is correct
4. Test Ollama API directly from n8n's HTTP Request node

### Tool Calling Not Working

1. Check if Ollama supports function calling (newer versions do)
2. Verify the tool definitions are correctly formatted
3. Check the Ollama response for `tool_calls` in the message

## Architecture

```
┌─────────────────┐
│  React Chat UI  │
└────────┬────────┘
         │
         ├─→ aiService.js (wrapper)
         │   └─→ ollamaService.js or openaiService.js
         │
         ├─→ Ollama (Docker) ← http://localhost:11434
         │   └─→ llama3.2 model
         │
         ├─→ Supabase (conversations, messages)
         │
         └─→ n8n Webhooks (SQL queries, market values)


┌─────────────────┐
│  n8n Workflow   │
└────────┬────────┘
         │
         ├─→ Webhook Trigger
         │
         ├─→ Process Message (Format for Ollama)
         │
         ├─→ Call Ollama API
         │
         ├─→ Check for Tool Calls
         │
         ├─→ Execute Tools (SQL, Charts, etc.)
         │
         └─→ Return Response
```

## Performance Considerations

1. **Model Size**: llama3.2 is a 3.2B parameter model
   - Smaller models are faster but less capable
   - Can switch to larger models: `docker exec ollama ollama pull llama3:70b`

2. **Context Window**: Default is 4096 tokens
   - Adjust in the Ollama service if needed
   - Larger context = more memory usage

3. **Response Time**:
   - Ollama responses are typically 1-10 seconds
   - Depends on prompt complexity and hardware

## Next Steps

1. **Add Persistent Storage**: Integrate Supabase for conversation storage
2. **Improve File Handling**: Implement custom file storage and retrieval
3. **Add More Tools**: Extend tool calling capabilities
4. **Optimize Performance**: Tune model parameters for better response times
5. **Deploy**: Containerize the entire stack for production deployment

## Resources

- [Ollama Documentation](https://ollama.ai/)
- [n8n Documentation](https://docs.n8n.io/)
- [Llama 3.2 Model Card](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)
- [React Documentation](https://react.dev/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Ollama logs: `docker logs ollama`
3. Check browser console for errors
4. Verify all services are running correctly
