import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api.js'
import QuestionCard from '../components/QuestionCard.jsx'

// 按年度场次刷题：左侧题号导航 + 顺序做题
export default function SessionPractice() {
  const { code } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [answered, setAnswered] = useState({})

  useEffect(() => {
    setData(null)
    get(`/sessions/${code}/questions`).then(setData).catch(e => setError(e.message))
  }, [code])

  if (error) return <div className="container empty">{error}</div>
  if (!data) return <div className="container loading">加载中…</div>

  const doneCount = data.questions.filter(q => q.lastCorrect !== null || answered[q.id] !== undefined).length

  return (
    <div className="container">
      <div className="page-head">
        <h1>{data.session.exam_name} · {data.session.label}</h1>
        <p className="sub">{data.session.code} · 共 {data.questions.length} 题 · 已作答 {doneCount} 题</p>
        <div className="progress-track" style={{ maxWidth: 360, marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${(doneCount / Math.max(1, data.questions.length)) * 100}%` }} />
        </div>
      </div>
      <div className="section" style={{ paddingTop: 20 }}>
        {data.questions.map(q => (
          <QuestionCard
            key={q.id}
            question={q}
            onAnswered={correct => setAnswered(a => ({ ...a, [q.id]: correct }))}
          />
        ))}
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <Link to="/exams" className="btn">← 返回收录考试</Link>
        </div>
      </div>
    </div>
  )
}
