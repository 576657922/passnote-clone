import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api.js'

export default function Exams() {
  const [groups, setGroups] = useState([])

  useEffect(() => {
    get('/exams').then(async d => {
      const gs = await Promise.all(d.exams.map(e => get(`/exams/${e.code}/sessions`)))
      setGroups(gs)
    }).catch(() => {})
  }, [])

  return (
    <div className="container">
      <div className="page-head">
        <h1>收录考试 · 年度题库</h1>
        <p className="sub">各项考试的练习题，按试验和年份整理。点击任一场次开始练习。</p>
      </div>
      {groups.map(({ exam, sessions }) => (
        <section key={exam.code} className="section" style={{ paddingTop: 26, paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{exam.name}</h2>
            {exam.badge && <span className="badge beta">{exam.badge}</span>}
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{sessions.length}回 · {sessions.reduce((s, x) => s + x.questionCount, 0)}题</span>
          </div>
          <div className="grid3">
            {sessions.map(s => (
              <Link key={s.code} to={`/exams/session/${s.code}`} className="card clickable">
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{s.year} · {s.season} · {s.questionCount}题</div>
                <div style={{ color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>{s.code} →</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
