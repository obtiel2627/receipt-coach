export const CATEGORIES = ['식비', '카페', '배달', '편의점', '교통', '생활', '쇼핑', '문화', '의료', '기타']
export const CAT_COLORS = {
  식비: '#0f766e', 카페: '#b45309', 배달: '#dc2626', 편의점: '#7c3aed', 교통: '#2563eb',
  생활: '#0891b2', 쇼핑: '#db2777', 문화: '#65a30d', 의료: '#475569', 기타: '#a8a29e',
}
export const won = (n) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`
export const monthOf = (date) => (date || '').slice(0, 7)
export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const thisMonth = () => today().slice(0, 7)
export function prevMonth(m) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const daysInMonth = (m) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo, 0).getDate()
}

// 영수증 → 품목 단위 행. 할인액은 품목 금액 비율로 나눠 합계가 결제 총액과 일치하게 한다.
export function receiptRows(r) {
  const sum = r.items.reduce((s, i) => s + (Number(i.price) || 0), 0)
  const discount = Number(r.discount) || 0
  let left = discount
  return r.items.map((i, idx) => {
    const price = Number(i.price) || 0
    let d = idx === r.items.length - 1 ? left : sum ? Math.round((discount * price) / sum) : 0
    left -= d
    return { receipt_id: r.id, date: r.date, store: r.store, name: i.name, category: i.category, price: price - d }
  })
}
export const allRows = (receipts) => receipts.flatMap(receiptRows)

export function monthStats(receipts, month) {
  const rows = allRows(receipts)
  const cur = rows.filter((r) => monthOf(r.date) === month)
  const prev = rows.filter((r) => monthOf(r.date) === prevMonth(month))
  const byCat = (list) => list.reduce((acc, r) => ((acc[r.category] = (acc[r.category] || 0) + r.price), acc), {})
  const curCat = byCat(cur)
  const prevCat = byCat(prev)
  const counts = {}
  receipts.filter((r) => monthOf(r.date) === month).forEach((r) => {
    new Set(r.items.map((i) => i.category)).forEach((c) => (counts[c] = (counts[c] || 0) + 1))
  })
  const categories = CATEGORIES.filter((c) => curCat[c] || prevCat[c]).map((c) => ({
    category: c, total: curCat[c] || 0, prev_total: prevCat[c] || 0, count: counts[c] || 0,
  })).sort((a, b) => b.total - a.total)
  const stores = {}
  cur.forEach((r) => (stores[r.store] = (stores[r.store] || 0) + r.price))
  const top_stores = Object.entries(stores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([store, total]) => ({ store, total }))
  const daily = Array(daysInMonth(month)).fill(0)
  cur.forEach((r) => (daily[Number(r.date.slice(8, 10)) - 1] += r.price))
  // 지난달 같은 기간(1일~오늘 날짜)과 비교해야 월 중간에도 공정하게 비교된다
  const cutoff = daysPassed(month)
  const prevSamePeriod = prev.filter((r) => Number(r.date.slice(8, 10)) <= cutoff).reduce((s, r) => s + r.price, 0)
  return {
    month, categories, top_stores, daily,
    prev_same_period_total: prevSamePeriod,
    total: cur.reduce((s, r) => s + r.price, 0),
    prev_total: prev.reduce((s, r) => s + r.price, 0),
  }
}

export function daysPassed(month) {
  const t = thisMonth()
  if (month < t) return daysInMonth(month)
  if (month > t) return 0
  return new Date().getDate()
}
