# FX Date Calculator - Changelog

## v50 (2026-01-27)

### 🐛 버그 수정

**1. Spread 적용 안 됨**
- Curves 탭: DB에서 mid_points 로드 후 spread_settings 적용 → bid/ask 계산
- Advisory 탭: JSON 로드 후 spread_settings 적용 → bid/ask 계산
- Client Pricing 탭: 동일하게 spread_settings 적용

**2. 네이버 환율 CORS 에러**
- 문제: 브라우저에서 직접 네이버 API 호출 시 CORS 차단
- 해결: Next.js API route (`/api/naver-rates`) 추가
- 서버에서 네이버 API 호출 → 클라이언트에 결과 반환

**3. Valuation 탭 DF = NaN**
- 원인: JSON에 `df` 필드가 없고 `rate`만 있음
- 해결: rate로부터 DF 계산: `DF = 1 / (1 + rate/100 * days/365)`

**4. Accounting Rates 정렬 및 표시**
- USD가 항상 맨 위에 오도록 정렬
- 변동폭 표시: % → 원 단위 (예: -24.4)

### 📁 새 파일
- `app/api/naver-rates/route.js` - 네이버 환율 프록시 API

---

## v49 (2026-01-27)

### 🔄 FX Swap 실시간 연동
- **📡 Market 버튼** 추가 (Curves 탭)
  - 실시간 스왑포인트 fetch → DB 저장
  - 30분 캐싱: DB 데이터 30분 이내면 재사용
  - 30분 경과 시 새로 fetch → DB 업데이트
- IPS → Market으로 명칭 변경 (UI에서 소스 숨김)

### 💰 Client Pricing 개선
- 네이버 실시간 환율 연동 추가
- 📡 버튼 + Spot 환율 표시
- Advisory 탭과 동일한 UI

### 🗑️ 제거
- `fx-swap-collector.yml` (GitHub Actions)
- `fx_swap_collector.py`

---

## v48 (2026-01-27)

### 📊 새 탭 추가
- **💰 Cash Balance 탭**: Blotter 거래 기반 잔고 관리
- **🏦 Accounting Rates 탭**: 재무환율 조회 (smbs.biz)

### 📡 네이버 환율 연동
- Curves 탭: 📡 네이버 버튼 추가
- Advisory 탭: 📡 버튼 + 실시간 스팟 표시
- 4분 글로벌 캐싱

### 🔢 소수점 포맷팅
- USDKRW: 3자리 (1,442.800)
- USDJPY: 3자리 (155.500)
- 기타: 5자리 (1.04500)

### 🔧 Backend
- `accounting_rates_scraper.py` 추가
- GitHub Actions 워크플로우 설정
- smbs.biz Flash API 연동

---

## v47 (2026-01-27)

### 📉 테너 표준화
17개 → **9개 표준 테너**로 축소:
- O/N, T/N, 1W, 1M, 2M, 3M, 6M, 9M, 1Y
- 제거: 2W, 3W, 4M, 5M, 7M, 8M, 10M, 11M

### 📊 Spread 설정 최종화
| 테너 | Spread (pips) |
|------|---------------|
| O/N | 3 |
| T/N | 3 |
| 1W | 8 |
| 1M | 20 |
| 2M | 40 |
| 3M | 60 |
| 6M | 80 |
| 9M | 120 |
| 1Y | 160 |

### 🗄️ Supabase 연동
- DB 스키마 설계 완료
- `fx_swap_points`, `usd_rates`, `krw_rates`, `accounting_rates` 테이블
- `latest_fx_curve` 뷰 생성
- 🔄 Load DB 버튼 추가

---

## v46 (2026-01-26)

### 🎨 UI/UX 개선
- 다크 테마 컬러 시스템 적용
- Kustody 브랜딩 (accent: #00D4AA)
- 반응형 레이아웃

### 📋 Blotter 탭 개선
- 거래 입력/수정/삭제
- 필터링 (Client, Direction)
- CSV Export

### 📅 Cash Schedule 탭
- 결제일별 현금흐름 표시
- USD/KRW 분리 표시

---

## v45 (2026-01-25)

### 🧮 Pricing Engine
- Bootstrap 커브 생성
- Linear/Log-Linear 보간법
- Margin 계산 (Credit + Notional)

### 💰 Client Pricing 탭
- 고객별 마진 적용 가격 산출
- Credit Tier (1-5) 시스템
- Notional Tier 시스템
- Point/BP 마진 방식 지원

### ⚙️ Settings 탭
- Credit Tier 설정
- Notional Tier 설정
- 고객 관리 (CRUD)

---

## v44 (2026-01-24)

### 🚀 초기 버전
- Date Calculator 기능
- Spot Date 계산 (T+2)
- Forward Date 계산
- 한국/미국 공휴일 처리

### 📊 Curves 탭
- USD/KRW 금리 커브 표시
- FX Swap Points 표시
- Spot Rates 표시

### 🎯 Advisory 탭
- 고객용 스왑포인트 계산
- Tenor별 가격 표시
- Pro/Beginner 모드

---

## 데이터 아키텍처 (v49 기준)

### 자동 수집 (GitHub Actions 08:45 KST)
| 데이터 | 소스 | 저장 |
|--------|------|------|
| 재무환율 | smbs.biz | ✅ DB |
| USD 금리 | FRED API | ✅ DB |

### 실시간 (프론트엔드)
| 데이터 | 소스 | 저장 |
|--------|------|------|
| FX Swap | Market API | ✅ DB (30분 캐싱) |
| Spot 환율 | Naver API | ❌ 캐시만 (4분) |

---

## 파일 구조 (v49)

```
fx-date-calculator-web/
├── app/
│   ├── console/
│   │   └── page.js          # 메인 콘솔 (6,168 lines)
│   ├── components/
│   │   └── StableFXLanding.js
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── lib/
│   ├── dateCalculator.js
│   └── pricing/
│       ├── bootstrap.js
│       ├── interpolation.js
│       └── margin.js
├── public/
│   ├── config/
│   │   ├── curves/
│   │   │   └── 20260127_IW.json
│   │   └── global_config.json
│   └── holidays/
│       ├── kr_2026.json
│       └── us_2026.json
└── package.json
```

---

## API Keys & Credentials

| 서비스 | 용도 |
|--------|------|
| Supabase | DB 저장/조회 |
| FRED | USD 금리 |
| Naver Stock API | 실시간 환율 |
| smbs.biz | 재무환율 |
| Market API | FX Swap Points |

---

## 다음 계획

- [ ] 한국 공휴일 API 연동
- [ ] 알림 기능 (환율 급변 시)
- [ ] 모바일 최적화
- [ ] 사용자 인증 (Supabase Auth)
