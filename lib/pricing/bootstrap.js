/**
 * USD/KRW Curve Bootstrap Functions
 * 
 * bootstrapUSD: Rate → Discount Factor (Simple Interest / Swap Bootstrapping)
 * bootstrapKRW: FX Swap Points + USD DF + Spot → KRW DF
 */

/**
 * Bootstrap USD Curve
 * Cash tenors: Simple Interest → DF = 1 / (1 + r × t)
 * Swap tenors: Annual compounding bootstrapping
 * 
 * @param {Object} curve - USD curve with tenors array
 * @returns {Object} - Curve with bootstrapped DF, lnDF, zeroRate
 */
export const bootstrapUSD = (curve) => {
  if (!curve || !curve.tenors) return curve;
  
  const dayCount = curve.dayCount || 360;
  const tenors = [...curve.tenors].sort((a, b) => a.days - b.days);
  const bootstrapped = [];
  
  // 연간 DF 저장 (Swap bootstrapping용)
  const annualDFs = {};
  
  for (let i = 0; i < tenors.length; i++) {
    const tenor = tenors[i];
    const days = tenor.days;
    const yearFrac = days / dayCount;
    
    const rate = tenor.rate / 100;
    let df;
    
    if (tenor.type === 'CASH' || Math.abs(days) <= 365) {
      // Cash: Simple Interest
      df = 1 / (1 + rate * yearFrac);
    } else {
      // Swap: Bootstrapping with annual compounding
      const years = Math.floor(Math.abs(days) / 365);
      let couponPV = 0;
      for (let y = 1; y < years; y++) {
        if (annualDFs[y]) couponPV += rate * annualDFs[y];
      }
      df = (1 - couponPV) / (1 + rate);
    }
    
    // 연간 DF 저장
    const years = Math.round(Math.abs(days) / 365);
    if (years >= 1 && Math.abs(Math.abs(days) - years * 365) < 30) {
      annualDFs[years] = df;
    }
    
    const lnDF = Math.log(df);
    const zeroRate = Math.abs(yearFrac) > 0 ? ((1/df - 1) / yearFrac) * 100 : tenor.rate;
    
    bootstrapped.push({
      ...tenor,
      df: df,
      lnDF: lnDF,
      zeroRate: zeroRate
    });
  }
  
  return { ...curve, tenors: bootstrapped, lastBootstrap: new Date().toISOString() };
};

/**
 * Bootstrap KRW Curve from FX Swap Points
 * Forward = Spot + SwapPoint
 * KRW_DF = USD_DF × Spot / Forward
 * 
 * @param {Object} krwCurve - KRW curve with tenors
 * @param {Object} usdCurve - Bootstrapped USD curve
 * @param {Array} fxSwapPoints - FX Swap Points array
 * @param {number} spot - Spot rate
 * @param {Object} screenOvr - Screen override values (전단위)
 * @param {Object} bidOvr - Bid override values (전단위)
 * @param {Object} askOvr - Ask override values (전단위)
 * @returns {Object} - KRW curve with bootstrapped DF, dfBid, dfAsk
 */
