import axios from "axios";

// N8N Chat API Configuration
const N8N_CHAT_API = "https://ai.realsolutions.ai/webhook/chat/ollama";

// Create axios instance for n8n chat API
const chatClient = axios.create({
  baseURL: N8N_CHAT_API,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120000, // 2 minute timeout
});

// In-memory storage for conversation threads
const threads = new Map();

// Create a new thread
export const createThread = async () => {
  try {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    threads.set(threadId, {
      id: threadId,
      messages: [],
      created_at: new Date().toISOString(),
    });
    return { id: threadId };
  } catch (error) {
    console.error("Error creating thread:", error);
    throw error;
  }
};

// Add a message to a thread
export const addMessageToThread = async (threadId, content, fileIds) => {
  try {
    const thread = threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: content,
      created_at: new Date().toISOString(),
    };

    if (fileIds && fileIds.length > 0) {
      message.attachments = fileIds.map(fileId => ({
        file_id: fileId,
        type: "file_search"
      }));
    }

    thread.messages.push(message);
    return message;
  } catch (error) {
    console.error("Error adding message to thread:", error);
    throw error;
  }
};

// Upload a file (simplified)
export const uploadFile = async (file, generateDownload = false) => {
  try {
    if (generateDownload) {
      const blob = new Blob([file.content || ''], { type: file.type || 'text/plain' });
      const url = URL.createObjectURL(blob);
      return { id: crypto.randomUUID(), url, filename: file.name, downloadable: true };
    }

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: fileId,
      filename: file.name,
      bytes: file.size,
      created_at: Date.now(),
      purpose: 'assistants'
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

// Build system prompt based on user role
const getSystemPrompt = (user) => {
  const isAdministrator = user?.roles?.includes('administrator');
  const vendorSlug = user?.vendor_slug;

  if (isAdministrator) {
    return `You are a highly intelligent auction and inventory assistant for WooCommerce administrators using Rapid Lister 3. You have access to ALL vendor data and can provide comprehensive insights across the entire platform. Your responsibilities include:

* Generate secure and optimized SQL queries for WooCommerce orders and products across all vendors
* Provide data analytics, reporting, and insights for administrators
* Assist with inventory management, pricing analysis, and auction oversight
* Generate charts and visualizations for better data understanding
* Look up market values for medical equipment

**Data Privacy:** NEVER retrieve or display customer personal information such as names, addresses, phone numbers, or any PII. Only use anonymized order IDs and aggregated data.
**User Data Restriction:** NEVER query or display user account data, login information, or any user table data.`;
  }

  return `You are a highly intelligent auction and inventory assistant designed to provide SQL queries and database insights specifically for WooCommerce vendors using Rapid Lister 3. Your vendor slug is: ${vendorSlug || 'unknown'}

Your responsibilities include:
* Generate secure and optimized SQL queries for WooCommerce orders and products filtered by vendor slug
* Provide inventory insights, sales analytics, and auction management assistance
* Generate charts and visualizations for better understanding of vendor data
* Look up market values for medical equipment

**Important Restrictions:**
* ALL queries MUST be filtered by vendor slug: ${vendorSlug}
* NEVER retrieve data from other vendors
* NEVER retrieve or display customer personal information (names, addresses, phone numbers, PII)
* NEVER query or display user account data or login information
* Only use anonymized order IDs and aggregated data`;
};

// Run the assistant on a thread using n8n
export const runAssistant = async (threadId, user) => {
  try {
    const thread = threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const systemPrompt = getSystemPrompt(user);

    // Get conversation history (exclude system messages)
    const history = thread.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    // Get the last user message
    const lastMessage = thread.messages[thread.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('No user message found to process');
    }

    // Call n8n chat API
    const response = await chatClient.post('', {
      message: lastMessage.content,
      threadId: threadId,
      history: history.slice(0, -1), // exclude the last message as it's sent separately
      systemPrompt: systemPrompt,
      user: {
        email: user?.email || user?.vendor_email,
        vendor_slug: user?.vendor_slug,
        vendor_id: user?.vendor_id || user?.id,
        roles: user?.roles || []
      }
    });

    // Store the run information
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const run = {
      id: runId,
      thread_id: threadId,
      status: 'completed',
      response: response.data,
      created_at: new Date().toISOString()
    };

    // Add assistant response to thread
    if (response.data.success && response.data.response) {
      const assistantMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: "assistant",
        content: response.data.response,
        created_at: new Date().toISOString()
      };
      thread.messages.push(assistantMessage);
    }

    if (!thread.runs) {
      thread.runs = [];
    }
    thread.runs.push(run);

    return run;
  } catch (error) {
    console.error("Error running assistant:", error);
    throw error;
  }
};

// Get the status of a run
export const getRunStatus = async (threadId, runId) => {
  try {
    const thread = threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const run = thread.runs?.find(r => r.id === runId);
    if (!run) {
      throw new Error(`Run ${runId} not found in thread ${threadId}`);
    }

    // Check if we have a response
    if (run.response?.success) {
      return {
        id: runId,
        status: 'completed'
      };
    }

    return {
      id: runId,
      status: run.status || 'completed'
    };
  } catch (error) {
    console.error("Error getting run status:", error);
    throw error;
  }
};

// Handle tool calls - n8n handles this internally now
export const handleToolCalls = async (threadId, runId, toolCalls, userEmail, userId, user = null) => {
  // Tool calls are handled by n8n workflow
  // This is a placeholder for compatibility
  console.log('Tool calls are handled by n8n workflow');
  return null;
};

// Get messages from a thread
export const getThreadMessages = async (threadId) => {
  try {
    const thread = threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    return thread.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
      attachments: msg.attachments
    }));
  } catch (error) {
    console.error("Error getting thread messages:", error);
    throw error;
  }
};

