import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, post } from '../api.js'
import { useApp } from '../App.jsx'

const KANA = ['ア', 'イ', 'ウ', 'エ']
const EXAM_OPTIONS = [
  { code: 'IP', label: 'IT Passport' },
  { code: 'FE', label: '基本情報技術者' },
  { code: 'SG', label: '情報セキュリティマネジメント' },
  { code: 'AP', label: '応用情報技術者' },
]

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

// 本番形式模拟考试：限时 + 题号导航 + 交卷评分 + 领域别成绩
export default function Mock() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [exam, setExam] = useState('IP')
  const [mock, setMock] = useState(null)          // {id, questions, durationSec}
  const [answers, setAnswers] = useState([])       // choice | null
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (user) get('/mock/history').then(d => setHistory(d.mocks)).catch(() => {})
  }, [user, result])

  useEffect(() => () => clearInterval(timerRef.current), [])

  async function start() {
    if (!user) { navigate('/register'); return }
    setError(null)
    try {
      const d = await post('/mock/start', { exam })
      setMock(d)
      setAnswers(new Array(d.questions.length).fill(null))
      setCurrent(0)
      setResult(null)
      setRemaining(d.durationSec)
      submittedRef.current = false
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(timerRef.current); submit(true); return 0 }
          return r - 1
        })
      }, 1000)
    } catch (e) {
      setError(e.message)
    }
  }

  async function submit(auto = false) {
    if (submittedRef.current) return
    submittedRef.current = true
    clearInterval(timerRef.current)
    setMock(m => {
      post(`/mock/${m.id}/submit`, { answers: answersRef.current })
        .then(r => setResult({ ...r, auto }))
        .catch(e => setError(e.message))
      return m
    })
  }
  // answers 最新值给定时器回调用
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  // ---------- 成绩页 ----------
  if (result) {
    return (
      <div className="container">
        <div className="score-hero">
          {result.auto && <div className="notice-strip" style={{ display: 'inline-block' }}>⏰ 考试时间到，已自动交卷</div>}
          <div className="score">{result.score}<small> / 1000</small></div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>答对 {result.correctCount} / {result.total} 题 · 合格线 {result.passScore} 分</div>
          <div className={`pass-badge ${result.passed ? 'pass' : 'fail'}`}>{result.passed ? '合格圏 🎉' : '继续加油'}</div>
        </div>
        <div className="section" style={{ paddingTop: 24, maxWidth: 640, margin: '0 auto' }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>领域别成绩</div>
            {result.domains.map(d => (
              <div key={d.domain} className="bar-row">
                <span className="name">{d.label}</span>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${d.rate * 100}%`, background: d.rate >= 0.6 ? 'var(--good)' : d.rate >= 0.3 ? 'var(--strategy)' : 'var(--bad)' }} /></div>
                <span className="val">{d.correct}/{d.total}（{Math.round(d.rate * 100)}%）</span>
              </div>
            ))}
          </div>
          <div style={{ margin: '26px 0', display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => { setResult(null); setMock(null) }}>再考一场</button>
            <button className="btn" onClick={() => navigate('/review')}>去复习错题 →</button>
          </div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, margin: '10px 0 14px' }}>逐题回顾</h2>
          {result.questions.map((q, i) => (
            <div key={q.id} className="qcard">
              <div className="qcard-meta">
                <span>Q{i + 1}</span>
                <span className={`tag ${q.domain}`}>{q.domainLabel}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: q.correct ? 'var(--good)' : 'var(--bad)' }}>
                  {q.correct ? '⭕' : q.yourChoice === null ? '未作答' : '❌'}
                </span>
              </div>
              <div className="qcard-text">{q.text}</div>
              <div className="choices">
                {q.choices.map((c, ci) => (
                  <div key={ci} className={`choice ${ci === q.answer ? 'correct' : ci === q.yourChoice ? 'wrong' : ''}`}>
                    <span className="kana">{KANA[ci]}</span><span>{c}</span>
                  </div>
                ))}
              </div>
              <div className="explain-box"><div className="label">中文解析</div>{q.explanationZh}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---------- 考试进行中 ----------
  if (mock) {
    const q = mock.questions[current]
    const answeredCount = answers.filter(a => a !== null).length
    return (
      <div className="container" style={{ paddingTop: 20 }}>
        <div className="mock-timer">
          <span className="time">⏱ {fmtTime(remaining)}</span>
          <span>{mock.exam.name} 模拟考试</span>
          <span style={{ marginLeft: 'auto' }}>{answeredCount}/{mock.questions.length} 已作答</span>
          <button className="btn small" style={{ background: '#fff' }} onClick={() => submit(false)}>交卷</button>
        </div>
        <div className="mock-nav">
          {mock.questions.map((_, i) => (
            <button key={i}
              className={i === current ? 'current' : answers[i] !== null ? 'answered' : ''}
              onClick={() => setCurrent(i)}>{i + 1}</button>
          ))}
        </div>
        <div className="qcard">
          <div className="qcard-meta">
            <span>Q{current + 1} / {mock.questions.length}</span>
            <span className={`tag ${q.domain}`}>{q.domainLabel}</span>
          </div>
          <div className="qcard-text">{q.text}</div>
          <div className="choices">
            {q.choices.map((c, i) => (
              <button key={i}
                className={`choice ${answers[current] === i ? 'picked' : ''}`}
                onClick={() => setAnswers(a => a.map((v, vi) => vi === current ? i : v))}>
                <span className="kana">{KANA[i]}</span><span>{c}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>← 上一题</button>
            {current < mock.questions.length - 1
              ? <button className="btn primary" onClick={() => setCurrent(c => c + 1)}>下一题 →</button>
              : <button className="btn accent" onClick={() => submit(false)}>交卷 ✓</button>}
          </div>
        </div>
      </div>
    )
  }

  // ---------- 开始页 ----------
  return (
    <div className="container">
      <div className="page-head">
        <h1>本番形式模拟考试</h1>
        <p className="sub">按考试真实形式限时作答，交卷后按 1000 分制评分，并给出领域别成绩与合格判定。</p>
      </div>
      <div className="section" style={{ paddingTop: 18, maxWidth: 640 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>选择考试</div>
            <div className="pill-select">
              {EXAM_OPTIONS.map(e => (
                <button key={e.code} className={exam === e.code ? 'active' : ''} onClick={() => setExam(e.code)}>{e.label}</button>
              ))}
            </div>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            出题：从所选考试题库随机抽取（每题 72 秒计时）· 合格判定：总分 ≥600 且各领域正确率 ≥30%
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary big" onClick={start}>开始模拟考试 →</button>
          {!user && <div style={{ fontSize: 13, color: 'var(--muted)' }}>模拟考试需要登录（免费），成绩会保存到你的账号。</div>}
        </div>

        {history.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>历史成绩</div>
            {history.filter(h => h.status === 'finished').map(h => (
              <div key={h.id} className="bar-row" style={{ gridTemplateColumns: '60px 1fr 120px' }}>
                <span className="name">{h.examCode}</span>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${(h.score / 1000) * 100}%` }} /></div>
                <span className="val">{h.score} 分 · {h.detail?.passed ? '合格圏' : '不合格'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
