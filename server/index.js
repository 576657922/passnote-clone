import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db, DOMAIN_LABELS } from './db.js'
import { explainQuestion, tomoChat, aiAvailable, aiErrorToHttp } from './ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 5170
const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// ---------- 密码与会话 ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare("INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(token, userId)
  return token
}
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name }
}

// ---------- 中间件 ----------
function attachUser(req, _res, next) {
  const token = req.cookies?.pn_session
  if (token) {
    const row = db.prepare(`
      SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`).get(token)
    if (row) req.user = row
  }
  next()
}
app.use(attachUser)

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录', code: 'UNAUTHORIZED' })
  next()
}

const KANA = ['ア', 'イ', 'ウ', 'エ']
function questionPublic(q, withAnswer = false) {
  const base = {
    id: q.id,
    examCode: q.exam_code,
    sessionCode: q.session_code,
    sessionLabel: q.session_label || undefined,
    number: q.number,
    domain: q.domain,
    domainLabel: DOMAIN_LABELS[q.domain]?.zh || q.domain,
    text: q.text,
    choices: JSON.parse(q.choices),
  }
  if (withAnswer) {
    base.answer = q.answer
    base.answerKana = KANA[q.answer]
    base.explanation = q.explanation
    base.explanationZh = q.explanation_zh
  }
  return base
}
function questionTerms(qid) {
  return db.prepare(`
    SELECT t.slug, t.title, t.title_zh AS titleZh FROM term_questions tq
    JOIN terms t ON t.id = tq.term_id WHERE tq.question_id = ?`).all(qid)
}
const getQuestion = (id) => db.prepare(`
  SELECT q.*, s.label AS session_label FROM questions q
  JOIN exam_sessions s ON s.code = q.session_code WHERE q.id = ?`).get(id)

// ---------- 认证 ----------
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' })
  if (!password || password.length < 6) return res.status(400).json({ error: '密码至少 6 位' })
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (exists) return res.status(409).json({ error: '该邮箱已注册，请直接登录' })
  const r = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(email.toLowerCase(), hashPassword(password), name?.trim() || email.split('@')[0])
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid))
  res.cookie('pn_session', createSession(user.id), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 })
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: '邮箱或密码不正确' })
  }
  res.cookie('pn_session', createSession(user.id), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 })
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.pn_session
  if (token) db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token)
  res.clearCookie('pn_session')
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

// ---------- 元信息（落地页统计） ----------
app.get('/api/meta', (_req, res) => {
  const questionCount = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c
  const sessionCount = db.prepare('SELECT COUNT(*) AS c FROM exam_sessions').get().c
  const termCount = db.prepare('SELECT COUNT(*) AS c FROM terms').get().c
  res.json({ questionCount, sessionCount, termCount, aiAvailable: aiAvailable() })
})

// ---------- 考试 / 年度场次 ----------
app.get('/api/exams', (_req, res) => {
  const exams = db.prepare(`
    SELECT e.*, COUNT(DISTINCT s.code) AS sessionCount, COUNT(q.id) AS questionCount
    FROM exams e
    LEFT JOIN exam_sessions s ON s.exam_code = e.code
    LEFT JOIN questions q ON q.exam_code = e.code
    GROUP BY e.code ORDER BY e.sort`).all()
  res.json({ exams })
})

app.get('/api/exams/:code/sessions', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE code = ?').get(req.params.code.toUpperCase())
  if (!exam) return res.status(404).json({ error: '考试不存在' })
  const sessions = db.prepare(`
    SELECT s.*, COUNT(q.id) AS questionCount FROM exam_sessions s
    LEFT JOIN questions q ON q.session_code = s.code
    WHERE s.exam_code = ? GROUP BY s.code ORDER BY s.sort`).all(exam.code)
  res.json({ exam, sessions })
})

