-- Enable the necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id TEXT,
  title TEXT NOT NULL,
  user_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  thread_id TEXT,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_ids TEXT[],
  file JSONB
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_email ON conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);

-- Row Level Security (RLS) policies
-- Enable RLS on tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (user_email = auth.jwt() ->> 'email');

-- Create policies for messages
CREATE POLICY "Users can view messages from their conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can insert messages to their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can update messages in their conversations"
  ON messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can delete messages in their conversations"
  ON messages FOR DELETE
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_email = auth.jwt() ->> 'email'
    )
  );

-- Function to add thread_id column if it doesn't exist
CREATE OR REPLACE FUNCTION add_thread_id_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the column exists in conversations table
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'thread_id'
  ) THEN
    -- Add the column
    ALTER TABLE conversations ADD COLUMN thread_id text;
  END IF;
  
  -- Check if the column exists in messages table
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'thread_id'
  ) THEN
    -- Add the column
    ALTER TABLE messages ADD COLUMN thread_id text;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_thread_id_column TO authenticated;



-- // Old Schema

create table messages (
  id uuid primary key,
  conversation_id uuid references conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  text text,
  file jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table conversations enable row level security;

-- Policy for selecting user conversations
create policy "User can access their own conversations"
on conversations for select
using (auth.email() = user_email);