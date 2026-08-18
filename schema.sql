-- 개인용 AI 채팅 D1 스키마
-- 설계 원칙: 대화 원문은 절대 삭제하지 않는다.
-- 요약이 끝난 메시지는 messages.summarized = 1 로 표시만 하고,
-- API 요청에 포함하지 않을 뿐 DB에는 영구히 남는다.

-- 대화 스레드. 지금 UI는 단일 스레드(id = 1)만 쓰지만,
-- 나중에 여러 페르소나/주제별 스레드를 붙일 수 있게 테이블로 분리해 둔다.
CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL DEFAULT '기본 대화',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 대화 원문 전체.
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role            TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT    NOT NULL,
  model           TEXT,                        -- assistant 메시지를 만든 모델 (user는 NULL)
  summarized      INTEGER NOT NULL DEFAULT 0,  -- 1 = 기억 노트로 압축 완료, API 전송 대상에서 제외
  created_at      INTEGER NOT NULL
);

-- 전체 히스토리 조회(최신순 페이지네이션)용
CREATE INDEX IF NOT EXISTS idx_messages_history
  ON messages (conversation_id, id DESC);

-- 매 턴 "아직 요약 안 된 메시지"를 뽑는 쿼리용
CREATE INDEX IF NOT EXISTS idx_messages_active
  ON messages (conversation_id, summarized, id);

-- 압축된 기억 노트. 스레드당 한 줄.
CREATE TABLE IF NOT EXISTS memory (
  conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id),
  notes           TEXT    NOT NULL DEFAULT '',
  updated_at      INTEGER NOT NULL,
  lock_until      INTEGER              -- 요약 작업 중복 실행 방지용 락 (epoch ms)
);

-- 기본 스레드 시드
INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at)
  VALUES (1, '기본 대화', unixepoch() * 1000, unixepoch() * 1000);
INSERT OR IGNORE INTO memory (conversation_id, notes, updated_at)
  VALUES (1, '', unixepoch() * 1000);
