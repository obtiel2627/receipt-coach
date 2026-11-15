"""프롬프트와 JSON 스키마 모음."""

CATEGORIES = ["식비", "카페", "배달", "편의점", "교통", "생활", "쇼핑", "문화", "의료", "기타"]

RECEIPT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "is_receipt": {"type": "BOOLEAN", "description": "이미지가 영수증이면 true"},
        "store": {"type": "STRING", "description": "가게 이름"},
        "date": {"type": "STRING", "description": "결제 날짜 YYYY-MM-DD, 없으면 빈 문자열"},
        "items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "quantity": {"type": "INTEGER"},
                    "price": {"type": "INTEGER", "description": "해당 품목의 최종 금액(수량 반영, 원)"},
                    "category": {"type": "STRING", "enum": CATEGORIES},
                },
                "required": ["name", "quantity", "price", "category"],
            },
        },
        "discount": {"type": "INTEGER", "description": "할인 총액(양수, 원), 없으면 0"},
        "total": {"type": "INTEGER", "description": "영수증에 인쇄된 최종 결제 금액(원)"},
    },
    "required": ["is_receipt", "store", "date", "items", "discount", "total"],
}

RECEIPT_SYSTEM = f"""너는 한국 영수증을 읽어 구조화된 데이터로 변환하는 도우미다.
규칙:
- 영수증에 인쇄된 글자만 사용하고, 보이지 않는 값은 추측하지 말고 빈 값으로 둔다.
- 금액은 쉼표 없는 정수(원)로 쓴다.
- 카드번호, 승인번호, 사업자번호, 전화번호 같은 개인·민감 정보는 절대 추출하지 않는다.
- 각 품목의 category는 다음 중 하나: {', '.join(CATEGORIES)}.
- 배달앱 주문내역이면 품목 category를 '배달'로 한다.
- 영수증이 아니면 is_receipt=false로 하고 나머지는 빈 값으로 둔다."""

REPORT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING", "description": "이번 달 소비 요약 2~3문장"},
        "changes": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "전월 대비 눈에 띄는 변화와 원인 해석"},
        "tips": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "detail": {"type": "STRING"},
                    "expected_saving": {"type": "INTEGER", "description": "월 예상 절약액(원), 통계 숫자에 근거해 보수적으로"},
                },
                "required": ["title", "detail", "expected_saving"],
            },
        },
        "praise": {"type": "STRING", "description": "잘한 점 한 문장"},
    },
    "required": ["summary", "changes", "tips", "praise"],
}

REPORT_SYSTEM = """너는 대학생·자취생을 위한 친근한 소비 코치다.
- 사용자가 준 통계 숫자만 근거로 말하고, 숫자를 새로 계산하거나 지어내지 않는다.
- 비난하지 말고 실천 가능한 구체적 제안(횟수, 금액, 대체 방법)을 한다.
- 월 중간이면 total은 prev_total(지난달 전체)이 아니라 prev_same_period_total(지난달 같은 기간)과 비교한다.
- 절약 팁은 3개, 지출 비중이 큰 카테고리부터 다룬다.
- 존댓말로, 짧고 명확하게 쓴다."""

CHAT_SYSTEM = """너는 사용자의 가계부 데이터를 조회해 질문에 답하는 도우미다.
- 금액·횟수가 필요한 질문은 반드시 제공된 함수를 호출해 얻은 값만 사용한다. 직접 계산하거나 추측하지 않는다.
- 오늘 날짜는 {today}이다. '이번 달'은 {this_month}이다.
- 사용 가능한 카테고리: {categories}.
- 답변은 2~4문장의 존댓말, 금액은 '12,300원'처럼 쓴다. 필요하면 짧은 절약 조언을 덧붙인다."""
