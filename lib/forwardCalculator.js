/**
 * FX Forward Points Calculator
 * 
 * Implied Yield 방식: Forward Points에서 DF 역산
 * 
 * 핵심 공식:
 * Forward = Spot + Forward_Points
 * Forward = Spot × (DF_base / DF_quote)
 * 
 * DF 역산:
 * DF_quote = DF_base × Spot / Forward
 * 
 * Cross Rate:
 * JPYKRW Forward = Spot_JPYKRW × (DF_JPY / DF_KRW)
 * 
 * Day Count Convention:
 * - USD: ACT/360
 * - EUR: ACT/360
 * - JPY: ACT/360
 * - KRW: ACT/365
 * - GBP: ACT/365
 */

// Day count fractions
const DAY_COUNT = {
  USD: 360,
  EUR: 360,
  JPY: 360,
  KRW: 365,
  GBP: 365,
  CNY: 365,
};

// Tenor to days mapping
const TENOR_DAYS = {
  'ON': 1,
  'TN': 1,
  '1W': 7,
  '1M': 30,
  '2M': 60,
  '3M': 90,
  '6M': 180,
  '9M': 270,
  '1Y': 365,
};

/**
 * Calculate Discount Factor from rate
 * @param {number} rate - Annual rate in percent (e.g., 4.5 for 4.5%)
 * @param {number} days - Number of days
 * @param {string} currency - Currency code for day count convention
 * @returns {number} Discount Factor
 */
function calculateDF(rate, days, currency = 'USD') {
  const dayCount = DAY_COUNT[currency] || 360;
  const yearFrac = days / dayCount;
  const r = rate / 100;
  return 1 / (1 + r * yearFrac);
}

/**
 * Calculate implied DF from Forward Points (핵심!)
 * 
 * Given: Spot, Forward Points, Base DF
 * Find: Quote DF
 * 
 * Forward = Spot + Points
 * Forward = Spot × (DF_base / DF_quote)
 * DF_quote = DF_base × Spot / Forward
 * 
 * @param {number} spot - Spot rate
 * @param {number} forwardPoints - Forward points (in quote currency units)
 * @param {number} baseDf - Base currency DF (e.g., USD DF)
 * @returns {number} Implied quote currency DF
 */
function calculateImpliedDF(spot, forwardPoints, baseDf) {
  const forward = spot + forwardPoints;
  return baseDf * spot / forward;
}

/**
 * Calculate implied rate from DF
 * @param {number} df - Discount Factor
 * @param {number} days - Number of days
 * @param {string} currency - Currency code
 * @returns {number} Implied rate in percent
 */
function calculateImpliedRate(df, days, currency = 'USD') {
  const dayCount = DAY_COUNT[currency] || 360;
  const yearFrac = days / dayCount;
  // DF = 1 / (1 + r × t)
  // r = (1/DF - 1) / t
  const r = (1 / df - 1) / yearFrac;
  return r * 100;
}

/**
 * Build implied yield curve from Forward Points
 * 
 * @param {number} spot - Spot rate
 * @param {Array} forwardCurve - [{tenor, points, bid, ask}, ...]
 * @param {object} baseCurve - Base currency rate curve {tenor: rate}
 * @param {string} baseCcy - Base currency code
 * @param {string} quoteCcy - Quote currency code
 * @returns {Array} Implied quote currency DF curve
 */
function buildImpliedCurve(spot, forwardCurve, baseCurve, baseCcy, quoteCcy) {
  return forwardCurve.map(fp => {
    const days = TENOR_DAYS[fp.tenor];
    if (!days) return null;
    
    // Base currency DF 계산
    const baseRate = interpolateRate(baseCurve, fp.tenor);
    if (baseRate === null) return null;
    
    const baseDf = calculateDF(baseRate, days, baseCcy);
    
    // Implied Quote DF 역산
    const quoteDfMid = calculateImpliedDF(spot, fp.points, baseDf);
    const quoteDfBid = fp.bid !== null ? calculateImpliedDF(spot, fp.bid, baseDf) : null;
    const quoteDfAsk = fp.ask !== null ? calculateImpliedDF(spot, fp.ask, baseDf) : null;
    
    // Implied Rate 계산
    const impliedRateMid = calculateImpliedRate(quoteDfMid, days, quoteCcy);
    const impliedRateBid = quoteDfBid ? calculateImpliedRate(quoteDfBid, days, quoteCcy) : null;
    const impliedRateAsk = quoteDfAsk ? calculateImpliedRate(quoteDfAsk, days, quoteCcy) : null;
    
    return {
      tenor: fp.tenor,
      days,
      baseDf,
      baseRate,
      quoteDfMid,
      quoteDfBid,
      quoteDfAsk,
      impliedRateMid,
      impliedRateBid,
      impliedRateAsk,
      forward: spot + fp.points,
      points: fp.points,
      bid: fp.bid,
      ask: fp.ask,
    };
  }).filter(x => x !== null);
}

