/**
 * FX Date Rule Calculator
 * 외환 파생상품 거래에서 사용되는 Date Rule 계산기
 * 다중 통화 캘린더 지원
 */

// 날짜 포맷 헬퍼
export function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

export function getDayName(date, locale = 'ko-KR') {
  return new Date(date).toLocaleDateString(locale, { weekday: 'short' });
}

export function getDayNameEn(date) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
}

// Date Rule Calculator Class
export class DateRuleCalculator {
  constructor(holidayCalendars = {}) {
    // holidayCalendars: { 'KR': Set(['2025-01-01', ...]), 'US': Set([...]) }
    this.calendars = {};
    for (const [country, holidays] of Object.entries(holidayCalendars)) {
      this.calendars[country] = new Set(
        Array.isArray(holidays) 
          ? holidays.map(h => typeof h === 'string' ? h : h.date)
          : holidays
      );
    }
  }

  addCalendar(country, holidays) {
    this.calendars[country] = new Set(
      holidays.map(h => typeof h === 'string' ? h : h.date)
    );
  }

  isBusinessDay(date, calendars = null) {
    const d = new Date(date);
    const dateStr = formatDate(d);
    
    // 주말 체크 (토요일=6, 일요일=0)
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // 휴일 체크 - calendars가 배열인지 확인
    const checkCalendars = Array.isArray(calendars) && calendars.length > 0 
      ? calendars 
      : Object.keys(this.calendars);
    
    for (const cal of checkCalendars) {
      if (this.calendars[cal]?.has(dateStr)) {
        return false;
      }
    }

    return true;
  }

  nextBusinessDay(date, forward = true, calendars = null) {
    const step = forward ? 1 : -1;
    let current = new Date(date);
    current.setDate(current.getDate() + step);

    while (!this.isBusinessDay(current, calendars)) {
      current.setDate(current.getDate() + step);
    }

    return current;
  }

  getMonthEnd(date) {
    const d = new Date(date);
    // 다음 달 1일에서 1일 빼기
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    nextMonth.setDate(nextMonth.getDate() - 1);
    return nextMonth;
  }

  applyDateRule(date, rule, calendars = null) {
    const d = new Date(date);
    rule = rule.toUpperCase();

    if (rule === 'NO_CHANGE') {
      return d;
    }

    if (rule === 'END_MONTH') {
      const monthEnd = this.getMonthEnd(d);
      if (!this.isBusinessDay(monthEnd, calendars)) {
        return this.nextBusinessDay(monthEnd, false, calendars);
      }
      return monthEnd;
    }

    // 이미 영업일이면 그대로 반환
    if (this.isBusinessDay(d, calendars)) {
      return d;
    }

    if (rule === 'FOLLOWING') {
      return this.nextBusinessDay(d, true, calendars);
    }

    if (rule === 'PRECEDING') {
      return this.nextBusinessDay(d, false, calendars);
    }

    if (rule === 'MD_FOLLOWING') {
      const adjusted = this.nextBusinessDay(d, true, calendars);
      // 월이 바뀌었으면 PRECEDING 적용
      if (adjusted.getMonth() !== d.getMonth()) {
        return this.nextBusinessDay(d, false, calendars);
      }
      return adjusted;
    }

    if (rule === 'MD_PRECEDING') {
      const adjusted = this.nextBusinessDay(d, false, calendars);
      // 월이 바뀌었으면 FOLLOWING 적용
      if (adjusted.getMonth() !== d.getMonth()) {
        return this.nextBusinessDay(d, true, calendars);
      }
      return adjusted;
    }

    throw new Error(`Unknown date rule: ${rule}`);
  }

