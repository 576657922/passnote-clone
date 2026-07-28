import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { get, post } from './api.js'
import Landing from './pages/Landing.jsx'
import Exams from './pages/Exams.jsx'
import SessionPractice from './pages/SessionPractice.jsx'
import Practice from './pages/Practice.jsx'
import Mock from './pages/Mock.jsx'
import Review from './pages/Review.jsx'
import Glossary from './pages/Glossary.jsx'
import TermDetail from './pages/TermDetail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { Login, Register } from './pages/Auth.jsx'
import TomoChat from './components/TomoChat.jsx'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export const FEATURES = [
  '覆盖题库的逐题 AI 解析（日语 / 中文 / 英语）',
  'AI 学习搭子 トモ（随时陪你答疑解惑）',
  '本番形式模拟考试',
  '复习模式（错题 + 术语记忆卡）',
  '学习统计仪表盘',
  '跨设备同步学习进度',
]

function Nav() {
  const { user, logout } = useApp()
  const navigate = useNavigate()
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">Pass<span>note</span> <small style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--sans)' }}>clone</small></Link>
        <nav className="nav-links">
          <NavLink to="/exams">收录考试</NavLink>
          <NavLink to="/practice">练习</NavLink>
          <NavLink to="/mock">模拟考试</NavLink>
          <NavLink to="/review">复习</NavLink>
          <NavLink to="/glossary">术语表</NavLink>
          <NavLink to="/dashboard">统计</NavLink>
        </nav>
        <div className="nav-right">
          {user ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user.name}</span>
              <button className="btn small" onClick={async () => { await logout(); navigate('/') }}>退出</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn small">登录</Link>
              <Link to="/register" className="btn small primary">开始</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>© Passnote Clone · 本项目为功能复刻学习用途，题库为原创示例题（非 IPA 官方真题）</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link to="/exams">收录考试</Link>
          <Link to="/glossary">术语表</Link>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const location = useLocation()

  useEffect(() => {
    get('/auth/me').then(d => setUser(d.user)).catch(() => {}).finally(() => setReady(true))
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  const logout = useCallback(async () => {
    await post('/auth/logout')
    setUser(null)
  }, [])

  const ctx = { user, setUser, logout }

  if (!ready) return <div className="loading">加载中…</div>

  return (
    <AppContext.Provider value={ctx}>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/session/:code" element={<SessionPractice />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/mock" element={<Mock />} />
          <Route path="/review" element={<Review />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/glossary/:slug" element={<TermDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
      <Footer />
      {user && <TomoChat />}
    </AppContext.Provider>
  )
}
