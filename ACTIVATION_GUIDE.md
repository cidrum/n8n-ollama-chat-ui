# Workflow Activation Guide

## Current Status

✅ **Workflow Created**: Ollama Chat API (ID: `gqd7nMYOXSXjSoI8`)
⚠️ **Status**: Inactive - needs to be activated
📍 **Location**: https://ai.realsolutions.ai

## Quick Activation Steps

### Method 1: Via n8n Web UI (Recommended)

1. **Open n8n**
   - Go to https://ai.realsolutions.ai
   - Log in with your credentials

2. **Find the Workflow**
   - Click on "Workflows" in the sidebar
   - Look for "Ollama Chat API"
   - Or search for workflow ID: `gqd7nMYOXSXjSoI8`

3. **Activate**
   - Open the workflow
   - Click the toggle button in the top-right corner to activate
   - The toggle should turn green/blue when active

4. **Verify**
   - The webhook URL should now be active
   - Test it with the command below

### Method 2: Verify Activation

After activating, test the webhook:

```bash
curl -X POST https://ai.realsolutions.ai/webhook/chat/ollama \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! Please respond with OK",
    "threadId": "test-123",
    "history": [],
    "systemPrompt": "You are a helpful assistant.",
    "user": {
      "email": "test@example.com",
      "vendor_slug": "test",
      "vendor_id": "1",
      "roles": ["vendor"]
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "response": "OK (or similar response from Ollama)",
  "threadId": "test-123",
  "model": "llama3.2",
  "timestamp": "2026-01-13T..."
}
```

## Workflow Details

### Webhook Endpoint
```
POST https://ai.realsolutions.ai/webhook/chat/ollama
```

### Workflow Nodes

1. **Chat Webhook** - Receives incoming requests
2. **Process Message** - Formats message for Ollama
3. **Call Ollama** - Sends request to Ollama API at `host.docker.internal:11434`
4. **Has Tool Calls?** - Checks if Ollama wants to use tools
5. **Format Response** - Prepares the response
6. **Send Response** - Returns JSON response

### How It Works

```
User Chat UI → Webhook → Process → Ollama → Response
                                      ↓
                                  Tool Calls
                                  (SQL, Charts)
```

## Troubleshooting

### Issue: "webhook is not registered"

**Problem**: Workflow is not activated
**Solution**: Follow activation steps above

### Issue: "Could not reach Ollama"

**Problem**: Ollama container is not running or not accessible from n8n
**Solution**:
```bash
# Check Ollama is running
docker ps | grep ollama

# Restart if needed
docker restart ollama

# Test from host
curl http://localhost:11434/api/tags
```

### Issue: Timeout or slow responses

**Problem**: Ollama is slow or the model is large
**Solution**:
- Check if you have a smaller model: `llama3.2` (3.2B) is fast
- Larger models (70B+) will be slower
- Increase timeout in the "Call Ollama" node (currently 120 seconds)

### Issue: "host.docker.internal" not resolving

**Problem**: n8n container can't reach host machine
**Solution**:
- For Linux: Use `172.17.0.1` (default Docker bridge IP) instead
- Update the "Call Ollama" node URL to: `http://172.17.0.1:11434/api/chat`
- Or add `--add-host=host.docker.internal:host-gateway` to n8n container

## Next Steps After Activation

1. **Test the endpoint** with curl (see command above)
2. **Test with React app**:
   ```bash
   cd /home/ai/n8n-chat-ui-main
   npm install
   npm run dev
   ```
3. **Integrate with surgbay.com**:
   - See `N8N_INTEGRATION_GUIDE.md` for JavaScript examples
   - Use the HTML example for quick integration

## Important Notes

### Security
- The workflow accepts requests from anywhere
- Consider adding authentication if exposing publicly
- Vendor data is automatically filtered by vendor_slug

### Performance
- First request may be slow (Ollama model loading)
- Subsequent requests are faster
- Consider warming up the model with a test request

### Monitoring
- Check n8n execution logs for errors
- Monitor Ollama logs: `docker logs ollama`
- Set up alerts for failed executions in n8n

## Support

If you encounter issues:

1. **Check Ollama**:
   ```bash
   docker logs ollama --tail 50
   ```

2. **Check n8n Execution Logs**:
   - Go to https://ai.realsolutions.ai
   - Click on "Executions" in sidebar
   - Look for failed executions of "Ollama Chat API"

3. **Test Ollama Directly**:
   ```bash
   curl http://localhost:11434/api/chat -d '{
     "model": "llama3.2",
     "messages": [{"role": "user", "content": "test"}],
     "stream": false
   }'
   ```

4. **Verify Network Connectivity**:
   ```bash
   # From n8n container (if you can exec into it)
   curl http://host.docker.internal:11434/api/tags
   ```

## Contact

For questions about:
- **n8n workflow**: Check n8n documentation at https://docs.n8n.io
- **Ollama**: Check https://ollama.ai
- **This integration**: Review `N8N_INTEGRATION_GUIDE.md`
