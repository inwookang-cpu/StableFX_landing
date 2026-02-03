'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import supabase from '../../services/SupabaseService';
import { formatNumber } from '../../services/formatters';

import { 
  DateRuleCalculator, 
  formatDate
} from '../../../../lib/dateCalculator';

function ValuationTab({ blotter, fixingRate, setFixingRate, sharedCurveData }) {
  const [curveData, setCurveData] = useState(null);
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [decimalPlaces, setDecimalPlaces] = useState(10); // 기본 10자리
  const [showFull, setShowFull] = useState(true); // 기본 10자리 표시
  const [curveSource, setCurveSource] = useState('loading...');
  const [spotDays, setSpotDays] = useState(2); // T+2 기본
  
  // ========== 정밀도 표준 ==========
  // 내부 계산: JavaScript 그대로 (~15자리) - 오차 누적 방지
  // 출력: 10자리로 표시
  
  // sharedCurveData (Curves 탭에서 계산된 데이터) 우선 사용
  useEffect(() => {
    if (sharedCurveData) {
      setCurveData(sharedCurveData);
      setCurveSource('Curves 탭 (실시간)');
      
      // Spot Date 계산해서 spotDays 설정
      const spotDateStr = sharedCurveData.curves?.USDKRW?.USD?.spotDate;
      if (spotDateStr && valuationDate) {
        const spotDate = new Date(spotDateStr);
        const valDate = new Date(valuationDate);
        const diffDays = Math.round((spotDate - valDate) / (1000 * 60 * 60 * 24));
        setSpotDays(diffDays > 0 ? diffDays : 2);
      }
      return;
    }
    
    // Fallback: Supabase 또는 JSON
    const loadCurveData = async () => {
      try {
        const [usdRates, krwRates] = await Promise.all([
          supabase.getRates('usd'),
          supabase.getRates('krw')
        ]);
        
        if (usdRates.length > 0 && krwRates.length > 0) {
          const tenorToDays = (tenor) => {
            const map = { 'ON': -1, 'TN': 0, '1W': 7, '2W': 14, '1M': 30, '2M': 60, '3M': 90, '6M': 180, '9M': 270, '1Y': 365, '2Y': 730 };
            return map[tenor] ?? 30;
          };
          
          // Rate에서 DF 계산
          const rateToDf = (rate, days, dayCount) => {
            if (days <= 0) return 1;
            return 1 / (1 + (rate / 100) * (days / dayCount));
          };
          
          const usdTenors = usdRates.map(r => {
            const days = tenorToDays(r.tenor);
            return {
                tenor: r.tenor,
                days: days,
                rate: r.rate,
                df: rateToDf(r.rate, days, 360)
              };
            });
            
            const krwTenors = krwRates.map(r => {
              const days = tenorToDays(r.tenor);
              return {
                tenor: r.tenor,
                days: days,
                rate: r.rate,
                df: rateToDf(r.rate, days, 365)
              };
            });
            
            setCurveData({
              curves: {
                USDKRW: {
                  USD: { tenors: usdTenors },
                  KRW: { tenors: krwTenors }
                }
              }
            });
            setCurveSource('Supabase');
            return;
          }
        
        // JSON fallback
        const jsonRes = await fetch('/config/curves/20260127_IW.json');
        if (jsonRes.ok) {
          const data = await jsonRes.json();
          setCurveData(data);
          setCurveSource('JSON (fallback)');
        }
      } catch (e) {
        console.error('Curve load error:', e);
      }
    };
    
    loadCurveData();
  }, [sharedCurveData, valuationDate]);

  // DF 보간 함수 (Log-Linear) - 이미 계산된 DF 사용
  const interpolateDf = (tenors, targetDays) => {
    if (!tenors || tenors.length === 0) return 1;
    
    // DF가 있는 tenor만 필터링
    const sorted = [...tenors]
      .filter(t => t.df !== undefined && t.df !== null)
      .sort((a, b) => a.days - b.days);
    
    if (sorted.length === 0) return 1;
    
    // 정확히 일치하는 tenor 먼저 찾기
    const exact = sorted.find(t => t.days === targetDays);
    if (exact) return exact.df;
    
    // 범위 밖 - 첫 번째 포인트 이전
    if (targetDays < sorted[0].days) {
      // 비례 외삽 (음수 days 포함)
      if (sorted[0].days === 0) return sorted[0].df;
      const lnDf = Math.log(sorted[0].df);
      return Math.exp(lnDf * targetDays / sorted[0].days);
    }
    
    // 범위 밖 - 마지막 포인트 이후
    if (targetDays > sorted[sorted.length - 1].days) {
      return sorted[sorted.length - 1].df;
    }
    
    // Log-linear 보간
    for (let i = 0; i < sorted.length - 1; i++) {
      if (targetDays >= sorted[i].days && targetDays <= sorted[i + 1].days) {
        const t = (targetDays - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
        const lnDfLower = Math.log(sorted[i].df);
        const lnDfUpper = Math.log(sorted[i + 1].df);
        return Math.exp(lnDfLower + (lnDfUpper - lnDfLower) * t);
      }
    }
    
    return 1;
  };

  // Rebased DF 계산
  // Curves 탭: Spot Date 기준 DF=1
  // Valuation: Today (valuationDate) 기준 DF=1로 rebasing
  // 
  // curvesDays = daysFromValuation - spotDays
  // todayRatio = USD_DF(-spotDays) / KRW_DF(-spotDays)  (Today는 Spot보다 spotDays일 전)
  // rebasedDF = (USD_DF / KRW_DF) / todayRatio
  const getRebasedDF = (daysFromValuation) => {
    if (!curveData) return 1;
    
    const usdTenors = curveData.curves?.USDKRW?.USD?.tenors || [];
    const krwTenors = curveData.curves?.USDKRW?.KRW?.tenors || [];
    
    if (usdTenors.length === 0 || krwTenors.length === 0) return 1;
    
    // Curves는 Spot Date 기준 days
    // Today는 Spot보다 spotDays일 전 → curvesDays = -spotDays
    const todayCurvesDays = -spotDays;
    
    // Today의 ratio (이 값이 1.000024 같은 값)
    const usdDfToday = interpolateDf(usdTenors, todayCurvesDays);
    const krwDfToday = interpolateDf(krwTenors, todayCurvesDays);
    const todayRatio = usdDfToday / krwDfToday;
    
    // Target의 curvesDays
    const targetCurvesDays = daysFromValuation - spotDays;
    
    // Target의 ratio
    const usdDfTarget = interpolateDf(usdTenors, targetCurvesDays);
    const krwDfTarget = interpolateDf(krwTenors, targetCurvesDays);
    const targetRatio = usdDfTarget / krwDfTarget;
    
    // Rebased: Today=1
    const rebasedDf = targetRatio / todayRatio;
    
    return rebasedDf;
  };

  // Daily Forward Rates 계산 (valuationDate부터 730일)
  const dailyRates = (() => {
    const rates = [];
    const today = new Date(valuationDate);
    
    for (let d = 0; d <= 730; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      
      const df = getRebasedDF(d);
      const forwardRate = fixingRate * df;
      
      rates.push({
        date: date.toISOString().split('T')[0],
        days: d,
        df,
        forwardRate
      });
    }
    return rates;
  })();

  // Blotter 평가
  const evalTrades = (() => {
    const today = new Date(valuationDate);
    return blotter
      .filter(t => new Date(t.settlementDate) > today)
      .map(t => {
        const days = Math.round((new Date(t.settlementDate) - today) / 864e5);
        const df = getRebasedDF(days);
        const evalRate = fixingRate * df;
        const pnl = (evalRate - (parseFloat(t.rate) || 0)) * (t.ccy1Amt || 0);
        return { ...t, days, df, evalRate, pnl };
      });
  })();
  
  const totalPnL = evalTrades.reduce((s, t) => s + t.pnl, 0);

  const downloadCSV = () => { 
    const h = 'Date,Days,DF_Rebased,공정가치_환율\n'; 
    const r = dailyRates.map(x => `${x.date},${x.days},${x.df.toFixed(decimalPlaces)},${x.forwardRate.toFixed(3)}`).join('\n'); 
    const b = new Blob([h + r], { type: 'text/csv' }); 
    const u = URL.createObjectURL(b); 
    const a = document.createElement('a'); 
    a.href = u; 
    a.download = `공정가치환율_${valuationDate}.csv`; 
    a.click(); 
    URL.revokeObjectURL(u); 
  };
  
  const fmt = (n, f = null) => n.toFixed(f ?? (showFull ? 10 : 4));
  
  // Today ratio 계산 (디버깅/표시용)
  const getTodayRatio = () => {
    if (!curveData) return 1;
    const usdTenors = curveData.curves?.USDKRW?.USD?.tenors || [];
    const krwTenors = curveData.curves?.USDKRW?.KRW?.tenors || [];
    if (usdTenors.length === 0 || krwTenors.length === 0) return 1;
    
    const todayCurvesDays = -spotDays;
    const usdDfToday = interpolateDf(usdTenors, todayCurvesDays);
    const krwDfToday = interpolateDf(krwTenors, todayCurvesDays);
    return usdDfToday / krwDfToday;
  };
  const todayRatio = getTodayRatio();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">📊 IFRS Valuation</h2>
          <p className="text-sm text-kustody-muted mt-1">공정가치 평가 및 고시 (커브: {curveSource}, Spot T+{spotDays})</p>
        </div>
      </div>
      <div className="bg-kustody-surface rounded-xl p-5"><div className="grid grid-cols-4 gap-4">
        <div><label className="block text-xs text-kustody-muted mb-1">평가일 (Today=1 기준)</label><input type="date" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono" /></div>
        <div><label className="block text-xs text-kustody-muted mb-1">재무환율 (Accounting Rate USD)</label><input type="number" step="0.01" value={fixingRate} onChange={(e) => setFixingRate(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono" /></div>
        <div><label className="block text-xs text-kustody-muted mb-1">CSV 소수점 (DF)</label><select value={decimalPlaces} onChange={(e) => setDecimalPlaces(parseInt(e.target.value))} className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg"><option value={6}>6자리</option><option value={8}>8자리</option><option value={10}>10자리</option></select></div>
        <div className="flex items-end gap-2"><button onClick={() => setShowFull(!showFull)} className={`px-3 py-2 rounded-lg text-sm ${showFull ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-navy'}`}>{showFull ? '10자리' : '4자리'}</button><button onClick={downloadCSV} className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-semibold">📥 CSV</button></div>
      </div></div>
      
      {/* 계산 로직 설명 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
        <p className="text-blue-300 mb-2">📐 <strong>공정가치 환율 계산 로직 (Today Rebasing)</strong></p>
        <ul className="text-blue-200/80 text-xs space-y-1">
          <li>• Curves 탭: Spot Date (T+{spotDays}) 기준 DF=1</li>
          <li>• Today (T+0) 원본 ratio = USD_DF / KRW_DF = <span className="font-mono text-yellow-300">{todayRatio.toFixed(10)}</span></li>
          <li>• <strong>Rebased DF(d) = 원본 ratio(d) / Today 원본 ratio</strong> → Today DF = 1</li>
          <li>• 공정가치 환율 = 재무환율 ({formatNumber(fixingRate, 2)}) × Rebased DF</li>
        </ul>
      </div>
      
      <div className="bg-kustody-surface rounded-xl p-5"><h3 className="font-semibold mb-4">📈 일별 공정가치 환율 (평가일={valuationDate}, Today DF=1)</h3><div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm"><thead className="sticky top-0 bg-kustody-surface"><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2 px-2">Date</th><th className="text-right py-2 px-2">Days</th><th className="text-right py-2 px-2">DF (Rebased)</th><th className="text-right py-2 px-2">공정가치 환율</th></tr></thead>
        <tbody>{dailyRates.slice(0, 100).map((r, i) => (<tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20"><td className="py-1 px-2 font-mono text-xs">{r.date}</td><td className="py-1 px-2 text-right font-mono text-kustody-muted">{r.days}</td><td className="py-1 px-2 text-right font-mono">{fmt(r.df, 10)}</td><td className="py-1 px-2 text-right font-mono text-kustody-accent">{r.forwardRate.toFixed(3)}</td></tr>))}</tbody></table>
        <p className="text-xs text-kustody-muted mt-2 text-center">처음 100일만 표시 (CSV로 전체 다운로드)</p>
      </div></div>
      {evalTrades.length > 0 && (<div className="bg-kustody-surface rounded-xl p-5"><h3 className="font-semibold mb-4">💹 미결제 거래 평가</h3>
        <table className="w-full text-sm"><thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2">결제일</th><th className="text-right py-2">Days</th><th className="text-right py-2">거래환율</th><th className="text-right py-2">평가환율</th><th className="text-right py-2">Notional</th><th className="text-right py-2">미실현손익</th></tr></thead>
        <tbody>{evalTrades.map((t, i) => (<tr key={i} className="border-b border-kustody-border/30"><td className="py-2 font-mono text-xs">{t.settlementDate}</td><td className="py-2 text-right font-mono text-kustody-muted">{t.days}</td><td className="py-2 text-right font-mono">{formatNumber(parseFloat(t.rate), 2)}</td><td className="py-2 text-right font-mono text-kustody-accent">{t.evalRate.toFixed(3)}</td><td className="py-2 text-right font-mono">{formatNumber(t.ccy1Amt, 0)}</td><td className={`py-2 text-right font-mono font-semibold ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(t.pnl, 0)}</td></tr>))}</tbody>
        <tfoot><tr className="border-t-2 border-kustody-border font-semibold"><td colSpan="5" className="py-2">Total 미실현손익</td><td className={`py-2 text-right font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(totalPnL, 0)} KRW</td></tr></tfoot>
      </table></div>)}
    </div>
  );
}

export default ValuationTab;
