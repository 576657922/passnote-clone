// AI 解析 + AI 学习搭子「トモ」— Anthropic Messages API
// 设置环境变量 ANTHROPIC_API_KEY 后启用真实 AI；未设置时解析回退到内置解析。
import Anthropic from '@anthropic-ai/sdk'
import { db, DOMAIN_LABELS } from './db.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
const KANA = ['ア', 'イ', 'ウ', 'エ']

export const aiAvailable = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

let client = null
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

const LANG_NAMES = { ja: '日本語', zh: '简体中文', en: 'English' }

function questionContext(q) {
  const choices = JSON.parse(q.choices)
  return [
    `試験: ${q.exam_code} / 分野: ${DOMAIN_LABELS[q.domain]?.ja || q.domain}`,
    `問題: ${q.text}`,
    ...choices.map((c, i) => `${KANA[i]}. ${c}`),
    `正解: ${KANA[q.answer]}`,
  ].join('\n')
}

// 逐题 AI 解析（带 DB 缓存）
export async function explainQuestion(q, lang) {
  const cached = db.prepare('SELECT content, model FROM ai_explanations WHERE question_id = ? AND lang = ?').get(q.id, lang)
  if (cached) return { content: cached.content, source: 'ai', model: cached.model, cached: true }

  if (!aiAvailable()) {
    // 回退：内置解析
    const content = lang === 'zh' ? q.explanation_zh : q.explanation
    return {
      content,
      source: 'builtin',
      notice: '未配置 ANTHROPIC_API_KEY，当前显示内置解析。配置后可生成日/中/英三语 AI 解析。',
    }
  }

  const system = 'あなたは日本のIPA情報処理技術者試験（ITパスポート・基本情報・SG・AP）の解説専門家です。受験者が根拠を持って正解を選べるように、正解の理由と他の選択肢が誤りである理由を簡潔かつ正確に解説してください。専門用語には短い補足を付けてください。マークダウンは使わず、プレーンテキストで3〜6文にまとめてください。'
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{
      role: 'user',
      content: `${questionContext(q)}\n\n上記の問題を${LANG_NAMES[lang] || '日本語'}で解説してください。`,
    }],
  })
  const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
  db.prepare('INSERT OR REPLACE INTO ai_explanations (question_id, lang, content, model) VALUES (?, ?, ?, ?)').run(q.id, lang, content, MODEL)
  return { content, source: 'ai', model: MODEL, cached: false }
}

// AI 学习搭子「トモ」多轮聊天
export async function tomoChat(messages, question) {
  if (!aiAvailable()) {
    return {
      content: 'こんにちは、トモです！🙌\n\n当前还没有配置 ANTHROPIC_API_KEY，所以我暂时不能聊天。请在启动服务前设置环境变量：\n\nexport ANTHROPIC_API_KEY=sk-ant-...\n\n配置好之后我就可以随时陪你答疑解惑啦！',
      source: 'builtin',
    }
  }

  let system = 'あなたは「トモ」という名前のAI学習パートナーです。日本のIPA情報処理技術者試験（ITパスポート・基本情報技術者・情報セキュリティマネジメント・応用情報技術者）の受験者に寄り添い、質問に答えたり、用語を説明したり、勉強のアドバイスをしたりします。親しみやすく励ましながら、内容は正確に。ユーザーが使う言語（日本語・中国語・英語）に合わせて返答してください。回答は簡潔に、必要なら箇条書きを使ってください。'
  if (question) {
    system += `\n\n現在ユーザーが取り組んでいる問題:\n${questionContext(question)}\n解説(参考): ${question.explanation}`
  }

  const cleaned = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== 'user') {
    throw Object.assign(new Error('messages 必须以 user 消息结尾'), { status: 400 })
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: cleaned,
  })
  const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
  return { content, source: 'ai', model: MODEL }
}

// 统一的 API 错误转换（按类型链捕获）
export function aiErrorToHttp(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 502, error: 'Anthropic API key 无效，请检查 ANTHROPIC_API_KEY。' }
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, error: 'AI 请求过于频繁，请稍后再试。' }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 502, error: '无法连接 Anthropic API，请检查网络。' }
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 502, error: `Anthropic API 错误（${err.status}）：${err.message}` }
  }
  if (err && err.status === 400) return { status: 400, error: err.message }
  return null
}
