// "샘플 데이터로 둘러보기"용 가짜 지출 데이터 (지난달 + 이번 달)
import { prevMonth, thisMonth } from './stats.js'

const TEMPLATES = [
  { store: '메가커피', items: [['아이스 아메리카노', 2000, '카페']], w: 9 },
  { store: '스타벅스', items: [['카페라떼', 5000, '카페'], ['초코칩 쿠키', 3300, '카페']], w: 3 },
  { store: '배달의민족 - BHC', items: [['뿌링클', 21000, '배달'], ['배달팁', 3000, '배달']], w: 3 },
  { store: '쿠팡이츠 - 엽기떡볶이', items: [['엽기떡볶이', 14000, '배달'], ['주먹김밥', 2500, '배달']], w: 3 },
  { store: 'GS25', items: [['삼각김밥', 1300, '편의점'], ['바나나우유', 1700, '편의점']], w: 8 },
  { store: 'CU', items: [['컵라면', 1500, '편의점'], ['제로콜라', 2000, '편의점']], w: 5 },
  { store: '학생식당', items: [['제육덮밥', 5500, '식비']], w: 10 },
  { store: '김밥천국', items: [['참치김밥', 4500, '식비'], ['라면', 4000, '식비']], w: 4 },
  { store: '티머니', items: [['교통카드 충전', 20000, '교통']], w: 2 },
  { store: '다이소', items: [['세제', 3000, '생활'], ['수납박스', 2000, '생활']], w: 2 },
  { store: '올리브영', items: [['선크림', 18000, '쇼핑']], w: 1 },
  { store: 'CGV', items: [['영화 관람권', 14000, '문화']], w: 1 },
]

function seeded(seed) {
  return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
}

function monthReceipts(month, days, rand, deliveryBoost) {
  const out = []
  const pool = TEMPLATES.flatMap((t) => Array(t.store.startsWith('배달') || t.store.startsWith('쿠팡') ? t.w + deliveryBoost : t.w).fill(t))
  for (let d = 1; d <= days; d++) {
    const n = Math.floor(rand() * 3)
    for (let k = 0; k < n; k++) {
      const t = pool[Math.floor(rand() * pool.length)]
      const items = t.items.map(([name, price, category]) => ({ name, quantity: 1, price, category }))
      const total = items.reduce((s, i) => s + i.price, 0)
      out.push({ id: `${month}-${d}-${k}`, store: t.store, date: `${month}-${String(d).padStart(2, '0')}`, items, discount: 0, total, createdAt: 0 })
    }
  }
  return out
}

export function makeSampleReceipts() {
  const rand = seeded(42)
  const cur = thisMonth()
  const prev = prevMonth(cur)
  const [py, pm] = prev.split('-').map(Number)
  const prevDays = new Date(py, pm, 0).getDate()
  return [...monthReceipts(cur, new Date().getDate(), rand, 4), ...monthReceipts(prev, prevDays, rand, 0)]
    .sort((a, b) => b.date.localeCompare(a.date))
}
