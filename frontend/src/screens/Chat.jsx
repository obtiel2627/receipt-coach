import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api.js'
import { allRows, today } from '../stats.js'

const SUGGESTIONS = ['이번 달 배달에 얼마 썼어?', '지난달이랑 비교해서 뭐가 늘었어?', '제일 돈 많이 쓴 가게는 어디야?', '카페 지출 줄이려면 어떻게 해?']
const FN_LABEL = { sum_spending: '합계 계산', spending_by_category: '카테고리 집계', top_items: '순위 조회' }

export default function Chat({ receipts }) {
  const [msgs, setMsgs] = useState([{ role: 'model', text: '안녕하세요! 지출 내역에 대해 무엇이든 물어보세요 🙂' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef()
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  const ask = async (text) => {
    const q = text.trim()
    if (!q || loading) return
    const history = msgs.slice(1).map(({ role, text }) => ({ role, text }))
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setLoading(true)
    try {
      const res = await sendChat({ message: q, history, rows: allRows(receipts), today: today() })
      setMsgs((m) => [...m, { role: 'model', text: res.answer, tools: res.tool_calls }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'model', text: `오류: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat">
      <div className="messages">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
            {m.tools?.length > 0 && (
              <div className="tools">🔧 {m.tools.map((t) => FN_LABEL[t.name] || t.name).join(' · ')} 함수로 실제 데이터를 조회했어요</div>
            )}
          </div>
        ))}
        {loading && <div className="bubble model"><span className="typing">●●●</span></div>}
        <div ref={endRef} />
      </div>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="예: 이번 주 편의점 몇 번 갔어?" />
        <button className="primary" disabled={loading}>전송</button>
      </form>
    </div>
  )
}
