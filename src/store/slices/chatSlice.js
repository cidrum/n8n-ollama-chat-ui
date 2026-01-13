import { createSlice } from '@reduxjs/toolkit';
import { 
  saveConversation, 
  getUserConversations, 
  saveMessages, 
  getConversationMessages,
  deleteConversationAndMessages
} from '../../api/supabaseService';
import { v4 as uuidv4 } from 'uuid';
import {
  createThread,
  addMessageToThread,
  runAssistant,
  getRunStatus,
  getThreadMessages,
  handleToolCalls,
  uploadFile as uploadFileToOpenAI,
  downloadGeneratedFile,
  deleteFirstMessages
} from '../../api/chatService';
import { validateFile } from '../../api/n8nService';

// Add timestamp to initialState
const initialState = {
  messages: [],
  conversations: [],
  currentConversation: null,
   loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },
    resetChat: (state) => {
      state.messages = [];
      state.currentConversation = null;
    },
    removeConversation: (state, action) => {
      state.conversations = state.conversations.filter(conv => conv.id !== action.payload);
      if (state.currentConversation?.id === action.payload) {
        state.currentConversation = null;
        state.messages = [];
      }
    }
  },
});

export const { 
  setLoading, 
  addMessage, 
  setMessages, 
  setConversations, 
  setCurrentConversation,
  resetChat,
  removeConversation
} = chatSlice.actions;

// Add new thunk actions for Supabase operations
export const fetchConversations = (user) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    if (!user?.email) throw new Error('User not authenticated');
    
    const conversations = await getUserConversations(user.email);
    dispatch(setConversations(conversations));
  } catch (error) {
    console.error('Error fetching conversations:', error);
  } finally {
    dispatch(setLoading(false));
  }
};

