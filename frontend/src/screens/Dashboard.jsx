import { useMemo, useState } from 'react'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { CAT_COLORS, daysInMonth, daysPassed, monthStats, prevMonth, thisMonth, won } from '../stats.js'
import { makeSampleReceipts } from '../sample.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export default function Dashboard({ receipts, setReceipts, budget, setBudget, goto }) {
  const [month, setMonth] = useState(thisMonth())
  const s = useMemo(() => monthStats(receipts, month), [receipts, month])
  const passed = daysPassed(month)
  const days = daysInMonth(month)
  const projected = passed ? Math.round((s.total / passed) * days) : 0
  const usage = budget ? Math.round((s.total / budget) * 100) : 0
  const overRisk = month === thisMonth() && budget && projected > budget
  const diff = s.total - s.prev_same_period_total

  if (!receipts.length) {
    return (
      <div className="empty card">
        <h2>첫 영수증을 기록해 보세요</h2>
        <p>영수증 사진 한 장이면 가게, 품목, 금액, 카테고리를 AI가 자동으로 정리해요.</p>
        <button className="primary" onClick={() => goto('add')}>📷 영수증 찍기</button>
        <button className="ghost" onClick={() => setReceipts(makeSampleReceipts())}>샘플 데이터로 둘러보기</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="month-nav">
        <button onClick={() => setMonth(prevMonth(month))}>‹</button>
        <strong>{month.replace('-', '년 ')}월</strong>
        <button disabled={month >= thisMonth()} onClick={() => setMonth(nextMonth(month))}>›</button>
      </div>

      <section className="card hero">
        <div className="label">이번 달 지출</div>
        <div className="big">{won(s.total)}</div>
        <div className={`delta ${diff > 0 ? 'up' : 'down'}`}>
          지난달 같은 기간보다 {won(Math.abs(diff))} {diff > 0 ? '▲ 더 썼어요' : '▼ 덜 썼어요'}
        </div>
        <div className="budget">
          <div className="bar"><div style={{ width: `${Math.min(usage, 100)}%` }} className={usage >= 100 ? 'over' : ''} /></div>
          <div className="row">
            <span>예산 {usage}% 사용</span>
            <label>
              예산
              <input type="number" step="10000" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} />
            </label>
          </div>
        </div>
      </section>

      {overRisk && (
        <div className="alert">
          ⚠️ 지금 속도면 이번 달 <b>{won(projected)}</b>을 쓰게 돼요. 예산보다 {won(projected - budget)} 많아요.
          남은 {days - passed}일 동안 하루 {won(Math.max(budget - s.total, 0) / Math.max(days - passed, 1))} 이하로 써 보세요.
        </div>
      )}

      {s.categories.length > 0 && (
        <section className="card">
          <h3>카테고리별 지출</h3>
          <div className="doughnut">
            <Doughnut
              data={{
                labels: s.categories.filter((c) => c.total).map((c) => c.category),
                datasets: [{
                  data: s.categories.filter((c) => c.total).map((c) => c.total),
                  backgroundColor: s.categories.filter((c) => c.total).map((c) => CAT_COLORS[c.category]),
                  borderWidth: 0,
                }],
              }}
              options={{ plugins: { legend: { position: 'right' } }, cutout: '62%', maintainAspectRatio: false }}
            />
          </div>
          <ul className="cat-list">
            {s.categories.map((c) => (
              <li key={c.category}>
                <span className="dot" style={{ background: CAT_COLORS[c.category] }} />
                <span className="name">{c.category}</span>
                <span className="muted">{c.count}회</span>
                <span className="amount">{won(c.total)}</span>
                <span className={`small ${c.total > c.prev_total ? 'up' : 'down'}`}>
                  {c.total === c.prev_total ? '-' : `${c.total > c.prev_total ? '+' : '-'}${won(Math.abs(c.total - c.prev_total))}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>일별 지출</h3>
        <div className="barchart">
          <Bar
            data={{ labels: s.daily.map((_, i) => i + 1), datasets: [{ data: s.daily, backgroundColor: '#0f766e', borderRadius: 3 }] }}
            options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => `${v / 10000}만` } } } }}
          />
        </div>
      </section>

      {s.top_stores.length > 0 && (
        <section className="card">
          <h3>많이 쓴 곳 TOP 5</h3>
          <ol className="rank">
            {s.top_stores.map((t) => (
              <li key={t.store}><span>{t.store}</span><b>{won(t.total)}</b></li>
            ))}
          </ol>
        </section>
      )}
      <button className="primary" onClick={() => goto('report')}>📝 AI 월간 리포트 받기</button>
    </div>
  )
}

function nextMonth(m) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
