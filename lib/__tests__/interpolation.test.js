/**
 * Interpolation Functions Test
 * Golden test cases based on 20200302_IW.json
 * 
 * Run with: npm test
 */

import { describe, test, expect } from '@jest/globals';
import { 
  interpolateSwapPointLinear, 
  interpolateClientSwapPoint,
  interpolateValue 
} from '../pricing/interpolation.js';

// Mock FX Swap Points from 20200302_IW.json
const mockFxSwapPoints = [
  { tenor: "O/N", start: "2020-03-02", maturity: "2020-03-03", days: -1, points: -0.05, bid: -0.20, ask: 0.10 },
  { tenor: "T/N", start: "2020-03-03", maturity: "2020-03-04", days: 0, points: -0.015, bid: -0.17, ask: 0.14 },
  { tenor: "1W", start: "2020-03-04", maturity: "2020-03-11", days: 7, points: -0.11, bid: -0.36, ask: 0.14 },
  { tenor: "1M", start: "2020-03-04", maturity: "2020-04-06", days: 33, points: -0.50, bid: -1.00, ask: 0.00 },
  { tenor: "2M", start: "2020-03-04", maturity: "2020-05-04", days: 61, points: -1.05, bid: -2.05, ask: -0.05 },
  { tenor: "3M", start: "2020-03-04", maturity: "2020-06-04", days: 92, points: -1.55, bid: -2.80, ask: -0.30 },
  { tenor: "6M", start: "2020-03-04", maturity: "2020-09-04", days: 184, points: -3.50, bid: -5.50, ask: -1.50 },
  { tenor: "1Y", start: "2020-03-04", maturity: "2021-03-04", days: 365, points: -8.90, bid: null, ask: null }
];

const SPOT_DATE = "2020-03-04";

describe('interpolateSwapPointLinear', () => {
  test('should return null for empty swap points', () => {
    expect(interpolateSwapPointLinear(30, [], SPOT_DATE, "2020-04-03")).toBeNull();
    expect(interpolateSwapPointLinear(30, null, SPOT_DATE, "2020-04-03")).toBeNull();
  });

  test('should return Spot values for days = 0', () => {
    const result = interpolateSwapPointLinear(0, mockFxSwapPoints, SPOT_DATE, SPOT_DATE);
    
    expect(result.tenor).toBe('Spot');
    expect(result.points).toBe(0);
    expect(result.bid).toBe(0);
    expect(result.ask).toBe(0);
    expect(result.displayDays).toBe(0);
  });

  test('should return T/N values for days = -1', () => {
    const result = interpolateSwapPointLinear(-1, mockFxSwapPoints, SPOT_DATE, "2020-03-03");
    
    expect(result.tenor).toBe('T/N');
    expect(result.points).toBeCloseTo(-0.015, 3);
    expect(result.displayDays).toBe(1);
  });

  test('should return O/N + T/N for days <= -2', () => {
    const result = interpolateSwapPointLinear(-2, mockFxSwapPoints, SPOT_DATE, "2020-03-02");
    
    expect(result.tenor).toBe('O/N+T/N');
    // O/N + T/N = -0.05 + (-0.015) = -0.065
    expect(result.points).toBeCloseTo(-0.065, 3);
    expect(result.displayDays).toBe(2);
  });

  test('should return exact tenor value for matching days', () => {
    // 1M = 33 days
    const result = interpolateSwapPointLinear(33, mockFxSwapPoints, SPOT_DATE, "2020-04-06");
    
    expect(result.points).toBeCloseTo(-0.50, 2);
    expect(result.bid).toBeCloseTo(-1.00, 2);
    expect(result.ask).toBeCloseTo(0.00, 2);
  });

  test('should interpolate between tenors', () => {
    // 45 days: between 1M (33 days) and 2M (61 days)
    const result = interpolateSwapPointLinear(45, mockFxSwapPoints, SPOT_DATE, "2020-04-18");
    
    // Linear interpolation: 
    // t = (45 - 33) / (61 - 33) = 12 / 28 = 0.4286
    // points = -0.50 + (-1.05 - (-0.50)) * 0.4286 = -0.50 + (-0.55) * 0.4286 = -0.7357
    expect(result.points).toBeCloseTo(-0.7357, 2);
    expect(result.tenor).toBe('1M-2M');
  });

  test('should extrapolate for days < first tenor', () => {
    // 3 days: before 1W (7 days)
    const result = interpolateSwapPointLinear(3, mockFxSwapPoints, SPOT_DATE, "2020-03-07");
    
    // Proportional: 3/7 * (-0.11) = -0.0471
    expect(result.points).toBeCloseTo(-0.0471, 2);
    expect(result.tenor).toBe('<1W');
  });
});

describe('interpolateClientSwapPoint', () => {
  // Mock client swap points with margin applied
  const mockClientSwapPoints = mockFxSwapPoints.map(sp => ({
    ...sp,
    clientBid: sp.bid !== null ? sp.bid - 0.05 : null, // -5 pips margin
    clientAsk: sp.ask !== null ? sp.ask + 0.05 : null  // +5 pips margin
  }));

  test('should return null for empty swap points', () => {
    expect(interpolateClientSwapPoint(30, [])).toBeNull();
  });

  test('should return zero for Spot', () => {
    const result = interpolateClientSwapPoint(0, mockClientSwapPoints);
    
    expect(result.points).toBe(0);
    expect(result.displayDays).toBe(0);
  });

  test('should return T/N for days = -1', () => {
    const result = interpolateClientSwapPoint(-1, mockClientSwapPoints);
    
    expect(result.tenor).toBe('T/N');
    expect(result.displayDays).toBe(1);
  });

  test('should interpolate with client margins', () => {
    // 1M = 33 days
    const result = interpolateClientSwapPoint(33, mockClientSwapPoints);
    
    expect(result.points).toBeCloseTo(-0.50, 2);
    // Client bid = -1.00 - 0.05 = -1.05
    expect(result.bid).toBeCloseTo(-1.05, 2);
    // Client ask = 0.00 + 0.05 = 0.05
    expect(result.ask).toBeCloseTo(0.05, 2);
  });
});

describe('interpolateValue', () => {
  test('should return 0 for days <= 0', () => {
    expect(interpolateValue(0, mockFxSwapPoints, p => p.points)).toBe(0);
    expect(interpolateValue(-1, mockFxSwapPoints, p => p.points)).toBe(0);
  });

  test('should return exact value for matching days', () => {
    const result = interpolateValue(33, mockFxSwapPoints, p => p.points);
    expect(result).toBeCloseTo(-0.50, 2);
  });

  test('should interpolate between tenors', () => {
    // 45 days between 1M (33) and 2M (61)
    const result = interpolateValue(45, mockFxSwapPoints, p => p.points);
    expect(result).toBeCloseTo(-0.7357, 2);
  });

  test('should extrapolate proportionally for small days', () => {
    const result = interpolateValue(3, mockFxSwapPoints, p => p.points);
    // 3/7 * (-0.11) = -0.0471
    expect(result).toBeCloseTo(-0.0471, 2);
  });
});