/**
 * Calculate Cross Rate Forward (예: JPYKRW)
 * 
 * JPYKRW = USDKRW / USDJPY
 * JPYKRW Forward = Spot_JPYKRW × (DF_JPY / DF_KRW)
 * 
 * @param {number} spotUSDKRW - USDKRW spot rate
 * @param {number} spotUSDJPY - USDJPY spot rate
 * @param {Array} krwCurve - KRW implied DF curve from USDKRW
 * @param {Array} jpyCurve - JPY implied DF curve from USDJPY
 * @returns {Array} JPYKRW forward curve
 */
function calculateCrossForward(spotUSDKRW, spotUSDJPY, krwCurve, jpyCurve) {
  const spotJPYKRW = spotUSDKRW / spotUSDJPY;
  
  // tenor 매칭
  const tenors = ['1W', '1M', '2M', '3M', '6M', '9M', '1Y'];
  
  return tenors.map(tenor => {
    const krwData = krwCurve.find(c => c.tenor === tenor);
    const jpyData = jpyCurve.find(c => c.tenor === tenor);
    
    if (!krwData || !jpyData) return null;
    
    // Forward = Spot × (DF_JPY / DF_KRW)
    const forwardMid = spotJPYKRW * (jpyData.quoteDfMid / krwData.quoteDfMid);
    const pointsMid = forwardMid - spotJPYKRW;
    
    // Bid/Ask (JPY 관점에서)
    let forwardBid = null, forwardAsk = null;
    if (jpyData.quoteDfBid && krwData.quoteDfAsk) {
      // JPY 매도 (bid) = JPY DF가 높아지는 방향, KRW DF가 낮아지는 방향
      forwardBid = spotJPYKRW * (jpyData.quoteDfBid / krwData.quoteDfAsk);
    }
    if (jpyData.quoteDfAsk && krwData.quoteDfBid) {
      forwardAsk = spotJPYKRW * (jpyData.quoteDfAsk / krwData.quoteDfBid);
    }
    
    return {
      tenor,
      days: TENOR_DAYS[tenor],
      spot: spotJPYKRW,
      forward: forwardMid,
      points: pointsMid,
      pointsPer100: pointsMid * 100, // 100엔당
      bid: forwardBid ? forwardBid - spotJPYKRW : null,
      ask: forwardAsk ? forwardAsk - spotJPYKRW : null,
      jpyDf: jpyData.quoteDfMid,
      krwDf: krwData.quoteDfMid,
    };
  }).filter(x => x !== null);
}

/**
 * Interpolate rate for a given tenor
 */
function interpolateRate(curve, targetTenor) {
  if (curve[targetTenor] !== undefined) {
    return curve[targetTenor];
  }
  
  const targetDays = TENOR_DAYS[targetTenor];
  
  const points = Object.entries(curve)
    .map(([t, r]) => ({ tenor: t, days: TENOR_DAYS[t], rate: r }))
    .filter(p => p.days !== undefined)
    .sort((a, b) => a.days - b.days);
  
  if (points.length === 0) return null;
  
  if (targetDays <= points[0].days) return points[0].rate;
  if (targetDays >= points[points.length - 1].days) return points[points.length - 1].rate;
  
  for (let i = 0; i < points.length - 1; i++) {
    if (targetDays >= points[i].days && targetDays <= points[i + 1].days) {
      const t = (targetDays - points[i].days) / (points[i + 1].days - points[i].days);
      return points[i].rate + (points[i + 1].rate - points[i].rate) * t;
    }
  }
  
  return null;
}

// ============================================================
// Example Usage
// ============================================================

