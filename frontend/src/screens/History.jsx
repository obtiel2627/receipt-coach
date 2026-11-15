import { useState } from 'react'
import { CAT_COLORS, won } from '../stats.js'

export default function History({ receipts, onDelete }) {
  const [open, setOpen] = useState(null)
  if (!receipts.length) return <div className="card empty"><p>아직 기록된 영수증이 없어요.</p></div>
  return (
    <div className="stack">
      <h2>지출 내역 <span className="muted">{receipts.length}건</span></h2>
      {receipts.map((r) => (
        <section key={r.id} className="card receipt" onClick={() => setOpen(open === r.id ? null : r.id)}>
          <div className="row between">
            <div>
              <div className="store">{r.store}</div>
              <div className="muted small">{r.date} · {r.items.length}개 품목</div>
            </div>
            <b>{won(r.total)}</b>
          </div>
          <div className="tags">
            {[...new Set(r.items.map((i) => i.category))].map((c) => (
              <span key={c} className="tag" style={{ borderColor: CAT_COLORS[c], color: CAT_COLORS[c] }}>{c}</span>
            ))}
          </div>
          {open === r.id && (
            <div className="detail" onClick={(e) => e.stopPropagation()}>
              {r.items.map((i, idx) => (
                <div key={idx} className="row between small"><span>{i.name} ×{i.quantity}</span><span>{won(i.price)}</span></div>
              ))}
              {r.discount > 0 && <div className="row between small"><span>할인</span><span>-{won(r.discount)}</span></div>}
              <button className="danger small" onClick={() => confirm('이 영수증을 삭제할까요?') && onDelete(r.id)}>삭제</button>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
