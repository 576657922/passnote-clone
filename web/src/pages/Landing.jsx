import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../api.js'
import { useApp, FEATURES } from '../App.jsx'
import QuestionCard from '../components/QuestionCard.jsx'

export default function Landing() {
  const [meta, setMeta] = useState(null)
  const [trial, setTrial] = useState([])
  const [exams, setExams] = useState([])
  const [glossaryPreview, setGlossaryPreview] = useState([])
  const { user } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    get('/meta').then(setMeta).catch(() => {})
    get('/trial').then(d => setTrial(d.questions)).catch(() => {})
    get('/exams').then(d => setExams(d.exams)).catch(() => {})
    get('/glossary').then(d => setGlossaryPreview(d.terms.filter(t => t.questionCount > 0).slice(0, 3))).catch(() => {})
  }, [])

  return (
    <>
      {/* 英雄区 */}
      <section className="hero container">
        <div className="hero-kicker">日本 IT 系资格考试，一个练习入口</div>
        <h1><em>Passnote</em> Clone</h1>
        <p>
          从 IT Passport 到基本情報技術者、情報セキュリティマネジメント、応用情報。
          把练习题、AI 解析、术语理解和错题复习整理进一条学习路径。
        </p>
        <div className="hero-cta">
          <button className="btn primary big" onClick={() => navigate(user ? '/practice' : '/register')}>免费开始 →</button>
          <Link to="/exams" className="btn big">查看收录考试</Link>
        </div>
        {meta && (
          <div className="hero-stats">
            <div className="hero-stat"><b>{meta.questionCount}题</b><span>练习题库</span></div>
            <div className="hero-stat"><b>{meta.sessionCount}回</b><span>收录场次</span></div>
            <div className="hero-stat"><b>{meta.termCount}词</b><span>术语表</span></div>
            <div className="hero-stat"><b>{meta.aiAvailable ? 'ON' : 'OFF'}</b><span>AI 解析引擎</span></div>
          </div>
        )}
      </section>

      {/* 收录考试 */}
      <section className="section">
        <div className="container">
          <div className="section-kicker">Exam coverage</div>
          <h2>不只做 IT Passport，也做 IPA 系考试入口</h2>
          <p className="section-sub">各考试按年度场次整理，切换考试时学习体验保持一致。SG / AP 保留 beta 标识。</p>
          <div className="grid4">
            {exams.map(e => (
              <Link key={e.code} to="/exams" className="card clickable">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <b style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{e.code}</b>
                  {e.badge && <span className="badge beta">{e.badge}</span>}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{e.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{e.subtitle}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>{e.questionCount}题 · {e.sessionCount}回</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5 题体验 */}
      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div className="section-kicker">5 题体验</div>
          <h2>免登录 · 5 题体验</h2>
          <p className="section-sub">从示例题库中精选 5 道。登录后可练习全部题目、记录进度，并使用 AI 解析和トモ。</p>
          {trial.map(q => (
            <QuestionCard key={q.id} question={q} withAnswer showAi={false} />
          ))}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="btn primary big" onClick={() => navigate(user ? '/practice' : '/register')}>
              全部 {meta?.questionCount ?? ''} 题 → 免费开始
            </button>
          </div>
        </div>
      </section>

      {/* 术语表预览 */}
      <section className="section">
        <div className="container">
          <div className="section-kicker">Glossary</div>
          <h2>做题时遇到的关键词，都能查</h2>
          <p className="section-sub">术语页不只是词典，也是练习体验的一部分。每个术语都关联着真实的出题例。</p>
          <div className="grid3">
            {glossaryPreview.map(t => (
              <Link key={t.slug} to={`/glossary/${t.slug}`} className="card clickable term-card">
                <h4>{t.title}</h4>
                <div className="zh">{t.titleZh}</div>
                <p>{t.description}</p>
                <div className="foot">
                  <span className={`tag ${t.category}`}>{t.categoryLabel}</span>
                  <span>出题 {t.questionCount} 次</span>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <Link to="/glossary" className="btn">查看术语表 →</Link>
          </div>
        </div>
      </section>

      {/* 全部功能 */}
      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div className="section-kicker">Features</div>
          <h2>全部功能，注册即用</h2>
          <p className="section-sub">IPA 考试备考所需的解析、复习和学习计划，登录后全部开放。</p>
          <div className="grid3">
            {FEATURES.map(f => (
              <div key={f} className="card" style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: 'var(--good)', fontWeight: 700 }}>✓</span>{f}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <button className="btn primary big" onClick={() => navigate(user ? '/practice' : '/register')}>免费开始 →</button>
          </div>
        </div>
      </section>
    </>
  )
}