export const bootstrapKRW = (krwCurve, usdCurve, fxSwapPoints, spot, screenOvr = {}, bidOvr = {}, askOvr = {}) => {
  if (!krwCurve || !usdCurve || !fxSwapPoints || !spot) return krwCurve;
  
  const dayCount = krwCurve.dayCount || 365;
  const tenors = [...krwCurve.tenors].sort((a, b) => a.days - b.days);
  const bootstrapped = [];
  
  // USD DF 보간 함수
  const getUsdDF = (targetDays) => {
    const usdTenors = usdCurve.tenors.filter(t => t.df).sort((a, b) => a.days - b.days);
    if (usdTenors.length === 0) return 1;
    
    // 정확히 일치하는 tenor 찾기
    const exact = usdTenors.find(t => t.days === targetDays);
    if (exact) return exact.df;
    
    // 범위 밖
    if (targetDays <= usdTenors[0].days) return usdTenors[0].df;
    if (targetDays >= usdTenors[usdTenors.length - 1].days) return usdTenors[usdTenors.length - 1].df;
    
    // Log-linear 보간
    let lower = usdTenors[0], upper = usdTenors[1];
    for (let i = 0; i < usdTenors.length - 1; i++) {
      if (targetDays >= usdTenors[i].days && targetDays <= usdTenors[i + 1].days) {
        lower = usdTenors[i];
        upper = usdTenors[i + 1];
        break;
      }
    }
    
    const t = (targetDays - lower.days) / (upper.days - lower.days);
    const lnDfLower = Math.log(lower.df);
    const lnDfUpper = Math.log(upper.df);
    return Math.exp(lnDfLower + (lnDfUpper - lnDfLower) * t);
  };
  
  // FX Swap Point에서 해당 tenor 찾기 (오버라이드 반영)
  // 오버라이드는 전단위 입력 (예: -100) → 원단위 변환 (예: -1.00)
  const getSwapPoint = (days, tenorName) => {
    const sp = fxSwapPoints.find(s => s.days === days);
    if (!sp) return null;
    
    // 오버라이드 적용 (전단위 입력 → 원단위 변환: / 100)
    const points = screenOvr[tenorName] !== undefined && screenOvr[tenorName] !== '' 
      ? parseFloat(screenOvr[tenorName]) / 100 
      : sp.points;
    const bid = bidOvr[tenorName] !== undefined && bidOvr[tenorName] !== '' 
      ? parseFloat(bidOvr[tenorName]) / 100 
      : sp.bid;
    const ask = askOvr[tenorName] !== undefined && askOvr[tenorName] !== '' 
      ? parseFloat(askOvr[tenorName]) / 100 
      : sp.ask;
    
    return { ...sp, points, bid, ask };
  };
  
  for (let i = 0; i < tenors.length; i++) {
    const tenor = tenors[i];
    const days = tenor.days;
    const yearFrac = days / dayCount;
    
    let dfMid, dfBid, dfAsk;
    
    // FX Swap Points에서 역산 (오버라이드 포함)
    const swapPoint = getSwapPoint(days, tenor.tenor);
    const usdDF = getUsdDF(days);
    
    if (swapPoint && usdDF) {
      // Forward = Spot + SwapPoint
      // KRW_DF = USD_DF × Spot / Forward = USD_DF / (1 + SwapPoint/Spot)
      const forwardMid = spot + (swapPoint.points || 0);
      const forwardBid = spot + (swapPoint.bid !== null ? swapPoint.bid : swapPoint.points || 0);
      const forwardAsk = spot + (swapPoint.ask !== null ? swapPoint.ask : swapPoint.points || 0);
      
      dfMid = usdDF * spot / forwardMid;
      dfBid = usdDF * spot / forwardBid;
      dfAsk = usdDF * spot / forwardAsk;
    } else if (days < 0) {
      // O/N 등 Spot 이전 - JSON의 기존 값 사용
      const rate = tenor.rate / 100;
      dfMid = 1 / (1 + rate * Math.abs(yearFrac));
      dfBid = tenor.dfBid || dfMid;
      dfAsk = tenor.dfAsk || dfMid;
    } else {
      // FX Swap Point 없으면 Rate에서 계산
      const rate = tenor.rate / 100;
      dfMid = 1 / (1 + rate * yearFrac);
      dfBid = tenor.dfBid || dfMid;
      dfAsk = tenor.dfAsk || dfMid;
    }
    
    const lnDF = Math.log(dfMid);
    const lnDfBid = Math.log(dfBid);
    const lnDfAsk = Math.log(dfAsk);
    const zeroRate = Math.abs(yearFrac) > 0 ? ((1/dfMid - 1) / yearFrac) * 100 : tenor.rate;
    
    bootstrapped.push({
      ...tenor,
      df: dfMid,
      dfBid: dfBid,
      dfAsk: dfAsk,
      lnDF: lnDF,
      lnDfBid: lnDfBid,
      lnDfAsk: lnDfAsk,
      zeroRate: zeroRate
    });
  }
  
  return { ...krwCurve, tenors: bootstrapped, lastBootstrap: new Date().toISOString() };
};

export default { bootstrapUSD, bootstrapKRW };
