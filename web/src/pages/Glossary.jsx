import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api.js'

const CATS = [
  { code: 'all', label: '全部' },
  { code: 'strategy', label: '战略类' },
  { code: 'management', label: '管理类' },
  { code: 'technology', label: '技术类' },
]

export default function Glossary() {
  const [data, setData] = useState(null)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (cat !== 'all') params.set('category', cat)
    if (q) params.set('q', q)
    get(`/glossary?${params}`).then(setData).catch(() => {})
  }, [cat, q])

  return (
    <div className="container">
      <div className="page-head">
        <h1>术语表</h1>
        <p className="sub">收录考试常见 IT 术语，配出题例。做题时遇到关键词，可以回到含义、例子和相关题目。</p>
      </div>
      <div className="section" style={{ paddingTop: 16 }}>
        <div className="glossary-filters">
          {CATS.map(c => (
            <button key={c.code} className={cat === c.code ? 'active' : ''} onClick={() => setCat(c.code)}>
              {c.label}{data && c.code !== 'all' ? ` · ${data.counts[c.code] || 0}` : data && c.code === 'all' ? ` · ${data.total}` : ''}
            </button>
          ))}
          <input className="glossary-search" placeholder="搜索术语…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {!data ? <div className="loading">加载中…</div> : (
          <div className="grid3">
            {data.terms.map(t => (
              <Link key={t.slug} to={`/glossary/${t.slug}`} className="card clickable term-card">
                <h4>{t.title}</h4>
                <div className="zh">{t.titleZh}</div>
                <p>{t.description}</p>
                <div className="foot">
                  <span className={`tag ${t.category}`}>{t.categoryLabel}</span>
                  {t.questionCount > 0 && <span>出题 {t.questionCount} 次</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
        {data && data.terms.length === 0 && <div className="empty">没有匹配的术语</div>}
      </div>
    </div>
  )
}
