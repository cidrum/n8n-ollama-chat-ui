# N8N Chat UI with Ollama (No OpenAI)

This chat UI application has been completely rebuilt to use **local Ollama LLM** via **n8n workflows**, removing all OpenAI dependencies.

## 🎯 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Chat UI (React/Web)                        │
│                 (surgbay.com or localhost)                    │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                  POST /webhook/chat/ollama
                            │
┌───────────────────────────┴──────────────────────────────────┐
│                   n8n Workflow Engine                         │
│              (ai.realsolutions.ai)                            │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │   Process   │───▶│ Call Ollama  │───▶│ Format & Send  │  │
│  │   Message   │    │ (local LLM)  │    │   Response     │  │
│  └─────────────┘    └──────┬───────┘    └────────────────┘  │
│                             │                                 │
│                             ▼                                 │
│                    ┌────────────────┐                         │
│                    │   Tool Calls   │                         │
│                    │ (SQL, Charts)  │                         │
│                    └────────────────┘                         │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Ollama (Docker) │
                  │  llama3.2 model  │
                  │  localhost:11434 │
                  └──────────────────┘
```

## ✅ What Changed

### Removed
- ❌ `openai` npm package
- ❌ `src/api/openaiService.js`
- ❌ `src/api/ollamaService.js`
- ❌ `src/api/aiService.js`
- ❌ All OpenAI API calls
- ❌ OpenAI Assistant API integration

### Added
- ✅ `src/api/chatService.js` - Calls n8n webhook
- ✅ n8n workflow: "Ollama Chat API"
- ✅ Local Ollama LLM integration (llama3.2)
- ✅ Tool calling via n8n
- ✅ Vendor-specific data filtering

## 🚀 Quick Start

### 1. Activate the n8n Workflow

**IMPORTANT**: The workflow must be activated before use.

1. Go to https://ai.realsolutions.ai
2. Find "Ollama Chat API" workflow (ID: `gqd7nMYOXSXjSoI8`)
3. Click the toggle button to activate it
4. Verify activation:

```bash
curl -X POST https://ai.realsolutions.ai/webhook/chat/ollama \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!","threadId": "test","history": [],"systemPrompt": "Be helpful."}'
```

See [ACTIVATION_GUIDE.md](./ACTIVATION_GUIDE.md) for detailed instructions.

### 2. Run the React Chat UI

```bash
cd /home/ai/n8n-chat-ui-main
npm install
npm run dev
```

Open http://localhost:5173

### 3. Integrate with Your Existing Chat UI

If you already have a chat UI at surgbay.com:

```javascript
const response = await fetch('https://ai.realsolutions.ai/webhook/chat/ollama', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userMessage,
    threadId: conversationId,
    history: previousMessages,
    systemPrompt: 'You are a helpful assistant.',
    user: {
      email: 'user@example.com',
      vendor_slug: 'vendor-name',
      vendor_id: '123',
      roles: ['vendor']
    }
  })
});

const data = await response.json();
console.log(data.response); // AI response
```

## 📡 API Reference

### Endpoint
```
POST https://ai.realsolutions.ai/webhook/chat/ollama
```

### Request Format
```json
{
  "message": "What are my top products?",
  "threadId": "thread_123",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help?"}
  ],
  "systemPrompt": "You are a helpful assistant.",
  "user": {
    "email": "vendor@example.com",
    "vendor_slug": "my-vendor",
    "vendor_id": "456",
    "roles": ["vendor"]
  }
}
```

### Response Format
```json
{
  "success": true,
  "response": "Here are your top products...",
  "threadId": "thread_123",
  "model": "llama3.2",
  "timestamp": "2026-01-13T18:00:00.000Z"
}
```

## 🛠️ Configuration

### Environment Variables

`.env` file:
```env
# N8N Chat API
VITE_N8N_CHAT_API=https://ai.realsolutions.ai/webhook/chat/ollama

