/**
 * Client Margin & Points Calculation Functions
 */

/**
 * Calculate client points with margin applied
 * Bid: base - margin (고객에게 불리하게)
 * Ask: base + margin (고객에게 불리하게)
 * 
 * @param {number} basePoints - Mid points
 * @param {number} baseBid - Base bid points
 * @param {number} baseAsk - Base ask points
 * @param {number} marginInPips - Margin in pips (전단위)
 * @returns {Object} - { bid, ask, mid }
 */
export const getClientPoints = (basePoints, baseBid, baseAsk, marginInPips) => {
  const marginInWon = marginInPips / 100; // 전단위 → 원단위
  return {
    bid: baseBid !== null ? baseBid - marginInWon : null,
    ask: baseAsk !== null ? baseAsk + marginInWon : null,
    mid: basePoints
  };
};

/**
 * Apply margin to FX Swap Points array
 * 
 * @param {Array} swapPoints - Base FX Swap Points
 * @param {number} marginInPips - Margin in pips (전단위)
 * @returns {Array} - Swap points with clientBid, clientAsk added
 */
export const applyMarginToSwapPoints = (swapPoints, marginInPips) => {
  if (!swapPoints) return [];
  const marginInWon = marginInPips / 100;
  
  return swapPoints.map(sp => ({
    ...sp,
    clientBid: sp.bid !== null ? sp.bid - marginInWon : null,
    clientAsk: sp.ask !== null ? sp.ask + marginInWon : null
  }));
};

/**
 * Credit Tier Margin Configuration
 * Tier 1 (Prime): 0 pips
 * Tier 2 (Standard): 5 pips  
 * Tier 3 (Subprime): 15 pips
 * Tier 4 (Discouraged): 30 pips
 * Tier 5 (Blocked): No trading
 */
export const CREDIT_TIER_MARGINS = {
  1: { base: 0, label: 'Prime', color: 'emerald' },
  2: { base: 5, label: 'Standard', color: 'blue' },
  3: { base: 15, label: 'Subprime', color: 'yellow' },
  4: { base: 30, label: 'Discouraged', color: 'orange' },
  5: { base: Infinity, label: 'Blocked', color: 'red' }
};

/**
 * Calculate total margin for a client
 * 
 * @param {number} creditTier - Client credit tier (1-5)
 * @param {number} additionalMargin - Additional custom margin
 * @returns {Object} - { base, additional, total }
 */
export const calculateMargin = (creditTier, additionalMargin = 0) => {
  const tierConfig = CREDIT_TIER_MARGINS[creditTier] || CREDIT_TIER_MARGINS[2];
  const base = tierConfig.base;
  const total = base === Infinity ? Infinity : base + additionalMargin;
  
  return {
    base,
    additional: additionalMargin,
    total,
    label: tierConfig.label,
    color: tierConfig.color
  };
};

export default { 
  getClientPoints, 
  applyMarginToSwapPoints,
  calculateMargin,
  CREDIT_TIER_MARGINS 
};
