import React, { useEffect, useRef, useState } from 'react'
import { post } from '../api.js'

// AI 学习搭子「トモ」— Pro 用户全站可用的浮动聊天面板
export default function TomoChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'こんにちは！トモです 🙌\n备考路上有任何问题都可以问我：术语解释、解题思路、学习计划都行～' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight)
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const d = await post('/ai/chat', { messages: next.filter((_, i) => i > 0 || next[0].role === 'user') })
      setMessages(m => [...m, { role: 'assistant', content: d.content }])
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `😥 出错了：${err.message}` }])
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return <button className="tomo-fab" onClick={() => setOpen(true)}>💬 トモに聞く</button>
  }

  return (
    <div className="tomo-panel">
      <div className="tomo-head">
        🤝 AI 学习搭子 トモ
        <button onClick={() => setOpen(false)}>×</button>
      </div>
      <div className="tomo-msgs" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={`tomo-msg ${m.role}`}>{m.content}</div>
        ))}
        {busy && <div className="tomo-msg assistant">トモ正在输入…</div>}
      </div>
      <div className="tomo-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="问点什么吧…（日/中/英均可）"
        />
        <button className="btn small pro" onClick={send} disabled={busy}>发送</button>
      </div>
    </div>
  )
}
