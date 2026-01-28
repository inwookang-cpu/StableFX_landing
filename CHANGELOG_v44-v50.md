# StableFX Changelog (v44 → v50)

> 작성일: 2026-01-27  
> 기간: v44 ~ v50 (약 1주일간 집중 개발)

---

## 📋 버전 요약

| 버전 | 핵심 변경 | 배포일 |
|------|----------|--------|
| v44 | Console 기반 구조, 기본 Curves/Advisory 탭 | 2026-01-20 |
| v45 | Blotter 탭, 거래 입력/관리 | 2026-01-21 |
| v46 | Advisory 자동 추천, Sp/Day 로직 | 2026-01-22 |
| v47 | Valuation 탭, DF 기반 Forward Rate | 2026-01-23 |
| v48 | Cash Balance, Accounting Rates, Naver 연동 | 2026-01-24 |
| v49 | IPS 실시간 스왑포인트, Market 데이터 통합 | 2026-01-25 |
| v50 | 정밀도 표준화, UI/UX 대폭 개선, PLG 기능 | 2026-01-27 |

---

## v44: Console 기반 아키텍처

### 주요 기능
- **Console 페이지** (`/console`) 신설
- **Curves 탭**: USD/KRW 금리 커브 관리, DF 계산
- **Advisory 탭**: 기본 FX Swap 가격 조회
- **JSON 기반 커브 데이터**: `/config/curves/*.json`

### 기술 스택
- Next.js 14 App Router
- Tailwind CSS (Kustody 테마)
- 정적 JSON 데이터 소스

---

## v45: Blotter (거래 관리)

### 신규 기능
- **Blotter 탭**: 거래 입력/수정/삭제
- 거래 유형: SWAP, OUTRIGHT, DEPOSIT
- Position 방향: BUY(매수), SELL(매도)
- LocalStorage 기반 저장

### 데이터 구조
```javascript
{
  id, client, type, direction,
  ccy1, ccy2, ccy1Amt, ccy2Amt,
  nearDate, farDate, rate, swapPoint,
  status: 'OPEN' | 'SETTLED' | 'CANCELLED'
}
```

---

## v46: Advisory 자동 추천

### 주요 개선
- **Tenor 자동 추천**: Sp/Day 기준 최적 tenor 제안
- **Spread 시뮬레이션**: Client Spread 적용 미리보기
- **Forward Rate 계산**: Spot + Swap Points

### 계산 로직
```
Sp/Day = Swap Points ÷ Days
최적 Tenor = max(Sp/Day) 기준 선택
Forward = Spot + Swap Points
```

---

## v47: Valuation (공정가치 평가)

### 신규 기능
- **Valuation 탭**: IFRS 공정가치 평가
- **Daily Forward Rate**: 730일 일별 환율 커브
- **미결제 거래 평가**: Blotter 연동 PnL 계산
- **CSV 다운로드**: 일별 DF, Forward Rate 내보내기

### DF 계산 방식
```
USD DF: ACT/360, Simple Interest
KRW DF: ACT/365, FX Swap Points 역산
Forward = Spot × (USD_DF / KRW_DF)
```

---

## v48: 데이터 인프라 구축

### 신규 기능
- **Cash Balance 탭**: 통화별 잔액 조회 (Blotter 연동)
- **Accounting Rates 탭**: 재무환율 조회 (SMBS.biz)
- **Naver 실시간 환율**: `/api/naver-rates` API Route

### 데이터 소스 연동
| 데이터 | 소스 | 주기 |
|--------|------|------|
| Spot Rate | 네이버 금융 | 4분 캐시 |
| Swap Points | IPS Corp | 30분 DB 캐시 |
| Accounting | SMBS.biz | 매일 08:40 |

### Supabase 스키마
```sql
-- 주요 테이블
spot_rates (currency_pair, rate, source, fetched_at)
fx_swap_points (tenor, days, mid_points, bid_points, ask_points)
accounting_rates (reference_date, currency_code, rate, change)
usd_rates / krw_rates (tenor, rate, source)
spread_settings (client_id, tenor, spread_pips)
```

