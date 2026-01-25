PRAGMA foreign_keys = ON;

-- =========================
-- speakers
-- =========================
CREATE TABLE IF NOT EXISTS speakers (
  speaker_id         INTEGER PRIMARY KEY,
  speaker_name       TEXT NOT NULL,
  speaker_role       TEXT NOT NULL,   -- 例: "リラ", "GPT-5.2"
  canonical_role     TEXT NOT NULL CHECK (canonical_role IN ('human','ai','system','unknown')),
  created_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_speakers_canonical_role ON speakers(canonical_role);

-- =========================
-- card role major items
-- =========================
CREATE TABLE IF NOT EXISTS card_role_major_items (
  card_role_major_item_id    INTEGER PRIMARY KEY,
  major_name                 TEXT NOT NULL UNIQUE
  -- 例: Goal/Claim/Hypothesis/Reason/Example/Decision/Rejection/Question/Other/Meaningless
);

-- =========================
-- card roles (minor items)
-- =========================
CREATE TABLE IF NOT EXISTS card_roles (
  card_role_id               INTEGER PRIMARY KEY,
  card_role_major_item_id    INTEGER NOT NULL,
  minor_name                 TEXT NOT NULL,
  created_at                 TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at                 TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (card_role_major_item_id) REFERENCES card_role_major_items(card_role_major_item_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_card_roles_major_minor
  ON card_roles(card_role_major_item_id, minor_name);

-- =========================
-- meaningless phrases (optional dictionary)
-- =========================
CREATE TABLE IF NOT EXISTS meaningless_phrases (
  meaningless_id     INTEGER PRIMARY KEY,
  card_role_id       INTEGER NOT NULL,
  phrase             TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (card_role_id) REFERENCES card_roles(card_role_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meaningless_phrases_role_phrase
  ON meaningless_phrases(card_role_id, phrase);

-- =========================
-- cards
-- =========================
CREATE TABLE IF NOT EXISTS cards (
  card_id                INTEGER PRIMARY KEY,

  thread_id              TEXT NOT NULL,      -- UUID文字列
  message_id             INTEGER NOT NULL,   -- 1,2,3... (ログ確定の想定)
  text_id                INTEGER NOT NULL,   -- 1,2,3... (疎でもOK)
  split_key              INTEGER NOT NULL,   -- 1,2,3...（ソート用）

  split_version          INTEGER NOT NULL DEFAULT 1,

  speaker_id             INTEGER NOT NULL,
  conversation_at        TEXT NOT NULL,      -- 発言時刻(ISO8601推奨)

  contents               TEXT NOT NULL,
  is_edited              INTEGER NOT NULL DEFAULT 0 CHECK (is_edited IN (0,1)),

  card_role_id           INTEGER,            -- LLM付与結果（未確定ならNULL）
  card_role_confidence   REAL,               -- 0.0-1.0想定
  visibility             TEXT NOT NULL DEFAULT 'normal'
                         CHECK (visibility IN ('normal','hidden','archived')),

  created_at             TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at             TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),

  FOREIGN KEY (speaker_id) REFERENCES speakers(speaker_id),
  FOREIGN KEY (card_role_id) REFERENCES card_roles(card_role_id),

  -- 論理キー：これで「参照で本文を再現」が安定する
  UNIQUE (thread_id, message_id, text_id, split_version)
);

CREATE INDEX IF NOT EXISTS idx_cards_thread_msg
  ON cards(thread_id, message_id);

CREATE INDEX IF NOT EXISTS idx_cards_role_visibility
  ON cards(card_role_id, visibility);

CREATE INDEX IF NOT EXISTS idx_cards_conversation_at
  ON cards(conversation_at);

-- =========================
-- link kinds
-- =========================
CREATE TABLE IF NOT EXISTS link_kinds (
  link_kind_id      INTEGER PRIMARY KEY,
  link_kind_name    TEXT NOT NULL UNIQUE
  -- supports/contradicts/refines/derived_from/example_of/depends_on
);

-- =========================
-- card links (directed edges)
-- =========================
CREATE TABLE IF NOT EXISTS card_links (
  link_id           INTEGER PRIMARY KEY,
  link_kind_id      INTEGER NOT NULL,

  from_card_id      INTEGER NOT NULL,
  to_card_id        INTEGER NOT NULL,

  confidence        REAL, -- 0.0-1.0想定

  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),

  FOREIGN KEY (link_kind_id) REFERENCES link_kinds(link_kind_id),
  FOREIGN KEY (from_card_id) REFERENCES cards(card_id) ON DELETE CASCADE,
  FOREIGN KEY (to_card_id) REFERENCES cards(card_id) ON DELETE CASCADE,

  CHECK (from_card_id <> to_card_id)
);

CREATE INDEX IF NOT EXISTS idx_card_links_from
  ON card_links(from_card_id);

CREATE INDEX IF NOT EXISTS idx_card_links_to
  ON card_links(to_card_id);

CREATE INDEX IF NOT EXISTS idx_card_links_kind
  ON card_links(link_kind_id);

-- ある種の重複リンクを防ぎたいなら（任意）
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_links_kind_from_to
  ON card_links(link_kind_id, from_card_id, to_card_id);

-- =========================
-- link_suggestions (pool)
-- =========================
CREATE TABLE IF NOT EXISTS link_suggestions (
  suggestion_id      INTEGER PRIMARY KEY,

  -- 片方向運用：ペアは1組だけ保持する前提
  -- 生成時に from_card_id < to_card_id に正規化して入れるのがおすすめ
  from_card_id       INTEGER NOT NULL,
  to_card_id         INTEGER NOT NULL,

  -- LLM提案結果（未処理ならNULL）
  suggested_link_kind_id   INTEGER,   -- link_kinds.link_kind_id
  suggested_confidence     REAL,      -- 0.0-1.0想定

  -- 状態管理
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN (
                      'queued',       -- 未処理
                      'processing',   -- 処理中
                      'success',      -- 提案取得済
                      'failed',       -- 取得失敗
                      'approved',     -- 承認してcard_linksへ反映済
                      'rejected'      -- 却下
                    )),

  -- 監査用
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),

  -- 1週間後に掃除したいならこれを使う（NULLなら対象外）
  expires_at        TEXT,

  FOREIGN KEY (from_card_id) REFERENCES cards(card_id) ON DELETE CASCADE,
  FOREIGN KEY (to_card_id)   REFERENCES cards(card_id) ON DELETE CASCADE,
  FOREIGN KEY (suggested_link_kind_id) REFERENCES link_kinds(link_kind_id),

  CHECK (from_card_id <> to_card_id)
);

-- 重複ペアはスキップ（検討済扱い）
CREATE UNIQUE INDEX IF NOT EXISTS uq_link_suggestions_pair
  ON link_suggestions(from_card_id, to_card_id);

-- ステータス別に拾いやすく
CREATE INDEX IF NOT EXISTS idx_link_suggestions_status
  ON link_suggestions(status);

-- キュー処理で使う
CREATE INDEX IF NOT EXISTS idx_link_suggestions_queue
  ON link_suggestions(status, updated_at);

-- 提案内容でフィルタしたい時用
CREATE INDEX IF NOT EXISTS idx_link_suggestions_kind_conf
  ON link_suggestions(suggested_link_kind_id, suggested_confidence);

-- 期限切れ掃除用
CREATE INDEX IF NOT EXISTS idx_link_suggestions_expires_at
  ON link_suggestions(expires_at);

-- =========================
-- llm_jobs
-- =========================

CREATE TABLE llm_jobs (
    job_id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- ジョブ種別（処理内容）
    job_type TEXT NOT NULL
        CHECK (job_type IN ('card_role', 'link_suggestion')),

    -- 対象データ
    target_table TEXT NOT NULL
        CHECK (target_table IN ('cards', 'link_suggestions')),
    target_id INTEGER NOT NULL,

    -- 状態管理
    status TEXT NOT NULL
        CHECK (status IN ('queued', 'processing', 'success', 'failed'))
        DEFAULT 'queued',

    -- ロック・進捗
    locked_at TEXT,          -- processing にした時刻
    lock_owner TEXT,         -- worker識別子（任意）
    started_at TEXT,         -- 実処理開始
    finished_at TEXT,        -- 成功 or 失敗確定

    -- エラー情報（failed時のみ）
    error TEXT,

    -- メタ情報（将来用・任意）
    result_json TEXT,        -- モデル名、推論時間など入れたくなったら
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- 1週間後に掃除したいならこれを使う（NULLなら対象外）
    expires_at        TEXT
);

-- 同一対象への二重投入を防ぐ（必要なら）
CREATE UNIQUE INDEX idx_llm_jobs_unique_target
ON llm_jobs (job_type, target_table, target_id);

-- キュー取得高速化
CREATE INDEX idx_llm_jobs_queue
ON llm_jobs (status, created_at);

-- processing 回収用
CREATE INDEX idx_llm_jobs_processing
ON llm_jobs (status, locked_at);

-- 期限切れ掃除用
CREATE INDEX IF NOT EXISTS idx_llm_jobs_expires_at
  ON llm_jobs(expires_at);