export const createNewConversation = (firstMessage, user) => async (dispatch) => {
  if (!user?.email) throw new Error('User not authenticated');
  dispatch(setLoading(true));
  
  const newConversation = {
    id: uuidv4(),
    title: firstMessage.text.substring(0, 30) + (firstMessage.text.length > 30 ? '...' : ''),
    user_email: user.email,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    const savedConversation = await saveConversation(newConversation);
    dispatch(setCurrentConversation(savedConversation));
    dispatch(fetchConversations(user));
    return savedConversation;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const loadConversation = (conversationId) => async (dispatch, getState) => {
  dispatch(setLoading(true));
  try {
    const messages = await getConversationMessages(conversationId);
    dispatch(setMessages(messages));
    
    // Get the conversation details to set as current
    const { conversations } = getState().chat;
    const conversation = conversations.find(conv => conv.id === conversationId);
    if (conversation) {
      dispatch(setCurrentConversation(conversation));
    }
  } catch (error) {
    console.error('Error loading conversation:', error);
  } finally {
    dispatch(setLoading(false));
  }
};

// Update sendMessage to save to Supabase
export const sendMessage = (text, file, user, metadata = null) => async (dispatch, getState) => {
  if (!text.trim() && !file) return;

  const timestamp = new Date().toISOString();
  const userMessage = { 
    id: uuidv4(),
    sender: "user", 
    text,
    created_at: timestamp,
    file: file ? {
      name: file.name,
      type: file.type,
      size: file.size
    } : null,
    metadata: metadata // Store CSV URL metadata if present
  };
  
  dispatch(addMessage(userMessage));
  dispatch(setLoading(true));

  try {
    // Get or create conversation
    let { currentConversation } = getState().chat;
    
    // Get current user - try to get from state if not provided
    if (!user) {
      // Try to get user from auth state
      const authState = getState().auth;
      user = authState?.user;
    }
    
    // Validate user
    if (!user?.email) {
      console.error('User not authenticated or missing email', { user, authState: getState().auth });
      throw new Error('User not authenticated. Please log in again.');
    }
    
    // Upload file if provided
    let fileId = null;
    if (file) {
      // Check if file type is supported by OpenAI
      const validation = validateFile(file);
      
      if (validation.openaiSupported) {
        try {
          const uploadedFile = await uploadFileToOpenAI(file);
          fileId = uploadedFile.id;
        } catch (error) {
          console.error("Error uploading file to OpenAI:", error);
          // Add a message to inform the user
          dispatch(addMessage({
            id: uuidv4(),
            sender: "assistant",
            text: "I couldn't process your file. OpenAI doesn't support this file type for retrieval.",
            created_at: new Date().toISOString()
          }));
          dispatch(setLoading(false));
          return;
        }
      } else {
        // For unsupported files, we'll still allow the message but without file processing
        dispatch(addMessage({
          id: uuidv4(),
          sender: "assistant",
          text: "I've received your file, but I can't process its contents because OpenAI doesn't support this file type for retrieval.",
          created_at: new Date().toISOString()
        }));
      }
    }
    
    // Create or get thread ID
    let threadId;
    let conversationId;
    
    if (!currentConversation) {
      // Create a new thread
      const thread = await createThread(user.email, user.id);
      threadId = thread.id;
      
      // Generate a UUID for Supabase (since thread IDs aren't valid UUIDs)
      conversationId = uuidv4();
      
      // Create a new conversation with both IDs
      currentConversation = {
        id: conversationId, // Use UUID for Supabase
        thread_id: threadId, // Store OpenAI thread ID separately
        title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        user_email: user.email,
        created_at: timestamp,
        updated_at: timestamp
      };
      
      await saveConversation(currentConversation);
      dispatch(setCurrentConversation(currentConversation));
    } else {
      conversationId = currentConversation.id;
      threadId = currentConversation.thread_id;
    }
    
    // Prepare user message with conversation ID
    // Note: metadata is kept in userMessage object for later use but will be filtered out when saving to DB
    const userMessageWithConversationId = {
      ...userMessage,
      conversation_id: conversationId
    };
    
    // Add message to thread
    const fileIds = fileId ? [fileId] : [];
    if (fileIds.length > 0) {
      await addMessageToThread(threadId, text, fileIds);
    } else {
      await addMessageToThread(threadId, text);
    }
    
    // Run the assistant
    const run = await runAssistant(threadId, user);
    let functionResultDownloadData = []; 

    // Poll for completion
    let runStatus = await getRunStatus(threadId, run.id);
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await getRunStatus(threadId, run.id);
      
      // Handle tool calls if needed
      if (runStatus.status === 'requires_action' && 
          runStatus.required_action?.type === 'submit_tool_outputs') {
          functionResultDownloadData = await handleToolCalls(
            threadId, 
            run.id, 
            runStatus.required_action.submit_tool_outputs.tool_calls,
            user.email,
            user.id,
            user
          );
      }
    }
    
    if (runStatus.status === 'failed') {
      throw new Error('Assistant run failed: ' + (runStatus.last_error?.message || 'Unknown error'));
    }
    
    // Get the latest messages
    const threadMessages = await getThreadMessages(threadId);
    
    // Find the assistant message created after the user's message timestamp
    // This ensures we get the new response, not the welcome message or older messages
    // Since messages are in ascending order, we need to find the last assistant message
    // that was created after our timestamp
    let assistantMessage = null;
    const userTimestamp = new Date(timestamp).getTime();
    
    // Iterate backwards through messages to find the most recent assistant message after timestamp
    for (let i = threadMessages.length - 1; i >= 0; i--) {
      const msg = threadMessages[i];
      if (msg.role === 'assistant') {
        const msgTimestamp = new Date(msg.created_at).getTime();
        if (msgTimestamp > userTimestamp) {
          assistantMessage = msg;
          break;
        }
      }
    }

    console.log('Message retrieval debug:', {
      userMessageTimestamp: timestamp,
      totalThreadMessages: threadMessages.length,
      assistantMessagesCount: threadMessages.filter(m => m.role === 'assistant').length,
      assistantMessageFound: !!assistantMessage,
      assistantMessageTimestamp: assistantMessage?.created_at,
      assistantMessageContent: assistantMessage?.content?.substring(0, 100)
    });

    if (assistantMessage) {
      // Check if there's CSV metadata to append download link
      let messageText = assistantMessage.content || "I'm not sure how to respond to that.";
      
      // If we have products data from button clicks, format and include it in the response
      if (userMessage.metadata?.products_data && Array.isArray(userMessage.metadata.products_data)) {
        const products = userMessage.metadata.products_data;
        
        // Create a table or formatted list from the products data
        // Check what columns are available in the data
        if (products.length > 0) {
          const columns = Object.keys(products[0]);
          
          // Create markdown table header
          let table = '\n\n| ' + columns.map(col => {
            // Format column names nicely
            return col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }).join(' | ') + ' |\n';
          
          // Add separator row
          table += '| ' + columns.map(() => '---').join(' | ') + ' |\n';
          
          // Add data rows (limit to first 10 for preview)
          const previewRows = products.slice(0, 10);
          previewRows.forEach(product => {
            table += '| ' + columns.map(col => {
              const value = product[col];
              return value !== null && value !== undefined ? String(value) : '';
            }).join(' | ') + ' |\n';
          });
          
          // Add message about full data
          if (products.length > 10) {
            table += `\n\n*This is a preview showing the first 10 of ${products.length} products. For the complete list, please download the Excel report below.*`;
          } else {
            table += `\n\n*This is a preview. For the complete list, please download the Excel report below.*`;
          }
          
          // Append table to the message text
          messageText = messageText + table;
        }
      }
      
      // CSV download link is shown in the file attachments section below, not in the message text
      
      // Format the assistant message
      // Build file object with attachments and CSV info
      let fileObj = null;
      if (assistantMessage.attachments || userMessage.metadata?.csv_url) {
        fileObj = {
          ...(assistantMessage.attachments ? { attachments: assistantMessage.attachments } : {}),
          ...(userMessage.metadata?.csv_url ? { 
            csv_url: userMessage.metadata.csv_url,
            csv_filename: userMessage.metadata.csv_filename || 'report.csv'
          } : {}),
          ...(userMessage.metadata?.products_data ? {
            products_data: userMessage.metadata.products_data
          } : {})
        };
      }
      
      const aiMessage = { 
        id: uuidv4(),
        sender: "assistant", 
        text: messageText,
        created_at: assistantMessage.created_at || new Date().toISOString(),
        conversation_id: conversationId,
        thread_id: threadId,
        file: fileObj,
        function_results: functionResultDownloadData ? functionResultDownloadData : null
      };
      
      dispatch(addMessage(aiMessage));
      
      // Save both messages to Supabase only after successful response
      await saveMessages(conversationId, [userMessageWithConversationId, aiMessage]);
      
      // Update conversation timestamp
      await saveConversation({
        ...currentConversation,
        updated_at: new Date().toISOString()
      });
      
      // Refresh conversations list (but don't reload messages to avoid overwriting)
      // Only update the conversations list, not the messages
      const updatedConversations = await getUserConversations(user.email);
      dispatch(setConversations(updatedConversations));
    } else {
      // If no assistant message found, show an error message
      console.error("No assistant message found in thread", { threadId, runStatus, threadMessagesCount: threadMessages.length });
      const errorMsg = { 
        id: uuidv4(),
        sender: "assistant", 
        text: "I'm sorry, I couldn't generate a response. Please try again or rephrase your question.",
        created_at: new Date().toISOString(),
        conversation_id: conversationId
      };
      dispatch(addMessage(errorMsg));
      
      // Still save the user message even if assistant response failed
      await saveMessages(conversationId, [userMessageWithConversationId]);
    }
    
  } catch (error) {
    console.error("Error in chat:", error);
    
    // Check if error is related to token limits
    if (error.message?.includes('token') && error.message?.includes('limit')) {
      try {
        // Get the thread ID from current conversation
        const { currentConversation } = getState().chat;
        if (currentConversation && currentConversation.thread_id) {
          // Delete the first four messages to free up token space
          await deleteFirstMessages(currentConversation.thread_id);
          
          // Delete the last user message from state
          const { messages } = getState().chat;
          const filteredMessages = messages.filter((msg, index) => 
            index !== messages.length - 1
          );
          dispatch(setMessages(filteredMessages));
        }
        
        await dispatch(sendMessage(text, file, user));
        
      } catch (deleteError) {
        console.error("Error deleting messages:", deleteError);
      }
    } else {
      const errorMsg = { 
        id: uuidv4(),
        sender: "assistant", 
        text: "Sorry, I encountered an error: " + (error.message || "Unknown error"),
        created_at: new Date().toISOString()
      };
      dispatch(addMessage(errorMsg));
      
      if (error.response?.status === 401) {
        // Handle unauthorized
        throw error;
      }
    }
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteConversation = (conversationId, user) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await deleteConversationAndMessages(conversationId);
    dispatch(removeConversation(conversationId));
    dispatch(fetchConversations(user));
  } catch (error) {
    console.error('Error deleting conversation:', error);
  } finally {
    dispatch(setLoading(false));
  }
};

// Add this action to handle file downloads
export const downloadAssistantFile = (threadId, fileId) => async (dispatch) => {
  try {
    dispatch(setLoading(true));
    const fileData = await downloadGeneratedFile(threadId, fileId);
    
    // Create a download link
    const blob = new Blob([fileData.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    dispatch(setLoading(false));
  } catch (error) {
    console.error("Error downloading file:", error);
    dispatch(setLoading(false));
    // Add error handling as needed
  }
};

export default chatSlice.reducer;