import { useMemo, useRef, useState } from 'react'
import { recognizeReceipt } from '../api.js'
import { addCorrections, loadCorrections } from '../storage.js'
import { CATEGORIES, today, won } from '../stats.js'

const emptyItem = () => ({ name: '', quantity: 1, price: 0, category: '식비' })
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

export default function AddReceipt({ onSave, server }) {
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [aiCats, setAiCats] = useState([])
  const [elapsed, setElapsed] = useState(null)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setError('')
    setDraft(null)
    setLoading(true)
    const t0 = performance.now()
    try {
      const res = await recognizeReceipt(file, loadCorrections())
      const r = res.receipt
      setDraft({ store: r.store, date: r.date || today(), items: r.items.length ? r.items : [emptyItem()], discount: r.discount || 0, total: r.total || 0 })
      setAiCats(r.items.map((i) => ({ name: i.name, category: i.category })))
      setElapsed(((performance.now() - t0) / 1000).toFixed(1))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const manual = () => {
    setPreview(null)
    setError('')
    setAiCats([])
    setElapsed(null)
    setDraft({ store: '', date: today(), items: [emptyItem()], discount: 0, total: 0 })
  }

  // 합계 검증: 사용자가 수정할 때마다 코드로 다시 계산
  const check = useMemo(() => {
    if (!draft) return null
    const sum = draft.items.reduce((s, i) => s + (Number(i.price) || 0), 0)
    const expected = sum - (Number(draft.discount) || 0)
    return { sum, expected, diff: (Number(draft.total) || 0) - expected }
  }, [draft])

  const setItem = (idx, key, value) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }))

  const save = () => {
    const items = draft.items.filter((i) => i.name.trim() && Number(i.price)).map((i) => ({ ...i, price: Number(i.price), quantity: Number(i.quantity) || 1 }))
    if (!draft.store.trim() || !items.length) {
      setError('가게 이름과 품목을 하나 이상 입력해 주세요.')
      return
    }
    // AI가 제안한 카테고리를 사용자가 바꾼 경우 → 다음 인식에 Few-shot 예시로 활용
    addCorrections(items.filter((it) => {
      const ai = aiCats.find((a) => a.name === it.name)
      return ai && ai.category !== it.category
    }).map((it) => ({ name: it.name, category: it.category })))
    const total = Number(draft.total) || check.expected
    onSave({ id: newId(), store: draft.store.trim(), date: draft.date, items, discount: Number(draft.discount) || 0, total, createdAt: Date.now() })
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>영수증 기록</h2>
        <p className="muted">영수증 전체가 보이도록 밝은 곳에서 찍어 주세요. 카드번호 같은 민감 정보는 저장하지 않아요.</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <div className="row gap">
          <button className="primary" disabled={loading} onClick={() => fileRef.current.click()}>📷 사진 찍기 / 업로드</button>
          <button className="ghost" disabled={loading} onClick={manual}>✍️ 직접 입력</button>
        </div>
        {server && !server.ai && server.ok !== false && (
          <p className="hint">지금은 데모 모드라 어떤 사진을 올려도 예시 영수증이 인식돼요. (서버에 GEMINI_API_KEY 설정 시 실제 인식)</p>
        )}
      </section>

      {preview && <img src={preview} alt="영수증 미리보기" className="preview" />}
      {loading && <div className="card center"><div className="spinner" />AI가 영수증을 읽고 있어요…</div>}
      {error && <div className="alert">{error}</div>}

      {draft && (
        <section className="card">
          <div className="row between">
            <h3>인식 결과 확인</h3>
            {elapsed && <span className="pill ok">{elapsed}초</span>}
          </div>
          <div className="grid2">
            <label>가게<input value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} /></label>
            <label>날짜<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
          </div>
          <div className="items">
            {draft.items.map((it, idx) => (
              <div className="item-row" key={idx}>
                <input className="name" placeholder="품목" value={it.name} onChange={(e) => setItem(idx, 'name', e.target.value)} />
                <input className="price" type="number" placeholder="금액" value={it.price} onChange={(e) => setItem(idx, 'price', e.target.value)} />
                <select value={it.category} onChange={(e) => setItem(idx, 'category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button className="icon-btn" aria-label="삭제" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}>✕</button>
              </div>
            ))}
            <button className="ghost small" onClick={() => setDraft({ ...draft, items: [...draft.items, emptyItem()] })}>+ 품목 추가</button>
          </div>
          <div className="grid2">
            <label>할인<input type="number" value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: e.target.value })} /></label>
            <label>결제 총액<input type="number" value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} /></label>
          </div>
          <div className={`verify ${check.diff === 0 ? 'ok' : 'bad'}`}>
            {check.diff === 0
              ? `✅ 합계 검증 통과: 품목 ${won(check.sum)} − 할인 ${won(draft.discount)} = ${won(check.expected)}`
              : `⚠️ 품목 합계(${won(check.expected)})와 결제 총액이 ${won(Math.abs(check.diff))} 달라요. 잘못 읽힌 금액이 없는지 확인해 주세요.`}
          </div>
          <button className="primary full" onClick={save}>저장하기</button>
        </section>
      )}
    </div>
  )
}
