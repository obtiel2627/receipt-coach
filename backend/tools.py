"""AI 채팅의 Function Calling 도구. 계산은 모두 여기(코드)에서 한다."""
from collections import defaultdict

TOOL_DECLARATIONS = [
    {
        "name": "sum_spending",
        "description": "기간과 조건에 맞는 지출 합계와 건수를 계산한다.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "start_date": {"type": "STRING", "description": "시작일 YYYY-MM-DD (포함)"},
                "end_date": {"type": "STRING", "description": "종료일 YYYY-MM-DD (포함)"},
                "category": {"type": "STRING", "description": "카테고리 필터, 전체면 생략"},
                "keyword": {"type": "STRING", "description": "가게명/품목명에 포함된 단어, 없으면 생략"},
            },
            "required": ["start_date", "end_date"],
        },
    },
    {
        "name": "spending_by_category",
        "description": "기간 내 카테고리별 지출 합계를 큰 순서로 반환한다.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "start_date": {"type": "STRING"},
                "end_date": {"type": "STRING"},
            },
            "required": ["start_date", "end_date"],
        },
    },
    {
        "name": "top_items",
        "description": "기간 내 가장 많이 돈을 쓴 가게 또는 품목 순위를 반환한다.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "start_date": {"type": "STRING"},
                "end_date": {"type": "STRING"},
                "group_by": {"type": "STRING", "enum": ["store", "item"]},
                "limit": {"type": "INTEGER"},
            },
            "required": ["start_date", "end_date", "group_by"],
        },
    },
]


def _filter(rows, start, end, category=None, keyword=None):
    out = []
    for r in rows:
        d = r.get("date", "")
        if not (start <= d <= end):
            continue
        if category and r.get("category") != category:
            continue
        if keyword and keyword not in r.get("store", "") and keyword not in r.get("name", ""):
            continue
        out.append(r)
    return out


def run_tool(name: str, args: dict, rows: list[dict]) -> dict:
    start, end = args.get("start_date", "0000-00-00"), args.get("end_date", "9999-99-99")
    if name == "sum_spending":
        sel = _filter(rows, start, end, args.get("category"), args.get("keyword"))
        receipts = {r.get("receipt_id") for r in sel}
        return {"total": sum(int(r.get("price", 0)) for r in sel), "item_count": len(sel), "receipt_count": len(receipts)}
    if name == "spending_by_category":
        acc = defaultdict(int)
        for r in _filter(rows, start, end):
            acc[r.get("category", "기타")] += int(r.get("price", 0))
        return {"categories": [{"category": k, "total": v} for k, v in sorted(acc.items(), key=lambda x: -x[1])]}
    if name == "top_items":
        key = "store" if args.get("group_by") == "store" else "name"
        acc = defaultdict(int)
        for r in _filter(rows, start, end):
            acc[r.get(key, "")] += int(r.get("price", 0))
        limit = int(args.get("limit") or 5)
        return {"ranking": [{"name": k, "total": v} for k, v in sorted(acc.items(), key=lambda x: -x[1])[:limit]]}
    return {"error": f"알 수 없는 함수: {name}"}
