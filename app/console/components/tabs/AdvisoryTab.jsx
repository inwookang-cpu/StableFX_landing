'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import { formatNumber } from '../../services/formatters';

import { 
  DateRuleCalculator, 
  formatDate,
  getDayName
} from '../../../../lib/dateCalculator';

function AdvisoryTab({ config, addTrade, selectedClientId, setSelectedClientId, pricingNotional, setPricingNotional, sharedCurveData }) {
  const [curveData, setCurveData] = useState(null);
  const [nearDate, setNearDate] = useState('2020-03-04'); // Swap Near leg (Start)
  const [farDate, setFarDate] = useState('2020-04-06'); // Swap Far leg (Maturity) / Outright 결제일
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [queryLog, setQueryLog] = useState([]); // 조회 로그 (tracking용)
  const [tradeType, setTradeType] = useState('swap'); // 'outright' | 'swap'
  const [direction, setDirection] = useState('borrow_usd'); // outright: 'buy'|'sell', swap: 'borrow_usd'|'lend_usd'
  const [proMode, setProMode] = useState(false); // Pro Mode 토글
  const [usdMmda, setUsdMmda] = useState(4.5); // USD MMDA 금리 (%)
  const [krwMmda, setKrwMmda] = useState(3.0); // KRW 고금리통장 금리 (%)
  
  // 네이버 환율 state
  const [liveSpot, setLiveSpot] = useState(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [naverLastUpdate, setNaverLastUpdate] = useState(null);
  
  const [tradeForm, setTradeForm] = useState({ 
    instrument: 'FX_SWAP',      // 'FX_SWAP' | 'OUTRIGHT'
    direction: 'B/S',           // FX Swap: 'B/S' | 'S/B', Outright: 'Buy' | 'Sell'
    tradeDate: new Date().toISOString().split('T')[0],
    nearDate: '',
    farDate: '',
    spotRate: 0,
    swapPoint: 0,
    farRate: 0,
    ccy1: 'USD',
    ccy2: 'KRW',
    nearCcy1Amt: 0,
    farCcy1Amt: 0,
    nearCcy2Amt: 0,
    farCcy2Amt: 0,
    counterParty: '', 
    trader: '' 
  });
  
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
      const response = await fetch('/api/naver-rates');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.rates?.USDKRW) {
          const rateObj = result.rates.USDKRW;
          const rate = typeof rateObj === 'object' ? rateObj.rate : rateObj;
          setLiveSpot(rate);
          setNaverLastUpdate(new Date(now));
          
          // 전역 캐시 업데이트
          naverRateCache.data = result.rates;
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

  // sharedCurveData (Curves 탭에서 이미 spread 적용됨)를 사용
  useEffect(() => {
    if (sharedCurveData) {
      setCurveData(sharedCurveData);
      
      const spotDate = sharedCurveData.curves?.USDKRW?.USD?.spotDate;
      if (spotDate) {
        setNearDate(spotDate);
        const m = new Date(spotDate);
        m.setMonth(m.getMonth() + 1);
        setFarDate(m.toISOString().split('T')[0]);
      }
    }
    
    // 조회 로그 로드
    const saved = localStorage.getItem('kustodyfi_query_log');
    if (saved) try { setQueryLog(JSON.parse(saved)); } catch(e) {}
  }, [sharedCurveData]);

  // Spot 환율: liveSpot(네이버 실시간) > curveData > fallback
  const spot = liveSpot || curveData?.spotRates?.USDKRW || 1443.00;
  const fxSwapPoints = curveData?.curves?.USDKRW?.fxSwapPoints || [];

  // 선택된 고객
  const selectedClient = config.clients?.find(c => c.clientId === selectedClientId);
  const creditTier = selectedClient ? config.creditTiers?.[selectedClient.creditTier] : null;
  const isBlocked = selectedClient?.creditTier === 5;

  // 마진 계산 (Client Pricing과 동일)
  const calculateMargin = () => {
    if (!selectedClient || isBlocked) return { credit: 0, notional: 0, total: 0 };
    let creditMargin = 0, notionalMargin = 0;
    if (!selectedClient.overrides?.ignoreCredit && creditTier) {
      creditMargin = selectedClient.marginType === 'bp' ? (creditTier.bpMargin || 0) * 33 / 365 * spot / 10000 : (creditTier.pointMargin || 0);
    }
    if (!selectedClient.overrides?.ignoreNotional) {
      const tier = config.notionalTiers?.find(t => pricingNotional >= t.min && (t.max === null || pricingNotional < t.max));
      notionalMargin = tier?.margin || 0;
    }
    if (selectedClient.overrides?.customMargin !== null && selectedClient.overrides?.customMargin !== undefined) {
      return { credit: 0, notional: 0, total: selectedClient.overrides.customMargin };
    }
    return { credit: creditMargin, notional: notionalMargin, total: creditMargin + notionalMargin };
  };
  const margin = calculateMargin();

  // 마진 적용된 Bid/Ask
  const getClientPoints = (basePoints, baseBid, baseAsk) => {
    const marginInWon = margin.total / 100;
    return {
      bid: baseBid !== null ? baseBid - marginInWon : null,
      ask: baseAsk !== null ? baseAsk + marginInWon : null,
      mid: basePoints
    };
  };

  // 보간 함수
  const interpolateValue = (days, getValue) => {
    if (days <= 0) return 0;
    const sorted = fxSwapPoints.filter(p => p.days > 0).sort((a, b) => a.days - b.days);
    if (sorted.length === 0) return 0;
    const exact = sorted.find(p => p.days === days);
    if (exact) return getValue(exact);
    if (days < sorted[0].days) return getValue(sorted[0]) * days / sorted[0].days;
    if (days > sorted[sorted.length - 1].days) return getValue(sorted[sorted.length - 1]) * days / sorted[sorted.length - 1].days;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].days <= days && sorted[i + 1].days >= days) {
        const ratio = (days - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
        return getValue(sorted[i]) + (getValue(sorted[i + 1]) - getValue(sorted[i])) * ratio;
      }
    }
    return 0;
  };

  // 원화 환산
  const krwAmount = pricingNotional * spot;

  const handleQuery = () => {
    if (!selectedClient) { alert('고객을 먼저 선택해주세요.'); return; }
    if (isBlocked) { alert('거래가 제한된 고객입니다.'); return; }
    
    const spotDateObj = new Date(curveData?.curves?.USDKRW?.USD?.spotDate);
    const targetDate = new Date(farDate);
    const days = Math.round((targetDate - spotDateObj) / (1000 * 60 * 60 * 24));
    
    // Near leg days (Swap용)
    const nearDateObj = new Date(nearDate);
    const nearDays = Math.round((nearDateObj - spotDateObj) / (1000 * 60 * 60 * 24));
    
    const midPoints = interpolateValue(days, p => p.points);
    const bidPoints = interpolateValue(days, p => p.bid);
    const askPoints = interpolateValue(days, p => p.ask);
    const clientPts = getClientPoints(midPoints, bidPoints, askPoints);
    
    // 적용 환율 결정 (방향에 따라)
    // Outright: buy→Ask, sell→Bid
    // Swap B/S (외화 차입): Far에서 USD 매도→Bid, Swap S/B (외화 대여): Far에서 USD 매수→Ask
    const appliedRate = (direction === 'buy' || direction === 'lend_usd')
      ? (clientPts.ask !== null ? spot + clientPts.ask : spot + midPoints)
      : (clientPts.bid !== null ? spot + clientPts.bid : spot + midPoints);
    
    const queryData = {
      nearDate: tradeType === 'swap' ? nearDate : null,
      farDate,
      nearDays: tradeType === 'swap' ? nearDays : null,
      days,
      points: midPoints,
      bid: clientPts.bid,
      ask: clientPts.ask,
      forwardRate: spot + midPoints,
      clientBidRate: clientPts.bid !== null ? spot + clientPts.bid : null,
      clientAskRate: clientPts.ask !== null ? spot + clientPts.ask : null,
      appliedRate,
      tradeType,
      direction,
      timestamp: Date.now(),
      clientId: selectedClientId,
      clientName: selectedClient.clientName,
      notional: pricingNotional,
      krwAmount,
      margin: margin.total
    };
    
    setLastQuery(queryData);
    
    // tradeForm 업데이트 (모든 필드 채우기)
    const instrument = tradeType === 'outright' ? 'OUTRIGHT' : 'FX_SWAP';
    const swapPoint = direction === 'borrow_usd' || direction === 'sell' ? clientPts.bid : clientPts.ask;
    const nearCcy2 = pricingNotional * spot;
    const farCcy2 = pricingNotional * appliedRate;
    
    // Direction 변환: borrow_usd -> B/S, lend_usd -> S/B, buy -> Buy, sell -> Sell
    const directionLabel = 
      direction === 'borrow_usd' ? 'B/S' :
      direction === 'lend_usd' ? 'S/B' :
      direction === 'buy' ? 'Buy' : 'Sell';
    
    setTradeForm({ 
      instrument,
      direction: directionLabel,
      tradeDate: new Date().toISOString().split('T')[0],
      nearDate: tradeType === 'swap' ? nearDate : '',
      farDate: farDate,
      spotRate: spot,
      swapPoint: swapPoint || 0,
      farRate: appliedRate,
      ccy1: 'USD',
      ccy2: 'KRW',
      nearCcy1Amt: pricingNotional,
      farCcy1Amt: pricingNotional,  // Even Swap이므로 같은 값
      nearCcy2Amt: nearCcy2,
      farCcy2Amt: farCcy2,
      counterParty: '',
      trader: ''
    });
    
    // 조회 로그 저장 (tracking)
    const newLog = [...queryLog, queryData].slice(-100); // 최근 100건만
    setQueryLog(newLog);
    localStorage.setItem('kustodyfi_query_log', JSON.stringify(newLog));
    
    setCountdown(10);
    const timer = setInterval(() => { setCountdown(prev => { if (prev <= 1) { clearInterval(timer); setShowTradeForm(true); return null; } return prev - 1; }); }, 1000);
  };

  const handleSaveTrade = () => {
    addTrade({ 
      ...tradeForm, 
      clientId: selectedClientId,
      queryTimestamp: lastQuery?.timestamp, 
      fairValue: lastQuery?.forwardRate 
    });
    setShowTradeForm(false); 
    setCountdown(null); 
    setLastQuery(null); 
    alert('거래가 기록되었습니다!');
  };

  const optimal = fxSwapPoints.filter(p => p.days > 0 && p.days <= 90).sort((a, b) => Math.abs(a.points) / a.days - Math.abs(b.points) / b.days)[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더: 타이틀 + 고객 선택 + Spot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">🎯 Customer Advisory</h2>
            <p className="text-sm text-kustody-muted mt-1">공정가치 조회 및 최적 전략 추천</p>
          </div>
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-4 py-2 bg-kustody-surface border border-kustody-border rounded-lg text-sm">
            <option value="">-- 고객 선택 --</option>
            {config.clients?.filter(c => c.creditTier !== 5).map(c => (
              <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
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
                {liveSpot ? liveSpot.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : formatNumber(spot, 3)}
              </div>
              {naverLastUpdate && (
                <div className="text-xs text-kustody-muted">{naverLastUpdate.toLocaleTimeString('ko-KR')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedClient && !isBlocked && (
        <>
          {/* FX Swap Points 테이블 */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">📊 FX Swap Points</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-kustody-muted">Pro Mode</span>
                  <button onClick={() => setProMode(!proMode)} 
                    className={`w-10 h-5 rounded-full transition-colors ${proMode ? 'bg-kustody-accent' : 'bg-kustody-border'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${proMode ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                  </button>
                </label>
                <span className="text-xs text-kustody-muted">USDKRW · 전단위</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                    <th className="text-left py-2 px-2">Tenor</th>
                    <th className="text-left py-2 px-2">Start</th>
                    <th className="text-left py-2 px-2">Maturity</th>
                    <th className="text-right py-2 px-2">Days</th>
                    <th className="text-right py-2 px-2">Screen</th>
                    <th className="text-right py-2 px-2 text-kustody-accent">Sp/Day</th>
                    {proMode && <th className="text-right py-2 px-2 text-yellow-400">Indic_rate</th>}
                    <th className="text-right py-2 px-2 text-red-400">Bid</th>
                    <th className="text-right py-2 px-2 text-green-400">Ask</th>
                  </tr>
                </thead>
                <tbody>
                  {fxSwapPoints.map(p => {
                    const clientPts = getClientPoints(p.points, p.bid, p.ask);
                    // 표시용 days: Start에서 Maturity까지의 실제 기간
                    const displayDays = p.start && p.maturity 
                      ? Math.round((new Date(p.maturity) - new Date(p.start)) / (1000 * 60 * 60 * 24))
                      : (p.days > 0 ? p.days : 1);
                    // Screen은 전단위 (×100)
                    const screenPips = p.points !== null ? Math.round(p.points * 100) : null;
                    // Sp/Day도 전단위 기준으로 계산
                    const spDay = (displayDays > 0 && screenPips !== null) ? (screenPips / displayDays).toFixed(2) : '-';
                    const indicRate = (displayDays > 0 && p.points !== null) ? ((p.points / displayDays / spot) * 365 * 100).toFixed(2) + '%' : '-';
                    return (
                      <tr key={p.tenor} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                        <td className="py-2 px-2 font-semibold">{p.tenor}</td>
                        <td className="py-2 px-2 font-mono text-xs text-kustody-muted">{p.start || '-'}</td>
                        <td className="py-2 px-2 font-mono text-xs text-kustody-muted">{p.maturity || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono">{displayDays}</td>
                        <td className="py-2 px-2 text-right font-mono">{screenPips !== null ? screenPips : '-'}</td>
                        <td className="py-2 px-2 text-right font-mono text-kustody-accent">{spDay}</td>
                        {proMode && <td className="py-2 px-2 text-right font-mono text-yellow-400">{indicRate}</td>}
                        <td className="py-2 px-2 text-right font-mono text-red-400">{clientPts.bid !== null ? Math.round(clientPts.bid * 100) : '-'}</td>
                        <td className="py-2 px-2 text-right font-mono text-green-400">{clientPts.ask !== null ? Math.round(clientPts.ask * 100) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 공정가치 조회 */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <h3 className="font-semibold mb-4">📈 Point Interpolation - {selectedClient.clientName}</h3>
            
            {/* 거래 유형 선택 */}
            <div className="mb-5 p-4 bg-kustody-navy/30 rounded-lg">
              <div className="grid grid-cols-2 gap-6">
                {/* 거래 유형 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">거래 유형</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setTradeType('outright'); setDirection('sell'); }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tradeType === 'outright' ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                      📤 단방향 (Outright)
                    </button>
                    <button onClick={() => { setTradeType('swap'); setDirection('borrow_usd'); }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tradeType === 'swap' ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                      🔄 스왑 (FX Swap)
                    </button>
                  </div>
                </div>
                
                {/* 방향 선택 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">
                    {tradeType === 'outright' ? '거래 방향' : '무엇이 먼저 필요하세요?'}
                  </label>
                  {tradeType === 'outright' ? (
                    <div className="flex gap-2">
                      <button onClick={() => setDirection('sell')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${direction === 'sell' ? 'bg-red-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        🔴 외화 매도 (Sell USD)
                      </button>
                      <button onClick={() => setDirection('buy')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${direction === 'buy' ? 'bg-green-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        🟢 외화 매수 (Buy USD)
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setDirection('borrow_usd')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${direction === 'borrow_usd' ? 'bg-blue-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        <div className="font-semibold">💵 외화가 먼저 필요해요</div>
                        <div className="text-xs opacity-80">외화 빌렸다가 갚기 (B/S)</div>
                      </button>
                      <button onClick={() => setDirection('lend_usd')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${direction === 'lend_usd' ? 'bg-purple-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        <div className="font-semibold">💴 원화가 먼저 필요해요</div>
                        <div className="text-xs opacity-80">외화 빌려줬다가 받기 (S/B)</div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 설명 */}
              <div className="mt-3 text-xs text-kustody-muted">
                {tradeType === 'outright' ? (
                  direction === 'buy' 
                    ? '💡 외화를 사서 보유합니다. 결제일에 원화를 지급하고 외화를 받습니다.'
                    : '💡 외화를 팔아 원화를 받습니다. 결제일에 외화를 지급하고 원화를 받습니다.'
                ) : (
                  direction === 'borrow_usd'
                    ? '💡 지금 외화를 빌리고(매수), 만기에 외화를 갚습니다(매도). 단기 외화 자금 필요 시 유용합니다.'
                    : '💡 지금 외화를 빌려주고(매도), 만기에 외화를 돌려받습니다(매수). 외화 여유자금 운용 시 유용합니다.'
                )}
              </div>
            </div>
            
            {/* 조회 입력 */}
            <div className={`grid ${tradeType === 'swap' ? 'grid-cols-6' : 'grid-cols-5'} gap-4 mb-4`}>
              {tradeType === 'swap' && (
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">
                    {direction === 'borrow_usd' ? '💵 외화 빌리는 날' : '💴 외화 빌려주는 날'}
                  </label>
                  <input type="date" value={nearDate} onChange={(e) => setNearDate(e.target.value)}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm" />
                </div>
              )}
              <div>
                <label className="block text-xs text-kustody-muted mb-1">
                  {tradeType === 'swap' 
                    ? (direction === 'borrow_usd' ? '💵 외화 갚을 날' : '💴 외화 돌려받을 날')
                    : '결제일'}
                </label>
                <input type="date" value={farDate} onChange={(e) => setFarDate(e.target.value)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm" />
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Notional (USD)</label>
                <input 
                  type="text" 
                  value={formatNumber(pricingNotional, 0)} 
                  onChange={(e) => setPricingNotional(parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm" />
                {pricingNotional > 0 && (
                  <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(pricingNotional)}</div>
                )}
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">원화 환산</label>
                <div className="px-3 py-2 bg-kustody-navy rounded-lg font-mono text-sm">₩{formatNumber(krwAmount, 0)}</div>
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">
                  Forward Points (전단위)
                  {lastQuery && <span className="ml-1 text-kustody-accent">
                    {(direction === 'sell' || direction === 'borrow_usd') ? '(Bid)' : '(Ask)'}
                  </span>}
                </label>
                <div className={`px-3 py-2 bg-kustody-navy rounded-lg font-mono ${
                  (direction === 'sell' || direction === 'borrow_usd') ? 'text-red-400' : 'text-green-400'
                }`}>
                  {lastQuery 
                    ? ((direction === 'sell' || direction === 'borrow_usd') 
                        ? (lastQuery.bid !== null ? Math.round(lastQuery.bid * 100) : '-')
                        : (lastQuery.ask !== null ? Math.round(lastQuery.ask * 100) : '-'))
                    : '-'}
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={handleQuery} className="w-full px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-semibold">조회</button>
              </div>
            </div>

            {lastQuery && (
              <div className="bg-kustody-navy/50 rounded-lg p-4">
                {/* 거래 유형 표시 */}
                <div className="mb-3 pb-3 border-b border-kustody-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-sm font-semibold ${tradeType === 'outright' ? 'bg-kustody-accent/20 text-kustody-accent' : 'bg-blue-500/20 text-blue-400'}`}>
                      {tradeType === 'outright' ? '📤 Outright' : '🔄 FX Swap'}
                    </span>
                    <span className={`px-3 py-1 rounded text-sm ${
                      direction === 'buy' ? 'bg-green-500/20 text-green-400' :
                      direction === 'sell' ? 'bg-red-500/20 text-red-400' :
                      direction === 'borrow_usd' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {direction === 'buy' ? '매수 (Buy)' :
                       direction === 'sell' ? '매도 (Sell)' :
                       direction === 'borrow_usd' ? 'B/S (외화 차입)' :
                       'S/B (외화 대여)'}
                    </span>
                  </div>
                  <div className="text-sm font-mono">
                    <span className="text-kustody-muted">Days: </span>
                    <span className="text-kustody-accent font-semibold">{lastQuery.days}</span>
                  </div>
                </div>
                
                {tradeType === 'swap' ? (
                  /* Swap 결과 - 빌리는/갚는 환율 */
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '💵 빌리는 날' : '💴 빌려주는 날'}
                      </div>
                      <div className="font-mono text-blue-400 mb-3">{lastQuery.nearDate}</div>
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '빌리는 환율 (Near)' : '빌려주는 환율 (Near)'}
                      </div>
                      <div className="font-mono text-2xl font-semibold">{formatNumber(spot, 2)}</div>
                      <div className="text-xs text-kustody-muted mt-1">Spot Rate</div>
                    </div>
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '💵 갚을 날' : '💴 돌려받을 날'}
                      </div>
                      <div className="font-mono text-blue-400 mb-3">{lastQuery.farDate}</div>
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '갚는 환율 (Far)' : '돌려받는 환율 (Far)'}
                      </div>
                      <div className={`font-mono text-2xl font-semibold ${direction === 'borrow_usd' ? 'text-red-400' : 'text-green-400'}`}>
                        {formatNumber(lastQuery.appliedRate, 2)}
                      </div>
                      <div className="text-xs text-kustody-muted mt-1">
                        Spot {direction === 'borrow_usd' ? '+' : '+'} {direction === 'borrow_usd' 
                          ? (lastQuery.bid !== null ? (lastQuery.bid).toFixed(2) : '-')
                          : (lastQuery.ask !== null ? (lastQuery.ask).toFixed(2) : '-')} 원
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Outright 결과 */
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">결제일</div>
                      <div className="font-mono text-blue-400 text-lg">{lastQuery.farDate}</div>
                    </div>
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'buy' ? '매수 환율' : '매도 환율'}
                      </div>
                      <div className={`font-mono text-2xl font-semibold ${direction === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(lastQuery.appliedRate, 2)}
                      </div>
                      <div className="text-xs text-kustody-muted mt-1">
                        {direction === 'buy' ? 'Ask' : 'Bid'} Rate
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {countdown && <div className="mt-4 text-center text-kustody-muted">거래 여부 확인까지 <span className="text-kustody-accent font-mono">{countdown}</span>초...</div>}
          </div>

          {/* 최적 구간 추천 */}
          {optimal && (
            <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-5">
              <h3 className="font-semibold mb-2 text-kustody-accent">⭐ 최적 구간 추천</h3>
              <p className="text-sm">일정에 이슈가 없다면, <span className="font-semibold text-kustody-accent">{optimal.tenor} ({optimal.days}일)</span>이 carry 효율이 가장 좋습니다. (Sp/Day: {(optimal.points * 100 / optimal.days).toFixed(2)})</p>
            </div>
          )}

          {/* 기회비용 비교 */}
          {lastQuery && tradeType === 'swap' && (
            <div className="bg-kustody-surface rounded-xl p-5 border border-kustody-border">
              <h3 className="font-semibold mb-4 text-kustody-accent">💰 기회비용 비교</h3>
              
              {/* 금리 입력 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-kustody-muted">USD MMDA:</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={usdMmda} 
                    onChange={(e) => setUsdMmda(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-kustody-dark border border-kustody-border rounded font-mono text-sm text-center" 
                  />
                  <span className="text-sm text-kustody-muted">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-kustody-muted">KRW MMDA:</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={krwMmda} 
                    onChange={(e) => setKrwMmda(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-kustody-dark border border-kustody-border rounded font-mono text-sm text-center" 
                  />
                  <span className="text-sm text-kustody-muted">%</span>
                </div>
              </div>

              {(() => {
                const days = lastQuery.days;
                const swapPoint = direction === 'borrow_usd' ? lastQuery.bid : lastQuery.ask;
                
                // 캐시플로우 계산
                const nearKrw = pricingNotional * spot;
                const farKrw = pricingNotional * (spot + swapPoint);
                const swapCostKrw = nearKrw - farKrw; // B/S: 양수면 비용, S/B: 음수면 비용
                
                let option1Label, option1Cost, option1Detail;
                let option2Label, option2Cost, option2Detail;
                let recommendation, analysis;
                
                if (direction === 'borrow_usd') {
                  // B/S: USD 필요 → KRW 담보로 USD 빌림
                  // Option 1: FX Swap B/S
                  //   - Swap 비용 (KRW 차이)
                  //   - KRW 기회비용 (담보 묶임)
                  const krwOpportunityCost = nearKrw * (krwMmda / 100) * (days / 365);
                  const totalSwapCost = swapCostKrw + krwOpportunityCost;
                  const swapAnnualized = (totalSwapCost / nearKrw) * (365 / days) * 100;
                  
                  option1Label = 'FX Swap B/S';
                  option1Cost = totalSwapCost;
                  option1Detail = {
                    swapCost: swapCostKrw,
                    opportunityCost: krwOpportunityCost,
                    annualized: swapAnnualized
                  };
                  
                  // Option 2: USD MMDA 해지
                  //   - USD 이자 포기
                  const usdInterestForgone = pricingNotional * (usdMmda / 100) * (days / 365);
                  const usdInterestForgoneKrw = usdInterestForgone * spot;
                  
                  option2Label = 'USD MMDA 해지';
                  option2Cost = usdInterestForgoneKrw;
                  option2Detail = {
                    usdInterest: usdInterestForgone,
                    krwEquivalent: usdInterestForgoneKrw,
                    annualized: usdMmda
                  };
                  
                  // 비교
                  if (option1Cost < option2Cost) {
                    recommendation = 'swap';
                    analysis = `FX Swap이 ${formatNumber(option2Cost - option1Cost, 0)}원 유리. USD MMDA ${usdMmda}% 유지하면서 저렴하게 USD 조달`;
                  } else {
                    recommendation = 'mmda';
                    analysis = `USD MMDA 해지가 ${formatNumber(option1Cost - option2Cost, 0)}원 유리. Swap 비용 + KRW 기회비용이 더 큼`;
                  }
                  
                } else {
                  // S/B: KRW 필요 → USD 담보로 KRW 빌림
                  // Option 1: FX Swap S/B
                  //   - Swap 비용/수익 (KRW 차이, S/B면 부호 반대)
                  //   - USD 기회비용 (담보 묶임)
                  const usdOpportunityCost = pricingNotional * (usdMmda / 100) * (days / 365);
                  const usdOpportunityCostKrw = usdOpportunityCost * spot;
                  const sbSwapCost = -swapCostKrw; // S/B는 부호 반대
                  const totalSwapCost = sbSwapCost + usdOpportunityCostKrw;
                  const swapAnnualized = (totalSwapCost / nearKrw) * (365 / days) * 100;
                  
                  option1Label = 'FX Swap S/B';
                  option1Cost = totalSwapCost;
                  option1Detail = {
                    swapCost: sbSwapCost,
                    opportunityCost: usdOpportunityCostKrw,
                    usdOpportunityCostRaw: usdOpportunityCost,
                    annualized: swapAnnualized
                  };
                  
                  // Option 2: KRW MMDA 해지
                  //   - KRW 이자 포기
                  const krwInterestForgone = nearKrw * (krwMmda / 100) * (days / 365);
                  
                  option2Label = 'KRW MMDA 해지';
                  option2Cost = krwInterestForgone;
                  option2Detail = {
                    krwInterest: krwInterestForgone,
                    annualized: krwMmda
                  };
                  
                  // 비교
                  if (option1Cost < option2Cost) {
                    recommendation = 'swap';
                    analysis = `FX Swap이 ${formatNumber(option2Cost - option1Cost, 0)}원 유리. KRW MMDA ${krwMmda}% 유지하면서 저렴하게 KRW 조달`;
                  } else {
                    recommendation = 'mmda';
                    analysis = `KRW MMDA 해지가 ${formatNumber(option1Cost - option2Cost, 0)}원 유리. Swap 비용 + USD 기회비용이 더 큼`;
                  }
                }

                return (
                  <div className="space-y-4">
                    {/* 두 옵션 비교 */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Option 1: FX Swap */}
                      <div className={`rounded-lg p-4 border ${recommendation === 'swap' ? 'bg-green-500/10 border-green-500/50' : 'bg-kustody-navy/50 border-kustody-border'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold">{option1Label}</span>
                          {recommendation === 'swap' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">추천</span>}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-kustody-muted">Swap 비용:</span>
                            <span className={`font-mono ${option1Detail.swapCost >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {option1Detail.swapCost >= 0 ? '' : '+'}₩{formatNumber(Math.abs(option1Detail.swapCost), 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-kustody-muted">
                              {direction === 'borrow_usd' ? 'KRW' : 'USD'} 기회비용:
                            </span>
                            <span className="font-mono text-red-400">
                              ₩{formatNumber(option1Detail.opportunityCost, 0)}
                              {direction === 'lend_usd' && <span className="text-xs text-kustody-muted ml-1">(${formatNumber(option1Detail.usdOpportunityCostRaw, 0)})</span>}
                            </span>
                          </div>
                          <div className="border-t border-kustody-border pt-2 flex justify-between font-semibold">
                            <span>합계:</span>
                            <span className="font-mono text-red-400">₩{formatNumber(option1Cost, 0)}</span>
                          </div>
                          <div className="text-xs text-kustody-muted text-right">
                            연율화: {option1Detail.annualized.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* Option 2: MMDA 해지 */}
                      <div className={`rounded-lg p-4 border ${recommendation === 'mmda' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-kustody-navy/50 border-kustody-border'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold">{option2Label}</span>
                          {recommendation === 'mmda' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">추천</span>}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-kustody-muted">이자 포기:</span>
                            <span className="font-mono text-red-400">
                              {direction === 'borrow_usd' 
                                ? `$${formatNumber(option2Detail.usdInterest, 0)}`
                                : `₩${formatNumber(option2Detail.krwInterest, 0)}`}
                            </span>
                          </div>
                          {direction === 'borrow_usd' && (
                            <div className="flex justify-between">
                              <span className="text-kustody-muted">원화 환산:</span>
                              <span className="font-mono text-red-400">₩{formatNumber(option2Detail.krwEquivalent, 0)}</span>
                            </div>
                          )}
                          <div className="border-t border-kustody-border pt-2 flex justify-between font-semibold">
                            <span>합계:</span>
                            <span className="font-mono text-red-400">₩{formatNumber(option2Cost, 0)}</span>
                          </div>
                          <div className="text-xs text-kustody-muted text-right">
                            연율화: {option2Detail.annualized.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 결론 */}
                    <div className={`rounded-lg p-4 ${recommendation === 'swap' ? 'bg-green-500/10 border border-green-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{recommendation === 'swap' ? '🔄' : '🏦'}</span>
                        <span className={`font-semibold ${recommendation === 'swap' ? 'text-green-400' : 'text-blue-400'}`}>
                          {recommendation === 'swap' ? option1Label + ' 추천' : option2Label + ' 추천'}
                        </span>
                      </div>
                      <p className="text-sm text-kustody-muted">{analysis}</p>
                    </div>

                    {/* 계산 기준 */}
                    <div className="text-xs text-kustody-muted bg-kustody-dark/30 rounded p-3">
                      <div className="font-semibold mb-1">계산 기준</div>
                      <div>• Notional: USD {formatUsdKorean(pricingNotional)} | 기간: {days}일</div>
                      <div>• Near KRW: ₩{formatNumber(nearKrw, 0)} (Spot {formatNumber(spot, 2)})</div>
                      <div>• Far KRW: ₩{formatNumber(farKrw, 0)} (Spot {swapPoint >= 0 ? '+' : ''}{swapPoint.toFixed(2)})</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Uneven Swap 관심도 수집 */}
          {selectedClient && tradeType === 'swap' && (
            <div className="bg-kustody-surface rounded-xl p-4 border border-kustody-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-kustody-muted">Near/Far 금액이 다른 <span className="text-kustody-accent font-semibold">Uneven Swap</span>이 필요하신가요?</p>
                  <p className="text-xs text-kustody-muted mt-1">현재는 Even Swap만 지원됩니다</p>
                </div>
                <button 
                  onClick={() => {
                    const existing = JSON.parse(localStorage.getItem('stablefx_feature_interest') || '{}');
                    existing.unevenSwap = (existing.unevenSwap || 0) + 1;
                    existing.lastClicked = new Date().toISOString();
                    localStorage.setItem('stablefx_feature_interest', JSON.stringify(existing));
                    alert('관심 등록되었습니다! Uneven Swap 기능 개발 시 반영하겠습니다.');
                  }}
                  className="px-4 py-2 bg-kustody-navy hover:bg-kustody-accent/20 border border-kustody-border rounded-lg text-sm transition-colors"
                >
                  🙋 필요해요
                </button>
              </div>
            </div>
          )}

          {/* 거래 기록 폼 */}
          {showTradeForm && (
            <div className="bg-kustody-surface rounded-xl p-5 border-2 border-kustody-accent">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">📝 거래 기록</h3>
                <div className="text-xs text-kustody-muted">* 실제 거래 조건을 입력하세요</div>
              </div>
              
              {/* 기본 정보 */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">Instrument</label>
                  <select 
                    value={tradeForm.instrument} 
                    onChange={(e) => {
                      const inst = e.target.value;
                      const dir = inst === 'FX_SWAP' ? 'B/S' : 'Buy';
                      setTradeForm({...tradeForm, instrument: inst, direction: dir});
                    }}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="FX_SWAP">🔄 FX Swap</option>
                    <option value="OUTRIGHT">📤 Outright</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">Direction</label>
                  <select 
                    value={tradeForm.direction} 
                    onChange={(e) => setTradeForm({...tradeForm, direction: e.target.value})}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    {tradeForm.instrument === 'FX_SWAP' ? (
                      <>
                        <option value="B/S">B/S (외화 차입)</option>
                        <option value="S/B">S/B (외화 대여)</option>
                      </>
                    ) : (
                      <>
                        <option value="Buy">Buy (매수)</option>
                        <option value="Sell">Sell (매도)</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">거래일</label>
                  <input type="date" value={tradeForm.tradeDate} 
                    onChange={(e) => setTradeForm({...tradeForm, tradeDate: e.target.value})} 
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">거래상대방</label>
                  <select value={tradeForm.counterParty} onChange={(e) => setTradeForm({...tradeForm, counterParty: e.target.value})} 
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="">선택</option>
                    {(config.counterParties || []).map(cp => <option key={cp.cpId} value={cp.cpId}>{cp.name}</option>)}
                  </select>
                </div>
              </div>

              {/* FX Swap 상세 */}
              {tradeForm.instrument === 'FX_SWAP' && (
                <div className="bg-kustody-navy/30 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Near Leg */}
                    <div>
                      <div className="text-sm font-semibold text-blue-400 mb-3">
                        Near Leg {tradeForm.direction === 'B/S' ? '(USD 매수)' : '(USD 매도)'}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Near Date</label>
                            <input type="date" value={tradeForm.nearDate} 
                              onChange={(e) => setTradeForm({...tradeForm, nearDate: e.target.value})}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Start Rate</label>
                            <input type="number" step="0.01" value={tradeForm.spotRate || ''} 
                              onChange={(e) => {
                                const spotRate = parseFloat(e.target.value) || 0;
                                const farRate = spotRate + tradeForm.swapPoint;
                                const nearCcy2 = tradeForm.nearCcy1Amt * spotRate;
                                const farCcy2 = tradeForm.farCcy1Amt * farRate;
                                setTradeForm({...tradeForm, spotRate, farRate, nearCcy2Amt: nearCcy2, farCcy2Amt: farCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Near CCY1 (USD)</label>
                            <input 
                              type="text" 
                              value={formatNumber(tradeForm.nearCcy1Amt, 0)} 
                              onChange={(e) => {
                                const amt = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                const nearCcy2 = amt * tradeForm.spotRate;
                                setTradeForm({...tradeForm, nearCcy1Amt: amt, nearCcy2Amt: nearCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                            <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(tradeForm.nearCcy1Amt)}</div>
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Near CCY2 (KRW)</label>
                            <div className={`px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono ${tradeForm.direction === 'B/S' ? 'text-red-400' : 'text-green-400'}`}>
                              {tradeForm.direction === 'B/S' ? '-' : '+'}{formatNumber(tradeForm.nearCcy2Amt, 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Far Leg */}
                    <div>
                      <div className="text-sm font-semibold text-purple-400 mb-3">
                        Far Leg {tradeForm.direction === 'B/S' ? '(USD 매도)' : '(USD 매수)'}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Far Date</label>
                            <input type="date" value={tradeForm.farDate} 
                              onChange={(e) => setTradeForm({...tradeForm, farDate: e.target.value})}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Swap Point</label>
                            <input type="number" step="0.01" value={tradeForm.swapPoint || ''} 
                              onChange={(e) => {
                                const swapPoint = parseFloat(e.target.value) || 0;
                                const farRate = tradeForm.spotRate + swapPoint;
                                const farCcy2 = tradeForm.farCcy1Amt * farRate;
                                setTradeForm({...tradeForm, swapPoint, farRate, farCcy2Amt: farCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Far CCY1 (USD)</label>
                            <input 
                              type="text" 
                              value={formatNumber(tradeForm.farCcy1Amt, 0)} 
                              onChange={(e) => {
                                const amt = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                const farCcy2 = amt * tradeForm.farRate;
                                setTradeForm({...tradeForm, farCcy1Amt: amt, farCcy2Amt: farCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                            <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(tradeForm.farCcy1Amt)}</div>
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Far CCY2 (KRW)</label>
                            <div className={`px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono ${tradeForm.direction === 'B/S' ? 'text-green-400' : 'text-red-400'}`}>
                              {tradeForm.direction === 'B/S' ? '+' : '-'}{formatNumber(tradeForm.farCcy2Amt, 0)}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-kustody-muted mb-1">Far Rate</label>
                          <div className="px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono">
                            {formatNumber(tradeForm.farRate, 2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Swap 요약 */}
                  <div className="mt-4 pt-4 border-t border-kustody-border/30 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-kustody-muted">기간: </span>
                      <span className="font-mono font-semibold">
                        {tradeForm.nearDate && tradeForm.farDate 
                          ? Math.round((new Date(tradeForm.farDate) - new Date(tradeForm.nearDate)) / (1000*60*60*24)) + '일'
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">USD Net: </span>
                      <span className={`font-mono ${tradeForm.nearCcy1Amt === tradeForm.farCcy1Amt ? '' : 'text-yellow-400'}`}>
                        {tradeForm.nearCcy1Amt === tradeForm.farCcy1Amt ? '0 (Even)' : formatNumber(tradeForm.farCcy1Amt - tradeForm.nearCcy1Amt, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">KRW Net: </span>
                      <span className={`font-mono font-semibold ${
                        (tradeForm.direction === 'B/S' ? 1 : -1) * (tradeForm.farCcy2Amt - tradeForm.nearCcy2Amt) >= 0 
                          ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatNumber((tradeForm.direction === 'B/S' ? 1 : -1) * (tradeForm.farCcy2Amt - tradeForm.nearCcy2Amt), 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">내재금리: </span>
                      <span className="font-mono">
                        {tradeForm.nearDate && tradeForm.farDate && tradeForm.spotRate
                          ? (((tradeForm.swapPoint / tradeForm.spotRate) * (365 / Math.round((new Date(tradeForm.farDate) - new Date(tradeForm.nearDate)) / (1000*60*60*24)))) * 100).toFixed(2) + '%'
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Outright 상세 */}
              {tradeForm.instrument === 'OUTRIGHT' && (
                <div className="bg-kustody-navy/30 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">결제일</label>
                      <input type="date" value={tradeForm.farDate} 
                        onChange={(e) => setTradeForm({...tradeForm, farDate: e.target.value})}
                        className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">CCY1 Amount (USD)</label>
                      <input 
                        type="text" 
                        value={formatNumber(tradeForm.farCcy1Amt, 0)} 
                        onChange={(e) => {
                          const amt = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          const farCcy2 = amt * tradeForm.farRate;
                          setTradeForm({...tradeForm, farCcy1Amt: amt, farCcy2Amt: farCcy2});
                        }}
                        className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                      <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(tradeForm.farCcy1Amt)}</div>
                    </div>
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">환율</label>
                      <input type="number" step="0.01" value={tradeForm.farRate || ''} 
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) || 0;
                          setTradeForm({...tradeForm, farRate: rate, farCcy2Amt: tradeForm.farCcy1Amt * rate});
                        }}
                        className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">CCY2 Amount (KRW)</label>
                      <div className={`px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono ${tradeForm.direction === 'Buy' ? 'text-red-400' : 'text-green-400'}`}>
                        {tradeForm.direction === 'Buy' ? '-' : '+'}₩{formatNumber(tradeForm.farCcy2Amt, 0)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-kustody-border/30 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-kustody-muted">USD: </span>
                      <span className={`font-mono font-semibold ${tradeForm.direction === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {tradeForm.direction === 'Buy' ? '+' : '-'}{formatNumber(tradeForm.farCcy1Amt, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">KRW: </span>
                      <span className={`font-mono font-semibold ${tradeForm.direction === 'Buy' ? 'text-red-400' : 'text-green-400'}`}>
                        {tradeForm.direction === 'Buy' ? '-' : '+'}₩{formatNumber(tradeForm.farCcy2Amt, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 거래자 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">거래자</label>
                  <select value={tradeForm.trader} onChange={(e) => setTradeForm({...tradeForm, trader: e.target.value})} 
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="">선택</option>
                    {(config.users || []).filter(u => u.role === 'trader').map(u => <option key={u.userId} value={u.userId}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSaveTrade} className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded font-semibold">💾 저장</button>
                <button onClick={() => setShowTradeForm(false)} className="px-4 py-2 bg-kustody-navy text-kustody-text rounded">취소</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 고객 미선택 또는 Blocked */}
      {!selectedClient && (
        <div className="bg-kustody-surface rounded-xl p-10 text-center text-kustody-muted">
          👆 고객을 선택해주세요
        </div>
      )}
      {!selectedClient && (
        <div className="bg-kustody-surface rounded-xl p-10 text-center">
          <div className="text-kustody-muted text-lg mb-2">👆 고객을 선택해주세요</div>
          <div className="text-sm text-kustody-muted">상단에서 고객을 선택하면 FX Swap Points와 조회 기능을 사용할 수 있습니다.</div>
        </div>
      )}
      {isBlocked && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-10 text-center">
          <div className="text-red-400 text-xl mb-2">🚫 거래 불가</div>
          <div className="text-kustody-muted">내부 정책에 의해 거래가 제한되었습니다.</div>
        </div>
      )}
    </div>
  );
}

export default AdvisoryTab;
