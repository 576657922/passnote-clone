import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../api.js'
import { useApp } from '../App.jsx'
import QuestionCard from '../components/QuestionCard.jsx'

const EXAMS = [
  { code: '', label: '全部考试' },
  { code: 'IP', label: 'IT Passport' },
  { code: 'FE', label: '基本情報' },
  { code: 'SG', label: 'SG' },
  { code: 'AP', label: 'AP' },
]
const DOMAINS = [
  { code: '', label: '全部领域' },
  { code: 'strategy', label: '战略类' },
  { code: 'management', label: '管理类' },
  { code: 'technology', label: '技术类' },
]

// 随机小练：选考试 / 领域 / 题数
export default function Practice() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [exam, setExam] = useState('')
  const [domain, setDomain] = useState('')
  const [count, setCount] = useState(10)
  const [questions, setQuestions] = useState(null)
  const [stats, setStats] = useState({ done: 0, correct: 0 })
  const [error, setError] = useState(null)

  async function start() {
    if (!user) { navigate('/register'); return }
    setError(null)
    try {
      const params = new URLSearchParams()
      if (exam) params.set('exam', exam)
      if (domain) params.set('domain', domain)
      params.set('count', count)
      const d = await get(`/practice/random?${params}`)
      setQuestions(d.questions)
      setStats({ done: 0, correct: 0 })
    } catch (e) {
      setError(e.message)
    }
  }

  if (questions) {
    return (
      <div className="container">
        <div className="page-head">
          <h1>随机小练</h1>
          <p className="sub">共 {questions.length} 题 · 已作答 {stats.done} 题 · 正确 {stats.correct} 题</p>
        </div>
        <div className="section" style={{ paddingTop: 16 }}>
          {questions.map(q => (
            <QuestionCard key={q.id} question={q}
              onAnswered={c => setStats(s => ({ done: s.done + 1, correct: s.correct + (c ? 1 : 0) }))} />
          ))}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '28px 0' }}>
            <button className="btn primary" onClick={start}>再来一组 →</button>
            <button className="btn" onClick={() => setQuestions(null)}>调整条件</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>练习中心</h1>
        <p className="sub">年度真题、分领域练习、随机小练都来自同一套题库。选择条件后开始。</p>
      </div>
      <div className="section" style={{ paddingTop: 20, maxWidth: 640 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>考试</div>
            <div className="pill-select">
              {EXAMS.map(e => (
                <button key={e.code} className={exam === e.code ? 'active' : ''} onClick={() => setExam(e.code)}>{e.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>领域</div>
            <div className="pill-select">
              {DOMAINS.map(d => (
                <button key={d.code} className={domain === d.code ? 'active' : ''} onClick={() => setDomain(d.code)}>{d.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>题数</div>
            <div className="pill-select">
              {[5, 10, 20].map(n => (
                <button key={n} className={count === n ? 'active' : ''} onClick={() => setCount(n)}>{n} 题</button>
              ))}
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary big" onClick={start}>开始练习 →</button>
          {!user && <div style={{ fontSize: 13, color: 'var(--muted)' }}>随机练习需要登录（免费），作答记录会自动同步到你的账号。</div>}
        </div>
      </div>
    </div>
  )
}