app.get('/api/sessions/:code/questions', (req, res) => {
  const session = db.prepare('SELECT s.*, e.name AS exam_name FROM exam_sessions s JOIN exams e ON e.code = s.exam_code WHERE s.code = ?').get(req.params.code)
  if (!session) return res.status(404).json({ error: '场次不存在' })
  const rows = db.prepare('SELECT * FROM questions WHERE session_code = ? ORDER BY number').all(session.code)
  let answered = {}
  if (req.user) {
    const ans = db.prepare(`
      SELECT question_id, is_correct FROM answers a1 WHERE user_id = ? AND id = (
        SELECT MAX(id) FROM answers a2 WHERE a2.user_id = a1.user_id AND a2.question_id = a1.question_id
      ) AND question_id IN (SELECT id FROM questions WHERE session_code = ?)`).all(req.user.id, session.code)
    answered = Object.fromEntries(ans.map(a => [a.question_id, a.is_correct]))
  }
  res.json({
    session,
    questions: rows.map(q => ({ ...questionPublic(q), lastCorrect: answered[q.id] ?? null })),
  })
})

// ---------- 免登录 5 题体验（含答案，前端判题，不记录进度） ----------
app.get('/api/trial', (_req, res) => {
  const rows = db.prepare(`
    SELECT q.*, s.label AS session_label FROM questions q
    JOIN exam_sessions s ON s.code = q.session_code
    WHERE q.is_trial = 1 ORDER BY q.session_code DESC, q.number LIMIT 5`).all()
  res.json({ questions: rows.map(q => ({ ...questionPublic(q, true), terms: questionTerms(q.id) })) })
})

// ---------- 做题 / 判题 ----------
app.get('/api/questions/:id', requireAuth, (req, res) => {
  const q = getQuestion(Number(req.params.id))
  if (!q) return res.status(404).json({ error: '题目不存在' })
  res.json({ question: { ...questionPublic(q), terms: questionTerms(q.id) } })
})

app.post('/api/questions/:id/answer', requireAuth, (req, res) => {
  const q = getQuestion(Number(req.params.id))
  if (!q) return res.status(404).json({ error: '题目不存在' })
  const choice = Number(req.body?.choice)
  if (!(choice >= 0 && choice <= 3)) return res.status(400).json({ error: 'choice 必须是 0-3' })
  const mode = ['practice', 'mock', 'review'].includes(req.body?.mode) ? req.body.mode : 'practice'
  const correct = choice === q.answer
  db.prepare('INSERT INTO answers (user_id, question_id, choice, is_correct, mode) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, q.id, choice, correct ? 1 : 0, mode)
  res.json({
    correct,
    answer: q.answer,
    answerKana: KANA[q.answer],
    explanation: q.explanation,
    explanationZh: q.explanation_zh,
    terms: questionTerms(q.id),
  })
})

// 随机练习（登录即可用）
app.get('/api/practice/random', requireAuth, (req, res) => {
  const { exam, domain } = req.query
  const count = Math.min(Math.max(Number(req.query.count) || 10, 1), 30)
  let sql = 'SELECT q.*, s.label AS session_label FROM questions q JOIN exam_sessions s ON s.code = q.session_code WHERE 1=1'
  const params = []
  if (exam) { sql += ' AND q.exam_code = ?'; params.push(String(exam).toUpperCase()) }
  if (domain && DOMAIN_LABELS[domain]) { sql += ' AND q.domain = ?'; params.push(domain) }
  sql += ' ORDER BY RANDOM() LIMIT ?'
  params.push(count)
  const rows = db.prepare(sql).all(...params)
  res.json({ questions: rows.map(q => questionPublic(q)) })
})

// ---------- AI 解析（Pro） ----------
app.post('/api/ai/explain', requireAuth, async (req, res) => {
  const q = getQuestion(Number(req.body?.questionId))
  if (!q) return res.status(404).json({ error: '题目不存在' })
  const lang = ['ja', 'zh', 'en'].includes(req.body?.lang) ? req.body.lang : 'ja'
  try {
    res.json(await explainQuestion(q, lang))
  } catch (err) {
    const mapped = aiErrorToHttp(err)
    if (mapped) return res.status(mapped.status).json({ error: mapped.error })
    console.error(err)
    res.status(500).json({ error: 'AI 解析生成失败' })
  }
})

// ---------- AI 学习搭子トモ（Pro） ----------
app.post('/api/ai/chat', requireAuth, async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  const question = req.body?.questionId ? getQuestion(Number(req.body.questionId)) : null
  try {
    res.json(await tomoChat(messages, question))
  } catch (err) {
    const mapped = aiErrorToHttp(err)
    if (mapped) return res.status(mapped.status).json({ error: mapped.error })
    console.error(err)
    res.status(500).json({ error: 'トモ暂时无法回复' })
  }
})

