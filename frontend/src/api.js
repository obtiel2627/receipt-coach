async function request(path, options) {
  const res = await fetch(path, options)
  let body = null
  try {
    body = await res.json()
  } catch {
    /* 본문 없음 */
  }
  if (!res.ok) throw new Error(body?.detail || `서버 오류 (${res.status})`)
  return body
}

// 업로드 전에 이미지를 1600px 이하 JPEG로 줄여 전송량과 응답 시간을 줄인다.
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob || file
  } catch {
    return file // HEIC 등 브라우저가 못 여는 형식은 원본 전송
  }
}

export const health = () => request('/api/health')

export async function recognizeReceipt(file, corrections) {
  const fd = new FormData()
  const img = await compressImage(file)
  fd.append('image', img, 'receipt.jpg')
  fd.append('corrections', JSON.stringify(corrections))
  return request('/api/receipt', { method: 'POST', body: fd })
}

const postJson = (path, data) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })

export const getReport = (stats) => postJson('/api/report', stats)
export const sendChat = (payload) => postJson('/api/chat', payload)
