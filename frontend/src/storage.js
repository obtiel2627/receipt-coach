// 지출 데이터는 서버가 아닌 사용자 기기(localStorage)에만 저장한다 (개인정보 보호).
const KEYS = { receipts: 'rc.receipts', budget: 'rc.budget', corrections: 'rc.corrections' }

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장 실패 시 메모리 상태만 유지 */
  }
}

export const loadReceipts = () => read(KEYS.receipts, [])
export const saveReceipts = (r) => write(KEYS.receipts, r)
export const loadBudget = () => read(KEYS.budget, 500000)
export const saveBudget = (b) => write(KEYS.budget, b)
export const loadCorrections = () => read(KEYS.corrections, [])

// 사용자가 AI 분류를 고친 기록 → 다음 인식 때 Few-shot 예시로 사용
export function addCorrections(list) {
  if (!list.length) return
  const map = new Map(read(KEYS.corrections, []).map((c) => [c.name, c]))
  list.forEach((c) => {
    map.delete(c.name)
    map.set(c.name, c)
  })
  write(KEYS.corrections, [...map.values()].slice(-30))
}
