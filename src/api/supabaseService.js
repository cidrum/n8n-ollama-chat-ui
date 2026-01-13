import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase URL and anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Save conversation to Supabase
export const saveConversation = async (conversation) => {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(conversation)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Get user conversations
export const getUserConversations = async (userEmail) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Save messages for a conversation
export const saveMessages = async (conversationId, messages) => {
  const { error } = await supabase
    .from('messages')
    .upsert(
      messages.map(msg => {
        // Remove metadata field if present (not in database schema)
        const { metadata, ...messageWithoutMetadata } = msg;
        return {
          conversation_id: conversationId,
          ...messageWithoutMetadata,
          created_at: msg.created_at || new Date().toISOString()
        };
      })
    );
  
  if (error) throw error;
  return true;
};

// Get messages for a conversation
export const getConversationMessages = async (conversationId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at');
  
  if (error) throw error;
  return data;
};

// Delete a conversation and its messages
export const deleteConversationAndMessages = async (conversationId) => {
  // First delete all messages associated with the conversation
  const { error: messagesError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);
  
  if (messagesError) throw messagesError;
  
  // Then delete the conversation itself
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);
  
  if (error) throw error;
  return true;
};