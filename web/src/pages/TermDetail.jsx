import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api.js'
import QuestionCard from '../components/QuestionCard.jsx'

// 术语详情页：释义 + 真实出题例（可直接作答）
export default function TermDetail() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    get(`/glossary/${slug}`).then(setData).catch(e => setError(e.message))
  }, [slug])

  if (error) return <div className="container empty">{error}</div>
  if (!data) return <div className="container loading">加载中…</div>

  const { term, questions } = data
  return (
    <div className="container">
      <div className="page-head">
        <div style={{ marginBottom: 8 }}><Link to="/glossary" style={{ color: 'var(--muted)', fontSize: 13 }}>← 术语表</Link></div>
        <h1>{term.title}</h1>
        <p className="sub">{term.titleZh} · <span className={`tag ${term.category}`}>{term.categoryLabel}</span></p>
      </div>
      <div className="section" style={{ paddingTop: 14 }}>
        <div className="card" style={{ maxWidth: 720, marginBottom: 30, fontSize: 15, lineHeight: 1.8 }}>
          {term.description}
        </div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, marginBottom: 14 }}>
          出题例{questions.length > 0 ? `（${questions.length}）` : ''}
        </h2>
        {questions.length === 0
          ? <div className="empty">该术语暂无关联题目</div>
          : questions.map(q => <QuestionCard key={q.id} question={q} />)}
      </div>
    </div>
  )
}
