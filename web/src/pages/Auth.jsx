import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { post } from '../api.js'
import { useApp } from '../App.jsx'

function AuthForm({ mode }) {
  const isRegister = mode === 'register'
  const { setUser } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const d = await post(isRegister ? '/auth/register' : '/auth/login', { email, password, name })
      setUser(d.user)
      navigate(isRegister ? '/practice' : '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="card form-card">
        <h2>{isRegister ? '创建账号' : '欢迎回来'}</h2>
        <p className="sub">{isRegister ? '用邮箱注册，学习进度会在所有设备间自动同步。' : '登录后继续你的学习进度。'}</p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={submit}>
          {isRegister && (
            <div className="field">
              <label>昵称（可选）</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="学习时显示的名字" />
            </div>
          )}
          <div className="field">
            <label>邮箱</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" />
          </div>
          <button className="btn primary big" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
            {busy ? '请稍候…' : isRegister ? '注册并开始 →' : '登录 →'}
          </button>
        </form>
        <button className="btn big" style={{ width: '100%', marginTop: 10 }} disabled title="本地复刻版未接入 Google OAuth">
          使用 Google 账号（本地版未接入）
        </button>
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
          {isRegister
            ? <>已有账号？<Link to="/login" style={{ color: 'var(--accent)' }}>直接登录</Link></>
            : <>还没有账号？<Link to="/register" style={{ color: 'var(--accent)' }}>免费注册</Link></>}
        </div>
      </div>
    </div>
  )
}

export const Login = () => <AuthForm mode="login" />
export const Register = () => <AuthForm mode="register" />