  addTenor(startDate, tenor, spotDays = 2, calendars = null, eomRule = true) {
    tenor = tenor.toUpperCase().trim();
    let start = new Date(startDate);

    // Spot date 계산
    let spotDate = new Date(start);
    for (let i = 0; i < spotDays; i++) {
      spotDate = this.nextBusinessDay(spotDate, true, calendars);
    }

    if (!tenor || tenor === 'SPOT') {
      return spotDate;
    }

    // O/N (Overnight) - Trade Date 다음 영업일
    if (tenor === 'O/N' || tenor === 'ON') {
      return this.nextBusinessDay(start, true, calendars);
    }

    // T/N (Tom-Next) - T+1 ~ T+2
    if (tenor === 'T/N' || tenor === 'TN') {
      const tomorrow = this.nextBusinessDay(start, true, calendars);
      return this.nextBusinessDay(tomorrow, true, calendars);
    }

    // S/N (Spot-Next) - Spot 다음 영업일
    if (tenor === 'S/N' || tenor === 'SN') {
      return this.nextBusinessDay(spotDate, true, calendars);
    }

    // End-of-Month Rule 체크: Spot이 월말 영업일인지 확인
    const isSpotEOM = eomRule && this.isEndOfMonthBusinessDay(spotDate, calendars);

    let maturity;

    // Week - EOM Rule 적용 안 함
    if (tenor.endsWith('W')) {
      const weeks = parseInt(tenor.slice(0, -1));
      maturity = new Date(spotDate);
      maturity.setDate(maturity.getDate() + weeks * 7);
      return this.applyDateRule(maturity, 'MD_FOLLOWING', calendars);
    }
    // Year
    else if (tenor.endsWith('Y') || tenor.endsWith('YR')) {
      const years = parseInt(tenor.replace('YR', '').replace('Y', ''));
      maturity = new Date(spotDate);
      maturity.setFullYear(maturity.getFullYear() + years);
      
      // EOM Rule: Spot이 월말이면 만기도 월말
      if (isSpotEOM) {
        maturity = this.getMonthEndBusinessDay(maturity, calendars);
      } else {
        maturity = this.applyDateRule(maturity, 'MD_FOLLOWING', calendars);
      }
    }
    // Month (기본)
    else if (tenor.endsWith('M')) {
      const months = parseInt(tenor.slice(0, -1));
      maturity = new Date(spotDate);
      const targetMonth = maturity.getMonth() + months;
      const targetYear = maturity.getFullYear() + Math.floor(targetMonth / 12);
      const finalMonth = targetMonth % 12;
      
      // 같은 일자로 설정 시도
      const originalDay = maturity.getDate();
      maturity.setFullYear(targetYear);
      maturity.setMonth(finalMonth);
      
      // 월말 처리 (예: 1월 31일 + 1M = 2월 28/29일)
      if (maturity.getDate() !== originalDay) {
        maturity = this.getMonthEnd(new Date(targetYear, finalMonth, 1));
      }
      
      // EOM Rule: Spot이 월말이면 만기도 월말
      if (isSpotEOM) {
        maturity = this.getMonthEndBusinessDay(maturity, calendars);
      } else {
        maturity = this.applyDateRule(maturity, 'MD_FOLLOWING', calendars);
      }
    }
    else {
      throw new Error(`Unknown tenor format: ${tenor}`);
    }

    return maturity;
  }

  // Spot이 월말 영업일인지 확인
  isEndOfMonthBusinessDay(date, calendars = null) {
    const d = new Date(date);
    const monthEnd = this.getMonthEnd(d);
    const lastBD = this.getMonthEndBusinessDay(d, calendars);
    
    return formatDate(d) === formatDate(lastBD);
  }

  // 해당 월의 마지막 영업일 구하기
  getMonthEndBusinessDay(date, calendars = null) {
    const monthEnd = this.getMonthEnd(date);
    if (this.isBusinessDay(monthEnd, calendars)) {
      return monthEnd;
    }
    return this.nextBusinessDay(monthEnd, false, calendars);
  }