// USD SOFR Curve (우리가 이미 가진 것)
const USD_CURVE = {
  'ON': 4.33,
  '1W': 4.34,
  '1M': 4.35,
  '3M': 4.38,
  '6M': 4.25,
  '1Y': 4.10,
};

// USDJPY Forward Points (investing.com에서 가져온 것 - 예시)
const USDJPY_FORWARD = [
  { tenor: '1W', points: -0.13, bid: -0.14, ask: -0.12 },
  { tenor: '1M', points: -0.55, bid: -0.57, ask: -0.53 },
  { tenor: '3M', points: -1.65, bid: -1.70, ask: -1.60 },
  { tenor: '6M', points: -3.10, bid: -3.20, ask: -3.00 },
  { tenor: '1Y', points: -5.80, bid: -6.00, ask: -5.60 },
];

// USDKRW Forward Points (IPS에서 가져온 것)
const USDKRW_FORWARD = [
  { tenor: '1W', points: -0.30, bid: -0.34, ask: -0.26 },
  { tenor: '1M', points: -1.60, bid: -1.70, ask: -1.50 },
  { tenor: '3M', points: -4.80, bid: -5.10, ask: -4.50 },
  { tenor: '6M', points: -8.50, bid: -8.90, ask: -8.10 },
  { tenor: '1Y', points: -15.20, bid: -15.80, ask: -14.60 },
];

// EURUSD Forward Points (investing.com에서 가져온 것 - 예시)
const EURUSD_FORWARD = [
  { tenor: '1W', points: 0.00027, bid: 0.00025, ask: 0.00029 },
  { tenor: '1M', points: 0.00135, bid: 0.00130, ask: 0.00140 },
  { tenor: '3M', points: 0.00425, bid: 0.00415, ask: 0.00435 },
  { tenor: '6M', points: 0.00860, bid: 0.00840, ask: 0.00880 },
  { tenor: '1Y', points: 0.01720, bid: 0.01680, ask: 0.01760 },
];

// Spot Rates
const SPOT_USDJPY = 156.50;
const SPOT_USDKRW = 1443.10;
const SPOT_EURUSD = 1.0850;

console.log('===========================================');
console.log('JPY Implied Yield Curve (from USDJPY Forward)');
console.log('===========================================');
const jpyCurve = buildImpliedCurve(SPOT_USDJPY, USDJPY_FORWARD, USD_CURVE, 'USD', 'JPY');
console.table(jpyCurve.map(c => ({
  Tenor: c.tenor,
  Days: c.days,
  'USD DF': c.baseDf.toFixed(6),
  'JPY DF': c.quoteDfMid.toFixed(6),
  'JPY Rate': c.impliedRateMid.toFixed(3) + '%',
  'Fwd Points': c.points.toFixed(2),
})));

console.log('\n===========================================');
console.log('KRW Implied Yield Curve (from USDKRW Forward)');
console.log('===========================================');
const krwCurve = buildImpliedCurve(SPOT_USDKRW, USDKRW_FORWARD, USD_CURVE, 'USD', 'KRW');
console.table(krwCurve.map(c => ({
  Tenor: c.tenor,
  Days: c.days,
  'USD DF': c.baseDf.toFixed(6),
  'KRW DF': c.quoteDfMid.toFixed(6),
  'KRW Rate': c.impliedRateMid.toFixed(3) + '%',
  'Fwd Points': c.points.toFixed(2),
})));

console.log('\n===========================================');
console.log('JPYKRW Cross Forward (from JPY & KRW curves)');
console.log('===========================================');
const jpykrwForward = calculateCrossForward(SPOT_USDKRW, SPOT_USDJPY, krwCurve, jpyCurve);
console.table(jpykrwForward.map(c => ({
  Tenor: c.tenor,
  Days: c.days,
  'Spot': (c.spot * 100).toFixed(2) + '/100¥',
  'Forward': (c.forward * 100).toFixed(2) + '/100¥',
  'Points': c.pointsPer100.toFixed(4) + '/100¥',
  'JPY DF': c.jpyDf.toFixed(6),
  'KRW DF': c.krwDf.toFixed(6),
})));

export {
  calculateDF,
  calculateImpliedDF,
  calculateImpliedRate,
  buildImpliedCurve,
  calculateCrossForward,
  interpolateRate,
  TENOR_DAYS,
  DAY_COUNT,
};
