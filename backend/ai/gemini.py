"""Gemini REST API 호출 래퍼 (SDK 없이 httpx 사용)."""
import json
import os

import httpx

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def api_key() -> str | None:
    # 복사·붙여넣기 시 섞여 들어오는 공백/줄바꿈/따옴표 제거
    key = (os.getenv("GEMINI_API_KEY") or "").strip().strip("\"'").strip()
    return key or None


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash")


class LLMError(RuntimeError):
    pass


async def generate(contents: list, *, system: str | None = None, schema: dict | None = None,
                   tools: list | None = None, temperature: float = 0.4) -> dict:
    """generateContent 호출 후 첫 번째 candidate의 content를 그대로 반환."""
    key = api_key()
    if not key:
        raise LLMError("GEMINI_API_KEY가 설정되지 않았습니다.")
    if not key.isascii() or any(c.isspace() for c in key):
        raise LLMError("GEMINI_API_KEY 값이 올바르지 않습니다 (한글·공백 포함). AI Studio에서 발급한 키를 그대로 넣어주세요.")
    body: dict = {"contents": contents, "generationConfig": {"temperature": temperature}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if schema:
        body["generationConfig"]["responseMimeType"] = "application/json"
        body["generationConfig"]["responseSchema"] = schema
    if tools:
        body["tools"] = [{"functionDeclarations": tools}]
    url = f"{API_BASE}/{model_name()}:generateContent"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(url, json=body, headers={"x-goog-api-key": key})
    except httpx.HTTPError as exc:
        raise LLMError(f"Gemini API 연결 실패: {type(exc).__name__}: {exc}") from exc
    if res.status_code != 200:
        raise LLMError(f"Gemini API 오류 {res.status_code}: {res.text[:300]}")
    data = res.json()
    try:
        return data["candidates"][0]["content"]
    except (KeyError, IndexError) as exc:
        raise LLMError(f"응답 형식 오류: {json.dumps(data)[:300]}") from exc


def text_of(content: dict) -> str:
    return "".join(p.get("text", "") for p in content.get("parts", []))


async def generate_json(contents: list, schema: dict, **kw) -> dict:
    content = await generate(contents, schema=schema, temperature=0.1, **kw)
    raw = text_of(content).strip()
    if raw.startswith("```"):
        raw = raw.strip("`").removeprefix("json").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError("AI가 올바른 JSON을 반환하지 않았습니다.") from exc
