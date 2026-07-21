-- Add metadata JSONB column to messages for raw payload storage
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Index for querying by message_id (for edits)
CREATE INDEX IF NOT EXISTS idx_messages_message_id_on_conversation ON messages(message_id, conversation_id);
