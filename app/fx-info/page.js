'use client';

import React, { useState, useEffect } from 'react';

export default function FXInfoPage() {
  const [selectedPair, setSelectedPair] = useState('USDKRW');
  const [activeTab, setActiveTab] = useState('news');
  const [loading, setLoading] = useState(false);
  
  // Supabase에서 실시간 데이터 가져오기 (나중에 연동)
  const SUPABASE_URL = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';
  
  // 샘플 데이터 (Supabase 연동 전까지)
  // EURKRW, JPYKRW Forward는 Cross rate로 계산됨
  const [fxData, setFxData] = useState({
    USDKRW: {
      name: '미국 달러', code: 'USD/KRW', rate: 1443.10, change: -5.80, changePercent: -0.40,
      dayLow: 1440.50, dayHigh: 1448.20, yearLow: 1305.80, yearHigh: 1478.50,
      open: 1448.90, prevClose: 1448.90,
      forward1M: -1.60, forward3M: -4.80, forward6M: -8.50, forward1Y: -15.20,
    },
    USDJPY: {
      name: '달러/엔', code: 'USD/JPY', rate: 156.50, change: -0.30, changePercent: -0.19,
      dayLow: 156.20, dayHigh: 157.10, yearLow: 140.00, yearHigh: 162.00,
      open: 156.80, prevClose: 156.80,
      forward1M: -0.55, forward3M: -1.65, forward6M: -3.10, forward1Y: -5.80,
    },
    EURUSD: {
      name: '유로/달러', code: 'EUR/USD', rate: 1.0850, change: 0.0012, changePercent: 0.11,
      dayLow: 1.0835, dayHigh: 1.0875, yearLow: 1.0200, yearHigh: 1.1200,
      open: 1.0838, prevClose: 1.0838,
      forward1M: 0.00135, forward3M: 0.00425, forward6M: 0.00860, forward1Y: 0.01720,
    },
    JPYKRW: {
      name: '일본 엔 (100엔)', code: 'JPY/KRW', rate: 922.11, change: -0.17, changePercent: -0.02,
      dayLow: 920.50, dayHigh: 925.20, yearLow: 880.00, yearHigh: 1020.00,
      open: 922.28, prevClose: 922.28,
      // Cross 계산: JPY DF (from USDJPY) / KRW DF (from USDKRW)
      forward1M: 2.23, forward3M: 6.73, forward6M: 13.09, forward1Y: 25.40,
    },
    EURKRW: {
      name: '유럽 유로', code: 'EUR/KRW', rate: 1565.76, change: -4.50, changePercent: -0.29,
      dayLow: 1562.00, dayHigh: 1572.50, yearLow: 1420.00, yearHigh: 1680.00,
      open: 1570.26, prevClose: 1570.26,
      // Cross 계산: EUR DF (from EURUSD) / KRW DF (from USDKRW)
      // EUR 금리 < KRW 금리 → 유로 프리미엄 (양수)
      forward1M: 0.21, forward3M: 0.90, forward6M: 3.12, forward1Y: 8.07,
    },
  });

  // Supabase에서 실시간 환율 가져오기
  const fetchSpotRates = async () => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/spot_rates?source=eq.naver&order=fetched_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        // TODO: fxData 업데이트
        console.log('Spot rates:', data);
      }
    } catch (error) {
      console.error('Failed to fetch spot rates:', error);
    }
  };

  useEffect(() => {
    fetchSpotRates();
  }, []);

  const data = fxData[selectedPair];
  if (!data) return null;
  
  const isUp = data.change >= 0;
  const dayPosition = ((data.rate - data.dayLow) / (data.dayHigh - data.dayLow)) * 100;
  const yearPosition = ((data.rate - data.yearLow) / (data.yearHigh - data.yearLow)) * 100;
  
  const formatNumber = (num, decimals = 2) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  
  // 통화쌍에 따른 포맷
  const formatRate = (rate) => {
    if (selectedPair === 'EURUSD') return rate.toFixed(4);
    return formatNumber(rate);
  };
  
  const formatPoints = (points) => {
    if (selectedPair === 'EURUSD') return (points * 10000).toFixed(1) + ' pips';
    return points.toFixed(2);
  };

  // 통화 심볼
  const getCurrencySymbol = () => {
    if (selectedPair.endsWith('KRW')) return '₩';
    if (selectedPair === 'USDJPY') return '¥';
    if (selectedPair === 'EURUSD') return '$';
    return '';
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
          <a href="/console" className="text-2xl text-gray-400 hover:text-white">‹</a>
          <div className="text-center">
            <div className="text-sm text-gray-400">{data.name}</div>
            <div className={`text-xl font-bold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
              {getCurrencySymbol()}{formatRate(data.rate)} {isUp ? '+' : ''}{data.changePercent.toFixed(2)}%
            </div>
          </div>
          <div className="flex gap-3">
            <button className="text-xl text-gray-500 hover:text-red-400">♡</button>
            <button className="text-xl text-yellow-500 hover:text-yellow-400">🔔</button>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-gray-800 scrollbar-hide">
          {Object.keys(fxData).map(pair => (
            <button 
              key={pair} 
              onClick={() => setSelectedPair(pair)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                selectedPair === pair ? 'bg-white text-black font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {pair.includes('KRW') ? pair.replace('KRW', '/KRW') : pair.replace('USD', '/USD').replace('EUR/', 'EUR/')}
            </button>
          ))}
        </div>

        {/* 시세 섹션 */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold">시세</h2>
            <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">현재가</span>
            <button 
              onClick={fetchSpotRates}
              className="ml-auto text-xs text-blue-400 hover:text-blue-300"
            >
              새로고침
            </button>
          </div>

          {/* 1일 범위 */}
          <div className="mb-5">
            <div className="relative h-1.5 bg-gradient-to-r from-blue-500 via-gray-600 to-red-500 rounded-full mb-2">
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black shadow-lg transition-all"
                style={{ left: `${Math.min(Math.max(dayPosition, 3), 97)}%`, transform: 'translate(-50%, -50%)' }} 
              />
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <div className="text-gray-500 text-xs">1일 최저가</div>
                <div className="text-gray-300">{getCurrencySymbol()}{formatRate(data.dayLow)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-xs">1일 최고가</div>
                <div className="text-gray-300">{getCurrencySymbol()}{formatRate(data.dayHigh)}</div>
              </div>
            </div>
          </div>

          {/* 1년 범위 */}
          <div className="mb-4">
            <div className="relative h-1.5 bg-gradient-to-r from-blue-500 via-gray-600 to-red-500 rounded-full mb-2">
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black shadow-lg transition-all"
                style={{ left: `${Math.min(Math.max(yearPosition, 3), 97)}%`, transform: 'translate(-50%, -50%)' }} 
              />
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <div className="text-gray-500 text-xs">1년 최저가</div>
                <div className="text-gray-300">{getCurrencySymbol()}{formatRate(data.yearLow)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-xs">1년 최고가</div>
                <div className="text-gray-300">{getCurrencySymbol()}{formatRate(data.yearHigh)}</div>
              </div>
            </div>
          </div>

          {/* 상세 정보 */}
          <div className="grid grid-cols-2 gap-3 py-3 border-t border-gray-800 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">시가</span>
              <span className="font-mono">{getCurrencySymbol()}{formatRate(data.open)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">전일종가</span>
              <span className="font-mono">{getCurrencySymbol()}{formatRate(data.prevClose)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">등락</span>
              <span className={`font-mono ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                {isUp ? '▲' : '▼'}{Math.abs(data.change).toFixed(selectedPair === 'EURUSD' ? 4 : 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">등락률</span>
              <span className={`font-mono ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                {isUp ? '+' : ''}{data.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Forward Points - 데이터 있는 경우만 */}
        {data.forward1M !== null && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold">선물환 스왑포인트</h2>
            <span className="px-1.5 py-0.5 bg-blue-900/50 rounded text-xs text-blue-300">기업전용</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '1M', value: data.forward1M },
              { label: '3M', value: data.forward3M },
              { label: '6M', value: data.forward6M },
              { label: '1Y', value: data.forward1Y }
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{label}</div>
                <div className={`font-mono font-bold text-sm ${value >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {value >= 0 ? '+' : ''}{formatPoints(value)}
                </div>
                <div className="text-xs text-gray-600">
                  {getCurrencySymbol()}{formatRate(data.rate + value)}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 p-2.5 bg-gray-900/50 rounded-lg text-xs">
            <span className="text-gray-500">💡 3개월 후 {selectedPair.startsWith('USD') ? '달러' : '유로'} 매도 시: </span>
            <span className="text-blue-400 font-mono font-bold">
              {getCurrencySymbol()}{formatRate(data.rate + data.forward3M)}
            </span>
          </div>
        </div>
        )}
        
        {/* Forward 데이터 없는 경우 안내 */}
        {data.forward1M === null && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold">선물환 스왑포인트</h2>
            <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400">준비중</span>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center text-sm text-gray-500">
            {data.name} 선물환 데이터는 준비 중입니다
          </div>
        </div>
        )}

        {/* 헤지 계산기 - USD 페어만 표시 */}
        {selectedPair.endsWith('KRW') && selectedPair.startsWith('USD') && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">헤지 계산기</h2>
                <span className="px-1.5 py-0.5 bg-green-900/50 rounded text-xs text-green-300">무료</span>
              </div>
              <a href="/console" className="text-blue-400 text-xs hover:underline">자세히 ›</a>
            </div>
            
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-2">USD 100만 달러, 3개월 헤지 시</div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">현물 환산</div>
                  <div className="text-base font-bold font-mono">₩{(data.rate * 1000000 / 100000000).toFixed(2)}억</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">3M 선물환</div>
                  <div className="text-base font-bold font-mono text-blue-400">
                    ₩{((data.rate + data.forward3M) * 1000000 / 100000000).toFixed(2)}억
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-700 text-center">
                <div className="text-xs text-gray-500">헤지 {data.forward3M >= 0 ? '비용' : '수익'}</div>
                <div className={`text-lg font-bold ${data.forward3M >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {data.forward3M >= 0 ? '+' : '-'}₩{formatNumber(Math.abs(data.forward3M * 10000), 0)}만
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="px-4 pt-2">
          <div className="flex bg-gray-900 rounded-xl p-1">
            {['news', 'analysis', 'alert'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                  activeTab === tab ? 'bg-gray-800 text-white font-medium' : 'text-gray-500'
                }`}
              >
                {tab === 'news' ? '뉴스' : tab === 'analysis' ? '시장분석' : '알림설정'}
              </button>
            ))}
          </div>
        </div>

        {/* 뉴스 */}
        <div className="px-4 pb-24">
          <div className="py-3 border-b border-gray-800">
            <div className="text-sm text-gray-300 mb-1">
              원·달러 환율, 1,440원대 초반서 하락 출발…美 달러 약세 영향
            </div>
            <div className="text-xs text-gray-600">2시간 전 · 연합뉴스</div>
          </div>
          <div className="py-3 border-b border-gray-800">
            <div className="text-sm text-gray-300 mb-1">
              "트럼프發 관세 불확실성에 원화 약세 지속 전망"
            </div>
            <div className="text-xs text-gray-600">5시간 전 · 매일경제</div>
          </div>
          <div className="py-3 border-b border-gray-800">
            <div className="text-sm text-gray-300 mb-1">
              엔화, 日은행 금리인상 기대에 강세...달러당 156엔대
            </div>
            <div className="text-xs text-gray-600">3시간 전 · 한국경제</div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-black border-t border-gray-800">
          <div className="max-w-md mx-auto flex gap-2">
            <button className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors">
              환율 알림 설정
            </button>
            <button className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
              헤지 상담 요청
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
