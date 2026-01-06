# FX Date Calculator - Web Version

외환 파생상품 Date Rule 계산기 (Next.js)

## 실행 방법

```bash
# 1. 폴더로 이동
cd fx-date-calculator-web

# 2. 패키지 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 기능

### 🧮 Date 계산 탭
- 통화쌍 선택 (USDKRW, EURUSD, USDJPY 등)
- Trade Date → Spot Date → Maturity Date 자동 계산
- Tenor: SPOT, O/N, T/N, S/N, 1W~5Y
- Date Rule: MD_FOLLOWING, FOLLOWING, PRECEDING 등
- 다중 캘린더 자동 적용 (USDKRW = KR + US)

### 📋 휴일 관리 탭
- 휴일 추가/삭제
- 대체공휴일 쉽게 추가
- JSON 다운로드 (파일로 저장)
- 유형: fixed, lunar, substitute, floating

### 📅 캘린더 탭
- 월별 캘린더 시각화
- 휴일 표시 (빨간색)
- 다중 국가 토글
- 휴일 마우스 오버 시 상세 정보

## 휴일 파일 수정

`public/holidays/` 폴더 내 JSON 파일 수정:

```
public/holidays/
├── kr_2025.json  ← 한국 휴일
├── us_2025.json  ← 미국 휴일
└── jp_2025.json  ← 일본 휴일 (필요시 추가)
```

### JSON 형식

```json
{
  "year": 2025,
  "country": "KR",
  "updated_at": "2025-01-06",
  "holidays": [
    {"date": "2025-01-01", "name": "신정", "type": "fixed"},
    {"date": "2025-03-03", "name": "삼일절 대체공휴일", "type": "substitute"}
  ]
}
```

## 대체공휴일 추가

1. 휴일 관리 탭에서 국가 선택
2. 날짜, 휴일명 입력
3. 유형 → "Substitute (대체)" 선택
4. "휴일 추가" 클릭
5. "JSON 다운로드"로 파일 저장
6. `public/holidays/` 폴더에 덮어쓰기

## 통화쌍별 설정

| 통화쌍 | Spot Days | 적용 캘린더 |
|--------|-----------|-------------|
| USDKRW | 1 | KR, US |
| KRWUSD | 1 | KR, US |
| EURUSD | 2 | US |
| USDJPY | 2 | US, JP |
| EURJPY | 2 | JP |
| GBPUSD | 2 | US, GB |

---

KustodyFi © 2025