  // 두 날짜 사이의 영업일 수 계산
  countBusinessDays(startDate, endDate, calendars = null) {
    let count = 0;
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current < end) {
      current.setDate(current.getDate() + 1);
      if (this.isBusinessDay(current, calendars)) {
        count++;
      }
    }

    return count;
  }
}

// ========== 개별 통화 캘린더 ==========
export const CURRENCY_CALENDARS = {
  'USD': ['US'],
  'KRW': ['KR'],
  'JPY': ['JP'],
  'EUR': ['EU'],
  'GBP': ['GB'],
  'AUD': ['AU'],
  'NZD': ['NZ'],
  'CAD': ['CA'],
  'CHF': ['CH'],
  'CNH': ['CN'],
  'NOK': ['NO'],
  'SEK': ['SE'],
};

// ========== Cross Rate 캘린더 계산 ==========
// Cross Rate는 USD를 경유하므로 세 통화의 캘린더가 모두 필요
// 예: JPYKRW = USDJPY + USDKRW → ['JP', 'US', 'KR']
export function getCrossCalendars(baseCcy, quoteCcy) {
  const baseCalendars = CURRENCY_CALENDARS[baseCcy] || [];
  const quoteCalendars = CURRENCY_CALENDARS[quoteCcy] || [];
  
  // 둘 다 USD가 아니면 Cross Rate → USD 캘린더도 필요
  if (baseCcy !== 'USD' && quoteCcy !== 'USD') {
    const usdCalendars = CURRENCY_CALENDARS['USD'];
    return [...new Set([...baseCalendars, ...quoteCalendars, ...usdCalendars])];
  }
  
  // 직접 거래 (한쪽이 USD인 경우)
  return [...new Set([...baseCalendars, ...quoteCalendars])];
}

// 통화쌍 문자열에서 캘린더 계산
export function getCalendarsForPair(ccyPair) {
  // 미리 정의된 쌍이 있으면 사용
  if (CALENDAR_MAP[ccyPair]) {
    return CALENDAR_MAP[ccyPair].calendars;
  }
  
  // 없으면 동적 계산 (6글자 = 3+3)
  if (ccyPair.length === 6) {
    const baseCcy = ccyPair.substring(0, 3);
    const quoteCcy = ccyPair.substring(3, 6);
    return getCrossCalendars(baseCcy, quoteCcy);
  }
  
  return ['US']; // fallback
}

// Cross Rate 여부 확인
export function isCrossRate(baseCcy, quoteCcy) {
  return baseCcy !== 'USD' && quoteCcy !== 'USD';
}

// ========== 통화쌍별 캘린더 매핑 (직접 거래) ==========
export const CALENDAR_MAP = {
  // Active (Priority 1-3)
  'USDKRW': { calendars: ['KR', 'US'], spotDays: 2 },
  'USDJPY': { calendars: ['JP', 'US'], spotDays: 2 },
  'EURUSD': { calendars: ['EU', 'US'], spotDays: 2 },
  // Inactive (Bloomberg 연동 후 활성화)
  // 'GBPUSD': { calendars: ['GB', 'US'], spotDays: 2 },
  // 'AUDUSD': { calendars: ['AU', 'US'], spotDays: 2 },
  // 'USDCNH': { calendars: ['CN', 'US'], spotDays: 2 },
};

// Tenor 목록
export const TENORS = [
  'SPOT', 'O/N', 'T/N', 'S/N',
  '1W', '2W', '3W',
  '1M', '2M', '3M', '4M', '5M', '6M',
  '9M', '1Y', '18M', '2Y', '3Y', '5Y'
];

// Date Rule 목록
export const DATE_RULES = [
  { value: 'MD_FOLLOWING', label: 'Modified Following' },
  { value: 'FOLLOWING', label: 'Following' },
  { value: 'PRECEDING', label: 'Preceding' },
  { value: 'MD_PRECEDING', label: 'Modified Preceding' },
  { value: 'END_MONTH', label: 'End of Month' },
  { value: 'NO_CHANGE', label: 'No Change' },
];
