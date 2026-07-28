import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../api.js'
import { useApp } from '../App.jsx'

const DOMAIN_COLORS = { strategy: '#b45309', management: '#047857', technology: '#1d4ed8' }

// 最近 14 天活动柱状图（单序列，悬停显示当日明细）
function DailyChart({ daily }) {
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const row = daily.find(r => r.day === d)
    days.push({ day: d, count: row?.count || 0, correct: row?.correct || 0 })
  }
  const max = Math.max(1, ...days.map(d => d.count))
  return (
    <div className="daily-chart">
      {days.map(d => (
        <div key={d.day} className="daily-col" title={`${d.day}：作答 ${d.count} 题，正确 ${d.correct} 题`}>
          <div className="bar" style={{ height: `${(d.count / max) * 100}%`, opacity: d.count ? 1 : 0.15 }} />
          <span className="day">{d.day.slice(8)}</span>
        </div>
      ))}
    </div>
  )
}

function BarRow({ name, value, max, right, color = 'var(--accent)' }) {
  return (
    <div className="bar-row" title={`${name}：${right}`}>
      <span className="name">{name}</span>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color }} />
      </div>
      <span className="val">{right}</span>
    </div>
  )
}

// 学习统计仪表盘
export default function Dashboard() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    get('/stats').then(setStats).catch(e => setError(e.message))
  }, [user])

  if (!user) {
    return (
      <div className="container">
        <div className="page-head">
          <h1>学习统计仪表盘</h1>
          <p className="sub">作答量、正确率、连续学习天数、薄弱领域，一屏看清备考状态。</p>
        </div>
        <div className="section" style={{ paddingTop: 10 }}>
          <div className="card" style={{ maxWidth: 560, textAlign: 'center', padding: 40 }}>
            <p style={{ marginBottom: 18, color: 'var(--muted)' }}>统计基于你的做题记录，需要先登录（免费）。</p>
            <button className="btn primary big" onClick={() => navigate('/register')}>免费注册 →</button>
          </div>
        </div>
      </div>
    )
  }

  if (error) return <div className="container empty">{error}</div>
  if (!stats) return <div className="container loading">加载中…</div>

  const acc = Math.round(stats.totals.accuracy * 100)

  return (
    <div className="container">
      <div className="page-head">
        <h1>学习统计</h1>
        <p className="sub">{user.name} 的备考仪表盘 · 学习进度已云端同步</p>
      </div>
      <div className="section" style={{ paddingTop: 14 }}>
        {/* KPI 磁贴 */}
        <div className="stat-tiles">
          <div className="stat-tile"><div className="num">{stats.totals.answered}</div><div className="lbl">累计作答（{stats.totals.uniqueAnswered} 道不同题）</div></div>
          <div className="stat-tile"><div className="num">{acc}%</div><div className="lbl">总正确率</div></div>
          <div className="stat-tile"><div className="num">{stats.streak} 天</div><div className="lbl">连续学习</div></div>
          <div className="stat-tile"><div className="num">{stats.mock.best ?? '—'}</div><div className="lbl">模拟考最高分（{stats.mock.count} 场）</div></div>
        </div>

        <div className="grid2">
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>最近 14 天活动</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>每日作答题数</div>
            <DailyChart daily={stats.daily} />
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>分领域正确率</div>
            {stats.byDomain.length === 0 && <div className="empty" style={{ padding: 20 }}>还没有作答记录</div>}
            {stats.byDomain.map(d => (
              <BarRow key={d.domain} name={d.label} value={d.correct} max={d.total}
                right={`${d.correct}/${d.total}（${Math.round((d.correct / Math.max(1, d.total)) * 100)}%）`}
                color={DOMAIN_COLORS[d.domain] || 'var(--accent)'} />
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>各考试题库进度</div>
            {stats.byExam.map(e => (
              <BarRow key={e.code} name={e.code} value={e.answered} max={e.total}
                right={`${e.answered}/${e.total} 题`} />
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>术语记忆卡</div>
            <BarRow name="已掌握" value={stats.terms.known} max={stats.terms.total} right={`${stats.terms.known}/${stats.terms.total}`} color="var(--good)" />
            <BarRow name="学习中" value={stats.terms.learning} max={stats.terms.total} right={`${stats.terms.learning}/${stats.terms.total}`} color="#b45309" />
            <div style={{ marginTop: 12 }}>
              <button className="btn small" onClick={() => navigate('/review')}>去复习术语卡 →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
