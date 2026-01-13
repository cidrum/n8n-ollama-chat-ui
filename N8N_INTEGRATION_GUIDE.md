# N8N + Ollama Chat Integration Guide

This guide explains the new architecture where all AI processing happens through n8n workflows using your local Ollama LLM.

## Architecture Overview

```
┌─────────────────────────┐
│  Chat UI (surgbay.com)  │
│  or React App           │
└───────────┬─────────────┘
            │ POST /webhook/chat/ollama
            │
            ▼
┌─────────────────────────┐
│  n8n Workflow           │
│  ai.realsolutions.ai    │
└───────────┬─────────────┘
            │
            ├─→ Ollama (local) ─→ llama3.2
            │
            ├─→ SQL Queries (n8n webhook)
            │
            └─→ Market Values (SERP API)
```

## ✅ What Was Changed

### 1. Removed All OpenAI Dependencies
- ❌ Removed `openai` package from package.json
- ❌ Deleted `src/api/openaiService.js`
- ❌ Deleted `src/api/ollamaService.js`
- ❌ Deleted `src/api/aiService.js`

### 2. Created New Chat Service
- ✅ Created `src/api/chatService.js` - Calls n8n webhook for all AI processing
- ✅ No local AI processing - everything goes through n8n
- ✅ Maintains same interface for compatibility

### 3. Deployed n8n Workflow
- ✅ Workflow ID: `gqd7nMYOXSXjSoI8`
- ✅ Webhook URL: `https://ai.realsolutions.ai/webhook/chat/ollama`
- ⚠️ Status: Created but needs to be activated in n8n UI

## n8n Workflow Details

### Workflow Name
**Ollama Chat API**

### Webhook Endpoint
**POST** `https://ai.realsolutions.ai/webhook/chat/ollama`

### Request Format

```json
{
  "message": "Your question here",
  "threadId": "thread_123456",
  "history": [
    {"role": "user", "content": "Previous message"},
    {"role": "assistant", "content": "Previous response"}
  ],
  "systemPrompt": "You are a helpful assistant...",
  "user": {
    "email": "user@example.com",
    "vendor_slug": "vendor-name",
    "vendor_id": "123",
    "roles": ["vendor"]
  }
}
```

### Response Format

```json
{
  "success": true,
  "response": "AI response text here",
  "threadId": "thread_123456",
  "model": "llama3.2",
  "timestamp": "2026-01-13T18:00:00.000Z"
}
```

## Activating the n8n Workflow

1. Go to https://ai.realsolutions.ai
2. Navigate to Workflows
3. Find "Ollama Chat API" workflow
4. Click "Activate" button
5. Test the webhook:

```bash
curl -X POST https://ai.realsolutions.ai/webhook/chat/ollama \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how can you help me?",
    "threadId": "test-123",
    "history": [],
    "systemPrompt": "You are a helpful assistant."
  }'
```

## Using with React Chat UI (This Repo)

### Installation

```bash
cd /home/ai/n8n-chat-ui-main
npm install
npm run dev
```

### Environment Variables

The `.env` file is already configured:

```env
VITE_N8N_CHAT_API=https://ai.realsolutions.ai/webhook/chat/ollama
```

### How It Works

1. User sends a message in the React UI
2. Message is added to the local thread (in-memory storage)
3. `chatService.js` sends request to n8n webhook with:
   - Current message
   - Conversation history
   - User information (vendor slug, roles)
   - System prompt (based on user role)
4. n8n workflow:
   - Formats message for Ollama
   - Calls Ollama API at `host.docker.internal:11434`
   - Checks if Ollama wants to call tools
   - Executes tools if needed (SQL queries, etc.)
   - Returns final response
5. Response is displayed in the chat UI

## Integrating with Existing Chat UI (surgbay.com)

If you already have a chat UI at ai.surgbay.com, you can integrate it by calling the n8n webhook directly.

### Example JavaScript Integration

```javascript
// Configuration
const N8N_CHAT_API = 'https://ai.realsolutions.ai/webhook/chat/ollama';

// Store conversation history
let conversationHistory = [];
let threadId = `thread_${Date.now()}`;

// Function to send message
async function sendMessage(userMessage, userInfo) {
  try {
    const response = await fetch(N8N_CHAT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: userMessage,
        threadId: threadId,
        history: conversationHistory,
        systemPrompt: 'You are a helpful assistant for auction and inventory management.',
        user: userInfo
      })
    });

    const data = await response.json();

    if (data.success) {
      // Add to conversation history
      conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: data.response }
      );

      return data.response;
    } else {
      throw new Error('Failed to get response');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Usage
const userInfo = {
  email: 'vendor@example.com',
  vendor_slug: 'my-vendor',
  vendor_id: '123',
  roles: ['vendor']
};

sendMessage('What are my top selling products?', userInfo)
  .then(response => {
    console.log('AI Response:', response);
    // Display response in your chat UI
  });
```

