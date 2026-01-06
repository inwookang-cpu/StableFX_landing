/**
 * Margin Functions Test
 * 
 * Run with: npm test
 */

import { describe, test, expect } from '@jest/globals';
import { 
  getClientPoints, 
  applyMarginToSwapPoints,
  calculateMargin,
  CREDIT_TIER_MARGINS 
} from '../pricing/margin.js';

describe('getClientPoints', () => {
  test('should apply margin to bid and ask', () => {
    const result = getClientPoints(-0.50, -1.00, 0.00, 5);
    
    // Bid: -1.00 - 0.05 = -1.05
    expect(result.bid).toBeCloseTo(-1.05, 2);
    // Ask: 0.00 + 0.05 = 0.05
    expect(result.ask).toBeCloseTo(0.05, 2);
    // Mid unchanged
    expect(result.mid).toBe(-0.50);
  });

  test('should handle null values', () => {
    const result = getClientPoints(-0.50, null, null, 5);
    
    expect(result.bid).toBeNull();
    expect(result.ask).toBeNull();
    expect(result.mid).toBe(-0.50);
  });

  test('should handle zero margin', () => {
    const result = getClientPoints(-0.50, -1.00, 0.00, 0);
    
    expect(result.bid).toBe(-1.00);
    expect(result.ask).toBe(0.00);
  });
});

describe('applyMarginToSwapPoints', () => {
  const mockSwapPoints = [
    { tenor: "1W", days: 7, points: -0.11, bid: -0.36, ask: 0.14 },
    { tenor: "1M", days: 33, points: -0.50, bid: -1.00, ask: 0.00 },
    { tenor: "2M", days: 61, points: -1.05, bid: -2.05, ask: -0.05 }
  ];

  test('should apply margin to all swap points', () => {
    const result = applyMarginToSwapPoints(mockSwapPoints, 5); // 5 pips
    
    expect(result).toHaveLength(3);
    
    // 1W: bid -0.36 - 0.05 = -0.41, ask 0.14 + 0.05 = 0.19
    expect(result[0].clientBid).toBeCloseTo(-0.41, 2);
    expect(result[0].clientAsk).toBeCloseTo(0.19, 2);
    
    // 1M: bid -1.00 - 0.05 = -1.05, ask 0.00 + 0.05 = 0.05
    expect(result[1].clientBid).toBeCloseTo(-1.05, 2);
    expect(result[1].clientAsk).toBeCloseTo(0.05, 2);
  });

  test('should return empty array for null input', () => {
    expect(applyMarginToSwapPoints(null, 5)).toEqual([]);
  });

  test('should preserve original properties', () => {
    const result = applyMarginToSwapPoints(mockSwapPoints, 5);
    
    expect(result[0].tenor).toBe('1W');
    expect(result[0].days).toBe(7);
    expect(result[0].points).toBe(-0.11);
  });
});

describe('calculateMargin', () => {
  test('should return correct margin for each tier', () => {
    expect(calculateMargin(1).base).toBe(0);
    expect(calculateMargin(1).label).toBe('Prime');
    
    expect(calculateMargin(2).base).toBe(5);
    expect(calculateMargin(2).label).toBe('Standard');
    
    expect(calculateMargin(3).base).toBe(15);
    expect(calculateMargin(3).label).toBe('Subprime');
    
    expect(calculateMargin(4).base).toBe(30);
    expect(calculateMargin(4).label).toBe('Discouraged');
    
    expect(calculateMargin(5).base).toBe(Infinity);
    expect(calculateMargin(5).label).toBe('Blocked');
  });

  test('should add additional margin', () => {
    const result = calculateMargin(2, 3); // Standard + 3 additional
    
    expect(result.base).toBe(5);
    expect(result.additional).toBe(3);
    expect(result.total).toBe(8);
  });

  test('should handle blocked tier', () => {
    const result = calculateMargin(5, 10);
    
    expect(result.total).toBe(Infinity);
  });

  test('should default to Standard for unknown tier', () => {
    const result = calculateMargin(99);
    
    expect(result.base).toBe(5);
    expect(result.label).toBe('Standard');
  });
});

describe('CREDIT_TIER_MARGINS', () => {
  test('should have 5 tiers defined', () => {
    expect(Object.keys(CREDIT_TIER_MARGINS)).toHaveLength(5);
  });

  test('should have increasing margins', () => {
    expect(CREDIT_TIER_MARGINS[1].base).toBeLessThan(CREDIT_TIER_MARGINS[2].base);
    expect(CREDIT_TIER_MARGINS[2].base).toBeLessThan(CREDIT_TIER_MARGINS[3].base);
    expect(CREDIT_TIER_MARGINS[3].base).toBeLessThan(CREDIT_TIER_MARGINS[4].base);
    expect(CREDIT_TIER_MARGINS[4].base).toBeLessThan(CREDIT_TIER_MARGINS[5].base);
  });
});
