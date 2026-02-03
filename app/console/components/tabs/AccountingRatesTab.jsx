'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import supabase from '../../services/SupabaseService';
import { formatNumber } from '../../services/formatters';

function AccountingRatesTab() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState(null);
  
  // 재무환율 데이터 로드
  const fetchRates = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabase.getAccountingRates(date);
      setRates(data);
      
      if (data.length === 0) {
        setError('해당 날짜의 데이터가 없습니다.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 최신 날짜 데이터 로드
  const fetchLatestRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const { date, rates: latestRates } = await supabase.getLatestAccountingRates();
      
      if (latestRates.length > 0) {
        setSelectedDate(date);
        setRates(latestRates);
      } else {
        setError('데이터가 없습니다. 스크래퍼를 실행해주세요.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 컴포넌트 마운트 시 최신 데이터 로드
  useEffect(() => {
    fetchLatestRates();
  }, []);
  
  // 주요 통화 분리 (USD 항상 맨 앞)
  const majorCurrencyOrder = ['USD', 'CNH', 'EUR', 'GBP', 'JPY'];
  const majorRates = majorCurrencyOrder
    .map(code => rates.find(r => r.currency_code === code))
    .filter(Boolean);
  
  // 전체 목록도 USD 우선 정렬
  const sortedRates = [...rates].sort((a, b) => {
    if (a.currency_code === 'USD') return -1;
    if (b.currency_code === 'USD') return 1;
    return a.currency_code.localeCompare(b.currency_code);
  });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">🏦 재무환율 (Accounting Rates)</h3>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
            />
            <button 
              onClick={() => fetchRates(selectedDate)}
              disabled={loading}
              className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-semibold text-sm hover:bg-kustody-accent/80 disabled:opacity-50"
            >
              {loading ? '⏳' : '🔍 조회'}
            </button>
            <button 
              onClick={fetchLatestRates}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-400 disabled:opacity-50"
            >
              {loading ? '⏳' : '📡 최신'}
            </button>
          </div>
        </div>
        <p className="text-xs text-kustody-muted">
          출처: 서울외국환중개 (smbs.biz) · 매일 08:40 KST 기준 · {selectedDate}
        </p>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}
      
      {/* 주요 통화 */}
      {majorRates.length > 0 && (
        <div className="bg-kustody-surface rounded-xl p-5">
          <h4 className="font-semibold mb-4">💱 주요 통화</h4>
          <div className="grid grid-cols-5 gap-4">
            {majorRates.map((rate) => (
              <div key={rate.currency_code} className="bg-kustody-dark rounded-lg p-4 text-center">
                <div className="text-xs text-kustody-muted mb-1">{rate.currency_name}</div>
                <div className="text-xl font-mono font-bold text-kustody-accent">
                  {formatNumber(rate.rate_krw, rate.currency_code === 'JPY' ? 4 : 2)}
                </div>
                {rate.change_rate !== null && rate.change_rate !== undefined && (
                  <div className={`text-xs mt-1 ${rate.change_rate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {rate.change_rate >= 0 ? '▲' : '▼'} {Math.abs(rate.change_rate).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 전체 통화 테이블 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <h4 className="font-semibold mb-4">📋 전체 통화 ({rates.length}개)</h4>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-kustody-surface">
              <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                <th className="text-left py-2 px-3">통화</th>
                <th className="text-left py-2 px-3">통화명</th>
                <th className="text-right py-2 px-3">환율 (원)</th>
                <th className="text-right py-2 px-3">전일대비</th>
                <th className="text-right py-2 px-3">Cross Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-kustody-muted">
                    {loading ? '로딩 중...' : '데이터가 없습니다'}
                  </td>
                </tr>
              ) : (
                sortedRates.map((rate) => (
                  <tr key={rate.currency_code} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                    <td className="py-2 px-3 font-mono font-semibold">{rate.currency_code}</td>
                    <td className="py-2 px-3 text-kustody-muted text-xs">{rate.currency_name}</td>
                    <td className="py-2 px-3 text-right font-mono text-kustody-accent">
                      {formatNumber(rate.rate_krw, 4)}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono ${
                      rate.change_rate > 0 ? 'text-red-400' : rate.change_rate < 0 ? 'text-blue-400' : 'text-kustody-muted'
                    }`}>
                      {rate.change_rate !== null && rate.change_rate !== undefined 
                        ? `${rate.change_rate >= 0 ? '+' : ''}${rate.change_rate.toFixed(2)}` 
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-kustody-muted">
                      {rate.cross_rate ? formatNumber(rate.cross_rate, 6) : '-'}
                    </td>
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
export default AccountingRatesTab;