### HTML Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Chat with AI</title>
  <style>
    #chat-container { max-width: 600px; margin: 50px auto; }
    #messages { height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
    .message { margin: 10px 0; }
    .user { text-align: right; color: blue; }
    .assistant { text-align: left; color: green; }
    #input-container { margin-top: 10px; display: flex; }
    #message-input { flex: 1; padding: 10px; }
    #send-btn { padding: 10px 20px; }
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="messages"></div>
    <div id="input-container">
      <input type="text" id="message-input" placeholder="Type your message...">
      <button id="send-btn">Send</button>
    </div>
  </div>

  <script>
    const N8N_CHAT_API = 'https://ai.realsolutions.ai/webhook/chat/ollama';
    let conversationHistory = [];
    let threadId = `thread_${Date.now()}`;

    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    async function sendMessage(userMessage) {
      // Add user message to UI
      addMessage('user', userMessage);
      messageInput.value = '';

      try {
        const response = await fetch(N8N_CHAT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            threadId: threadId,
            history: conversationHistory,
            systemPrompt: 'You are a helpful assistant.',
            user: {
              email: 'user@example.com',
              vendor_slug: 'test-vendor',
              vendor_id: '1',
              roles: ['vendor']
            }
          })
        });

        const data = await response.json();

        if (data.success) {
          // Add assistant response to UI
          addMessage('assistant', data.response);

          // Update history
          conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: data.response }
          );
        } else {
          addMessage('assistant', 'Error: Could not get response');
        }
      } catch (error) {
        console.error('Error:', error);
        addMessage('assistant', 'Error: ' + error.message);
      }
    }

    function addMessage(role, content) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${role}`;
      msgDiv.textContent = content;
      messagesDiv.appendChild(msgDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    sendBtn.addEventListener('click', () => {
      const message = messageInput.value.trim();
      if (message) sendMessage(message);
    });

    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = messageInput.value.trim();
        if (message) sendMessage(message);
      }
    });
  </script>
</body>
</html>
```

## Ollama Configuration

### Current Setup
- **Container**: ollama (running on Docker)
- **Port**: 11434
- **Model**: llama3.2 (3.2B parameters)
- **Access from n8n**: `http://host.docker.internal:11434`

### Verifying Ollama

```bash
# Check if container is running
docker ps | grep ollama

# Test Ollama API
curl http://localhost:11434/api/tags

# Test chat
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": false
}'
```

## Tool Calling

The n8n workflow supports tool calling for:

### 1. SQL Query Execution
Ollama can request SQL queries to be executed on the WooCommerce database.

```javascript
// Ollama will call this tool automatically when needed
{
  "type": "function",
  "function": {
    "name": "run_sql_query",
    "parameters": {
      "query": "SELECT * FROM wp_posts WHERE post_type='product' LIMIT 10"
    }
  }
}
```

### 2. Chart Generation
Generate visualizations from data.

### 3. Market Value Lookup
Look up market values for medical equipment.

## Conversation Management

### Thread Storage
- Threads are stored in-memory in the React app
- For persistent storage, integrate with Supabase (already configured)

### Thread Lifecycle
```javascript
// 1. Create thread
const thread = await createThread();

// 2. Add message
await addMessageToThread(thread.id, "Hello!", []);

// 3. Run assistant (calls n8n)
const run = await runAssistant(thread.id, userInfo);

// 4. Get messages
const messages = await getThreadMessages(thread.id);
```

## Security Considerations

### Vendor Data Isolation
The system prompt automatically includes vendor filtering:

- **Administrators**: Can access all vendor data
- **Vendors**: Only see their own data (filtered by vendor_slug)

### Data Privacy
- Never retrieves customer PII (names, addresses, phone numbers)
- Only uses anonymized order IDs and aggregated data
- Never queries user account data or login information

## Troubleshooting

### Workflow Not Responding

1. Check if workflow is active in n8n UI
2. Verify Ollama is running:
   ```bash
   docker ps | grep ollama
   docker logs ollama
   ```
3. Test Ollama directly:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Connection Timeout

- The workflow has a 2-minute timeout
- For long-running queries, consider increasing timeout in the "Call Ollama" node

### Tool Calls Not Working

- Ensure Ollama supports function calling (newer versions do)
- Check n8n execution logs for tool call handling
- Verify tool call format in the workflow

## Performance Tips

1. **Model Selection**
   - llama3.2 (3.2B): Fast, good for most queries
   - For better quality: `docker exec ollama ollama pull llama3:8b`
   - For best quality: `docker exec ollama ollama pull llama3:70b` (requires more resources)

2. **Context Management**
   - Keep conversation history under 10 messages
   - Use `deleteFirstMessages()` to prune old messages

3. **Caching**
   - Consider caching common queries
   - Store frequently accessed data in Supabase

## Next Steps

1. ✅ Activate the n8n workflow
2. ✅ Test with curl
3. ✅ Integrate with your surgbay.com chat UI
4. 📝 Add persistent storage with Supabase
5. 📝 Implement conversation caching
6. 📝 Add more tool functions
7. 📝 Deploy to production

## API Reference

### chatService.js Methods

```javascript
// Thread management
createThread() → Promise<{id: string}>
addMessageToThread(threadId, content, fileIds) → Promise<Message>
getThreadMessages(threadId) → Promise<Message[]>
deleteFirstMessages(threadId) → Promise<boolean>

// AI interaction
runAssistant(threadId, user) → Promise<Run>
getRunStatus(threadId, runId) → Promise<RunStatus>

// File handling (limited support)
uploadFile(file, generateDownload) → Promise<File>
getFileContent(fileId) → Promise<null>
getFileInfo(fileId) → Promise<FileInfo>

// Utilities
generateChart(args) → Promise<ChartResult>
```

## Support

For issues:
1. Check this documentation
2. Review n8n workflow execution logs
3. Check Ollama container logs: `docker logs ollama`
4. Verify network connectivity to ai.realsolutions.ai

## Resources

- [Ollama Documentation](https://ollama.ai/)
- [n8n Documentation](https://docs.n8n.io/)
- [Llama 3.2 Model](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)
