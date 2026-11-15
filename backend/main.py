"""ReceiptCoach FastAPI 백엔드."""
import base64
import datetime as dt
import json
import os
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


def _load_dotenv() -> None:
    """프로젝트 루트의 .env를 읽어 환경변수로 설정 (이미 설정된 값은 유지)."""
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if v.strip():
                os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()

from .ai import gemini, prompts  # noqa: E402
from .tools import TOOL_DECLARATIONS, run_tool

app = FastAPI(title="ReceiptCoach API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MAX_IMAGE_BYTES = 4 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def demo_mode() -> bool:
    return gemini.api_key() is None


@app.get("/api/health")
def health():
    return {"ok": True, "ai": not demo_mode(), "model": gemini.model_name() if not demo_mode() else "demo"}


# ---------- 영수증 인식 + 합계 검증 ----------

def verify(receipt: dict) -> dict:
    """품목 합계 - 할인 = 총액 인지 코드로 검증한다 (LLM에 계산을 맡기지 않음)."""
    items_sum = sum(int(i.get("price") or 0) for i in receipt.get("items", []))
    discount = int(receipt.get("discount") or 0)
    total = int(receipt.get("total") or 0)
    expected = items_sum - discount
    diff = total - expected
    return {"items_sum": items_sum, "discount": discount, "total": total, "difference": diff, "ok": diff == 0 and total > 0}


DEMO_RECEIPT = {
    "is_receipt": True,
    "store": "GS25 데모점",
    "date": dt.date.today().isoformat(),
    "items": [
        {"name": "삼각김밥 참치마요", "quantity": 2, "price": 2600, "category": "편의점"},
        {"name": "바나나우유", "quantity": 1, "price": 1700, "category": "편의점"},
        {"name": "컵라면", "quantity": 1, "price": 1500, "category": "편의점"},
    ],
    "discount": 300,
    "total": 5500,
}


@app.post("/api/receipt")
async def recognize_receipt(image: UploadFile = File(...), corrections: str = Form("[]")):
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "이미지가 너무 큽니다 (최대 4MB).")
    mime = image.content_type or "image/jpeg"
    if mime not in ALLOWED_TYPES:
        raise HTTPException(415, "jpg, png, webp, heic 이미지만 업로드할 수 있습니다.")

    if demo_mode():
        receipt = dict(DEMO_RECEIPT)
    else:
        # Few-shot 개인화: 사용자가 직접 고친 분류 결과를 예시로 넣는다.
        try:
            fixes = json.loads(corrections)[:20]
        except json.JSONDecodeError:
            fixes = []
        hint = ""
        if fixes:
            lines = "\n".join(f"- {f['name']} → {f['category']}" for f in fixes if f.get("name") and f.get("category"))
            hint = f"\n\n이 사용자는 과거에 다음과 같이 분류를 수정했다. 비슷한 품목은 같은 방식으로 분류하라:\n{lines}"
        contents = [{
            "role": "user",
            "parts": [
                {"inlineData": {"mimeType": mime, "data": base64.b64encode(data).decode()}},
                {"text": "이 영수증을 JSON으로 변환해줘." + hint},
            ],
        }]
        try:
            receipt = await gemini.generate_json(contents, prompts.RECEIPT_SCHEMA, system=prompts.RECEIPT_SYSTEM)
        except gemini.LLMError as exc:
            raise HTTPException(502, str(exc)) from exc

    if not receipt.get("is_receipt"):
        raise HTTPException(422, "영수증을 찾지 못했습니다. 영수증이 화면에 꽉 차게 다시 찍어주세요.")
    for item in receipt.get("items", []):
        if item.get("category") not in prompts.CATEGORIES:
            item["category"] = "기타"
    return {"receipt": receipt, "verification": verify(receipt), "demo": demo_mode()}


# ---------- AI 월간 리포트 + 절약 코칭 ----------

class CategoryStat(BaseModel):
    category: str
    total: int
    prev_total: int = 0
    count: int = 0


class ReportRequest(BaseModel):
    month: str
    total: int
    prev_total: int = 0
    prev_same_period_total: int = 0  # 지난달 1일~같은 날짜까지 지출
    budget: int = 0
    days_in_month: int = 30
    days_passed: int = 30
    categories: list[CategoryStat] = Field(default_factory=list)
    top_stores: list[dict] = Field(default_factory=list)


