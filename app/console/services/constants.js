/**
 * 상수 및 기본값 정의
 */

// Supabase 설정
export const SUPABASE_CONFIG = {
  URL: 'https://dxenbwvhxdcgtdivjhpa.supabase.co',
  ANON_KEY: 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO'
};

// 캐시 설정 (밀리초)
export const CACHE_DURATION = {
  SPOT_RATES: 4 * 60 * 1000,      // 4분
  SWAP_POINTS: 30 * 60 * 1000,    // 30분
  SPREAD_SETTINGS: 60 * 60 * 1000 // 1시간
};

// 기본 스프레드 설정 (DB에 없을 경우 fallback)
export const DEFAULT_SPREADS = {
  'O/N': 1.5,
  'T/N': 1.5,
  '1W': 4,
  '1M': 10,
  '2M': 20,
  '3M': 30,
  '6M': 40,
  '9M': 60,
  '1Y': 80
};

// 테너 매핑
export const TENOR_MAP = {
  'ON': 'O/N',
  'TN': 'T/N',
  '1W': '1W',
  '2W': '2W',
  '3W': '3W',
  '1M': '1M',
  '2M': '2M',
  '3M': '3M',
  '4M': '4M',
  '5M': '5M',
  '6M': '6M',
  '7M': '7M',
  '8M': '8M',
  '9M': '9M',
  '10M': '10M',
  '11M': '11M',
  '1Y': '1Y'
};

// 기본 공휴일
export const DEFAULT_HOLIDAYS = {
  KR: [
    { date: "2025-01-01", name: "신정" },
    { date: "2025-03-01", name: "삼일절" },
    { date: "2025-05-05", name: "어린이날" },
    { date: "2025-06-06", name: "현충일" },
    { date: "2025-08-15", name: "광복절" },
    { date: "2025-10-03", name: "개천절" },
    { date: "2025-10-09", name: "한글날" },
    { date: "2025-12-25", name: "크리스마스" },
    { date: "2026-01-01", name: "신정" },
    { date: "2026-01-27", name: "설날" },
    { date: "2026-01-28", name: "설날" },
    { date: "2026-01-29", name: "설날" },
    { date: "2026-03-01", name: "삼일절" },
    { date: "2026-05-05", name: "어린이날" },
    { date: "2026-05-24", name: "부처님오신날" },
    { date: "2026-06-06", name: "현충일" },
    { date: "2026-08-15", name: "광복절" },
    { date: "2026-09-24", name: "추석" },
    { date: "2026-09-25", name: "추석" },
    { date: "2026-09-26", name: "추석" },
    { date: "2026-10-03", name: "개천절" },
    { date: "2026-10-09", name: "한글날" },
    { date: "2026-12-25", name: "크리스마스" },
  ],
  US: [
    { date: "2025-01-01", name: "New Year's Day" },
    { date: "2025-01-20", name: "MLK Day" },
    { date: "2025-02-17", name: "Presidents Day" },
    { date: "2025-05-26", name: "Memorial Day" },
    { date: "2025-07-04", name: "Independence Day" },
    { date: "2025-09-01", name: "Labor Day" },
    { date: "2025-11-27", name: "Thanksgiving" },
    { date: "2025-12-25", name: "Christmas" },
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-19", name: "MLK Day" },
    { date: "2026-02-16", name: "Presidents Day" },
    { date: "2026-05-25", name: "Memorial Day" },
    { date: "2026-07-03", name: "Independence Day (observed)" },
    { date: "2026-09-07", name: "Labor Day" },
    { date: "2026-11-26", name: "Thanksgiving" },
    { date: "2026-12-25", name: "Christmas" },
  ]
};

// 금융결제원 은행코드
export const BANK_CODES = [
  { code: "004", name: "KB국민은행" },
  { code: "011", name: "NH농협은행" },
  { code: "020", name: "우리은행" },
  { code: "081", name: "하나은행" },
  { code: "088", name: "신한은행" },
  { code: "003", name: "IBK기업은행" },
  { code: "023", name: "SC제일은행" },
  { code: "027", name: "한국씨티은행" },
  { code: "071", name: "우체국" },
  { code: "089", name: "케이뱅크" },
  { code: "090", name: "카카오뱅크" },
  { code: "092", name: "토스뱅크" },
  { code: "005", name: "외환은행" },
  { code: "032", name: "부산은행" },
  { code: "031", name: "대구은행" },
  { code: "039", name: "경남은행" },
  { code: "034", name: "광주은행" },
  { code: "037", name: "전북은행" },
  { code: "035", name: "제주은행" },
];

// Credit Tiers 기본 설정
export const DEFAULT_CREDIT_TIERS = {
  "1": { name: "Prime", pointMargin: 0, bpMargin: 0 },
  "2": { name: "Standard", pointMargin: 5, bpMargin: 5 },
  "3": { name: "Subprime", pointMargin: 20, bpMargin: 15 },
  "4": { name: "Discouraged", pointMargin: 100, bpMargin: 50 },
  "5": { name: "Blocked", pointMargin: null, bpMargin: null }
};

// Notional Tiers 기본 설정
export const DEFAULT_NOTIONAL_TIERS = [
  { min: 0, max: 1000000, margin: 10, name: "Small (<$1M)" },
  { min: 1000000, max: 10000000, margin: 0, name: "Standard ($1M~$10M)" },
  { min: 10000000, max: null, margin: 5, name: "Large (>$10M)" }
];
