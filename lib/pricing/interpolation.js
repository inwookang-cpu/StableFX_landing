/**
 * FX Swap Point & Discount Factor Interpolation Functions
 * 
 * interpolateSwapPointLinear: Linear interpolation on swap points
 * interpolateRaw: Log-linear interpolation on discount factors
 * interpolateClientSwapPoint: Client swap point interpolation (with margin)
 */

/**
 * Linear Interpolation on FX Swap Points
 * Spot 이전: O/N, T/N 구간 그대로 반환
 * Spot 이후: tenor 간 선형 보간
 * 
 * @param {number} days - Days from spot (negative for pre-spot)
 * @param {Array} swapPoints - FX Swap Points array
 * @param {string} spotDateStr - Spot date (YYYY-MM-DD)
 * @param {string} targetDateStr - Target date (YYYY-MM-DD)
 * @returns {Object} - Interpolated result with points, bid, ask
 */
export const interpolateSwapPointLinear = (days, swapPoints, spotDateStr, targetDateStr) => {
  if (!swapPoints || swapPoints.length === 0) return null;
  
  // Spot 이전 (days < 0): 해당 구간의 T/N, O/N 값 그대로 반환
  // 표시: Start(입력일) → Maturity(Spot)
  if (days < 0) {
    const tn = swapPoints.find(sp => sp.tenor === 'T/N');
    const on = swapPoints.find(sp => sp.tenor === 'O/N');
    
    if (days === -1) {
      // Tom: T/N 구간 (입력일 → Spot)
      return {
        startDate: targetDateStr,
        maturityDate: spotDateStr,
        displayDays: 1,
        tenor: 'T/N',
        points: tn?.points || 0,
        bid: tn?.bid || 0,
        ask: tn?.ask || 0
      };
    } else if (days <= -2) {
      // Today: O/N + T/N 구간
      // Start(입력일) → Spot, 2일
      return {
        startDate: targetDateStr,
        maturityDate: spotDateStr,
        displayDays: Math.abs(days),
        tenor: 'O/N+T/N',
        points: (on?.points || 0) + (tn?.points || 0),
        bid: (on?.bid || 0) + (tn?.bid || 0),
        ask: (on?.ask || 0) + (tn?.ask || 0)
      };
    }
  }
  
  // Spot (days = 0)
  if (days === 0) {
    return { 
      startDate: spotDateStr,
      maturityDate: spotDateStr,
      displayDays: 0,
      tenor: 'Spot',
      points: 0, 
      bid: 0, 
      ask: 0 
    };
  }
  
  // Spot 이후 (days > 0): 1W, 1M, ... 등 Spot 이후 tenor들만 사용
  // 표시: Start(Spot) → Maturity(입력일)
  const postSpot = swapPoints.filter(sp => sp.days > 0).sort((a, b) => a.days - b.days);
  
  if (postSpot.length === 0) return null;
  
  let result;
  let tenor = '';
  
  // 범위 체크
  if (days <= postSpot[0].days) {
    // 1W 이전: 0 ~ 1W 사이 비례 계산
    const t = days / postSpot[0].days;
    tenor = `<${postSpot[0].tenor}`;
    result = {
      points: postSpot[0].points * t,
      bid: postSpot[0].bid !== null ? postSpot[0].bid * t : null,
      ask: postSpot[0].ask !== null ? postSpot[0].ask * t : null
    };
  } else if (days >= postSpot[postSpot.length - 1].days) {
    tenor = `>${postSpot[postSpot.length - 1].tenor}`;
    result = { 
      points: postSpot[postSpot.length - 1].points, 
      bid: postSpot[postSpot.length - 1].bid, 
      ask: postSpot[postSpot.length - 1].ask 
    };
  } else {
    // 보간할 구간 찾기
    let lower = postSpot[0], upper = postSpot[1];
    for (let i = 0; i < postSpot.length - 1; i++) {
      if (days >= postSpot[i].days && days <= postSpot[i + 1].days) {
        lower = postSpot[i];
        upper = postSpot[i + 1];
        break;
      }
    }
    
    tenor = `${lower.tenor}-${upper.tenor}`;
    
    // Linear interpolation
    const t = (days - lower.days) / (upper.days - lower.days);
    result = {
      points: lower.points + (upper.points - lower.points) * t,
      bid: (lower.bid !== null && upper.bid !== null) ? lower.bid + (upper.bid - lower.bid) * t : null,
      ask: (lower.ask !== null && upper.ask !== null) ? lower.ask + (upper.ask - lower.ask) * t : null
    };
  }
  
  return {
    startDate: spotDateStr,
    maturityDate: targetDateStr,
    displayDays: days,
    tenor: tenor,
    ...result
  };
};

/**
 * Log-linear interpolation on ln(DF)
 * Internal helper function
 */