# Other services
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_key
VITE_N8N_BASE_URL=https://webhook.surgbay.com/
```

### Ollama Configuration

Running on Docker:
- **Container**: ollama
- **Port**: 11434
- **Model**: llama3.2 (3.2B parameters)
- **Access**: http://localhost:11434

Check status:
```bash
docker ps | grep ollama
curl http://localhost:11434/api/tags
```

## 🔧 Features

### ✅ Supported
- ✅ Chat conversations with Ollama
- ✅ Conversation threading (in-memory)
- ✅ Tool calling (SQL queries, charts, market lookups)
- ✅ Vendor data isolation
- ✅ Administrator vs. Vendor permissions
- ✅ Markdown rendering
- ✅ Code syntax highlighting
- ✅ WooCommerce authentication
- ✅ Supabase integration

### ⚠️ Limited
- File uploads (metadata only, no content analysis)
- Image generation
- Advanced vision capabilities

## 🔒 Security

### Data Isolation
- **Vendors**: Only see their own data (filtered by vendor_slug)
- **Administrators**: Access to all vendor data

### Privacy
- Never retrieves customer PII (names, addresses, phones)
- Only uses anonymized order IDs and aggregated data
- No user account or login information queries

## 📚 Documentation

- **[N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md)** - Comprehensive integration guide
- **[ACTIVATION_GUIDE.md](./ACTIVATION_GUIDE.md)** - Workflow activation steps
- **[test-n8n-integration.sh](./test-n8n-integration.sh)** - Automated testing script

## 🧪 Testing

Run the test script:
```bash
./test-n8n-integration.sh
```

This checks:
- ✅ Ollama is running
- ✅ Ollama API is accessible
- ✅ llama3.2 model is available
- ✅ n8n webhook is responding
- ✅ Environment is configured
- ✅ OpenAI is removed

## 🐛 Troubleshooting

### Webhook Not Found (404)
**Problem**: Workflow not activated
**Solution**: See [ACTIVATION_GUIDE.md](./ACTIVATION_GUIDE.md)

### Ollama Not Responding
```bash
# Check if running
docker ps | grep ollama

# Restart if needed
docker restart ollama

# View logs
docker logs ollama
```

### n8n Can't Reach Ollama
**Problem**: Docker network issue
**Solution**:
- Change Ollama URL in workflow from `host.docker.internal:11434` to `172.17.0.1:11434`
- Or add network configuration to n8n container

### Slow Responses
- First request loads the model (slower)
- Subsequent requests are faster
- Consider using smaller models for faster responses

## 📊 Performance

### Response Times
- First request: 5-15 seconds (model loading)
- Subsequent requests: 1-5 seconds
- Depends on: prompt complexity, model size, hardware

### Model Options
```bash
# Current: llama3.2 (3.2B) - Fast
docker exec ollama ollama pull llama3.2

# Better: llama3:8b - Balanced
docker exec ollama ollama pull llama3:8b

# Best: llama3:70b - Slow but high quality
docker exec ollama ollama pull llama3:70b
```

## 🔄 Workflow Details

**Name**: Ollama Chat API
**ID**: `gqd7nMYOXSXjSoI8`
**Location**: https://ai.realsolutions.ai

### Nodes:
1. Chat Webhook (receives requests)
2. Process Message (formats for Ollama)
3. Call Ollama (sends to local LLM)
4. Has Tool Calls? (checks for function calls)
5. Format Response (prepares output)
6. Send Response (returns JSON)

## 💡 Example Integrations

### Simple HTML Page
```html
<script>
async function chat(message) {
  const response = await fetch('https://ai.realsolutions.ai/webhook/chat/ollama', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      threadId: 'thread-' + Date.now(),
      history: [],
      systemPrompt: 'You are helpful.'
    })
  });
  const data = await response.json();
  return data.response;
}

chat('Hello!').then(response => console.log(response));
</script>
```

### React Component
```jsx
import { useState } from 'react';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const response = await fetch('https://ai.realsolutions.ai/webhook/chat/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        threadId: 'thread-123',
        history: messages,
        systemPrompt: 'Be helpful.'
      })
    });

    const data = await response.json();
    setMessages([...messages,
      { role: 'user', content: input },
      { role: 'assistant', content: data.response }
    ]);
    setInput('');
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.role}: {msg.content}</div>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

## 📞 Support

For issues:
1. Check [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md)
2. Run `./test-n8n-integration.sh`
3. Check n8n execution logs
4. Check Ollama logs: `docker logs ollama`

## 🎯 Your Use Case (surgbay.com)

You mentioned you already have a chat UI at ai.surgbay.com. To integrate:

1. **Activate the n8n workflow** (see ACTIVATION_GUIDE.md)
2. **Update your chat UI** to POST messages to:
   `https://ai.realsolutions.ai/webhook/chat/ollama`
3. **Send the required payload** (see API Reference above)
4. **Display the response** in your existing chat interface

See the JavaScript/HTML examples in [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md) for complete integration code.

## 📝 Next Steps

1. ✅ Activate workflow in n8n UI
2. ✅ Test with curl
3. ✅ Test with React app
4. ✅ Integrate with surgbay.com
5. 📝 Add Supabase persistence
6. 📝 Implement conversation caching
7. 📝 Add more tool functions
8. 📝 Deploy to production

## 📄 License

Same as original project.

## 🙏 Credits

- Original repo: https://github.com/cidrum/n8n-chat-ui
- Ollama: https://ollama.ai
- n8n: https://n8n.io
- Llama 3.2: Meta AI
