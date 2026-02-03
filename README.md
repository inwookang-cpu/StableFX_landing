# FX Date Calculator - Web Version

외환 파생상품 Date Rule 계산기 & Professional Console (Next.js)

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

---

## 📊 메인 페이지 (/)

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

---

## 🎛️ Professional Console (/console)

FX 딜러용 전문가 콘솔 - 실시간 시장 데이터 연동

### 주요 탭

| 탭 | 기능 |
|-----|------|
| **Curves** | IPS 스왑포인트 실시간 로드, USD/KRW 금리 커브 Bootstrap, Bid/Ask Spread 적용 |
| **Calculator** | Trade Date → Maturity Date 계산 |
| **Client Pricing** | 고객별 Credit Tier 기반 마진 계산, Forward 호가 생성 |
| **Advisory** | FX Forward/Swap 거래 입력, 실시간 P&L 계산 |
| **Blotter** | 거래 내역 조회/관리/삭제 |
| **Cash Schedule** | 결제 스케줄 조회 |
| **Valuation** | MTM 평가, Discount Factor 기반 NPV 계산 |
| **Cash Balance** | 통화별 잔고 현황 |
| **Accounting Rates** | 재무환율 조회 (매매기준율, 재정환율) |
| **Settings** | Spread 설정, Counter Party/고객/은행 관리 |

### 데이터 소스
- **Spot Rate**: 네이버 금융 (GitHub Actions 15분마다 수집 → Supabase)
- **Swap Points**: IPS (실시간 API)
- **Accounting Rates**: 하나은행 재무환율

### 폴더 구조

```
app/console/
├── page.js                           # 메인 컨트롤러 (451줄)
├── components/
│   ├── common/
│   │   └── DeferredInput.jsx         # 지연 입력 컴포넌트
│   └── tabs/
│       ├── CurvesTab.jsx             # 금리 커브 (1823줄)
│       ├── CalculatorTab.jsx         # 날짜 계산
│       ├── ClientPricingTab.jsx      # 고객 프라이싱 (1260줄)
│       ├── AdvisoryTab.jsx           # 거래 입력 (1141줄)
│       ├── BlotterTab.jsx            # 거래 내역
│       ├── CashScheduleTab.jsx       # 결제 스케줄
│       ├── ValuationTab.jsx          # 평가
│       ├── CashBalanceTab.jsx        # 잔고
│       ├── AccountingRatesTab.jsx    # 재무환율
│       ├── SettingsTab.jsx           # 설정 (879줄)
│       ├── ClientsTab.jsx            # 고객 관리
│       ├── ClientModal.jsx           # 고객 모달
│       ├── ConfigTab.jsx             # 통화쌍 설정
│       ├── HolidaysTab.jsx           # 휴일 관리
│       └── CalendarTab.jsx           # 캘린더
└── services/
    ├── SupabaseService.js            # DB 추상화 레이어
    ├── constants.js                  # 상수 (캐시 시간, 기본값)
    └── formatters.js                 # 숫자/날짜 포맷팅 유틸
```

---

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

## 기술 스택

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Data Collection**: GitHub Actions (cron)
- **Deployment**: Vercel

---

KustodyFi © 2025