const interpolateLnDF = (curve, targetDays, lnDfType = 'lnDF') => {
  const sorted = [...curve.tenors].filter(t => t[lnDfType] !== undefined && t.days > 0).sort((a, b) => a.days - b.days);
  
  if (sorted.length === 0) return null;
  
  // 범위 밖 처리
  if (targetDays <= sorted[0].days) {
    // Spot ~ 첫 tenor 사이: 비례 보간
    const t = targetDays / sorted[0].days;
    return sorted[0][lnDfType] * t;
  }
  if (targetDays >= sorted[sorted.length - 1].days) return sorted[sorted.length - 1][lnDfType];
  
  // 보간 구간 찾기
  let lower = sorted[0], upper = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (targetDays >= sorted[i].days && targetDays <= sorted[i + 1].days) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }
  
  // Linear interpolation on ln(DF)
  const lnDfLower = lower[lnDfType];
  const lnDfUpper = upper[lnDfType];
  const t = (targetDays - lower.days) / (upper.days - lower.days);
  
  return lnDfLower + (lnDfUpper - lnDfLower) * t;
};

/**
 * Raw Interpolation using Log-Linear DF
 * Forward = Spot × (USD_DF / KRW_DF)
 * SwapPoints = Forward - Spot
 * 
 * @param {number} days - Days from spot
 * @param {Object} usdCurve - Bootstrapped USD curve
 * @param {Object} krwCurve - Bootstrapped KRW curve
 * @param {number} spot - Spot rate
 * @param {Array} fxSwapPoints - FX Swap Points (for pre-spot)
 * @param {string} spotDateStr - Spot date
 * @param {string} targetDateStr - Target date
 * @returns {Object} - Interpolated result with forward, points, bid, ask
 */
export const interpolateRaw = (days, usdCurve, krwCurve, spot, fxSwapPoints, spotDateStr, targetDateStr) => {
  if (!usdCurve || !krwCurve || !spot) return null;
  
  // Spot 이전 (days < 0): Swap Point Linear와 동일
  if (days < 0 && fxSwapPoints) {
    const tn = fxSwapPoints.find(sp => sp.tenor === 'T/N');
    const on = fxSwapPoints.find(sp => sp.tenor === 'O/N');
    
    if (days === -1) {
      return {
        startDate: targetDateStr,
        maturityDate: spotDateStr,
        displayDays: 1,
        tenor: 'T/N',
        usdDF: 1,
        krwDF: 1,
        forward: spot + (tn?.points || 0),
        points: tn?.points || 0,
        bid: tn?.bid || 0,
        ask: tn?.ask || 0
      };
    } else if (days <= -2) {
      const totalPoints = (on?.points || 0) + (tn?.points || 0);
      return {
        startDate: targetDateStr,
        maturityDate: spotDateStr,
        displayDays: Math.abs(days),
        tenor: 'O/N+T/N',
        usdDF: 1,
        krwDF: 1,
        forward: spot + totalPoints,
        points: totalPoints,
        bid: (on?.bid || 0) + (tn?.bid || 0),
        ask: (on?.ask || 0) + (tn?.ask || 0)
      };
    }
  }
  
  // Spot (days = 0)
  if (days === 0) {
    return {
      startDate: spotDateStr,
      maturityDate: spotDateStr,
      displayDays: 0,
      tenor: 'Spot',
      usdDF: 1,
      krwDF: 1,
      forward: spot,
      points: 0,
      bid: 0,
      ask: 0
    };
  }
  
  // Spot 이후 (days > 0): Log-Linear DF 보간
  // USD는 단일 커브 (Bid/Ask 없음)
  const usdLnDF = interpolateLnDF(usdCurve, days, 'lnDF');
  const usdDF = usdLnDF !== null ? Math.exp(usdLnDF) : null;
  
  // KRW는 Bid/Mid/Ask 각각 보간
  const krwLnDFMid = interpolateLnDF(krwCurve, days, 'lnDF');
  const krwLnDFBid = interpolateLnDF(krwCurve, days, 'lnDfBid');
  const krwLnDFAsk = interpolateLnDF(krwCurve, days, 'lnDfAsk');
  
  const krwDFMid = krwLnDFMid !== null ? Math.exp(krwLnDFMid) : null;
  const krwDFBid = krwLnDFBid !== null ? Math.exp(krwLnDFBid) : null;
  const krwDFAsk = krwLnDFAsk !== null ? Math.exp(krwLnDFAsk) : null;
  
  if (!usdDF || !krwDFMid) return null;
  
  // Forward 계산: Forward = Spot × (USD_DF / KRW_DF)
  const forwardMid = spot * (usdDF / krwDFMid);
  const swapPointsMid = forwardMid - spot;
  
  const forwardBid = krwDFBid ? spot * (usdDF / krwDFBid) : null;
  const swapPointsBid = forwardBid ? forwardBid - spot : null;
  
  const forwardAsk = krwDFAsk ? spot * (usdDF / krwDFAsk) : null;
  const swapPointsAsk = forwardAsk ? forwardAsk - spot : null;
  
  return {
    startDate: spotDateStr,
    maturityDate: targetDateStr,
    displayDays: days,
    tenor: 'Interpolated',
    usdDF,
    krwDF: krwDFMid,
    krwDFBid,
    krwDFAsk,
    forward: forwardMid,
    points: swapPointsMid,
    bid: swapPointsBid,
    ask: swapPointsAsk
  };
};

