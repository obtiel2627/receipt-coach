import { useState } from 'react'
import { getReport } from '../api.js'
import { daysInMonth, daysPassed, monthStats, prevMonth, thisMonth, won } from '../stats.js'

export default function Report({ receipts, budget }) {
  const [month, setMonth] = useState(thisMonth())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true)
    setError('')
    setReport(null)
    const s = monthStats(receipts, month)
    try {
      // 숫자는 모두 코드로 계산해서 보내고, AI는 해석과 문장만 만든다 (환각 방지)
      const res = await getReport({
        month, total: s.total, prev_total: s.prev_total, prev_same_period_total: s.prev_same_period_total, budget,
        days_in_month: daysInMonth(month), days_passed: daysPassed(month),
        categories: s.categories, top_stores: s.top_stores,
      })
      setReport(res.report)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalSaving = report?.tips?.reduce((s, t) => s + (t.expected_saving || 0), 0) || 0
  return (
    <div className="stack">
      <section className="card">
        <h2>AI 월간 리포트 & 절약 코칭</h2>
        <p className="muted">코드가 계산한 통계만 AI에게 전달해요. 영수증 원본이나 개인정보는 보내지 않아요.</p>
        <div className="row gap">
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {[thisMonth(), prevMonth(thisMonth()), prevMonth(prevMonth(thisMonth()))].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="primary" disabled={loading || !receipts.length} onClick={run}>{loading ? '분석 중…' : '리포트 만들기'}</button>
        </div>
      </section>
      {loading && <div className="card center"><div className="spinner" />소비 패턴을 분석하고 있어요…</div>}
      {error && <div className="alert">{error}</div>}
      {report && (
        <>
          <section className="card">
            <h3>📌 한 줄 요약</h3>
            <p>{report.summary}</p>
          </section>
          <section className="card">
            <h3>📈 지난달과 달라진 점</h3>
            <ul className="bullets">{report.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
          <section className="card">
            <h3>💡 절약 코칭 <span className="pill ok">월 최대 {won(totalSaving)} 절약</span></h3>
            {report.tips.map((t, i) => (
              <div key={i} className="tip">
                <div className="row between"><b>{t.title}</b><span className="saving">-{won(t.expected_saving)}</span></div>
                <p>{t.detail}</p>
              </div>
            ))}
          </section>
          <section className="card praise">👏 {report.praise}</section>
        </>
      )}
    </div>
  )
}
