import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const DB_PATH = path.join(dataDir, 'passnote.db')
export const db = new DatabaseSync(DB_PATH)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  pro_since TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  badge TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  code TEXT PRIMARY KEY,
  exam_code TEXT NOT NULL REFERENCES exams(code),
  label TEXT NOT NULL,
  year INTEGER NOT NULL,
  season TEXT NOT NULL DEFAULT '通年',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_code TEXT NOT NULL REFERENCES exams(code),
  session_code TEXT NOT NULL REFERENCES exam_sessions(code),
  number INTEGER NOT NULL,
  domain TEXT NOT NULL,
  text TEXT NOT NULL,
  choices TEXT NOT NULL,          -- JSON array [ア,イ,ウ,エ]
  answer INTEGER NOT NULL,        -- 0..3
  explanation TEXT NOT NULL,      -- 内置日语解析（无 API key 时的回退）
  explanation_zh TEXT NOT NULL,   -- 内置中文解析
  is_trial INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,            -- 日语术语名
  title_zh TEXT NOT NULL,         -- 中文名
  category TEXT NOT NULL,         -- strategy / management / technology / mixed
  description TEXT NOT NULL       -- 中文释义
);

CREATE TABLE IF NOT EXISTS term_questions (
  term_id INTEGER NOT NULL REFERENCES terms(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  PRIMARY KEY (term_id, question_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  choice INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'practice',  -- practice / mock / review
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_answers_date ON answers(user_id, created_at);

CREATE TABLE IF NOT EXISTS mock_exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  exam_code TEXT NOT NULL REFERENCES exams(code),
  question_ids TEXT NOT NULL,     -- JSON array
  duration_sec INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',  -- running / finished
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  score INTEGER,
  detail TEXT                     -- JSON：领域别得分等
);

CREATE TABLE IF NOT EXISTS ai_explanations (
  question_id INTEGER NOT NULL REFERENCES questions(id),
  lang TEXT NOT NULL,             -- ja / zh / en
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (question_id, lang)
);

CREATE TABLE IF NOT EXISTS term_progress (
  user_id INTEGER NOT NULL REFERENCES users(id),
  term_id INTEGER NOT NULL REFERENCES terms(id),
  status TEXT NOT NULL DEFAULT 'new',   -- new / learning / known
  streak INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, term_id)
);
`)

export const DOMAIN_LABELS = {
  strategy: { zh: '战略类', ja: 'ストラテジ系' },
  management: { zh: '管理类', ja: 'マネジメント系' },
  technology: { zh: '技术类', ja: 'テクノロジ系' },
  mixed: { zh: '综合题', ja: '総合' },
}