---

## v49: Market 데이터 통합

### 주요 변경
- **IPS → Market 리브랜딩**: UI에서 "IPS" 제거
- **실시간 스왑포인트**: IPS Corp 데이터 30분 캐시
- **3-tier Fallback**: IPS → Supabase → JSON

### 데이터 흐름
```
1차: /api/ips-swap (실시간)
  ↓ 실패 시
2차: Supabase fx_swap_points (30분 캐시)
  ↓ 실패 시  
3차: JSON /config/curves/*.json (정적)
```

### GitHub Actions 자동화
- `naver-rates-collector.yml`: 15분마다 환율 수집
- `fx-data-collector.yml`: 매일 금리/재무환율 수집

---

## v50: 정밀도 표준화 & PLG 기능 (현재)

### 🎯 정밀도 표준 확립

| 구분 | 자릿수 | 설명 |
|------|--------|------|
| 내부 계산 | ~15자리 | JavaScript Number 그대로 |
| 화면 표시 (DF) | 10자리 | 가독성 + 정밀도 |
| 화면 표시 (환율) | 3자리 | 원단위 반올림 |
| CSV 다운로드 | 6/8/10자리 | 선택 가능 |

### 🔄 Valuation 탭 대폭 개선

#### Today Rebasing 로직
```javascript
// Curves 탭: Spot Date (T+2) 기준 DF=1
// Valuation: Today (평가일) 기준 DF=1로 rebasing

todayRatio = USD_DF(-spotDays) / KRW_DF(-spotDays)
// → 이 값이 1.000024 같은 값

rebasedDF(d) = 원본ratio(d) / todayRatio
// → Day 0: DF = 1.0000000000 ✅

공정가치 환율 = 재무환율 × rebasedDF
```

#### 용어 변경
| 기존 | 변경 |
|------|------|
| Forward Rate | **공정가치 환율** |
| 기본 재무환율 1450.50 | **1442.80** (Accounting Rates 연동) |
| 환율 10자리 표시 | **3자리** (소수점 반올림) |

#### UI 개선
- 계산 로직 설명 박스 추가
- Today ratio 값 표시 (디버깅용)
- CSV 파일명: `공정가치환율_날짜.csv`

### 📊 FX Info 대시보드 (`/fx-info`)

#### 선물환 설명 개선
```
기존: "선물환 스왑포인트" (전문 용어)

변경: "📌 지금 환율 고정하기"
      "오늘 환율로 고정하고, 미래에 결제하세요"
      
      1개월 후 | 3개월 후 | 6개월 후 | 1년 후
      ₩1,441   | ₩1,438   | ₩1,434   | ₩1,428
      
      💡 예시: 지금 3개월 선물환 계약 → ₩1,438.30에 결제 확정
```

#### 달러 관리 옵션 (신규)
```
┌──────────────────────────────────────┐
│ 📅 미래에 달러가 들어오나요?         │
│    수출대금, 해외투자 회수 등        │
│    → [선물환 매도 약정하기]          │
├──────────────────────────────────────┤
│ 🔔 지금 달러를 갖고 계신가요?        │
│    더 좋은 환율에 팔고 싶다면        │
│    → [목표 환율 알림 설정]           │
│                                      │
│    🚀 향후: 목표가 도달 시 자동 매도 │
└──────────────────────────────────────┘
```

### 🔔 환율 알림 기능 (PLG)

#### 적용 페이지
- `/` (랜딩 페이지): 스왑포인트 테이블 위 버튼
- `/fx-info`: 하단 고정 버튼 + 달러 관리 옵션

