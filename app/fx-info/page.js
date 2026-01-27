'use client';

import React, { useState, useEffect } from 'react';

export default function FXInfoPage() {
  const [selectedPair, setSelectedPair] = useState('USDKRW');
  const [activeTab, setActiveTab] = useState('news');
  const [loading, setLoading] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertTarget, setAlertTarget] = useState('');
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  
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
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-base font-bold">📌 지금 환율 고정하기</h2>
            <span className="px-1.5 py-0.5 bg-blue-900/50 rounded text-xs text-blue-300">선물환</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">오늘 환율로 고정하고, 미래에 결제하세요</p>
          
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '1개월 후', tenor: '1M', value: data.forward1M },
              { label: '3개월 후', tenor: '3M', value: data.forward3M },
              { label: '6개월 후', tenor: '6M', value: data.forward6M },
              { label: '1년 후', tenor: '1Y', value: data.forward1Y }
            ].map(({ label, tenor, value }) => (
              <div key={tenor} className="bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-[10px] text-gray-500">{label}</div>
                <div className={`font-mono font-bold text-sm ${value >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {value >= 0 ? '+' : ''}{formatPoints(value)}
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  {getCurrencySymbol()}{formatRate(data.rate + value)}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 p-2.5 bg-blue-900/20 border border-blue-800/50 rounded-lg text-xs">
            <span className="text-blue-300">💡 예시: </span>
            <span className="text-gray-300">지금 3개월 선물환 계약 → </span>
            <span className="text-blue-400 font-mono font-bold">
              {getCurrencySymbol()}{formatRate(data.rate + data.forward3M)}
            </span>
            <span className="text-gray-300">에 결제 확정</span>
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

        {/* 외화 관리 옵션 - USD 페어만 표시 */}
        {selectedPair.endsWith('KRW') && selectedPair.startsWith('USD') && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">💰 달러 관리 옵션</h2>
              </div>
            </div>
            
            {/* 옵션 1: 미래에 달러가 들어오는 경우 */}
            <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/20 rounded-xl p-4 mb-3 border border-blue-800/50">
              <div className="flex items-start gap-3">
                <span className="text-xl">📅</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-300 mb-1">미래에 달러가 들어오나요?</p>
                  <p className="text-xs text-gray-400 mb-3">수출대금, 해외투자 회수 등 예정된 외화 입금이 있다면</p>
                  
                  <div className="bg-black/30 rounded-lg p-3 mb-3">
                    <div className="text-xs text-gray-500 mb-2">예시: USD 100만불, 3개월 후 입금 예정</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-500">지금 선물환 계약 시</div>
                        <div className="text-lg font-mono font-bold text-blue-400">₩{((data.rate + data.forward3M) * 1000000 / 100000000).toFixed(2)}억</div>
                      </div>
                      <div className="text-center px-3">
                        <div className="text-[10px] text-gray-500">vs 현재 환율</div>
                        <div className="text-sm font-mono text-gray-400">₩{(data.rate * 1000000 / 100000000).toFixed(2)}억</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
                      선물환 계약가: <span className="text-blue-400 font-mono">{formatNumber(data.rate + data.forward3M, 2)}</span>원 (3개월 후 확정)
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => window.location.href = '/console'}
                    className="w-full py-2.5 bg-blue-600/80 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-colors"
                  >
                    선물환 매도 약정하기 →
                  </button>
                </div>
              </div>
            </div>

            {/* 옵션 2: 현재 달러를 보유 중인 경우 */}
            <div className="bg-gradient-to-r from-green-900/30 to-green-800/20 rounded-xl p-4 border border-green-800/50">
              <div className="flex items-start gap-3">
                <span className="text-xl">🔔</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-300 mb-1">지금 달러를 갖고 계신가요?</p>
                  <p className="text-xs text-gray-400 mb-3">더 좋은 환율에 팔고 싶다면 목표가 알림을 설정하세요</p>
                  
                  <div className="bg-black/30 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-500">현재 환율</div>
                        <div className="text-lg font-mono font-bold">{formatNumber(data.rate, 2)}</div>
                      </div>
                      <div className="text-2xl">→</div>
                      <div>
                        <div className="text-[10px] text-gray-500">목표 환율 예시</div>
                        <div className="text-lg font-mono font-bold text-green-400">{formatNumber(data.rate * 1.02, 0)}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500 text-center">
                      🚀 향후 업데이트: 목표가 도달 시 자동 매도 기능
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setShowAlertModal(true)}
                    className="w-full py-2.5 bg-green-600/80 hover:bg-green-600 rounded-lg text-sm font-semibold transition-colors"
                  >
                    목표 환율 알림 설정 →
                  </button>
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
            <button 
              onClick={() => setShowAlertModal(true)}
              className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors"
            >
              🔔 환율 알림 설정
            </button>
            <button className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
              💬 헤지 상담 요청
            </button>
          </div>
        </div>

        {/* 환율 알림 설정 모달 */}
        {showAlertModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden border border-gray-700">
              {/* 모달 헤더 */}
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-lg font-bold">🔔 환율 알림 설정</h3>
                <button 
                  onClick={() => { setShowAlertModal(false); setAlertSubmitted(false); }}
                  className="text-gray-500 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {!alertSubmitted ? (
                <div className="p-4 space-y-4">
                  {/* 설명 */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-sm text-blue-300">
                      💡 목표 환율에 도달하면 알림을 보내드려요!<br/>
                      <span className="text-xs text-blue-400">이메일, 카카오톡, SMS 중 선택 가능</span>
                    </p>
                  </div>

                  {/* 통화쌍 표시 */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">알림 대상</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{data.code}</span>
                      <span className="text-lg font-mono text-blue-400">{formatNumber(data.rate, data.rate < 10 ? 4 : 2)}</span>
                    </div>
                  </div>

                  {/* 목표 환율 입력 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">목표 환율</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAlertTarget((data.rate * 0.99).toFixed(2))}
                        className="px-3 py-2 bg-green-600/20 border border-green-600/50 rounded-lg text-xs text-green-400 hover:bg-green-600/30"
                      >
                        ▼ 1% 하락
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        value={alertTarget}
                        onChange={(e) => setAlertTarget(e.target.value)}
                        placeholder={data.rate.toFixed(2)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-center font-mono focus:border-blue-500 focus:outline-none"
                      />
                      <button 
                        onClick={() => setAlertTarget((data.rate * 1.01).toFixed(2))}
                        className="px-3 py-2 bg-red-600/20 border border-red-600/50 rounded-lg text-xs text-red-400 hover:bg-red-600/30"
                      >
                        ▲ 1% 상승
                      </button>
                    </div>
                  </div>

                  {/* 이메일 입력 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">이메일 주소</label>
                    <input
                      type="email"
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="example@company.com"
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* 알림 유형 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">알림 유형</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['도달 시', '매일 오전', '급변 시'].map((type, i) => (
                        <button
                          key={type}
                          className={`py-2 rounded-lg text-xs border ${i === 0 ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 가입 유도 문구 */}
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">
                      알림 설정은 <span className="text-blue-400 font-bold">무료</span>입니다
                    </p>
                    <p className="text-[10px] text-gray-500">
                      회원가입 시 더 많은 기능을 이용하실 수 있어요
                    </p>
                  </div>

                  {/* 제출 버튼 */}
                  <button
                    onClick={() => {
                      if (alertEmail && alertTarget) {
                        setAlertSubmitted(true);
                        // TODO: Supabase에 저장
                        console.log('Alert request:', { email: alertEmail, target: alertTarget, pair: selectedPair });
                      }
                    }}
                    disabled={!alertEmail || !alertTarget}
                    className="w-full py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    알림 설정하기
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <h4 className="text-lg font-bold mb-2">알림이 설정되었습니다!</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    {data.code}가 <span className="text-blue-400 font-mono">{alertTarget}</span>에 도달하면<br/>
                    <span className="text-blue-400">{alertEmail}</span>로 알림을 보내드릴게요.
                  </p>
                  
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-300 mb-2">🎁 회원가입하고 더 많은 혜택 받기</p>
                    <ul className="text-xs text-gray-400 space-y-1 text-left">
                      <li>✓ 무제한 알림 설정</li>
                      <li>✓ 카카오톡/SMS 알림</li>
                      <li>✓ 스왑포인트 이론가 계산기</li>
                      <li>✓ 선물환 헤지 시뮬레이션</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => window.location.href = '/console'}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity mb-2"
                  >
                    회원가입하고 시작하기
                  </button>
                  <button
                    onClick={() => { setShowAlertModal(false); setAlertSubmitted(false); setAlertEmail(''); setAlertTarget(''); }}
                    className="w-full py-2 text-gray-500 text-sm"
                  >
                    나중에 할게요
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
