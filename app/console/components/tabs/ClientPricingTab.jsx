'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import supabase from '../../services/SupabaseService';
import { DEFAULT_SPREADS } from '../../services/constants';

import { 
  DateRuleCalculator, 
  formatDate,
  getDayName
} from '../../../../lib/dateCalculator';

function ClientPricingTab({ config, selectedClientId, setSelectedClientId, pricingNotional, setPricingNotional }) {
  const [curveData, setCurveData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Point Interpolation 관련 state
  const [viewMode, setViewMode] = useState('beginner');
  const [interpDate, setInterpDate] = useState('2020-04-06');
  const [interpStartDate, setInterpStartDate] = useState('2020-03-04');
  
  // 네이버 환율 state
  const [liveSpot, setLiveSpot] = useState(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [naverLastUpdate, setNaverLastUpdate] = useState(null);

  // 네이버 환율 가져오기 (4분 캐싱)
  const fetchNaverSpot = async (force = false) => {
    const now = Date.now();
    
    // 전역 캐시 체크
    if (!force && naverRateCache.data && naverRateCache.lastFetch && 
        (now - naverRateCache.lastFetch) < naverRateCache.CACHE_DURATION) {
      if (naverRateCache.data.USDKRW) {
        const rateObj = naverRateCache.data.USDKRW;
        const rate = typeof rateObj === 'object' ? rateObj.rate : rateObj;
        setLiveSpot(rate);
        setNaverLastUpdate(new Date(naverRateCache.lastFetch));
        return rate;
      }
    }
    
    setNaverLoading(true);
    try {
      const response = await fetch('/api/naver-rates', {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.rates?.USDKRW) {
          const rateObj = data.rates.USDKRW;
          // 객체면 rate 추출, 숫자면 그대로 사용
          const rate = typeof rateObj === 'object' ? rateObj.rate : rateObj;
          setLiveSpot(rate);
          setNaverLastUpdate(new Date(now));
          
          // 전역 캐시 업데이트
          naverRateCache.data = data.rates;
          
          naverRateCache.lastFetch = now;
          
          return rate;
        }
      }
    } catch (error) {
      console.error('Naver spot fetch error:', error);
    } finally {
      setNaverLoading(false);
    }
    return null;
  };
  
  // Spread settings 가져오기
  const fetchSpreadSettings = async () => {
    try {
      const settings = await supabase.getSpreadSettings();
      if (Object.keys(settings).length > 0) {
        return settings;
      }
    } catch (error) {
      console.error('Spread settings fetch error:', error);
    }
    return DEFAULT_SPREADS;
  };

  // Curve 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. JSON 로드
        const res = await fetch('/config/curves/20260127_IW.json');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        
        // 2. Spread settings 가져오기
        const spreads = await fetchSpreadSettings();
        
        // 3. fxSwapPoints에 spread 적용
        if (data.curves?.USDKRW?.fxSwapPoints) {
          data.curves.USDKRW.fxSwapPoints = data.curves.USDKRW.fxSwapPoints.map(sp => {
            const spreadPips = spreads[sp.tenor] || 0;
            const spreadValue = spreadPips / 100;
            return {
              ...sp,
              bid: sp.points - spreadValue,
              ask: sp.points + spreadValue
            };
          });
        }
        
        // Spot Date 기준으로 기본 날짜 설정
        const spotDate = data.curves?.USDKRW?.USD?.spotDate;
        if (spotDate) {
          setInterpStartDate(spotDate);
          const maturity = new Date(spotDate);
          maturity.setMonth(maturity.getMonth() + 1);
          setInterpDate(maturity.toISOString().split('T')[0]);
        }
        setCurveData(data);
        setLoading(false);
      } catch (error) {
        console.error('Load error:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const selectedClient = config.clients.find(c => c.clientId === selectedClientId);
  const spot = liveSpot || curveData?.spotRates?.USDKRW || 1450.00;

  // Notional Tier 찾기
  const getNotionalTier = (notional) => {
    return config.notionalTiers.find(t => 
      notional >= t.min && (t.max === null || notional < t.max)
    ) || config.notionalTiers[1];
  };

  // Margin 계산 (Point 방식) - 전단위로 반환
  const calculatePointMargin = (client, days) => {
    if (!client) return { credit: 0, notional: 0, total: 0 };
    
    const tier = config.creditTiers[client.creditTier];
    if (!tier || tier.pointMargin === null) return null; // Blocked

    // Custom Margin 체크
    if (client.overrides?.customMargin !== null && client.overrides?.customMargin !== undefined) {
      return { credit: client.overrides.customMargin, notional: 0, total: client.overrides.customMargin, isCustom: true };
    }

    // Credit Margin
    let creditMargin = 0;
    if (!client.overrides?.ignoreCredit) {
      if (client.marginType === 'point') {
        creditMargin = tier.pointMargin;
      } else {
        // BP → Point 환산: bp × days / 365 × spot / 10000
        creditMargin = tier.bpMargin * days / 365 * spot / 10000;
      }
    }

    // Notional Margin
    let notionalMargin = 0;
    if (!client.overrides?.ignoreNotional) {
      const notionalTier = getNotionalTier(pricingNotional);
      notionalMargin = notionalTier.margin;
    }

    return {
      credit: creditMargin,
      notional: notionalMargin,
      total: creditMargin + notionalMargin,
      isCustom: false
    };
  };

  // 고객용 커브 생성 (마진 적용)
  const getClientSwapPoints = () => {
    if (!curveData || !selectedClient) return [];
    const fxSwapPoints = curveData.curves?.USDKRW?.fxSwapPoints || [];
    
    return fxSwapPoints.map(p => {
      const margin = calculatePointMargin(selectedClient, p.days);
      if (!margin) return { ...p, clientBid: null, clientAsk: null };
      
      // 마진은 전단위로 계산됨, 원단위로 변환 필요 (/100)
      const marginInWon = margin.total / 100;
      
      return {
        ...p,
        clientBid: p.bid !== null ? p.bid - marginInWon : null,
        clientAsk: p.ask !== null ? p.ask + marginInWon : null
      };
    });
  };

  // Swap Point Linear Interpolation (고객용 커브 기반)
  const interpolateClientSwapPoint = (days, swapPoints) => {
    if (!swapPoints || swapPoints.length === 0) return null;
    
    // Spot 이전 처리
    if (days <= 0) {
      if (days === 0) {
        return { points: 0, bid: 0, ask: 0, displayDays: 0 };
      }
      const tn = swapPoints.find(p => p.tenor === 'T/N');
      const on = swapPoints.find(p => p.tenor === 'O/N');
      if (days === -1 && tn) {
        return { points: tn.points, bid: tn.clientBid, ask: tn.clientAsk, displayDays: 1, tenor: 'T/N' };
      }
      if (days === -2 && on) {
        return { points: on.points, bid: on.clientBid, ask: on.clientAsk, displayDays: 1, tenor: 'O/N' };
      }
      return null;
    }

    const sorted = swapPoints.filter(p => p.days > 0).sort((a, b) => a.days - b.days);
    if (sorted.length === 0) return null;

    // 정확히 일치하는 경우
    const exact = sorted.find(p => p.days === days);
    if (exact) {
      return {
        points: exact.points,
        bid: exact.clientBid,
        ask: exact.clientAsk,
        displayDays: days,
        tenor: exact.tenor
      };
    }

    // 범위 밖
    if (days < sorted[0].days) {
      return {
        points: sorted[0].points * days / sorted[0].days,
        bid: sorted[0].clientBid !== null ? sorted[0].clientBid * days / sorted[0].days : null,
        ask: sorted[0].clientAsk !== null ? sorted[0].clientAsk * days / sorted[0].days : null,
        displayDays: days
      };
    }
    if (days > sorted[sorted.length - 1].days) {
      const last = sorted[sorted.length - 1];
      return {
        points: last.points * days / last.days,
        bid: last.clientBid !== null ? last.clientBid * days / last.days : null,
        ask: last.clientAsk !== null ? last.clientAsk * days / last.days : null,
        displayDays: days
      };
    }

    // 선형 보간
    let lower = sorted[0], upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].days <= days && sorted[i + 1].days >= days) {
        lower = sorted[i];
        upper = sorted[i + 1];
        break;
      }
    }

    const ratio = (days - lower.days) / (upper.days - lower.days);
    const interpPoints = lower.points + (upper.points - lower.points) * ratio;
    const interpBid = (lower.clientBid !== null && upper.clientBid !== null)
      ? lower.clientBid + (upper.clientBid - lower.clientBid) * ratio : null;
    const interpAsk = (lower.clientAsk !== null && upper.clientAsk !== null)
      ? lower.clientAsk + (upper.clientAsk - lower.clientAsk) * ratio : null;

    return {
      points: interpPoints,
      bid: interpBid,
      ask: interpAsk,
      displayDays: days,
      lowerTenor: lower.tenor,
      upperTenor: upper.tenor
    };
  };

  // 보간 결과 계산
  const clientInterpResult = useMemo(() => {
    if (!curveData || !interpDate || !selectedClient || selectedClient.creditTier === 5) return null;
    
    try {
      const clientSwapPoints = getClientSwapPoints();
      const usdkrw = curveData.curves?.USDKRW;
      const spotDate = new Date(usdkrw?.USD?.spotDate || curveData.metadata.referenceDate);
      const targetDate = new Date(interpDate);
      const startDate = new Date(interpStartDate);
      
      if (isNaN(spotDate.getTime()) || isNaN(targetDate.getTime()) || isNaN(startDate.getTime())) {
        return null;
      }

      if (viewMode === 'beginner') {
        const days = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        const result = interpolateClientSwapPoint(days, clientSwapPoints);
        return result ? { ...result, days } : null;
      } else {
        // Pro 모드
        const startDays = Math.round((startDate - spotDate) / (1000 * 60 * 60 * 24));
        const maturityDays = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        const periodDays = maturityDays - startDays;

        const startResult = interpolateClientSwapPoint(startDays, clientSwapPoints);
        const maturityResult = interpolateClientSwapPoint(maturityDays, clientSwapPoints);

        if (!startResult || !maturityResult) return null;

        // Forward Spread (Tight 방식)
        const forwardPoints = maturityResult.points - startResult.points;
        const tightBid = (maturityResult.bid !== null && startResult.bid !== null)
          ? maturityResult.bid - startResult.bid : null;
        const tightAsk = (maturityResult.ask !== null && startResult.ask !== null)
          ? maturityResult.ask - startResult.ask : null;

        return {
          startDate: interpStartDate,
          maturityDate: interpDate,
          displayDays: periodDays,
          days: periodDays,
          tenor: `${startDays === 0 ? 'Spot' : startDays + 'D'} → ${maturityDays}D`,
          points: forwardPoints,
          tightBid,
          tightAsk,
          startDays,
          maturityDays,
          startPoints: startResult.points,
          maturityPoints: maturityResult.points,
          startBid: startResult.bid,
          startAsk: startResult.ask,
          maturityBid: maturityResult.bid,
          maturityAsk: maturityResult.ask
        };
      }
    } catch (e) {
      console.warn('Client interpolation error:', e);
      return null;
    }
  }, [curveData, interpDate, interpStartDate, viewMode, selectedClient, pricingNotional]);

  if (loading) return <div className="text-center py-20 text-kustody-muted">로딩 중...</div>;

  const fxSwapPoints = curveData?.curves?.USDKRW?.fxSwapPoints || [];
  const clientSwapPoints = getClientSwapPoints();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">💰 Client Pricing</h2>
          <p className="text-sm text-kustody-muted mt-1">고객별 마진 적용 가격 산출</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchNaverSpot(true)}
            disabled={naverLoading}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              naverLoading
                ? 'bg-orange-500/50 text-white cursor-wait'
                : 'bg-orange-500 text-white hover:bg-orange-400'
            }`}
          >
            {naverLoading ? '⏳' : '📡'}
          </button>
          <div className="text-right text-sm">
            <div className="text-kustody-muted">Spot (USDKRW)</div>
            <div className="font-mono text-lg font-bold text-kustody-accent">
              {spot.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </div>
            {naverLastUpdate && (
              <div className="text-xs text-kustody-muted">{naverLastUpdate.toLocaleTimeString('ko-KR')}</div>
            )}
          </div>
        </div>
      </div>

      {/* 고객 선택 & Notional 입력 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs text-kustody-muted mb-2">고객 선택</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-3 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
            >
              <option value="">-- 고객 선택 --</option>
              {config.clients.map(c => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName} (Tier {c.creditTier})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-kustody-muted mb-2">Notional (USD)</label>
            <input
              type="number"
              value={pricingNotional}
              onChange={(e) => setPricingNotional(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-kustody-dark border border-kustody-border rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-kustody-muted mb-2">적용 마진 (1M 기준)</label>
            <div className="px-4 py-3 bg-kustody-accent/20 border border-kustody-accent/30 rounded-lg text-sm font-mono text-kustody-accent font-semibold">
              ±{selectedClient ? Math.round(calculatePointMargin(selectedClient, 33)?.total || 0) : 0} pt
              <span className="text-kustody-muted font-normal ml-2">
                (Credit: {selectedClient ? Math.round(calculatePointMargin(selectedClient, 33)?.credit || 0) : 0} + 
                Notional: {getNotionalTier(pricingNotional)?.margin || 0})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 5 Blocked */}
      {selectedClient && selectedClient.creditTier === 5 && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🚫</div>
          <div className="text-red-400 font-semibold text-lg">거래 불가 (Tier 5 - Blocked)</div>
          <div className="text-kustody-muted text-sm mt-2">
            {selectedClient.sealLayer?.reason || '내부 정책에 의해 거래가 제한되었습니다.'}
          </div>
        </div>
      )}

      {/* Tier 4 Warning */}
      {selectedClient && selectedClient.creditTier === 4 && (
        <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
          ⚠️ Tier 4 (Discouraged) - 거래 억제 가격이 적용됩니다.
        </div>
      )}

      {/* FX Swap Points - 고객용 (마진 적용) */}
      {selectedClient && selectedClient.creditTier !== 5 && (
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">📊 FX Swap Points - {selectedClient.clientName}</h3>
            <span className="text-xs bg-kustody-navy px-2 py-1 rounded text-kustody-muted">USDKRW · 전단위</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                  <th className="text-left py-2 px-2 font-medium">Tenor</th>
                  <th className="text-center py-2 px-2 font-medium">Start</th>
                  <th className="text-center py-2 px-2 font-medium">Maturity</th>
                  <th className="text-right py-2 px-2 font-medium">Days</th>
                  <th className="text-right py-2 px-2 font-medium">Screen</th>
                  <th className="text-right py-2 px-2 font-medium">Sp/Day</th>
                  <th className="text-right py-2 px-2 font-medium">Indic_rate</th>
                  <th className="text-right py-2 px-2 font-medium text-red-400">Bid</th>
                  <th className="text-right py-2 px-2 font-medium text-green-400">Ask</th>
                </tr>
              </thead>
              <tbody>
                {clientSwapPoints.map((p, i) => {
                  // 표시용 days: Start에서 Maturity까지의 실제 기간
                  const displayDays = p.start && p.maturity 
                    ? Math.round((new Date(p.maturity) - new Date(p.start)) / (1000 * 60 * 60 * 24))
                    : (p.days > 0 ? p.days : 1);
                  const screenPips = p.points !== null ? Math.round(p.points * 100) : null;
                  const bidPips = p.clientBid !== null ? Math.round(p.clientBid * 100) : null;
                  const askPips = p.clientAsk !== null ? Math.round(p.clientAsk * 100) : null;
                  const spPerDay = (displayDays > 0 && screenPips !== null) ? (screenPips / displayDays).toFixed(2) : '-';
                  const effectivePoints = p.points;
                  const indicRate = (displayDays > 0 && effectivePoints !== null) ? ((effectivePoints / spot) * (365 / displayDays) * 100).toFixed(2) : '-';

                  return (
                    <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 px-2 font-mono font-semibold text-kustody-text">{p.tenor}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.start || '-'}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.maturity || '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{displayDays}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-text">{screenPips !== null ? screenPips : '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-accent">{spPerDay}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{indicRate !== '-' ? indicRate + '%' : '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-red-400 font-semibold">{bidPips ?? '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-green-400 font-semibold">{askPips ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Point Interpolation - 고객용 */}
      {selectedClient && selectedClient.creditTier !== 5 && (
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">🎯 Point Interpolation - {selectedClient.clientName}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('beginner')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  viewMode === 'beginner' 
                    ? 'bg-kustody-accent text-kustody-dark font-semibold' 
                    : 'text-kustody-muted hover:text-kustody-text'
                }`}
              >
                초보
              </button>
              <button
                onClick={() => setViewMode('pro')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  viewMode === 'pro' 
                    ? 'bg-kustody-accent text-kustody-dark font-semibold' 
                    : 'text-kustody-muted hover:text-kustody-text'
                }`}
              >
                Pro
              </button>
            </div>
          </div>
          
          <div className={`grid ${viewMode === 'pro' ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-3`}>
            {viewMode === 'pro' && (
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={interpStartDate} 
                  onChange={(e) => setInterpStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-kustody-muted mb-1">
                {viewMode === 'beginner' ? '결제일' : 'Maturity Date'}
              </label>
              <input 
                type="date" 
                value={interpDate} 
                onChange={(e) => setInterpDate(e.target.value)}
                className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
              />
            </div>
            {/* Result inline */}
            {clientInterpResult && (
              <div className="bg-kustody-navy/50 rounded-lg p-2 flex items-center justify-around">
                <div className="text-center">
                  <div className="text-xs text-kustody-muted">Screen</div>
                  <div className="font-mono text-kustody-accent font-semibold">
                    {clientInterpResult.points !== null ? Math.round(clientInterpResult.points * 100) : '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-kustody-muted">{clientInterpResult.displayDays || clientInterpResult.days}D</div>
                  <div className="font-mono text-xs text-kustody-muted">
                    {clientInterpResult.displayDays > 0 
                      ? (clientInterpResult.points * 100 / clientInterpResult.displayDays).toFixed(2) + '/d'
                      : '-'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 결과 표시 */}
          {clientInterpResult && (
            <div className="bg-kustody-navy/30 rounded-lg p-4">
              {viewMode === 'beginner' ? (
                <div className="grid grid-cols-7 gap-2 text-center text-sm">
                  <div>
                    <div className="text-xs text-kustody-muted">Spot Date</div>
                    <div className="font-mono text-kustody-text text-xs">
                      {curveData?.curves?.USDKRW?.USD?.spotDate}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">결제일</div>
                    <div className="font-mono text-kustody-text text-xs">{interpDate}</div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">기간</div>
                    <div className="font-mono text-kustody-accent">{clientInterpResult.displayDays}일</div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Screen</div>
                    <div className="font-mono text-kustody-text">
                      {clientInterpResult.points !== null ? Math.round(clientInterpResult.points * 100) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Bid</div>
                    <div className="font-mono text-red-400 font-semibold">
                      {clientInterpResult.bid !== null ? Math.round(clientInterpResult.bid * 100) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Ask</div>
                    <div className="font-mono text-green-400 font-semibold">
                      {clientInterpResult.ask !== null ? Math.round(clientInterpResult.ask * 100) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Spread</div>
                    <div className="font-mono text-kustody-accent">
                      {clientInterpResult.bid !== null && clientInterpResult.ask !== null 
                        ? Math.round((clientInterpResult.ask - clientInterpResult.bid) * 100) : '-'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Pro 모드 */
                <div>
                  <div className="grid grid-cols-7 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xs text-kustody-muted">Start</div>
                      <div className="font-mono text-kustody-text text-xs">{clientInterpResult.startDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Maturity</div>
                      <div className="font-mono text-kustody-text text-xs">{clientInterpResult.maturityDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Days</div>
                      <div className="font-mono text-kustody-accent">{clientInterpResult.displayDays}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Mid</div>
                      <div className="font-mono text-kustody-text">
                        {clientInterpResult.points !== null ? Math.round(clientInterpResult.points * 100) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Bid</div>
                      <div className="font-mono text-red-400 font-semibold">
                        {clientInterpResult.tightBid !== null ? Math.round(clientInterpResult.tightBid * 100) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Ask</div>
                      <div className="font-mono text-green-400 font-semibold">
                        {clientInterpResult.tightAsk !== null ? Math.round(clientInterpResult.tightAsk * 100) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Spread</div>
                      <div className="font-mono text-kustody-accent">
                        {clientInterpResult.tightAsk !== null && clientInterpResult.tightBid !== null 
                          ? Math.round((clientInterpResult.tightAsk - clientInterpResult.tightBid) * 100) : '-'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Start/Maturity 상세 */}
                  <div className="mt-2 pt-2 border-t border-kustody-border/30 grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="text-kustody-muted">Start ({clientInterpResult.startDays}D): </span>
                      <span className="font-mono">{clientInterpResult.startPoints !== null ? Math.round(clientInterpResult.startPoints * 100) : '-'}</span>
                      <span className="text-red-400/70 ml-1">B:{clientInterpResult.startBid !== null ? Math.round(clientInterpResult.startBid * 100) : '-'}</span>
                      <span className="text-green-400/70 ml-1">A:{clientInterpResult.startAsk !== null ? Math.round(clientInterpResult.startAsk * 100) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">Maturity ({clientInterpResult.maturityDays}D): </span>
                      <span className="font-mono">{clientInterpResult.maturityPoints !== null ? Math.round(clientInterpResult.maturityPoints * 100) : '-'}</span>
                      <span className="text-red-400/70 ml-1">B:{clientInterpResult.maturityBid !== null ? Math.round(clientInterpResult.maturityBid * 100) : '-'}</span>
                      <span className="text-green-400/70 ml-1">A:{clientInterpResult.maturityAsk !== null ? Math.round(clientInterpResult.maturityAsk * 100) : '-'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedClient && (
        <div className="bg-kustody-surface rounded-xl p-10 text-center text-kustody-muted">
          👆 고객을 선택해주세요
        </div>
      )}
    </div>
  );
}

// ==================== Spread Settings Section ====================
function SpreadSettingsSection() {
  const TENOR_LIST = ['ON', 'TN', '1W', '1M', '2M', '3M', '6M', '1Y', '2Y'];
  
  const [mode, setMode] = useState('uniform'); // 'uniform' or 'byTenor'
  const [uniformBp, setUniformBp] = useState(5);
  const [tenorBp, setTenorBp] = useState({
    'ON': 20, 'TN': 15, '1W': 10, '1M': 5, '2M': 5, '3M': 5, '6M': 5, '1Y': 5, '2Y': 5
  });
  const [minimumPips, setMinimumPips] = useState(1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // localStorage에서 설정 로드
    const savedSettings = localStorage.getItem('stablefx_spread_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setMode(settings.mode || 'uniform');
        setUniformBp(settings.uniformBp || 5);
        setTenorBp(settings.tenorBp || tenorBp);
        setMinimumPips(settings.minimumPips || 1);
      } catch {}
    } else {
      // 레거시 호환: 기존 단일 값이 있으면 가져오기
      const legacySpread = localStorage.getItem('stablefx_spread_bp');
      if (legacySpread) {
        setUniformBp(Number(legacySpread));
      }
    }
  }, []);

  const handleSave = () => {
    const settings = { mode, uniformBp, tenorBp, minimumPips };
    localStorage.setItem('stablefx_spread_settings', JSON.stringify(settings));
    
    // 레거시 호환용
    localStorage.setItem('stablefx_spread_bp', String(uniformBp));
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    
    // 다른 탭에도 알림 (Landing 페이지)
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stablefx_spread_settings',
      newValue: JSON.stringify(settings),
    }));
  };

  const handleTenorBpChange = (tenor, value) => {
    setTenorBp(prev => ({ ...prev, [tenor]: Number(value) }));
  };

  return (
    <div className="bg-kustody-surface rounded-xl p-5">
      <h3 className="font-semibold mb-4">📊 Bid/Ask Spread 설정 (Landing 페이지)</h3>
      <p className="text-sm text-kustody-muted mb-4">
        Landing 페이지의 스왑포인트 조회에서 보여주는 Bid/Ask 추정 범위를 설정합니다.
      </p>
      
      {/* 모드 선택 */}
      <div className="mb-6">
        <label className="block text-sm text-kustody-muted mb-2">스프레드 적용 방식</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="spreadMode"
              checked={mode === 'uniform'}
              onChange={() => setMode('uniform')}
              className="accent-kustody-accent"
            />
            <span className="text-sm">일괄 적용</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="spreadMode"
              checked={mode === 'byTenor'}
              onChange={() => setMode('byTenor')}
              className="accent-kustody-accent"
            />
            <span className="text-sm">테너별 설정</span>
          </label>
        </div>
      </div>

      {/* 일괄 적용 */}
      {mode === 'uniform' && (
        <div className="mb-6 p-4 bg-kustody-navy/30 rounded-lg">
          <div className="flex items-center gap-4">
            <label className="text-sm text-kustody-muted">일괄 Spread:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={uniformBp}
              onChange={(e) => setUniformBp(Number(e.target.value))}
              className="w-20 px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono text-center"
            />
            <span className="text-sm text-kustody-muted">bp (연율 기준)</span>
          </div>
        </div>
      )}

      {/* 테너별 설정 */}
      {mode === 'byTenor' && (
        <div className="mb-6 p-4 bg-kustody-navy/30 rounded-lg">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {TENOR_LIST.map(tenor => (
              <div key={tenor} className="flex items-center gap-2">
                <label className="text-xs text-kustody-muted w-8">{tenor}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tenorBp[tenor]}
                  onChange={(e) => handleTenorBpChange(tenor, e.target.value)}
                  className="w-16 px-2 py-1 bg-kustody-dark border border-kustody-border rounded text-xs font-mono text-center"
                />
                <span className="text-xs text-kustody-muted">bp</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minimum Spread */}
      <div className="mb-6 p-4 bg-kustody-navy/30 rounded-lg">
        <div className="flex items-center gap-4">
          <label className="text-sm text-kustody-muted">Minimum Spread:</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={minimumPips}
            onChange={(e) => setMinimumPips(Number(e.target.value))}
            className="w-20 px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono text-center"
          />
          <span className="text-sm text-kustody-muted">전단위 (pips)</span>
        </div>
        <p className="text-xs text-kustody-muted mt-2">
          계산된 스프레드가 이 값보다 작으면 최소값이 적용됩니다.
        </p>
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-kustody-accent text-kustody-dark rounded font-semibold"
        >
          {saved ? '✓ 저장됨' : '저장'}
        </button>
        <span className="text-xs text-kustody-muted">
          저장 시 Landing 페이지에 즉시 반영됩니다.
        </span>
      </div>
      
      {/* 예시 */}
      <div className="p-3 bg-kustody-dark/50 rounded-lg">
        <p className="text-xs text-kustody-muted">
          <strong>적용 예시 (Spot 1,443 기준):</strong><br/>
          • O/N (1일), {mode === 'uniform' ? uniformBp : tenorBp['ON']}bp → 계산값 약 {((mode === 'uniform' ? uniformBp : tenorBp['ON']) / 10000 * 1443 * 1 / 360 * 100).toFixed(2)}전단위 → <span className="text-kustody-accent">Minimum {minimumPips}전단위 적용</span><br/>
          • 1M (33일), {mode === 'uniform' ? uniformBp : tenorBp['1M']}bp → 계산값 약 {((mode === 'uniform' ? uniformBp : tenorBp['1M']) / 10000 * 1443 * 33 / 360 * 100).toFixed(2)}전단위 → {((mode === 'uniform' ? uniformBp : tenorBp['1M']) / 10000 * 1443 * 33 / 360 * 100) < minimumPips ? <span className="text-kustody-accent">Minimum {minimumPips}전단위 적용</span> : '그대로 적용'}<br/>
          • 1Y (365일), {mode === 'uniform' ? uniformBp : tenorBp['1Y']}bp → 계산값 약 {((mode === 'uniform' ? uniformBp : tenorBp['1Y']) / 10000 * 1443 * 365 / 360 * 100).toFixed(2)}전단위 → 그대로 적용
        </p>
      </div>
    </div>
  );
}

// ==================== User Feedback Section ====================
function UserFeedbackSection() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const surveys = JSON.parse(localStorage.getItem('stablefx_surveys') || '[]');
    setFeedbacks(surveys.reverse());
  }, []);

  const JOB_LABELS = {
    cfo: 'CFO/경영진', treasury: '자금/재무', accounting: '회계/경리',
    trader: '트레이더/딜러', risk: '리스크 관리', backoffice: '백오피스/결제',
    it: 'IT/개발', other: '기타'
  };

  const BANK_LABELS = {
    kb: 'KB국민', shinhan: '신한', woori: '우리', hana: '하나',
    nh: 'NH농협', ibk: 'IBK기업', sc: 'SC제일', citi: '씨티',
    bnk: 'BNK', dgb: 'DGB대구', foreign: '외국계', other: '기타'
  };

  const PAIN_LABELS = {
    compare: '은행별 비교 어려움', timing: '거래 타이밍', excel: '엑셀 관리',
    report: '보고서 작성', hedge: '헤지 전략', settlement: '결제 일정'
  };

  const FEATURE_LABELS = {
    multi_bank_compare: '은행 환율 비교', realtime_pricing: '실시간 알림',
    cash_schedule: '자금 일정', hedge_dashboard: '헤지 대시보드',
    auto_report: '자동 리포팅', approval_workflow: '승인 워크플로우',
    trader_limit: '담당자 한도', audit_trail: '거래 추적', api_erp: 'ERP 연동'
  };

  const clearFeedbacks = () => {
    if (confirm('모든 피드백을 삭제하시겠습니까?')) {
      localStorage.removeItem('stablefx_surveys');
      setFeedbacks([]);
    }
  };

  // 통계 집계
  const bankCounts = feedbacks.reduce((acc, fb) => {
    fb.banks?.forEach(b => { acc[b] = (acc[b] || 0) + 1; });
    return acc;
  }, {});

  const painCounts = feedbacks.reduce((acc, fb) => {
    fb.painPoints?.forEach(p => { acc[p] = (acc[p] || 0) + 1; });
    return acc;
  }, {});

  const featureCounts = feedbacks.reduce((acc, fb) => {
    fb.features?.forEach(f => { acc[f] = (acc[f] || 0) + 1; });
    return acc;
  }, {});

  const sortedBanks = Object.entries(bankCounts).sort((a, b) => b[1] - a[1]);
  const sortedPains = Object.entries(painCounts).sort((a, b) => b[1] - a[1]);
  const sortedFeatures = Object.entries(featureCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-kustody-surface rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">💬 User Feedback ({feedbacks.length}건)</h3>
        {feedbacks.length > 0 && (
          <button onClick={clearFeedbacks} className="text-xs text-red-400 hover:text-red-300">전체 삭제</button>
        )}
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center text-kustody-muted py-8">
          아직 수집된 피드백이 없습니다.<br />
          <span className="text-xs">랜딩 페이지에서 설문을 진행하면 여기에 표시됩니다.</span>
        </div>
      ) : (
        <>
          {/* 3가지 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 주거래 은행 */}
            <div className="p-4 bg-kustody-navy/30 rounded-lg">
              <h4 className="text-xs font-semibold mb-3 text-kustody-accent">🏦 주거래 은행</h4>
              <div className="space-y-1">
                {sortedBanks.slice(0, 5).map(([bank, count]) => (
                  <div key={bank} className="flex justify-between text-xs">
                    <span className="text-kustody-muted">{BANK_LABELS[bank] || bank}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pain Points */}
            <div className="p-4 bg-kustody-navy/30 rounded-lg">
              <h4 className="text-xs font-semibold mb-3 text-red-400">😤 Pain Points</h4>
              <div className="space-y-1">
                {sortedPains.slice(0, 5).map(([pain, count]) => (
                  <div key={pain} className="flex justify-between text-xs">
                    <span className="text-kustody-muted">{PAIN_LABELS[pain] || pain}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 관심 기능 */}
            <div className="p-4 bg-kustody-navy/30 rounded-lg">
              <h4 className="text-xs font-semibold mb-3 text-green-400">⭐ 관심 기능</h4>
              <div className="space-y-1">
                {sortedFeatures.slice(0, 5).map(([feature, count]) => (
                  <div key={feature} className="flex justify-between text-xs">
                    <span className="text-kustody-muted">{FEATURE_LABELS[feature] || feature}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 개별 피드백 목록 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {feedbacks.map((fb, idx) => {
              const roleIcons = { cfo: '👔', treasury: '💰', accounting: '📊', trader: '📈', risk: '🛡️', backoffice: '📋', it: '💻', other: '👤' };
              return (
              <div key={idx} className="border border-kustody-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === idx ? null : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-kustody-navy/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{roleIcons[fb.role] || '👤'}</span>
                    <div>
                      <div className="text-sm font-medium">
                        {fb.company ? `${fb.company} · ` : ''}{JOB_LABELS[fb.role] || fb.role}
                      </div>
                      <div className="text-xs text-kustody-muted">{new Date(fb.timestamp).toLocaleString('ko-KR')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fb.banks?.length > 0 && <span className="text-xs text-blue-400">{fb.banks.length}개 은행</span>}
                    <span className="text-xs text-kustody-accent">{fb.features?.length || 0}개 기능</span>
                    <span className="text-kustody-muted">{expanded === idx ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expanded === idx && (
                  <div className="px-4 py-3 border-t border-kustody-border bg-kustody-navy/20 space-y-3">
                    {/* 거래 은행 */}
                    {fb.banks?.length > 0 && (
                      <div>
                        <span className="text-xs text-kustody-muted">거래 은행 ({fb.bankCount}):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fb.banks.map(b => (
                            <span key={b} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                              {BANK_LABELS[b] || b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Pain Points */}
                    {fb.painPoints?.length > 0 && (
                      <div>
                        <span className="text-xs text-kustody-muted">불편한 점:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fb.painPoints.map(p => (
                            <span key={p} className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                              {PAIN_LABELS[p] || p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 관심 기능 */}
                    {fb.features?.length > 0 && (
                      <div>
                        <span className="text-xs text-kustody-muted">관심 기능:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fb.features.map(f => (
                            <span key={f} className="px-2 py-0.5 bg-kustody-accent/20 text-kustody-accent text-xs rounded">
                              {FEATURE_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 추가 의견 */}
                    {fb.feedback && (
                      <div>
                        <span className="text-xs text-kustody-muted">추가 의견:</span>
                        <p className="text-sm mt-1 p-2 bg-kustody-dark rounded">{fb.feedback}</p>
                      </div>
                    )}
                    {/* 연락처 */}
                    {fb.email && (
                      <div className="text-xs">
                        <span className="text-kustody-muted">이메일:</span> 
                        <span className="font-mono ml-1">{fb.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );})}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== Usage Analytics Section ====================
function UsageAnalyticsSection() {
  const [usageLogs, setUsageLogs] = useState([]);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, all

  useEffect(() => {
    const logs = JSON.parse(localStorage.getItem('stablefx_usage') || '[]');
    setUsageLogs(logs);
  }, []);

  const clearLogs = () => {
    if (confirm('모든 사용 로그를 삭제하시겠습니까?')) {
      localStorage.removeItem('stablefx_usage');
      setUsageLogs([]);
    }
  };

  // 날짜 필터링
  const getFilteredLogs = () => {
    const now = new Date();
    let cutoff = new Date(0);
    if (dateRange === '7d') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === '30d') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    return usageLogs.filter(log => new Date(log.timestamp) >= cutoff);
  };

  const filteredLogs = getFilteredLogs();

  // 일별 통계
  const dailyStats = filteredLogs.reduce((acc, log) => {
    const date = log.timestamp.split('T')[0];
    if (!acc[date]) acc[date] = { date_calc: 0, swap_points_load: 0, swap_points_interp: 0 };
    acc[date][log.type] = (acc[date][log.type] || 0) + 1;
    return acc;
  }, {});

  const sortedDays = Object.keys(dailyStats).sort().reverse();

  // 전체 통계
  const totalStats = filteredLogs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {});

  // 테너별 통계 (date_calc)
  const tenorStats = filteredLogs
    .filter(l => l.type === 'date_calc')
    .reduce((acc, log) => {
      const tenor = log.data?.tenor || 'unknown';
      acc[tenor] = (acc[tenor] || 0) + 1;
      return acc;
    }, {});

  // 통화쌍별 통계
  const currencyStats = filteredLogs
    .filter(l => l.type === 'date_calc')
    .reduce((acc, log) => {
      const ccy = log.data?.currency || 'unknown';
      acc[ccy] = (acc[ccy] || 0) + 1;
      return acc;
    }, {});

  const totalCount = filteredLogs.length;
  const avgPerDay = sortedDays.length > 0 ? (totalCount / sortedDays.length).toFixed(1) : 0;

  return (
    <div className="bg-kustody-surface rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">📊 Usage Analytics</h3>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1 bg-kustody-dark border border-kustody-border rounded text-sm"
          >
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="all">전체</option>
          </select>
          {usageLogs.length > 0 && (
            <button onClick={clearLogs} className="text-xs text-red-400 hover:text-red-300">전체 삭제</button>
          )}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center text-kustody-muted py-8">
          아직 수집된 사용 로그가 없습니다.<br />
          <span className="text-xs">랜딩 페이지에서 조회 시 여기에 기록됩니다.</span>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-kustody-accent">{totalCount}</div>
              <div className="text-xs text-kustody-muted mt-1">총 조회수</div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-kustody-text">{avgPerDay}</div>
              <div className="text-xs text-kustody-muted mt-1">일평균</div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{totalStats.date_calc || 0}</div>
              <div className="text-xs text-kustody-muted mt-1">날짜 계산</div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{(totalStats.swap_points_load || 0) + (totalStats.swap_points_interp || 0)}</div>
              <div className="text-xs text-kustody-muted mt-1">스왑포인트</div>
            </div>
          </div>

          {/* 테너/통화 분포 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-kustody-navy/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">📈 테너별 조회</h4>
              <div className="space-y-2">
                {Object.entries(tenorStats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tenor, count]) => (
                  <div key={tenor} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-12">{tenor}</span>
                    <div className="flex-1 h-4 bg-kustody-dark rounded overflow-hidden">
                      <div 
                        className="h-full bg-blue-500/60"
                        style={{ width: `${(count / (totalStats.date_calc || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">💱 통화쌍별 조회</h4>
              <div className="space-y-2">
                {Object.entries(currencyStats).sort((a, b) => b[1] - a[1]).map(([ccy, count]) => (
                  <div key={ccy} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-16">{ccy}</span>
                    <div className="flex-1 h-4 bg-kustody-dark rounded overflow-hidden">
                      <div 
                        className="h-full bg-green-500/60"
                        style={{ width: `${(count / (totalStats.date_calc || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 일별 추이 */}
          <div className="bg-kustody-navy/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">📅 일별 추이</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-kustody-muted border-b border-kustody-border">
                    <th className="text-left py-2">날짜</th>
                    <th className="text-right py-2">날짜계산</th>
                    <th className="text-right py-2">스왑조회</th>
                    <th className="text-right py-2">스왑보간</th>
                    <th className="text-right py-2">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDays.slice(0, 14).map(date => {
                    const stats = dailyStats[date];
                    const total = (stats.date_calc || 0) + (stats.swap_points_load || 0) + (stats.swap_points_interp || 0);
                    return (
                      <tr key={date} className="border-b border-kustody-border/30">
                        <td className="py-2 font-mono">{date}</td>
                        <td className="py-2 text-right text-blue-400">{stats.date_calc || 0}</td>
                        <td className="py-2 text-right text-green-400">{stats.swap_points_load || 0}</td>
                        <td className="py-2 text-right text-yellow-400">{stats.swap_points_interp || 0}</td>
                        <td className="py-2 text-right font-semibold">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ClientPricingTab;
