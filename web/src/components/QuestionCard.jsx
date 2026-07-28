import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { post } from '../api.js'
import { useApp } from '../App.jsx'

const KANA = ['ア', 'イ', 'ウ', 'エ']
const LANGS = [
  { key: 'ja', label: '日本語' },
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'EN' },
]

// AI 解析面板
function AiExplain({ questionId }) {
  const [lang, setLang] = useState('zh')
  const [state, setState] = useState({})   // { [lang]: {loading, content, notice, error} }

  async function load(l) {
    setLang(l)
    if (state[l]?.content || state[l]?.loading) return
    setState(s => ({ ...s, [l]: { loading: true } }))
    try {
      const d = await post('/ai/explain', { questionId, lang: l })
      setState(s => ({ ...s, [l]: { content: d.content, notice: d.notice, source: d.source } }))
    } catch (err) {
      setState(s => ({ ...s, [l]: { error: err.message } }))
    }
  }

  const cur = state[lang]
  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        ✦ AI 解析
        <div className="langs">
          {LANGS.map(l => (
            <button key={l.key} className={lang === l.key ? 'active' : ''} onClick={() => load(l.key)}>{l.label}</button>
          ))}
        </div>
      </div>
      {!cur && (
        <div className="ai-panel-body">
          <button className="btn small pro" onClick={() => load(lang)}>生成 AI 解析（{LANGS.find(l => l.key === lang).label}）</button>
        </div>
      )}
      {cur?.loading && <div className="ai-panel-body">トモ正在思考…</div>}
      {cur?.error && <div className="ai-panel-body" style={{ color: 'var(--bad)' }}>{cur.error}</div>}
      {cur?.content && <div className="ai-panel-body">{cur.content}</div>}
      {cur?.notice && <div className="ai-notice">{cur.notice}</div>}
    </div>
  )
}

// 通用做题卡片。
// question: 题目对象；withAnswer=true 时（体验题）本地判题；否则调用后端判题接口。
// onAnswered(correct) 回调用于外部统计。
export default function QuestionCard({ question, mode = 'practice', withAnswer = false, showAi = true, onAnswered }) {
  const [picked, setPicked] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const { user } = useApp()

  async function pick(i) {
    if (result) return
    setPicked(i)
    if (withAnswer) {
      const r = {
        correct: i === question.answer,
        answer: question.answer,
        answerKana: KANA[question.answer],
        explanation: question.explanation,
        explanationZh: question.explanationZh,
        terms: question.terms || [],
      }
      setResult(r)
      onAnswered?.(r.correct)
      return
    }
    try {
      const r = await post(`/questions/${question.id}/answer`, { choice: i, mode })
      setResult(r)
      onAnswered?.(r.correct)
    } catch (err) {
      setPicked(null)
      setError(err.status === 401 ? '登录后可作答并记录进度' : err.message)
    }
  }

  function choiceClass(i) {
    if (!result) return picked === i ? 'choice picked' : 'choice'
    if (i === result.answer) return 'choice correct'
    if (i === picked && !result.correct) return 'choice wrong'
    return 'choice'
  }

  return (
    <div className="qcard">
      <div className="qcard-meta">
        <span>{question.sessionLabel || question.sessionCode}</span>
        <span>· #{question.number}</span>
        <span className={`tag ${question.domain}`}>{question.domainLabel}</span>
      </div>
      <div className="qcard-text">{question.text}</div>
      <div className="choices">
        {question.choices.map((c, i) => (
          <button key={i} className={choiceClass(i)} onClick={() => pick(i)} disabled={!!result}>
            <span className="kana">{KANA[i]}</span>
            <span>{c}</span>
          </button>
        ))}
      </div>
      {error && <div className="form-error" style={{ marginTop: 12 }}>{error} {!user && <Link to="/register" style={{ textDecoration: 'underline' }}>免费注册 →</Link>}</div>}
      {result && (
        <>
          <div className={`verdict ${result.correct ? 'good' : 'bad'}`}>
            {result.correct ? '⭕ 回答正确' : '❌ 回答错误'}
            <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 14 }}>正确答案：{result.answerKana}</span>
          </div>
          <div className="explain-box">
            <div className="label">解説</div>
            {result.explanation}
          </div>
          <div className="explain-box">
            <div className="label">中文解析</div>
            {result.explanationZh}
          </div>
          {result.terms?.length > 0 && (
            <div className="term-chips">
              {result.terms.map(t => (
                <Link key={t.slug} to={`/glossary/${t.slug}`} className="term-chip">🔖 {t.title}（{t.titleZh}）</Link>
              ))}
            </div>
          )}
          {showAi && <AiExplain questionId={question.id} />}
        </>
      )}
    </div>
  )
}