/**
 * Client Swap Point Interpolation (with margin already applied)
 * 
 * @param {number} days - Days from spot
 * @param {Array} swapPoints - Client swap points (with clientBid, clientAsk)
 * @returns {Object} - Interpolated result
 */
export const interpolateClientSwapPoint = (days, swapPoints) => {
  if (!swapPoints || swapPoints.length === 0) return null;
  
  // Spot 이전 처리
  if (days <= 0) {
    if (days === 0) {
      return { points: 0, bid: 0, ask: 0, displayDays: 0 };
    }
    const tn = swapPoints.find(p => p.tenor === 'T/N');
    const on = swapPoints.find(p => p.tenor === 'O/N');
    if (days === -1 && tn) {
      return { points: tn.points, bid: tn.clientBid, ask: tn.clientAsk, displayDays: 1, tenor: 'T/N' };
    }
    if (days === -2 && on) {
      return { points: on.points, bid: on.clientBid, ask: on.clientAsk, displayDays: 1, tenor: 'O/N' };
    }
    return null;
  }

  const sorted = swapPoints.filter(p => p.days > 0).sort((a, b) => a.days - b.days);
  if (sorted.length === 0) return null;

  // 정확히 일치하는 경우
  const exact = sorted.find(p => p.days === days);
  if (exact) {
    return {
      points: exact.points,
      bid: exact.clientBid,
      ask: exact.clientAsk,
      displayDays: days,
      tenor: exact.tenor
    };
  }

  // 범위 밖
  if (days < sorted[0].days) {
    return {
      points: sorted[0].points * days / sorted[0].days,
      bid: sorted[0].clientBid !== null ? sorted[0].clientBid * days / sorted[0].days : null,
      ask: sorted[0].clientAsk !== null ? sorted[0].clientAsk * days / sorted[0].days : null,
      displayDays: days
    };
  }
  if (days > sorted[sorted.length - 1].days) {
    const last = sorted[sorted.length - 1];
    return {
      points: last.points * days / last.days,
      bid: last.clientBid !== null ? last.clientBid * days / last.days : null,
      ask: last.clientAsk !== null ? last.clientAsk * days / last.days : null,
      displayDays: days
    };
  }

  // 선형 보간
  let lower = sorted[0], upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].days <= days && sorted[i + 1].days >= days) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  const ratio = (days - lower.days) / (upper.days - lower.days);
  const interpPoints = lower.points + (upper.points - lower.points) * ratio;
  const interpBid = (lower.clientBid !== null && upper.clientBid !== null)
    ? lower.clientBid + (upper.clientBid - lower.clientBid) * ratio : null;
  const interpAsk = (lower.clientAsk !== null && upper.clientAsk !== null)
    ? lower.clientAsk + (upper.clientAsk - lower.clientAsk) * ratio : null;

  return {
    points: interpPoints,
    bid: interpBid,
    ask: interpAsk,
    displayDays: days,
    lowerTenor: lower.tenor,
    upperTenor: upper.tenor
  };
};

/**
 * Generic value interpolation on swap points
 * 
 * @param {number} days - Days from spot
 * @param {Array} swapPoints - FX Swap Points
 * @param {Function} getValue - Function to extract value from swap point
 * @returns {number} - Interpolated value
 */
export const interpolateValue = (days, swapPoints, getValue) => {
  if (!swapPoints || days <= 0) return 0;
  const sorted = swapPoints.filter(p => p.days > 0).sort((a, b) => a.days - b.days);
  if (sorted.length === 0) return 0;
  const exact = sorted.find(p => p.days === days);
  if (exact) return getValue(exact);
  if (days < sorted[0].days) return getValue(sorted[0]) * days / sorted[0].days;
  if (days > sorted[sorted.length - 1].days) return getValue(sorted[sorted.length - 1]) * days / sorted[sorted.length - 1].days;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].days <= days && sorted[i + 1].days >= days) {
      const ratio = (days - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
      return getValue(sorted[i]) + (getValue(sorted[i + 1]) - getValue(sorted[i])) * ratio;
    }
  }
  return 0;
};

export default { 
  interpolateSwapPointLinear, 
  interpolateRaw, 
  interpolateClientSwapPoint,
  interpolateValue 
};
