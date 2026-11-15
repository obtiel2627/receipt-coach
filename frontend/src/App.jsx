import { useEffect, useState } from 'react'
import { health } from './api.js'
import { loadBudget, loadReceipts, saveBudget, saveReceipts } from './storage.js'
import Dashboard from './screens/Dashboard.jsx'
import AddReceipt from './screens/AddReceipt.jsx'
import History from './screens/History.jsx'
import Report from './screens/Report.jsx'
import Chat from './screens/Chat.jsx'

const TABS = [
  { id: 'home', label: '홈', icon: '📊' },
  { id: 'add', label: '기록', icon: '📷' },
  { id: 'history', label: '내역', icon: '🧾' },
  { id: 'report', label: '리포트', icon: '📝' },
  { id: 'chat', label: 'AI 채팅', icon: '💬' },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const [receipts, setReceipts] = useState(loadReceipts)
  const [budget, setBudget] = useState(loadBudget)
  const [server, setServer] = useState(null)

  useEffect(() => { saveReceipts(receipts) }, [receipts])
  useEffect(() => { saveBudget(budget) }, [budget])
  useEffect(() => {
    health().then(setServer).catch(() => setServer({ ok: false }))
  }, [])

  const addReceipt = (r) => {
    setReceipts((list) => [...list, r].sort((a, b) => b.date.localeCompare(a.date)))
    setTab('home')
  }
  const deleteReceipt = (id) => setReceipts((list) => list.filter((r) => r.id !== id))

  const props = { receipts, setReceipts, budget, setBudget, server, goto: setTab }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🧾 영수증코치</div>
        {server && (
          <span className={`pill ${server.ai ? 'ok' : 'warn'}`}>
            {server.ok === false ? '서버 연결 안 됨' : server.ai ? 'AI 연결됨' : '데모 모드'}
          </span>
        )}
      </header>
      <main className="content">
        {tab === 'home' && <Dashboard {...props} />}
        {tab === 'add' && <AddReceipt onSave={addReceipt} server={server} />}
        {tab === 'history' && <History receipts={receipts} onDelete={deleteReceipt} />}
        {tab === 'report' && <Report {...props} />}
        {tab === 'chat' && <Chat receipts={receipts} />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