#### 알림 설정 모달
```
┌─────────────────────────────────┐
│ 🔔 환율 알림 설정               │
├─────────────────────────────────┤
│ 현재 USD/KRW: 1,442.80          │
│                                 │
│ 목표 환율:                      │
│ [▼1%] [ 1,443 ] [▲1%]          │
│                                 │
│ 이메일: [example@company.com]   │
│                                 │
│ [      알림 설정하기      ]     │
└─────────────────────────────────┘
          ↓ 제출 후
┌─────────────────────────────────┐
│          ✅                     │
│  알림이 설정되었습니다!         │
│                                 │
│  🎁 더 많은 기능이 필요하세요?  │
│  ✓ 무제한 알림 설정             │
│  ✓ EUR, JPY 등 다양한 통화      │
│  ✓ 스왑포인트 이론가 계산기     │
│                                 │
│ [  전문가 콘솔 시작하기 →  ]    │
└─────────────────────────────────┘
```

### 📱 랜딩 페이지 개선

#### 선물환 설명 박스 추가
```
💡 선물환이란?
지금 환율을 고정하고, 약정한 미래 날짜에 결제하는 거래입니다.
예) 3M 선물환 = 오늘 환율(1,442.80)에 스왑포인트를 더해 3개월 후에 결제
```

#### 환율 알림 버튼
```
[🔔 목표 환율 도달 시 알림 받기]
```

### 🐛 버그 수정

1. **Spread 설정 미적용**: Curves/Advisory 초기 로드 시 spread 미반영 → DEFAULT_SPREADS fallback 추가
2. **Naver API CORS**: 클라이언트 직접 호출 → API Route 프록시로 해결
3. **IPS API CORS**: 동일하게 `/api/ips-swap` 프록시 추가
4. **Advisory Spot Rate**: 1193.87 하드코딩 → liveSpot 우선 사용
5. **Valuation DF 계산**: USD/KRW 분리 (ACT/360 vs ACT/365)
6. **Accounting Rates 정렬**: USD 우선 표시

### 📁 파일 구조 변경

```
app/
├── page.js              # 랜딩 + 알림 모달 추가
├── console/page.js      # Valuation 대폭 개선
├── fx-info/page.js      # 달러 관리 옵션 + 알림
├── api/
│   ├── naver-rates/     # Naver 환율 프록시
│   └── ips-swap/        # IPS 스왑포인트 프록시
└── components/
    └── StableFXLanding.js  # About 간소화
```

---

## 🗺️ 향후 계획 (Roadmap)

### 단기 (v51)
- [ ] Supabase에 알림 설정 저장
- [ ] 알림 발송 시스템 (이메일)
- [ ] 다중 통화 알림 (EUR, JPY)

### 중기 (v52-53)
- [ ] 목표가 도달 시 자동 매도 기능
- [ ] 카카오톡/SMS 알림
- [ ] 회원가입/로그인 시스템

### 장기
- [ ] VASP 라이센스 연동
- [ ] 실제 거래 체결 (은행 API)
- [ ] 싱가포르 엔티티 연동

---

## 📊 기술 스택 요약

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Supabase (PostgreSQL), API Routes |
| 데이터 수집 | GitHub Actions, Node.js scripts |
| 데이터 소스 | Naver, IPS Corp, SMBS.biz, ECOS |
| 배포 | Vercel |

---

## 📝 주요 설계 결정

### 1. 정밀도 표준
- **계산**: JavaScript 네이티브 (~15자리) 유지
- **표시**: 10자리 (DF), 3자리 (환율)
- **이유**: 중간 truncation → 오차 누적 방지

### 2. Today Rebasing
- **문제**: Curves는 Spot Date 기준 DF=1
- **해결**: Valuation에서 Today 기준으로 재조정
- **공식**: `rebasedDF = 원본ratio / todayRatio`

### 3. 데이터 Fallback
- **3-tier**: 실시간 API → DB 캐시 → 정적 JSON
- **이유**: 안정성 확보, CORS 우회

### 4. PLG 전략
- **무료**: 환율 조회, 알림 설정, 계산기
- **유료 전환 유도**: 알림 완료 → 가입 혜택 안내

---

*Last updated: 2026-01-27*
