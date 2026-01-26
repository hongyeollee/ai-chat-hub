-- 두 AI 동시 응답 기능을 위한 parent_message_id 컬럼 추가
-- 같은 user 메시지에 대한 여러 AI 응답을 연결하기 위해 사용

-- messages 테이블에 parent_message_id 컬럼 추가
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES messages(id) ON DELETE SET NULL;

-- 인덱스 추가 (같은 parent_message_id를 가진 메시지들을 빠르게 찾기 위해)
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_message_id);

-- 코멘트 추가
COMMENT ON COLUMN messages.parent_message_id IS '해당 응답이 어떤 user 메시지에 대한 것인지 연결. 같은 질문에 대한 여러 AI 응답을 그룹화하는데 사용.';
