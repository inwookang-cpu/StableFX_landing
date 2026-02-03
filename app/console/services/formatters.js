/**
 * 숫자 및 날짜 포맷팅 유틸리티
 */

/**
 * 숫자 포맷팅 (천단위 콤마)
 */
export const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * 환율 포맷팅 (통화쌍별 소수점 자릿수)
 */
export const formatRate = (pair, rate) => {
  if (rate === null || rate === undefined || isNaN(rate)) return '-';
  
  // KRW 페어는 소수점 2자리
  if (pair?.includes('KRW')) {
    return rate.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  // JPY 페어는 소수점 3자리
  if (pair?.includes('JPY')) {
    return rate.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  }
  
  // 기타 (EURUSD 등)는 소수점 5자리
  return rate.toFixed(5);
};

/**
 * 스왑포인트 포맷팅 (전 단위 표시)
 */
export const formatSwapPoint = (point, showJeon = true) => {
  if (point === null || point === undefined || isNaN(point)) return '-';
  
  if (showJeon) {
    // 전 단위로 표시 (원 * 100)
    const jeon = point * 100;
    return jeon.toFixed(2);
  }
  
  // 원 단위 그대로
  return point.toFixed(4);
};

/**
 * 퍼센트 포맷팅
 */
export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
export const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 날짜+시간 포맷팅
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('ko-KR');
};

/**
 * 시간만 포맷팅 (HH:MM:SS)
 */
export const formatTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleTimeString('ko-KR');
};

/**
 * 금액 포맷팅 (USD/KRW)
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  
  if (currency === 'KRW') {
    return `₩${Math.round(amount).toLocaleString()}`;
  }
  
  return `$${formatNumber(amount, 2)}`;
};

/**
 * 변동폭 표시 (▲/▼)
 */
export const formatChange = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  const prefix = value >= 0 ? '▲' : '▼';
  return `${prefix} ${Math.abs(value).toFixed(decimals)}`;
};

/**
 * Notional 약어 (1M, 10M, 100M 등)
 */
export const formatNotional = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
};

/**
 * Tenor 표준화 (ON → O/N)
 */
export const normalizeTenor = (tenor) => {
  const map = {
    'ON': 'O/N',
    'TN': 'T/N',
    'SPOT': 'Spot'
  };
  return map[tenor] || tenor;
};
