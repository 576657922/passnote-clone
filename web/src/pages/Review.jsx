import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, post } from '../api.js'
import { useApp } from '../App.jsx'
import QuestionCard from '../components/QuestionCard.jsx'

// 术语记忆卡（点击翻面 → 认识 / 不认识）
function Flashcards({ terms: initial }) {
  const [terms, setTerms] = useState(initial)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  if (terms.length === 0) {
    return <div className="empty">🎉 当前没有到期的术语卡。已复习 {done} 张，明天再来！</div>
  }
  const t = terms[0]

  async function grade(know) {
    try { await post('/review/term', { termId: t.id, result: know ? 'know' : 'unknown' }) } catch { /* 忽略 */ }
    setTerms(ts => ts.slice(1))
    setFlipped(false)
    setDone(d => d + 1)
  }

  return (
    <div>
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
        剩余 {terms.length} 张 · 已复习 {done} 张
      </div>
      <div className="card flashcard" onClick={() => setFlipped(f => !f)}>
        {!flipped ? (
          <>
            <div className="front">{t.title}</div>
            <div className="hint">点击卡片查看释义 ↻</div>
          </>
        ) : (
          <>
            <div className="back-title">{t.title}（{t.titleZh}）</div>
            <div className="back-desc">{t.description}</div>
          </>
        )}
      </div>
      {flipped && (
        <div className="flash-actions">
          <button className="btn danger big" onClick={() => grade(false)}>不认识 · 稍后再看</button>
          <button className="btn accent big" onClick={() => grade(true)}>认识 ✓</button>
        </div>
      )}
    </div>
  )
}

// 复习模式：错题重做 + 术语记忆卡
export default function Review() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('wrong')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    get('/review').then(setData).catch(e => setError(e.message))
  }, [user])

  if (!user) {
    return (
      <div className="container">
        <div className="page-head">
          <h1>复习模式</h1>
          <p className="sub">根据做题记录、薄弱领域和术语卡状态，整理下一步该复习的内容。</p>
        </div>
        <div className="section" style={{ paddingTop: 10 }}>
          <div className="card" style={{ maxWidth: 560, textAlign: 'center', padding: 40 }}>
            <p style={{ marginBottom: 18, color: 'var(--muted)' }}>复习模式基于你的做题记录，需要先登录（免费）。</p>
            <button className="btn primary big" onClick={() => navigate('/register')}>免费注册 →</button>
          </div>
        </div>
      </div>
    )
  }

  if (error) return <div className="container empty">{error}</div>
  if (!data) return <div className="container loading">加载中…</div>

  return (
    <div className="container">
      <div className="page-head">
        <h1>复习模式</h1>
        <p className="sub">错题会回到复习，术语卡按记忆状态安排复现。短练习也能持续积累。</p>
      </div>
      <div className="section" style={{ paddingTop: 14 }}>
        <div className="pill-select" style={{ marginBottom: 22 }}>
          <button className={tab === 'wrong' ? 'active' : ''} onClick={() => setTab('wrong')}>错题重做（{data.wrongQuestions.length}）</button>
          <button className={tab === 'terms' ? 'active' : ''} onClick={() => setTab('terms')}>术语记忆卡（{data.terms.length}）</button>
        </div>
        {tab === 'wrong' ? (
          data.wrongQuestions.length === 0
            ? <div className="empty">🎉 没有待复习的错题。去<a href="/practice" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>练习</a>里刷几题吧！</div>
            : data.wrongQuestions.map(q => <QuestionCard key={q.id} question={q} mode="review" />)
        ) : (
          <Flashcards terms={data.terms} />
        )}
      </div>
    </div>
  )
}
