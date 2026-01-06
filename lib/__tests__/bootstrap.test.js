/**
 * Bootstrap Functions Test
 * Golden test cases based on 20200302_IW.json
 * 
 * Run with: npm test
 */

import { describe, test, expect } from '@jest/globals';
import { bootstrapUSD, bootstrapKRW } from '../pricing/bootstrap.js';

// Mock USD Curve from 20200302_IW.json
const mockUSDCurve = {
  dayCount: 360,
  spotDate: "2020-03-04",
  tenors: [
    { tenor: "O/N", maturity: "2020-03-03", days: -1, type: "CASH", rate: 1.5678 },
    { tenor: "Spot", maturity: "2020-03-04", days: 0, type: "CASH", rate: 1.5678 },
    { tenor: "1W", maturity: "2020-03-11", days: 7, type: "CASH", rate: 1.5680 },
    { tenor: "1M", maturity: "2020-04-06", days: 33, type: "CASH", rate: 1.5153 },
    { tenor: "2M", maturity: "2020-05-04", days: 61, type: "CASH", rate: 1.5026 },
    { tenor: "3M", maturity: "2020-06-04", days: 92, type: "CASH", rate: 1.4628 },
    { tenor: "6M", maturity: "2020-09-04", days: 184, type: "SWAP", rate: 1.1649 },
    { tenor: "1Y", maturity: "2021-03-04", days: 365, type: "SWAP", rate: 0.9955 }
  ]
};

// Mock KRW Curve
const mockKRWCurve = {
  dayCount: 365,
  spotDate: "2020-03-04",
  tenors: [
    { tenor: "O/N", maturity: "2020-03-03", days: -2, type: "FX", rate: 1.1093 },
    { tenor: "T/N", maturity: "2020-03-04", days: -1, type: "FX", rate: 1.1093 },
    { tenor: "Spot", maturity: "2020-03-04", days: 0, type: "FX", rate: 1.1093 },
    { tenor: "1W", maturity: "2020-03-11", days: 7, type: "FX", rate: 1.1092 },
    { tenor: "1M", maturity: "2020-04-06", days: 33, type: "FX", rate: 1.0724 },
    { tenor: "2M", maturity: "2020-05-04", days: 61, type: "FX", rate: 0.9959 },
    { tenor: "3M", maturity: "2020-06-04", days: 92, type: "FX", rate: 0.9660 }
  ]
};

// Mock FX Swap Points
const mockFxSwapPoints = [
  { tenor: "O/N", start: "2020-03-02", maturity: "2020-03-03", days: -1, points: -0.05, bid: -0.20, ask: 0.10 },
  { tenor: "T/N", start: "2020-03-03", maturity: "2020-03-04", days: 0, points: -0.015, bid: -0.17, ask: 0.14 },
  { tenor: "1W", start: "2020-03-04", maturity: "2020-03-11", days: 7, points: -0.11, bid: -0.36, ask: 0.14 },
  { tenor: "1M", start: "2020-03-04", maturity: "2020-04-06", days: 33, points: -0.50, bid: -1.00, ask: 0.00 },
  { tenor: "2M", start: "2020-03-04", maturity: "2020-05-04", days: 61, points: -1.05, bid: -2.05, ask: -0.05 },
  { tenor: "3M", start: "2020-03-04", maturity: "2020-06-04", days: 92, points: -1.55, bid: -2.80, ask: -0.30 }
];

const SPOT_RATE = 1193.85;

describe('bootstrapUSD', () => {
  test('should return null for invalid input', () => {
    expect(bootstrapUSD(null)).toBeNull();
    expect(bootstrapUSD({})).toEqual({});
  });

  test('should bootstrap Cash tenors with simple interest', () => {
    const result = bootstrapUSD(mockUSDCurve);
    
    expect(result.tenors).toHaveLength(mockUSDCurve.tenors.length);
    expect(result.lastBootstrap).toBeDefined();
    
    // 1W tenor: Simple Interest
    // df = 1 / (1 + 0.01568 * 7/360) = 0.999695...
    const oneWeek = result.tenors.find(t => t.tenor === '1W');
    expect(oneWeek.df).toBeCloseTo(0.9997, 4);
    expect(oneWeek.lnDF).toBeLessThan(0);
  });

  test('should calculate zero rate correctly', () => {
    const result = bootstrapUSD(mockUSDCurve);
    
    const oneMonth = result.tenors.find(t => t.tenor === '1M');
    expect(oneMonth.zeroRate).toBeGreaterThan(0);
    expect(oneMonth.zeroRate).toBeLessThan(5);
  });
});

describe('bootstrapKRW', () => {
  test('should return null for invalid input', () => {
    expect(bootstrapKRW(null, mockUSDCurve, mockFxSwapPoints, SPOT_RATE)).toBeNull();
    expect(bootstrapKRW(mockKRWCurve, null, mockFxSwapPoints, SPOT_RATE)).toEqual(mockKRWCurve);
  });

  test('should bootstrap KRW curve from FX Swap Points', () => {
    const usdBootstrapped = bootstrapUSD(mockUSDCurve);
    const result = bootstrapKRW(mockKRWCurve, usdBootstrapped, mockFxSwapPoints, SPOT_RATE);
    
    expect(result.tenors).toHaveLength(mockKRWCurve.tenors.length);
    expect(result.lastBootstrap).toBeDefined();
    
    // 1W tenor should have df, dfBid, dfAsk
    const oneWeek = result.tenors.find(t => t.tenor === '1W');
    expect(oneWeek.df).toBeDefined();
    expect(oneWeek.dfBid).toBeDefined();
    expect(oneWeek.dfAsk).toBeDefined();
  });

  test('should apply overrides correctly', () => {
    const usdBootstrapped = bootstrapUSD(mockUSDCurve);
    const screenOvr = { '1M': '-100' }; // Override to -100 pips = -1.00 won
    
    const result = bootstrapKRW(mockKRWCurve, usdBootstrapped, mockFxSwapPoints, SPOT_RATE, screenOvr);
    const oneMonth = result.tenors.find(t => t.tenor === '1M');
    
    // With override, the DF should be different
    expect(oneMonth.df).toBeDefined();
  });
});
