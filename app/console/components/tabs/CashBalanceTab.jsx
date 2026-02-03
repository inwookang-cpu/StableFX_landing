'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import { formatNumber } from '../../services/formatters';

function CashBalanceTab({ blotter, config, selectedClientId, setSelectedClientId }) {
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [usdBalance, setUsdBalance] = useState(0);
  const [krwBalance, setKrwBalance] = useState(0);
  
  // 선택된 고객의 잔액 계산
  const filteredTrades = selectedClientId === 'ALL' 
    ? blotter 
    : blotter.filter(t => t.clientId === selectedClientId);
  
  // 특정 날짜 기준 잔액 계산
  const calculateBalance = () => {
    let usd = 0;
    let krw = 0;
    
    filteredTrades.forEach(trade => {
      if (trade.settlementDate <= balanceDate) {
        if (trade.type === 'BUY') {
          usd += parseFloat(trade.ccy1Amt) || 0;
          krw -= parseFloat(trade.ccy2Amt) || 0;
        } else {
          usd -= parseFloat(trade.ccy1Amt) || 0;
          krw += parseFloat(trade.ccy2Amt) || 0;
        }
      }
    });
    
    return { usd, krw };
  };
  
  const balance = calculateBalance();
  
  // 일별 잔액 히스토리 생성
  const generateBalanceHistory = () => {
    const history = [];
    const sortedTrades = [...filteredTrades].sort((a, b) => 
      new Date(a.settlementDate) - new Date(b.settlementDate)
    );
    
    let runningUsd = 0;
    let runningKrw = 0;
    
    sortedTrades.forEach(trade => {
      if (trade.type === 'BUY') {
        runningUsd += parseFloat(trade.ccy1Amt) || 0;
        runningKrw -= parseFloat(trade.ccy2Amt) || 0;
      } else {
        runningUsd -= parseFloat(trade.ccy1Amt) || 0;
        runningKrw += parseFloat(trade.ccy2Amt) || 0;
      }
      
      history.push({
        date: trade.settlementDate,
        tradeId: trade.id,
        type: trade.type,
        usdChange: trade.type === 'BUY' ? parseFloat(trade.ccy1Amt) : -parseFloat(trade.ccy1Amt),
        krwChange: trade.type === 'BUY' ? -parseFloat(trade.ccy2Amt) : parseFloat(trade.ccy2Amt),
        usdBalance: runningUsd,
        krwBalance: runningKrw,
      });
    });
    
    return history;
  };
  
  const balanceHistory = generateBalanceHistory();

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="text-kustody-muted text-xs mb-2">기준일</div>
          <input 
            type="date" 
            value={balanceDate} 
            onChange={(e) => setBalanceDate(e.target.value)}
            className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono"
          />
        </div>
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="text-kustody-muted text-xs mb-2">USD Balance</div>
          <div className={`text-2xl font-mono font-bold ${balance.usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatNumber(balance.usd)}
          </div>
        </div>
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="text-kustody-muted text-xs mb-2">KRW Balance</div>
          <div className={`text-2xl font-mono font-bold ${balance.krw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatNumber(balance.krw)}
          </div>
        </div>
      </div>
      
      {/* 고객 필터 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-kustody-muted">고객 필터:</label>
          <select 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg"
          >
            <option value="ALL">전체</option>
            {config.clients?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* 잔액 히스토리 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <h3 className="font-semibold mb-4">📊 잔액 변동 히스토리</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-kustody-surface">
              <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                <th className="text-left py-2 px-2">Settlement Date</th>
                <th className="text-center py-2 px-2">Type</th>
                <th className="text-right py-2 px-2">USD Change</th>
                <th className="text-right py-2 px-2">KRW Change</th>
                <th className="text-right py-2 px-2">USD Balance</th>
                <th className="text-right py-2 px-2">KRW Balance</th>
              </tr>
            </thead>
            <tbody>
              {balanceHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-kustody-muted">거래 내역이 없습니다</td>
                </tr>
              ) : (
                balanceHistory.map((row, i) => (
                  <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                    <td className="py-2 px-2 font-mono text-xs">{row.date}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${row.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{row.type}</td>
                    <td className={`py-2 px-2 text-right font-mono ${row.usdChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(row.usdChange)}</td>
                    <td className={`py-2 px-2 text-right font-mono ${row.krwChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(row.krwChange)}</td>
                    <td className="py-2 px-2 text-right font-mono text-kustody-accent">{formatNumber(row.usdBalance)}</td>
                    <td className="py-2 px-2 text-right font-mono text-kustody-accent">{formatNumber(row.krwBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CashBalanceTab;