// Delete old messages from thread
export const deleteFirstMessages = async (threadId) => {
  try {
    const thread = threads.get(threadId);
    if (!thread || !thread.messages || thread.messages.length === 0) {
      return false;
    }

    if (thread.messages.length > 10) {
      thread.messages.splice(0, 2);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error deleting first messages:", error);
    throw error;
  }
};

// Placeholder functions for compatibility
export const getFileContent = async (fileId) => {
  console.warn("File content retrieval not supported");
  return null;
};

export const getFileInfo = async (fileId) => {
  console.warn("File info retrieval not supported");
  return { id: fileId, filename: "unknown", bytes: 0 };
};

export const downloadGeneratedFile = async (threadId, fileId) => {
  console.warn("File download not supported");
  return null;
};

// Generate chart function (for local use if needed)
export const generateChart = async (args) => {
  try {
    const { chart_type, title, data, x_axis, y_axis } = args;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        error: "Invalid or empty data provided",
        message: "Cannot generate chart with empty or invalid data"
      };
    }

    if ((chart_type === 'bar' || chart_type === 'line' || chart_type === 'scatter') &&
      (!x_axis || !y_axis || !data[0].hasOwnProperty(x_axis) || !data[0].hasOwnProperty(y_axis))) {
      return {
        success: false,
        error: "Missing or invalid axis fields",
        message: "The specified x_axis or y_axis fields are missing from the data"
      };
    }

    const labels = data.map(item => item[x_axis]);
    const values = data.map(item => parseFloat(item[y_axis]) || 0);

    const colors = data.map(() =>
      `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.7)`
    );

    const chartData = {
      type: chart_type,
      data: {
        labels: labels,
        datasets: [{
          label: title || y_axis,
          data: values,
          backgroundColor: chart_type === 'pie' ? colors : 'rgba(54, 162, 235, 0.5)',
          borderColor: chart_type === 'pie' ? colors : 'rgb(54, 162, 235)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            display: chart_type !== 'pie'
          },
          x: {
            display: chart_type !== 'pie'
          }
        },
        plugins: {
          title: {
            display: !!title,
            text: title
          },
          legend: {
            display: chart_type === 'pie'
          }
        }
      }
    };

    const chartConfig = encodeURIComponent(JSON.stringify(chartData));
    const chartUrl = `https://quickchart.io/chart?c=${chartConfig}&w=600&h=400`;

    return {
      success: true,
      chart_url: chartUrl,
      message: `Chart generated successfully`,
      chart_data: {
        labels,
        values,
        type: chart_type
      }
    };
  } catch (error) {
    console.error("Error generating chart:", error);
    return {
      success: false,
      error: error.message || "Failed to generate chart",
      message: "There was an error generating the chart. Please try again."
    };
  }
};