// ---------- 模拟考试（Pro） ----------
const MOCK_CONFIG = { count: 20, secPerQuestion: 72, passScore: 600, domainFloor: 0.3 }

app.post('/api/mock/start', requireAuth, (req, res) => {
  const examCode = String(req.body?.exam || 'IP').toUpperCase()
  const exam = db.prepare('SELECT * FROM exams WHERE code = ?').get(examCode)
  if (!exam) return res.status(404).json({ error: '考试不存在' })
  const rows = db.prepare(`
    SELECT q.*, s.label AS session_label FROM questions q
    JOIN exam_sessions s ON s.code = q.session_code
    WHERE q.exam_code = ? ORDER BY RANDOM() LIMIT ?`).all(examCode, MOCK_CONFIG.count)
  if (rows.length < 4) return res.status(400).json({ error: '该考试题量不足，无法组卷' })
  const durationSec = rows.length * MOCK_CONFIG.secPerQuestion
  const r = db.prepare('INSERT INTO mock_exams (user_id, exam_code, question_ids, duration_sec) VALUES (?, ?, ?, ?)')
    .run(req.user.id, examCode, JSON.stringify(rows.map(q => q.id)), durationSec)
  res.json({
    id: Number(r.lastInsertRowid),
    exam: { code: exam.code, name: exam.name },
    durationSec,
    questions: rows.map(q => questionPublic(q)),
  })
})

