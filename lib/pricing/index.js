/**
 * FX Pricing Library
 * 
 * This module exports all pricing-related functions:
 * - Bootstrap: USD/KRW curve bootstrapping
 * - Interpolation: Swap point and DF interpolation
 * - Margin: Client margin calculation
 */

export { 
  bootstrapUSD, 
  bootstrapKRW 
} from './bootstrap.js';

export { 
  interpolateSwapPointLinear, 
  interpolateRaw,
  interpolateClientSwapPoint,
  interpolateValue
} from './interpolation.js';

export { 
  getClientPoints, 
  applyMarginToSwapPoints,
  calculateMargin,
  CREDIT_TIER_MARGINS 
} from './margin.js';
