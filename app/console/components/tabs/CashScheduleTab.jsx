'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import { formatNumber } from '../../services/formatters';

function CashScheduleTab({ blotter, config, selectedClientId, setSelectedClientId }) {
  const [selectedCcy, setSelectedCcy] = useState('USD');
  const [curveData, setCurveData] = useState(null);
  useEffect(() => { fetch('/config/curves/20260127_IW.json').then(res => res.ok ? res.json() : null).then(data => setCurveData(data)); }, []);

  // 고객 필터 적용
  const filteredBlotter = selectedClientId 
    ? blotter.filter(t => t.clientId === selectedClientId)
    : blotter;
  
  const selectedClient = config.clients?.find(c => c.clientId === selectedClientId);

  const getDF = (days, ccy) => {
    if (!curveData) return 1;
    const tenors = curveData.curves?.USDKRW?.[ccy]?.tenors || [];
    if (tenors.length === 0) return 1;
    
    const sorted = [...tenors].sort((a, b) => a.days - b.days);
    
    const interpolate = (d) => {
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].days <= d && sorted[i + 1].days >= d) {
          const r = (d - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
          return sorted[i].df + (sorted[i + 1].df - sorted[i].df) * r;
        }
      }
      if (d <= sorted[0].days) return sorted[0].df;
      if (d >= sorted[sorted.length - 1].days) return sorted[sorted.length - 1].df;
      return 1;
    };
    
    const todayDF = interpolate(0);
    const df = interpolate(days);
    return df / todayDF;
  };

  const schedule = (() => {
    const today = new Date(), flows = {};
    
    const addFlow = (date, instrument, amt) => {
      if (!date || !amt) return;
      if (!flows[date]) flows[date] = { SWAP: 0, OUTRIGHT: 0 };
      flows[date][instrument] += amt;
    };
    
    filteredBlotter.forEach(t => {
      if (t.instrument === 'FX_SWAP') {
        // Near leg
        if (selectedCcy === 'USD') {
          const nearUsd = t.direction === 'B/S' ? t.nearCcy1Amt : -t.nearCcy1Amt;
          addFlow(t.nearDate, 'SWAP', nearUsd);
        } else {
          const nearKrw = t.direction === 'B/S' ? -t.nearCcy2Amt : t.nearCcy2Amt;
          addFlow(t.nearDate, 'SWAP', nearKrw);
        }
        // Far leg
        if (selectedCcy === 'USD') {
          const farUsd = t.direction === 'B/S' ? -t.farCcy1Amt : t.farCcy1Amt;
          addFlow(t.farDate, 'SWAP', farUsd);
        } else {
          const farKrw = t.direction === 'B/S' ? t.farCcy2Amt : -t.farCcy2Amt;
          addFlow(t.farDate, 'SWAP', farKrw);
        }
      } else if (t.instrument === 'OUTRIGHT') {
        if (selectedCcy === 'USD') {
          const usd = t.direction === 'Buy' ? t.farCcy1Amt : -t.farCcy1Amt;
          addFlow(t.farDate, 'OUTRIGHT', usd);
        } else {
          const krw = t.direction === 'Buy' ? -t.farCcy2Amt : t.farCcy2Amt;
          addFlow(t.farDate, 'OUTRIGHT', krw);
        }
      }
    });
    
    return Object.entries(flows).map(([date, f]) => { 
      const days = Math.round((new Date(date) - today) / 864e5); 
      const sum = f.SWAP + f.OUTRIGHT; 
      const df = getDF(days, selectedCcy); 
      return { date, days, sum, df, npv: sum * df, ...f }; 
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  })();
  const totalNPV = schedule.reduce((s, r) => s + r.npv, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">💵 Cash Schedule</h2><p className="text-sm text-kustody-muted mt-1">통화별 캐시플로우</p></div>
        <div className="flex items-center gap-3">
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm">
            <option value="">🔍 전체 고객</option>
            {config.clients?.map(c => (
              <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
            ))}
          </select>
          <select value={selectedCcy} onChange={(e) => setSelectedCcy(e.target.value)} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm">
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </select>
        </div>
      </div>
      
      {selectedClientId && selectedClient && (
        <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-kustody-accent font-semibold">👤 {selectedClient.clientName}</span>
            <span className="text-kustody-muted">거래 {filteredBlotter.length}건</span>
          </div>
        </div>
      )}
      
      <div className="bg-kustody-surface rounded-xl p-5"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2 px-2">날짜</th><th className="text-right py-2 px-2">SUM</th><th className="text-right py-2 px-2">DF</th><th className="text-right py-2 px-2">NPV</th><th className="text-right py-2 px-2">SWAP</th><th className="text-right py-2 px-2">OUTRIGHT</th></tr></thead>
          <tbody>{schedule.length === 0 ? <tr><td colSpan="6" className="py-8 text-center text-kustody-muted">데이터가 없습니다.</td></tr> : schedule.map((r, i) => (
            <tr key={i} className="border-b border-kustody-border/30">
              <td className="py-2 px-2 font-mono">{r.date}</td>
              <td className={`py-2 px-2 text-right font-mono ${r.sum >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(r.sum, 0)}</td>
              <td className="py-2 px-2 text-right font-mono text-kustody-muted">{r.df.toFixed(10)}</td>
              <td className={`py-2 px-2 text-right font-mono ${r.npv >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(r.npv, 2)}</td>
              <td className="py-2 px-2 text-right font-mono text-purple-400">{r.SWAP !== 0 ? formatNumber(r.SWAP, 0) : '-'}</td>
              <td className="py-2 px-2 text-right font-mono text-green-400">{r.OUTRIGHT !== 0 ? formatNumber(r.OUTRIGHT, 0) : '-'}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr className="border-t-2 border-kustody-border font-semibold"><td className="py-2 px-2">Total NPV</td><td colSpan="2"></td><td className={`py-2 px-2 text-right font-mono ${totalNPV >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(totalNPV, 2)}</td><td colSpan="2"></td></tr></tfoot>
        </table>
      </div></div>
    </div>
  );
}

export default CashScheduleTab;