app.post('/api/mock/:id/submit', requireAuth, (req, res) => {
  const mock = db.prepare('SELECT * FROM mock_exams WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id)
  if (!mock) return res.status(404).json({ error: '模拟考试不存在' })
  if (mock.status === 'finished') return res.status(409).json({ error: '该场模拟考试已提交' })
  const qids = JSON.parse(mock.question_ids)
  const userAnswers = Array.isArray(req.body?.answers) ? req.body.answers : []
  const insAns = db.prepare('INSERT INTO answers (user_id, question_id, choice, is_correct, mode) VALUES (?, ?, ?, ?, ?)')
  const perDomain = {}
  const detailQuestions = []
  let correctCount = 0
  qids.forEach((qid, i) => {
    const q = getQuestion(qid)
    const choice = Number.isInteger(userAnswers[i]) ? userAnswers[i] : null
    const correct = choice === q.answer
    if (correct) correctCount++
    perDomain[q.domain] = perDomain[q.domain] || { total: 0, correct: 0 }
    perDomain[q.domain].total++
    if (correct) perDomain[q.domain].correct++
    if (choice !== null) insAns.run(req.user.id, qid, choice, correct ? 1 : 0, 'mock')
    detailQuestions.push({
      ...questionPublic(q, true),
      yourChoice: choice,
      correct,
    })
  })
  const score = Math.round((correctCount / qids.length) * 1000)
  const domains = Object.entries(perDomain).map(([d, v]) => ({
    domain: d,
    label: DOMAIN_LABELS[d]?.zh || d,
    total: v.total,
    correct: v.correct,
    rate: v.correct / v.total,
  }))
  const passed = score >= MOCK_CONFIG.passScore && domains.every(d => d.rate >= MOCK_CONFIG.domainFloor)
  const detail = { correctCount, total: qids.length, domains, passed, passScore: MOCK_CONFIG.passScore }
  db.prepare("UPDATE mock_exams SET status = 'finished', finished_at = datetime('now'), score = ?, detail = ? WHERE id = ?")
    .run(score, JSON.stringify(detail), mock.id)
  res.json({ score, ...detail, questions: detailQuestions })
})

app.get('/api/mock/history', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.id, m.exam_code AS examCode, m.status, m.started_at AS startedAt,
           m.finished_at AS finishedAt, m.score, m.detail
    FROM mock_exams m WHERE m.user_id = ? ORDER BY m.id DESC LIMIT 20`).all(req.user.id)
  res.json({ mocks: rows.map(m => ({ ...m, detail: m.detail ? JSON.parse(m.detail) : null })) })
})

// ---------- 复习模式（Pro）：错题 + 术语记忆卡 ----------
app.get('/api/review', requireAuth, (req, res) => {
  // 错题：用户对每道题的最近一次作答为错误的题
  const wrong = db.prepare(`
    SELECT q.*, s.label AS session_label FROM questions q
    JOIN exam_sessions s ON s.code = q.session_code
    WHERE q.id IN (
      SELECT a1.question_id FROM answers a1
      WHERE a1.user_id = ? AND a1.id = (
        SELECT MAX(id) FROM answers a2 WHERE a2.user_id = a1.user_id AND a2.question_id = a1.question_id
      ) AND a1.is_correct = 0
    ) ORDER BY RANDOM() LIMIT 20`).all(req.user.id)

  // 术语卡：到期的学习中卡片 + 尚未学习的新卡片
  const due = db.prepare(`
    SELECT t.id, t.slug, t.title, t.title_zh AS titleZh, t.category, t.description,
           p.status, p.streak
    FROM term_progress p JOIN terms t ON t.id = p.term_id
    WHERE p.user_id = ? AND p.due_at <= datetime('now') AND p.status != 'known'
    ORDER BY p.due_at LIMIT 10`).all(req.user.id)
  const fresh = db.prepare(`
    SELECT t.id, t.slug, t.title, t.title_zh AS titleZh, t.category, t.description,
           'new' AS status, 0 AS streak
    FROM terms t WHERE t.id NOT IN (SELECT term_id FROM term_progress WHERE user_id = ?)
    ORDER BY RANDOM() LIMIT ?`).all(req.user.id, Math.max(0, 10 - due.length))

  res.json({
    wrongQuestions: wrong.map(q => questionPublic(q)),
    terms: [...due, ...fresh],
  })
})

app.post('/api/review/term', requireAuth, (req, res) => {
  const termId = Number(req.body?.termId)
  const know = req.body?.result === 'know'
  const term = db.prepare('SELECT id FROM terms WHERE id = ?').get(termId)
  if (!term) return res.status(404).json({ error: '术语不存在' })
  const cur = db.prepare('SELECT * FROM term_progress WHERE user_id = ? AND term_id = ?').get(req.user.id, termId)
  const streak = know ? (cur?.streak || 0) + 1 : 0
  // 简化间隔重复：认识 → 1天/3天/7天后复现并标记掌握；不认识 → 10分钟后复现
  let status = 'learning'
  let interval = "'+10 minutes'"
  if (know) {
    if (streak >= 3) { status = 'known'; interval = "'+7 days'" }
    else if (streak === 2) interval = "'+3 days'"
    else interval = "'+1 day'"
  }
  db.prepare(`
    INSERT INTO term_progress (user_id, term_id, status, streak, due_at)
    VALUES (?, ?, ?, ?, datetime('now', ${interval}))
    ON CONFLICT(user_id, term_id) DO UPDATE SET status = excluded.status, streak = excluded.streak, due_at = excluded.due_at`)
    .run(req.user.id, termId, status, streak)
  res.json({ ok: true, status, streak })
})

// ---------- 学习统计仪表盘（Pro） ----------
app.get('/api/stats', requireAuth, (req, res) => {
  const uid = req.user.id
  const totals = db.prepare('SELECT COUNT(*) AS answered, COALESCE(SUM(is_correct), 0) AS correct FROM answers WHERE user_id = ?').get(uid)
  const uniqueAnswered = db.prepare('SELECT COUNT(DISTINCT question_id) AS c FROM answers WHERE user_id = ?').get(uid).c

  // 最近 14 天活动
  const daily = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count, SUM(is_correct) AS correct
    FROM answers WHERE user_id = ? AND created_at >= datetime('now', '-14 days')
    GROUP BY date(created_at) ORDER BY day`).all(uid)

  // 连续学习天数（从今天/昨天往前数）
  const days = new Set(db.prepare("SELECT DISTINCT date(created_at) AS d FROM answers WHERE user_id = ?").all(uid).map(r => r.d))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 400; i++) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10)
    if (days.has(d)) streak++
    else if (i === 0) continue // 今天还没做题，不中断
    else break
  }

  // 分领域正确率
  const byDomain = db.prepare(`
    SELECT q.domain, COUNT(*) AS total, SUM(a.is_correct) AS correct
    FROM answers a JOIN questions q ON q.id = a.question_id
    WHERE a.user_id = ? GROUP BY q.domain`).all(uid)
    .map(r => ({ domain: r.domain, label: DOMAIN_LABELS[r.domain]?.zh || r.domain, total: r.total, correct: r.correct }))

  // 各考试进度
  const byExam = db.prepare(`
    SELECT e.code, e.name, COUNT(DISTINCT q.id) AS total,
           COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) AS answered
    FROM exams e
    JOIN questions q ON q.exam_code = e.code
    LEFT JOIN answers a ON a.question_id = q.id AND a.user_id = ?
    GROUP BY e.code ORDER BY e.sort`).all(uid)

  // 术语卡进度
  const termStats = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status = 'known' THEN 1 ELSE 0 END), 0) AS known,
           COALESCE(SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END), 0) AS learning
    FROM term_progress WHERE user_id = ?`).get(uid)
  const termTotal = db.prepare('SELECT COUNT(*) AS c FROM terms').get().c

  const mockBest = db.prepare("SELECT MAX(score) AS best, COUNT(*) AS count FROM mock_exams WHERE user_id = ? AND status = 'finished'").get(uid)

  res.json({
    totals: { answered: totals.answered, correct: totals.correct, uniqueAnswered, accuracy: totals.answered ? totals.correct / totals.answered : 0 },
    streak,
    daily,
    byDomain,
    byExam,
    terms: { ...termStats, total: termTotal },
    mock: { best: mockBest.best, count: mockBest.count },
  })
})

// ---------- 术语表 ----------
app.get('/api/glossary', (req, res) => {
  const { category, q } = req.query
  let sql = `
    SELECT t.*, COUNT(tq.question_id) AS questionCount FROM terms t
    LEFT JOIN term_questions tq ON tq.term_id = t.id WHERE 1=1`
  const params = []
  if (category && category !== 'all') { sql += ' AND t.category = ?'; params.push(category) }
  if (q) { sql += ' AND (t.title LIKE ? OR t.title_zh LIKE ? OR t.slug LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  sql += ' GROUP BY t.id ORDER BY t.category, t.title'
  const terms = db.prepare(sql).all(...params)
  const counts = db.prepare('SELECT category, COUNT(*) AS c FROM terms GROUP BY category').all()
  res.json({
    terms: terms.map(t => ({ slug: t.slug, title: t.title, titleZh: t.title_zh, category: t.category, categoryLabel: DOMAIN_LABELS[t.category]?.zh || t.category, description: t.description, questionCount: t.questionCount })),
    counts: Object.fromEntries(counts.map(c => [c.category, c.c])),
    total: counts.reduce((s, c) => s + c.c, 0),
  })
})

app.get('/api/glossary/:slug', (req, res) => {
  const term = db.prepare('SELECT * FROM terms WHERE slug = ?').get(req.params.slug)
  if (!term) return res.status(404).json({ error: '术语不存在' })
  const questions = db.prepare(`
    SELECT q.*, s.label AS session_label FROM term_questions tq
    JOIN questions q ON q.id = tq.question_id
    JOIN exam_sessions s ON s.code = q.session_code
    WHERE tq.term_id = ? ORDER BY q.session_code DESC, q.number`).all(term.id)
  res.json({
    term: { slug: term.slug, title: term.title, titleZh: term.title_zh, category: term.category, categoryLabel: DOMAIN_LABELS[term.category]?.zh || term.category, description: term.description },
    questions: questions.map(q => questionPublic(q)),
  })
})

// ---------- 静态资源（生产构建） ----------
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`✅ Passnote clone 已启动: http://localhost:${PORT}`)
  console.log(`   AI 功能: ${aiAvailable() ? `已启用（${process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'}）` : '未配置 ANTHROPIC_API_KEY（解析回退到内置，トモ聊天不可用）'}`)
})