def demo_report(req: ReportRequest) -> dict:
    cats = sorted(req.categories, key=lambda c: -c.total)
    top = cats[0] if cats else None
    diff = req.total - (req.prev_same_period_total or req.prev_total)
    changes = []
    for c in cats[:3]:
        d = c.total - c.prev_total
        if d:
            changes.append(f"{c.category} 지출이 지난달보다 {abs(d):,}원 {'늘었' if d > 0 else '줄었'}어요.")
    tips = []
    for c in cats[:3]:
        tips.append({"title": f"{c.category} 줄이기", "detail": f"{c.category}에 {c.total:,}원({c.count}건)을 썼어요. 횟수를 20% 줄이는 걸 목표로 해보세요.",
                     "expected_saving": round(c.total * 0.2 / 100) * 100})
    return {
        "summary": f"{req.month} 총 지출은 {req.total:,}원으로 지난달 같은 기간보다 {abs(diff):,}원 {'많아요' if diff > 0 else '적어요'}."
                   + (f" 가장 큰 비중은 {top.category}({top.total:,}원)입니다." if top else ""),
        "changes": changes or ["비교할 지난달 데이터가 아직 충분하지 않아요."],
        "tips": tips,
        "praise": "꾸준히 영수증을 기록하고 있는 것 자체가 큰 절약의 시작이에요!",
    }


@app.post("/api/report")
async def monthly_report(req: ReportRequest):
    if demo_mode():
        return {"report": demo_report(req), "demo": True}
    stats = req.model_dump()
    if req.budget:
        stats["budget_usage_percent"] = round(req.total / req.budget * 100, 1)
        stats["projected_month_total"] = round(req.total / max(req.days_passed, 1) * req.days_in_month)
    contents = [{"role": "user", "parts": [{"text": "다음은 코드가 계산한 이번 달 소비 통계(JSON)입니다. 이 숫자만 근거로 리포트를 작성해 주세요.\n"
                                                     + json.dumps(stats, ensure_ascii=False)}]}]
    try:
        report = await gemini.generate_json(contents, prompts.REPORT_SCHEMA, system=prompts.REPORT_SYSTEM)
    except gemini.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"report": report, "demo": False}


# ---------- AI 채팅 (Function Calling) ----------

class ChatTurn(BaseModel):
    role: str  # "user" | "model"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)
    rows: list[dict] = Field(default_factory=list)  # 품목 단위 지출 (date, store, name, category, price, receipt_id)
    today: str | None = None


def demo_chat(req: ChatRequest, today: dt.date) -> str:
    month = today.strftime("%Y-%m")
    start, end = f"{month}-01", f"{month}-31"
    for cat in prompts.CATEGORIES:
        if cat in req.message:
            r = run_tool("sum_spending", {"start_date": start, "end_date": end, "category": cat}, req.rows)
            return f"이번 달 {cat} 지출은 {r['total']:,}원({r['receipt_count']}회)이에요. (데모 모드 답변)"
    r = run_tool("sum_spending", {"start_date": start, "end_date": end}, req.rows)
    return f"이번 달 총 지출은 {r['total']:,}원이에요. (데모 모드: API 키를 설정하면 자유롭게 질문할 수 있어요)"


@app.post("/api/chat")
async def chat(req: ChatRequest):
    today = dt.date.fromisoformat(req.today) if req.today else dt.date.today()
    if demo_mode():
        return {"answer": demo_chat(req, today), "tool_calls": [], "demo": True}

    system = prompts.CHAT_SYSTEM.format(today=today.isoformat(), this_month=today.strftime("%Y-%m"),
                                        categories=", ".join(prompts.CATEGORIES))
    contents = [{"role": t.role if t.role in ("user", "model") else "user", "parts": [{"text": t.text}]} for t in req.history[-8:]]
    contents.append({"role": "user", "parts": [{"text": req.message}]})
    used = []
    try:
        for _ in range(4):  # 함수 호출 → 결과 전달을 최대 4번 반복
            content = await gemini.generate(contents, system=system, tools=TOOL_DECLARATIONS, temperature=0.3)
            calls = [p["functionCall"] for p in content.get("parts", []) if "functionCall" in p]
            if not calls:
                return {"answer": gemini.text_of(content).strip(), "tool_calls": used, "demo": False}
            contents.append(content)
            responses = []
            for call in calls:
                result = run_tool(call["name"], call.get("args", {}), req.rows)
                used.append({"name": call["name"], "args": call.get("args", {}), "result": result})
                responses.append({"functionResponse": {"name": call["name"], "response": result}})
            contents.append({"role": "user", "parts": responses})
    except gemini.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"answer": "질문을 처리하지 못했어요. 조금 더 구체적으로 물어봐 주세요.", "tool_calls": used, "demo": False}


# ---------- 로컬/단일 서버 배포 시 프론트엔드 정적 파일 제공 ----------
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.exists() and not os.getenv("VERCEL"):
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")
