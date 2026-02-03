'use client';

import './globals.css';
import { useState, useEffect } from 'react';
import { 
  DateRuleCalculator, 
  CALENDAR_MAP, 
  TENORS, 
  formatDate,
  getDayName,
  getDayNameEn
} from '../lib/dateCalculator';
import StableFXLanding from './components/StableFXLanding';

// Supabase 설정
const SUPABASE_URL = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZW5id3ZoeGRjZ3RkaXZqaHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNTI3MjMsImV4cCI6MjA2MzcyODcyM30.sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';

const DEFAULT_HOLIDAYS = {
  KR: [
    {"date": "2025-01-01", "name": "신정"},
    {"date": "2025-03-01", "name": "삼일절"},
    {"date": "2025-05-05", "name": "어린이날"},
    {"date": "2025-06-06", "name": "현충일"},
    {"date": "2025-08-15", "name": "광복절"},
    {"date": "2025-10-03", "name": "개천절"},
    {"date": "2025-10-09", "name": "한글날"},
    {"date": "2025-12-25", "name": "크리스마스"},
    {"date": "2026-01-01", "name": "신정"},
    {"date": "2026-03-01", "name": "삼일절"},
  ],
  US: [
    {"date": "2025-01-01", "name": "New Year's Day"},
    {"date": "2025-07-04", "name": "Independence Day"},
    {"date": "2025-12-25", "name": "Christmas"},
    {"date": "2026-01-01", "name": "New Year's Day"},
  ]
};

// 결과 카드 컴포넌트
function ResultCard({ label, date, sublabel, highlight }) {
  if (!date) return null;
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-kustody-accent/10 border border-kustody-accent/30' : 'bg-kustody-navy/50'}`}>
      <div className="text-xs text-kustody-muted mb-1">{label}</div>
      <div className={`text-lg font-mono ${highlight ? 'text-kustody-accent font-semibold' : 'text-kustody-text'}`}>
        {formatDate(date)}
      </div>
      <div className="text-xs text-kustody-muted mt-1">
        {getDayName(date)} ({getDayNameEn(date)})
      </div>
      {sublabel && <div className="text-xs text-kustody-muted mt-1">{sublabel}</div>}
    </div>
  );
}

// 숫자 포맷
const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// 오늘 날짜
const getTodayString = () => new Date().toISOString().split('T')[0];

// ========== Bid/Ask 계산 함수 ==========
// 내재금리 기반으로 ± spreadBp 적용 + minimumPips
const calculateBidAsk = (midPoints, spot, days, spreadBp, minimumPips = 1) => {
  if (midPoints === null || days <= 0 || !spot) return { bid: null, ask: null };
  
  // 내재금리 계산: implied_yield = (swap_points / spot) × (360 / days)
  const impliedYield = (midPoints / spot) * (360 / days);
  
  // 금리 ± spread (bp를 %로 변환: 5bp = 0.0005)
  const spreadDecimal = spreadBp / 10000;
  const bidYield = impliedYield - spreadDecimal;  // 더 낮은 금리 → 더 음수 스왑포인트
  const askYield = impliedYield + spreadDecimal;  // 더 높은 금리 → 덜 음수 스왑포인트
  
  // 조정된 금리 → 스왑포인트: swap_points = spot × yield × (days / 360)
  let bidPoints = spot * bidYield * (days / 360);
  let askPoints = spot * askYield * (days / 360);
  
  // 스프레드 계산 (원단위)
  let spreadAmount = Math.abs(askPoints - bidPoints) / 2;
  
  // minimumPips 적용 (전단위 → 원단위 변환: 1전단위 = 0.01원)
  const minimumAmount = minimumPips / 100;
  if (spreadAmount < minimumAmount) {
    bidPoints = midPoints - minimumAmount;
    askPoints = midPoints + minimumAmount;
  }
  
  return { bid: bidPoints, ask: askPoints };
};

// 테너 문자열을 정규화 (O/N → ON)
const normalizeTenor = (tenor) => {
  return tenor.replace('/', '').toUpperCase();
};


// 설문 옵션
const JOB_ROLES = [
  { id: 'cfo', label: 'CFO / 경영진', icon: '👔' },
  { id: 'treasury', label: '자금 / 재무', icon: '💰' },
  { id: 'accounting', label: '회계 / 경리', icon: '📊' },
  { id: 'trader', label: '트레이더 / 딜러', icon: '📈' },
  { id: 'risk', label: '리스크 관리', icon: '🛡️' },
  { id: 'backoffice', label: '백오피스 / 결제', icon: '📋' },
  { id: 'it', label: 'IT / 개발', icon: '💻' },
  { id: 'other', label: '기타', icon: '👤' },
];

const BANKS = [
  { id: 'kb', name: 'KB국민은행' },
  { id: 'shinhan', name: '신한은행' },
  { id: 'woori', name: '우리은행' },
  { id: 'hana', name: '하나은행' },
  { id: 'nh', name: 'NH농협은행' },
  { id: 'ibk', name: 'IBK기업은행' },
  { id: 'sc', name: 'SC제일은행' },
  { id: 'citi', name: '한국씨티은행' },
  { id: 'bnk', name: 'BNK부산/경남' },
  { id: 'dgb', name: 'DGB대구은행' },
  { id: 'foreign', name: '외국계 은행' },
  { id: 'other', name: '기타' },
];

const PAIN_POINTS = [
  { id: 'compare', label: '은행별 환율 비교가 어려움', desc: '일일이 전화하거나 앱 확인해야 함' },
  { id: 'timing', label: '최적의 거래 타이밍을 모름', desc: '환율이 좋은지 나쁜지 판단 어려움' },
  { id: 'excel', label: '자금 관리를 엑셀로 하는 중', desc: '실수 위험, 버전 관리 어려움' },
  { id: 'report', label: '경영진 보고 자료 만들기 번거로움', desc: '환헤지 현황 정리에 시간 소요' },
  { id: 'hedge', label: '헤지 전략 수립이 어려움', desc: '언제, 얼마나 헤지해야 할지 모름' },
  { id: 'settlement', label: '결제 일정 관리가 복잡함', desc: '만기일, 입출금 일정 추적 어려움' },
];

const FEATURE_INTERESTS = [
  { id: 'multi_bank_compare', label: '여러 은행 환율 비교', desc: '한 화면에서 최적 조건 확인' },
  { id: 'realtime_pricing', label: '실시간 환율 알림', desc: '목표 환율 도달 시 알림' },
  { id: 'cash_schedule', label: '자금 일정 관리', desc: '입출금, 만기일 자동 추적' },
  { id: 'hedge_dashboard', label: '헤지 현황 대시보드', desc: '한눈에 보는 환헤지 포지션' },
  { id: 'auto_report', label: '자동 리포팅', desc: '경영진 보고서 원클릭 생성' },
  { id: 'approval_workflow', label: '승인 워크플로우', desc: '거래 결재 프로세스' },
  { id: 'trader_limit', label: '담당자별 거래한도', desc: '권한별 한도 설정' },
  { id: 'audit_trail', label: '거래 이력 추적', desc: '전체 거래 로그 관리' },
  { id: 'api_erp', label: 'ERP/회계 연동', desc: '기존 시스템과 자동 연결' },
];

export default function PublicLanding() {
  const [holidays, setHolidays] = useState(DEFAULT_HOLIDAYS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mainView, setMainView] = useState('calculator'); // 'landing', 'calculator'
  const [activeSection, setActiveSection] = useState('calculator');

  // Date Calculator State
  const [tradeDate, setTradeDate] = useState(getTodayString());
  const [currency, setCurrency] = useState('USDKRW');
  const [tenor, setTenor] = useState('1M');
  const [spotDays, setSpotDays] = useState(2);
  const [result, setResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);

  // Swap Point State
  const [curveData, setCurveData] = useState(null);
  const [curveLoading, setCurveLoading] = useState(false);
  const [interpDate, setInterpDate] = useState('');
  const [spotRate, setSpotRate] = useState(null); // 네이버 실시간 USDKRW
  const [eurRate, setEurRate] = useState(null);   // EURKRW
  const [jpyRate, setJpyRate] = useState(null);   // JPYKRW (100엔당)
  const [spreadSettings, setSpreadSettings] = useState({
    mode: 'byTenor',  // Tier4: 테너별 차등 스프레드
    uniformBp: 20,    // Tier4 기본: 20bp
    tenorBp: { 
      'ON': 50,   // O/N: 50bp (단기 변동성)
      'TN': 40,   // T/N: 40bp
      '1W': 30,   // 1W: 30bp
      '1M': 20,   // 1M: 20bp
      '2M': 18,   // 2M: 18bp
      '3M': 15,   // 3M: 15bp
      '6M': 12,   // 6M: 12bp
      '1Y': 10,   // 1Y: 10bp
      '2Y': 8     // 2Y: 8bp
    },
    minimumPips: 5,   // 최소 5전단위
  });

  // Alert Modal State
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertTarget, setAlertTarget] = useState('');
  const [alertSubmitted, setAlertSubmitted] = useState(false);

  // Survey State (4 steps)
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyStep, setSurveyStep] = useState(1);
  const [surveyData, setSurveyData] = useState({
    role: '',
    bankCount: '',
    banks: [],
    painPoints: [],
    features: [],
    feedback: '',
    email: '',
    company: '',
  });
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  // Load holidays
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const allHolidays = { KR: [], US: [] };
        for (let year = 2025; year <= 2031; year++) {
          for (const country of ['kr', 'us']) {
            try {
              const res = await fetch(`/holidays/${country}_${year}.json`);
              if (res.ok) {
                const data = await res.json();
                allHolidays[country.toUpperCase()] = [...allHolidays[country.toUpperCase()], ...data.holidays];
              }
            } catch {}
          }
        }
        if (allHolidays.KR.length > 0 || allHolidays.US.length > 0) {
          setHolidays(allHolidays);
        }
      } catch {}
      setIsLoaded(true);
    };
    loadHolidays();
  }, []);

  // Load spread settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('stablefx_spread_settings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setSpreadSettings(prev => ({ ...prev, ...settings }));
        } catch {}
      } else {
        // 레거시 호환
        const legacySpread = localStorage.getItem('stablefx_spread_bp');
        if (legacySpread) {
          setSpreadSettings(prev => ({ ...prev, uniformBp: Number(legacySpread) }));
        }
      }
    };
    
    loadSettings();
    
    // Listen for changes (from console)
    const handleStorageChange = (e) => {
      if (e.key === 'stablefx_spread_settings') {
        try {
          const settings = JSON.parse(e.newValue);
          setSpreadSettings(prev => ({ ...prev, ...settings }));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 사용 로그 저장
  const trackUsage = (type, data) => {
    const logs = JSON.parse(localStorage.getItem('stablefx_usage') || '[]');
    logs.push({
      type,
      data,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    localStorage.setItem('stablefx_usage', JSON.stringify(logs));
  };

  // 날짜 조회 버튼 클릭
  const handleDateCalculate = async () => {
    if (!isLoaded || !tradeDate) return;
    
    setIsCalculating(true);
    setApiResponse(null);
    trackUsage('date_calc', { tradeDate, currency, tenor, spotDays });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const calendarList = CALENDAR_MAP[currency] || ['KR', 'US'];
      const calc = new DateRuleCalculator(holidays);
      const tradeDt = new Date(tradeDate);
      
      let spotDate = new Date(tradeDt);
      for (let i = 0; i < spotDays; i++) {
        spotDate = calc.nextBusinessDay(spotDate, true, calendarList);
      }
      
      let maturityDate = tenor === 'SPOT' ? spotDate : calc.addTenor(tradeDt, tenor, spotDays, calendarList, 'STANDARD');
      
      const resultData = {
        tradeDate: tradeDt, spotDate, maturityDate,
        currency, tenor, spotDays,
        calendars: calendarList,
        daysToMaturity: Math.round((maturityDate - spotDate) / (1000 * 60 * 60 * 24)),
        businessDays: calc.countBusinessDays(spotDate, maturityDate, calendarList),
      };
      
      setResult(resultData);
      setApiResponse({
        status: 200,
        data: {
          tradeDate: formatDate(tradeDt),
          spotDate: formatDate(spotDate),
          maturityDate: formatDate(maturityDate),
          currency, tenor, spotDays,
          daysToMaturity: resultData.daysToMaturity,
          businessDays: resultData.businessDays,
        }
      });
    } catch (e) {
      console.error('Date calculation error:', e);
      setApiResponse({ status: 500, error: e.message });
    }
    
    setIsCalculating(false);
  };

  // 스왑포인트 및 스팟 환율 로드
  const loadSwapPoints = async () => {
    setCurveLoading(true);
    trackUsage('swap_points_load', { action: 'refresh' });
    
    try {
      // ========== 1. 스팟 환율 가져오기 ==========
      let spotRateValue = null;
      let eurRateValue = null;
      let jpyRateValue = null;
      
      // 1-1. Supabase에서 먼저 조회
      try {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/spot_rates?source=eq.naver&order=fetched_at.desc&limit=20`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (sbRes.ok) {
          const sbData = await sbRes.json();
          if (sbData.length > 0) {
            const now = Date.now();
            const fetchedAt = new Date(sbData[0].fetched_at);
            const ageMinutes = (now - fetchedAt.getTime()) / (1000 * 60);
            
            if (ageMinutes < 30) {
              sbData.forEach(row => {
                if (row.currency_pair === 'USDKRW' && !spotRateValue) spotRateValue = row.rate;
                if (row.currency_pair === 'EURKRW' && !eurRateValue) eurRateValue = row.rate;
                if (row.currency_pair === 'JPYKRW' && !jpyRateValue) jpyRateValue = row.rate;
              });
              console.log(`✅ Supabase spot rates (${Math.round(ageMinutes)}분 전):`, spotRateValue);
            }
          }
        }
      } catch (e) {
        console.warn('Supabase spot rate failed:', e);
      }
      
      // 1-2. Supabase에 없으면 네이버 API 직접 호출
      if (!spotRateValue) {
        try {
          console.log('📡 Supabase에 데이터 없음, API route 호출...');
          const naverRes = await fetch('/api/naver-rates');
          if (naverRes.ok) {
            const naverData = await naverRes.json();
            if (naverData.success && naverData.rates) {
              if (naverData.rates.USDKRW?.rate) spotRateValue = naverData.rates.USDKRW.rate;
              if (naverData.rates.EURKRW?.rate) eurRateValue = naverData.rates.EURKRW.rate;
              if (naverData.rates.JPYKRW?.rate) jpyRateValue = naverData.rates.JPYKRW.rate;
              console.log('✅ Naver API:', spotRateValue);
            }
          }
        } catch (e) {
          console.warn('Naver API failed:', e);
        }
      }
      
      // 1-3. 최종 fallback
      if (!spotRateValue) spotRateValue = 1423.00;
      if (!eurRateValue) eurRateValue = 1545.00;
      if (!jpyRateValue) jpyRateValue = 917.00;
      
      setSpotRate(spotRateValue);
      setEurRate(eurRateValue);
      setJpyRate(jpyRateValue);

      // ========== 2. DateRuleCalculator로 날짜 계산 ==========
      const calc = new DateRuleCalculator(DEFAULT_HOLIDAYS);
      const calendars = ['KR', 'US'];
      const today = new Date();
      const todayStr = formatDate(today);
      const tradeDate = new Date(todayStr + 'T00:00:00');
      
      // Spot Date (T+2)
      let spotDate = new Date(tradeDate);
      for (let i = 0; i < 2; i++) {
        spotDate = calc.nextBusinessDay(spotDate, true, calendars);
      }
      const spotDateStr = formatDate(spotDate);
      
      // T+1 (O/N maturity, T/N start)
      const tPlus1 = calc.nextBusinessDay(tradeDate, true, calendars);
      const tPlus1Str = formatDate(tPlus1);
      
      console.log(`📅 Trade: ${todayStr}, T+1: ${tPlus1Str}, Spot: ${spotDateStr}`);

      // ========== 3. Supabase에서 mid_points 가져오기 ==========
      let midPointsMap = {};
      let dataSource = 'fallback';
      
      try {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/fx_swap_points?source=eq.IPS&order=reference_date.desc`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (sbRes.ok) {
          const sbData = await sbRes.json();
          if (sbData.length > 0) {
            // 가장 최신 reference_date의 데이터만 사용
            const latestDate = sbData[0].reference_date;
            sbData.filter(r => r.reference_date === latestDate).forEach(row => {
              midPointsMap[row.tenor] = row.mid_points;
            });
            dataSource = `Supabase (${latestDate})`;
            console.log('✅ Supabase mid_points:', midPointsMap);
          }
        }
      } catch (e) {
        console.warn('Supabase fx_swap_points failed:', e);
      }

      // fallback: JSON 파일
      if (Object.keys(midPointsMap).length === 0) {
        try {
          const res = await fetch('/config/curves/20260127_IW.json');
          if (res.ok) {
            const jsonData = await res.json();
            if (jsonData.curves?.USDKRW?.fxSwapPoints) {
              jsonData.curves.USDKRW.fxSwapPoints.forEach(p => {
                midPointsMap[p.tenor] = p.points;
              });
              dataSource = 'JSON (fallback)';
            }
          }
        } catch (e) {
          console.warn('JSON fallback failed:', e);
        }
      }

      // ========== 4. 각 Tenor별 날짜/days 계산 ==========
      const tenorList = ['ON', 'TN', '1W', '1M', '2M', '3M', '6M', '9M', '1Y'];
      const fxSwapPoints = [];
      
      for (const tenor of tenorList) {
        const midPoints = midPointsMap[tenor];
        if (midPoints === undefined) {
          console.warn(`⚠️ No mid_points for ${tenor}`);
          continue;
        }
        
        let startDate, maturityDate, days;
        
        if (tenor === 'ON') {
          // O/N: Trade Date → T+1
          startDate = tradeDate;
          maturityDate = tPlus1;
          days = 1;
        } else if (tenor === 'TN') {
          // T/N: T+1 → Spot
          startDate = tPlus1;
          maturityDate = spotDate;
          days = 1;
        } else {
          // 1W ~ 1Y: Spot → Maturity
          startDate = spotDate;
          maturityDate = calc.addTenor(tradeDate, tenor, 2, calendars, true);
          days = Math.round((maturityDate - spotDate) / (1000 * 60 * 60 * 24));
        }
        
        fxSwapPoints.push({
          tenor: tenor,
          startDate: formatDate(startDate),
          maturity: formatDate(maturityDate),
          days: days,
          points: midPoints,
          bid: null,  // spread는 클라이언트에서 계산
          ask: null,
        });
      }
      
      console.log(`✅ Calculated ${fxSwapPoints.length} tenors from ${dataSource}`);

      // ========== 5. curveData 구성 ==========
      const swapPointsData = {
        metadata: {
          referenceDate: todayStr,
          source: dataSource,
        },
        curves: {
          USDKRW: {
            USD: { spotDate: spotDateStr },
            fxSwapPoints: fxSwapPoints,
          }
        },
        spotRates: {
          USDKRW: spotRateValue,
        }
      };

      setCurveData(swapPointsData);
      
      // 기본 보간 날짜 설정 (Spot + 1M)
      const defaultInterpDate = new Date(spotDate);
      defaultInterpDate.setMonth(defaultInterpDate.getMonth() + 1);
      setInterpDate(formatDate(defaultInterpDate));
      
    } catch (e) {
      console.error('Failed to load swap points:', e);
    }
    setCurveLoading(false);
  };

  useEffect(() => {
    if (activeSection === 'interpolation' && !curveData && !curveLoading) {
      loadSwapPoints();
    }
  }, [activeSection]);

  useEffect(() => {
    if (!interpDate || !curveData) return;
    const timer = setTimeout(() => {
      trackUsage('swap_points_interp', { interpDate, currency: 'USDKRW' });
    }, 500);
    return () => clearTimeout(timer);
  }, [interpDate]);

  // 스왑포인트 보간 계산
  const calculateInterpolation = () => {
    if (!curveData || !interpDate) return null;
    
    const spotDateStr = curveData.curves?.USDKRW?.USD?.spotDate;
    if (!spotDateStr) return null;
    
    const spotDateObj = new Date(spotDateStr);
    const targetDate = new Date(interpDate);
    const days = Math.round((targetDate - spotDateObj) / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return { error: 'Spot Date 이후 날짜를 선택해주세요.' };
    
    const swapPoints = curveData.curves?.USDKRW?.fxSwapPoints?.filter(p => p.days > 0).sort((a, b) => a.days - b.days) || [];
    if (swapPoints.length === 0) return null;
    
    let points, tenorLabel = '', tenorForBp = '1M';
    
    if (days <= swapPoints[0].days) {
      tenorLabel = `<${swapPoints[0].tenor}`;
      tenorForBp = swapPoints[0].tenor;
      points = swapPoints[0].points * (days / swapPoints[0].days);
    } else if (days >= swapPoints[swapPoints.length - 1].days) {
      tenorLabel = `>${swapPoints[swapPoints.length - 1].tenor}`;
      tenorForBp = swapPoints[swapPoints.length - 1].tenor;
      points = swapPoints[swapPoints.length - 1].points;
    } else {
      let lower = swapPoints[0], upper = swapPoints[1];
      for (let i = 0; i < swapPoints.length - 1; i++) {
        if (days >= swapPoints[i].days && days <= swapPoints[i + 1].days) {
          lower = swapPoints[i];
          upper = swapPoints[i + 1];
          break;
        }
      }
      tenorLabel = `${lower.tenor}-${upper.tenor}`;
      tenorForBp = upper.tenor; // 보수적으로 상위 테너 bp 사용
      const t = (days - lower.days) / (upper.days - lower.days);
      points = lower.points + (upper.points - lower.points) * t;
    }
    
    const spot = spotRate || curveData.spotRates?.USDKRW || 1443.10;
    
    // 테너별 bp + minimum 적용
    const tenorBp = spreadSettings.mode === 'uniform' 
      ? spreadSettings.uniformBp 
      : (spreadSettings.tenorBp[normalizeTenor(tenorForBp)] || spreadSettings.uniformBp);
    const { bid, ask } = calculateBidAsk(points, spot, days, tenorBp, spreadSettings.minimumPips);
    
    return { 
      days, 
      tenorLabel, 
      points, 
      forward: spot + points, 
      spot,
      bid,
      ask,
      bidForward: spot + bid,
      askForward: spot + ask,
    };
  };

  // Survey handlers
  const handleSurveySubmit = () => {
    const submissions = JSON.parse(localStorage.getItem('stablefx_surveys') || '[]');
    submissions.push({ ...surveyData, timestamp: new Date().toISOString() });
    localStorage.setItem('stablefx_surveys', JSON.stringify(submissions));
    setSurveySubmitted(true);
  };

  // 테너에 맞는 bp 가져오기
  const getSpreadBpForTenor = (tenor) => {
    if (spreadSettings.mode === 'uniform') {
      return spreadSettings.uniformBp;
    }
    const normalizedTenor = normalizeTenor(tenor);
    return spreadSettings.tenorBp[normalizedTenor] || spreadSettings.uniformBp;
  };

  const spot = spotRate || curveData?.spotRates?.USDKRW || 1443.10;
  const interpCalc = calculateInterpolation();

  // Navigation handler for landing page
  const handleLandingNavigate = (target) => {
    if (target === 'calculator') {
      setMainView('calculator');
    } else if (target === 'console') {
      window.location.href = '/console';
    }
  };

  return (
    <div className="min-h-screen bg-kustody-dark">
      {/* Global Navigation Bar */}
      <nav className="bg-kustody-surface border-b border-kustody-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-kustody-accent to-emerald-600 rounded-lg flex items-center justify-center font-bold text-sm text-kustody-dark">
              S
            </div>
            <span className="text-xl font-bold text-kustody-text">
              Stable<span className="text-kustody-accent">FX</span>
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMainView('landing')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mainView === 'landing'
                  ? 'bg-kustody-accent/10 text-kustody-accent'
                  : 'text-kustody-muted hover:text-kustody-text hover:bg-kustody-navy/50'
              }`}
            >
              🏠 About
            </button>
            <button
              onClick={() => setMainView('calculator')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mainView === 'calculator'
                  ? 'bg-kustody-accent/10 text-kustody-accent'
                  : 'text-kustody-muted hover:text-kustody-text hover:bg-kustody-navy/50'
              }`}
            >
              🧮 Calculator
            </button>
            <a
              href="/console"
              className="px-4 py-2 rounded-lg text-sm font-medium text-kustody-muted hover:text-kustody-text hover:bg-kustody-navy/50 transition-all"
            >
              🚀 Console
            </a>
          </div>
        </div>
      </nav>

      {/* Landing Page View */}
      {mainView === 'landing' && (
        <StableFXLanding onNavigate={handleLandingNavigate} />
      )}

      {/* Calculator View */}
      {mainView === 'calculator' && (
        <>
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-kustody-navy to-kustody-dark">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-kustody-text mb-4">
              Stable<span className="text-kustody-accent">FX</span>
            </h1>
            <p className="text-xl text-kustody-text mb-2">
              여러 은행 환율, 한눈에 비교하고 관리하세요
            </p>
            <p className="text-kustody-muted">
              은행마다 다른 환율, 가장 좋은 조건 찾기 어려우셨죠?
            </p>
          </div>
          
          {/* Tool Selector */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setActiveSection('calculator')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeSection === 'calculator'
                  ? 'bg-kustody-accent text-kustody-dark'
                  : 'bg-kustody-surface text-kustody-muted hover:text-kustody-text'
              }`}
            >
              📅 날짜 계산기
            </button>
            <button
              onClick={() => setActiveSection('interpolation')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeSection === 'interpolation'
                  ? 'bg-kustody-accent text-kustody-dark'
                  : 'bg-kustody-surface text-kustody-muted hover:text-kustody-text'
              }`}
            >
              📊 스왑포인트 조회
            </button>
            <a
              href="/console"
              className="px-6 py-3 rounded-lg font-medium transition-all bg-kustody-navy border border-kustody-accent/50 text-kustody-accent hover:bg-kustody-accent hover:text-kustody-dark"
            >
              🚀 전문가 콘솔
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Date Calculator */}
        {activeSection === 'calculator' && (
          <div className="bg-kustody-surface rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-semibold text-kustody-text mb-6">
              📅 FX 날짜 계산기
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-kustody-muted mb-2">거래일 (Trade Date)</label>
                <input
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text focus:border-kustody-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-kustody-muted mb-2">통화쌍</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text focus:border-kustody-accent focus:outline-none"
                >
                  {Object.keys(CALENDAR_MAP).map(ccy => (
                    <option key={ccy} value={ccy}>{ccy}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-kustody-muted mb-2">테너 (Tenor)</label>
                <select
                  value={tenor}
                  onChange={(e) => setTenor(e.target.value)}
                  className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text focus:border-kustody-accent focus:outline-none"
                >
                  {TENORS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-kustody-muted mb-2">Spot Days</label>
                <select
                  value={spotDays}
                  onChange={(e) => setSpotDays(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text focus:border-kustody-accent focus:outline-none"
                >
                  <option value={0}>T+0 (Today)</option>
                  <option value={1}>T+1</option>
                  <option value={2}>T+2 (Standard)</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handleDateCalculate}
              disabled={isCalculating || !isLoaded}
              className="w-full py-4 bg-kustody-accent text-kustody-dark font-semibold rounded-lg hover:bg-kustody-accent/90 transition-colors disabled:opacity-50 text-lg"
            >
              {isCalculating ? '조회 중...' : '🔍 조회'}
            </button>
            
            {result && (
              <div className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <ResultCard label="거래일" date={result.tradeDate} sublabel="Trade Date" />
                  <ResultCard label="결제일" date={result.spotDate} sublabel="Spot Date" />
                  <ResultCard label="만기일" date={result.maturityDate} sublabel="Maturity Date" highlight />
                </div>
                <div className="p-4 bg-kustody-navy/30 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                    <div><div className="text-kustody-muted">통화쌍</div><div className="font-mono text-kustody-text">{result.currency}</div></div>
                    <div><div className="text-kustody-muted">테너</div><div className="font-mono text-kustody-accent">{result.tenor}</div></div>
                    <div><div className="text-kustody-muted">일수</div><div className="font-mono text-kustody-text">{result.daysToMaturity}일</div></div>
                    <div><div className="text-kustody-muted">영업일수</div><div className="font-mono text-kustody-text">{result.businessDays}일</div></div>
                  </div>
                </div>
              </div>
            )}
            
            {apiResponse && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-kustody-muted">API Response</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${apiResponse.status === 200 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {apiResponse.status}
                  </span>
                </div>
                <pre className="p-4 bg-kustody-dark rounded-lg text-xs font-mono text-kustody-muted overflow-x-auto">
{JSON.stringify(apiResponse.data || apiResponse.error, null, 2)}
                </pre>
                <p className="text-xs text-kustody-muted mt-2">
                  💡 REST API: <code className="text-kustody-accent">GET /api/v1/date-calc?tradeDate={tradeDate}&currency={currency}&tenor={tenor}</code>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Swap Point */}
        {activeSection === 'interpolation' && (
          <div className="bg-kustody-surface rounded-2xl p-4 md:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6 gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-kustody-text">📊 스왑포인트 조회</h2>
                <p className="text-kustody-muted text-xs md:text-sm mt-1">
                  기준일: {curveData?.metadata?.referenceDate || new Date().toISOString().split('T')[0]} | 출처: {curveData?.metadata?.source || '로딩중...'}
                </p>
              </div>
              <button
                onClick={loadSwapPoints}
                disabled={curveLoading}
                className="px-3 py-2 md:px-4 bg-kustody-navy border border-kustody-border rounded-lg text-xs md:text-sm hover:border-kustody-accent transition-colors disabled:opacity-50 self-start sm:self-auto"
              >
                {curveLoading ? '로딩...' : '🔄 새로고침'}
              </button>
            </div>

            {/* 실시간 환율 카드 */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/30 rounded-xl p-4 text-center">
                <div className="text-xs text-blue-300 mb-1">🇺🇸 USD/KRW</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-blue-400">
                  {spotRate ? formatNumber(spotRate, 2) : '-'}
                </div>
                <div className="text-[10px] text-kustody-muted mt-1">달러/원</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/10 border border-purple-500/30 rounded-xl p-4 text-center">
                <div className="text-xs text-purple-300 mb-1">🇪🇺 EUR/KRW</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-purple-400">
                  {eurRate ? formatNumber(eurRate, 2) : '-'}
                </div>
                <div className="text-[10px] text-kustody-muted mt-1">유로/원</div>
              </div>
              <div className="bg-gradient-to-br from-red-600/20 to-red-800/10 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="text-xs text-red-300 mb-1">🇯🇵 JPY/KRW</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-red-400">
                  {jpyRate ? formatNumber(jpyRate, 2) : '-'}
                </div>
                <div className="text-[10px] text-kustody-muted mt-1">100엔/원</div>
              </div>
            </div>
            
            {curveLoading ? (
              <div className="text-center py-8 md:py-12 text-kustody-muted">
                <div className="text-3xl md:text-4xl mb-4">⏳</div>
                <p className="text-sm md:text-base">데이터 로딩 중...</p>
              </div>
            ) : curveData ? (
              <>
                {/* 스왑포인트 설명 */}
                <div className="mb-6 p-4 bg-gradient-to-r from-kustody-accent/10 to-blue-500/10 border border-kustody-accent/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <p className="text-sm font-semibold text-kustody-text mb-1">선물환이란?</p>
                      <p className="text-xs text-kustody-muted leading-relaxed">
                        <strong className="text-kustody-accent">지금 환율을 고정</strong>하고, 약정한 미래 날짜에 결제하는 거래입니다.<br/>
                        예) 3M 선물환 = 오늘 환율({spot ? formatNumber(spot, 2) : '1,442.80'})에 스왑포인트를 더해 3개월 후에 결제
                      </p>
                    </div>
                  </div>
                </div>

                {/* 환율 알림 설정 버튼 */}
                <div className="mb-6 flex justify-center">
                  <button
                    onClick={() => {
                      setAlertTarget(spot ? spot.toFixed(0) : '1443');
                      setShowAlertModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-blue-600/20"
                  >
                    <span>🔔</span>
                    <span>목표 환율 도달 시 알림 받기</span>
                  </button>
                </div>

                {/* 스왑포인트 테이블 (Bid/Ask 포함) */}
                <div className="mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <table className="w-full text-sm min-w-[320px]">
                    <thead>
                      <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                        <th className="text-left py-2 md:py-3 px-2 md:px-3">Tenor</th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-3 hidden md:table-cell">Maturity</th>
                        <th className="text-right py-2 md:py-3 px-1 md:px-3">Days</th>
                        <th className="text-right py-2 md:py-3 px-1 md:px-3 text-blue-400">Bid</th>
                        <th className="text-right py-2 md:py-3 px-1 md:px-3">Mid</th>
                        <th className="text-right py-2 md:py-3 px-1 md:px-3 text-red-400">Ask</th>
                        <th className="text-right py-2 md:py-3 px-1 md:px-3 text-kustody-accent hidden sm:table-cell">Sp/Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {curveData.curves?.USDKRW?.fxSwapPoints?.map((p, i) => {
                        const displayDays = p.startDate && p.maturity 
                          ? Math.round((new Date(p.maturity) - new Date(p.startDate)) / (1000 * 60 * 60 * 24))
                          : (p.days > 0 ? p.days : 1);
                        const midPips = p.points !== null ? Math.round(p.points * 100) : null;
                        const spDay = (displayDays > 0 && midPips !== null) ? (midPips / displayDays).toFixed(2) : '-';
                        
                        // Bid/Ask 계산 (테너별 bp + minimum 적용)
                        const tenorBp = getSpreadBpForTenor(p.tenor);
                        const { bid, ask } = calculateBidAsk(p.points, spot, displayDays, tenorBp, spreadSettings.minimumPips);
                        const bidPips = bid !== null ? Math.round(bid * 100) : null;
                        const askPips = ask !== null ? Math.round(ask * 100) : null;
                        
                        return (
                          <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                            <td className="py-2 md:py-3 px-2 md:px-3 font-mono font-semibold text-xs md:text-sm">{p.tenor}</td>
                            <td className="py-2 md:py-3 px-2 md:px-3 text-center font-mono text-kustody-muted text-xs hidden md:table-cell">{p.maturity || '-'}</td>
                            <td className="py-2 md:py-3 px-1 md:px-3 text-right font-mono text-kustody-muted text-xs md:text-sm">{displayDays}</td>
                            <td className="py-2 md:py-3 px-1 md:px-3 text-right font-mono text-blue-400 text-xs md:text-sm">{bidPips !== null ? bidPips : '-'}</td>
                            <td className="py-2 md:py-3 px-1 md:px-3 text-right font-mono text-xs md:text-sm">{midPips !== null ? midPips : '-'}</td>
                            <td className="py-2 md:py-3 px-1 md:px-3 text-right font-mono text-red-400 text-xs md:text-sm">{askPips !== null ? askPips : '-'}</td>
                            <td className="py-2 md:py-3 px-1 md:px-3 text-right font-mono text-kustody-accent text-xs md:text-sm hidden sm:table-cell">{spDay}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 안내 문구 */}
                <div className="mb-8 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300 text-center">
                    💡 Bid/Ask는 내재금리 기반의 참고용 추정치이며, 실제 거래 가격은 은행·거래 조건에 따라 달라질 수 있습니다.
                  </p>
                </div>
                
                {/* 맞춤 날짜 조회 */}
                <div className="bg-kustody-navy/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">🎯 맞춤 날짜 조회</h3>
                    <button
                      onClick={loadSwapPoints}
                      disabled={curveLoading}
                      className="px-3 py-1.5 bg-kustody-dark border border-kustody-border rounded text-xs hover:border-kustody-accent transition-colors disabled:opacity-50"
                    >
                      {curveLoading ? '로딩...' : '🔄 새로고침'}
                    </button>
                  </div>
                  
                  {/* Spot Date 먼저, 조회 날짜 나중에 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm text-kustody-muted mb-2">Spot Date (기준일)</label>
                      <div className="px-4 py-3 bg-kustody-dark/50 border border-kustody-border/50 rounded-lg text-kustody-muted font-mono">
                        {curveData.curves?.USDKRW?.USD?.spotDate || '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-kustody-muted mb-2">만기일 (조회할 날짜)</label>
                      <input
                        type="date"
                        value={interpDate}
                        onChange={(e) => setInterpDate(e.target.value)}
                        className="w-full px-4 py-3 bg-kustody-dark border border-kustody-border rounded-lg text-kustody-text focus:border-kustody-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  {interpCalc?.error ? (
                    <div className="text-center text-kustody-muted py-4">{interpCalc.error}</div>
                  ) : interpCalc && (
                    <>
                      {/* 기본 정보 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                          <div className="text-xs text-kustody-muted mb-1">Days</div>
                          <div className="font-mono text-xl text-kustody-accent">{interpCalc.days}</div>
                          <div className="text-xs text-kustody-muted">{interpCalc.tenorLabel}</div>
                        </div>
                        <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                          <div className="text-xs text-kustody-muted mb-1">Mid (전단위)</div>
                          <div className="font-mono text-xl">{Math.round(interpCalc.points * 100)}</div>
                        </div>
                        <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                          <div className="text-xs text-kustody-muted mb-1">Sp/Day</div>
                          <div className="font-mono text-xl text-kustody-accent">
                            {(Math.round(interpCalc.points * 100) / interpCalc.days).toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                          <div className="text-xs text-kustody-muted mb-1">Mid Forward</div>
                          <div className="font-mono text-xl">{formatNumber(interpCalc.forward, 2)}</div>
                        </div>
                      </div>

                      {/* Bid/Ask 선도환율 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                          <div className="text-xs text-blue-400 mb-1">Bid (매도 시)</div>
                          <div className="font-mono text-lg text-blue-400">{Math.round(interpCalc.bid * 100)} 전단위</div>
                          <div className="font-mono text-xl font-semibold text-blue-300">{formatNumber(interpCalc.bidForward, 2)}</div>
                        </div>
                        <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-lg p-4 text-center">
                          <div className="text-xs text-kustody-muted mb-1">Mid (기준)</div>
                          <div className="font-mono text-lg">{Math.round(interpCalc.points * 100)} 전단위</div>
                          <div className="font-mono text-xl font-semibold text-kustody-accent">{formatNumber(interpCalc.forward, 2)}</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                          <div className="text-xs text-red-400 mb-1">Ask (매수 시)</div>
                          <div className="font-mono text-lg text-red-400">{Math.round(interpCalc.ask * 100)} 전단위</div>
                          <div className="font-mono text-xl font-semibold text-red-300">{formatNumber(interpCalc.askForward, 2)}</div>
                        </div>
                      </div>

                      {/* 계산식 */}
                      <div className="p-3 bg-kustody-dark/30 rounded-lg text-center text-xs text-kustody-muted">
                        Forward = Spot ({formatNumber(interpCalc.spot, 2)}) + Swap Points | 
                        Bid/Ask: {spreadSettings.mode === 'uniform' ? `±${spreadSettings.uniformBp}bp` : '테너별'} (연율) | Min: {spreadSettings.minimumPips}전단위
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-kustody-muted">
                <div className="text-4xl mb-4">📊</div>
                <p>데이터를 불러오지 못했습니다.</p>
                <button onClick={loadSwapPoints} className="mt-4 px-6 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-medium">다시 시도</button>
              </div>
            )}
          </div>
        )}

        {/* Feedback CTA */}
        {!showSurvey && !surveySubmitted && (
          <div className="mt-12">
            <div className="bg-gradient-to-r from-kustody-accent/20 to-blue-500/20 rounded-2xl p-8 border border-kustody-accent/30 text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-kustody-text mb-3">
                더 나은 환율 관리, 함께 만들어요
              </h3>
              <p className="text-kustody-muted mb-6">
                1분 설문에 참여하시면 여러분의 니즈에 맞는<br />
                기능을 우선 개발해 드릴게요.
              </p>
              <button
                onClick={() => setShowSurvey(true)}
                className="px-8 py-3 bg-kustody-accent text-kustody-dark font-semibold rounded-lg hover:bg-kustody-accent/90 transition-colors"
              >
                의견 남기기 →
              </button>
            </div>
          </div>
        )}

        {/* Survey - 4 Steps */}
        {showSurvey && !surveySubmitted && (
          <div className="mt-12 bg-kustody-surface rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-kustody-text">💬 의견 남기기</h2>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map(step => (
                  <div key={step} className={`w-6 h-1 rounded-full ${surveyStep >= step ? 'bg-kustody-accent' : 'bg-kustody-border'}`} />
                ))}
              </div>
            </div>

            {/* Step 1: 직무 */}
            {surveyStep === 1 && (
              <div>
                <h3 className="text-lg text-kustody-text mb-4">어떤 업무를 담당하고 계세요?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {JOB_ROLES.map(role => (
                    <button
                      key={role.id}
                      onClick={() => setSurveyData(prev => ({ ...prev, role: role.id }))}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        surveyData.role === role.id
                          ? 'border-kustody-accent bg-kustody-accent/10'
                          : 'border-kustody-border bg-kustody-navy/30 hover:border-kustody-accent/50'
                      }`}
                    >
                      <span className="text-2xl">{role.icon}</span>
                      <div className="mt-2 text-sm font-medium text-kustody-text">{role.label}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => surveyData.role && setSurveyStep(2)}
                    disabled={!surveyData.role}
                    className={`px-6 py-2 rounded-lg font-medium ${surveyData.role ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-border text-kustody-muted cursor-not-allowed'}`}
                  >
                    다음 →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: 거래 은행 & Pain Point */}
            {surveyStep === 2 && (
              <div>
                <h3 className="text-lg text-kustody-text mb-4">현재 외환 거래 현황을 알려주세요</h3>
                
                <div className="mb-6">
                  <label className="block text-sm text-kustody-muted mb-2">현재 몇 개 은행과 거래하고 계세요?</label>
                  <div className="flex gap-2">
                    {['1개', '2-3개', '4-5개', '6개 이상'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setSurveyData(prev => ({ ...prev, bankCount: opt }))}
                        className={`px-4 py-2 rounded-lg border text-sm ${
                          surveyData.bankCount === opt
                            ? 'border-kustody-accent bg-kustody-accent/10 text-kustody-text'
                            : 'border-kustody-border text-kustody-muted hover:border-kustody-accent/50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-kustody-muted mb-2">주로 거래하는 은행은? (복수 선택)</label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {BANKS.map(bank => (
                      <button
                        key={bank.id}
                        onClick={() => {
                          const newBanks = surveyData.banks.includes(bank.id)
                            ? surveyData.banks.filter(b => b !== bank.id)
                            : [...surveyData.banks, bank.id];
                          setSurveyData(prev => ({ ...prev, banks: newBanks }));
                        }}
                        className={`px-3 py-2 rounded-lg border text-xs ${
                          surveyData.banks.includes(bank.id)
                            ? 'border-kustody-accent bg-kustody-accent/10 text-kustody-text'
                            : 'border-kustody-border text-kustody-muted hover:border-kustody-accent/50'
                        }`}
                      >
                        {bank.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-kustody-muted mb-2">환율 관리할 때 가장 불편한 점은? (복수 선택)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {PAIN_POINTS.map(pain => (
                      <button
                        key={pain.id}
                        onClick={() => {
                          const newPains = surveyData.painPoints.includes(pain.id)
                            ? surveyData.painPoints.filter(p => p !== pain.id)
                            : [...surveyData.painPoints, pain.id];
                          setSurveyData(prev => ({ ...prev, painPoints: newPains }));
                        }}
                        className={`p-3 rounded-lg border text-left ${
                          surveyData.painPoints.includes(pain.id)
                            ? 'border-kustody-accent bg-kustody-accent/10'
                            : 'border-kustody-border hover:border-kustody-accent/50'
                        }`}
                      >
                        <div className="text-sm font-medium text-kustody-text">{pain.label}</div>
                        <div className="text-xs text-kustody-muted mt-1">{pain.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setSurveyStep(1)} className="px-6 py-2 text-kustody-muted hover:text-kustody-text">← 이전</button>
                  <button
                    onClick={() => setSurveyStep(3)}
                    className="px-6 py-2 rounded-lg font-medium bg-kustody-accent text-kustody-dark"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 관심 기능 */}
            {surveyStep === 3 && (
              <div>
                <h3 className="text-lg text-kustody-text mb-2">어떤 기능에 관심 있으세요?</h3>
                <p className="text-sm text-kustody-muted mb-4">여러 개 선택 가능해요</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {FEATURE_INTERESTS.map(feature => (
                    <button
                      key={feature.id}
                      onClick={() => {
                        const newFeatures = surveyData.features.includes(feature.id)
                          ? surveyData.features.filter(f => f !== feature.id)
                          : [...surveyData.features, feature.id];
                        setSurveyData(prev => ({ ...prev, features: newFeatures }));
                      }}
                      className={`p-4 rounded-lg border text-left ${
                        surveyData.features.includes(feature.id)
                          ? 'border-kustody-accent bg-kustody-accent/10'
                          : 'border-kustody-border hover:border-kustody-accent/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          surveyData.features.includes(feature.id) ? 'border-kustody-accent bg-kustody-accent' : 'border-kustody-border'
                        }`}>
                          {surveyData.features.includes(feature.id) && (
                            <svg className="w-3 h-3 text-kustody-dark" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-kustody-text">{feature.label}</div>
                          <div className="text-xs text-kustody-muted mt-1">{feature.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setSurveyStep(2)} className="px-6 py-2 text-kustody-muted hover:text-kustody-text">← 이전</button>
                  <button
                    onClick={() => surveyData.features.length > 0 && setSurveyStep(4)}
                    disabled={surveyData.features.length === 0}
                    className={`px-6 py-2 rounded-lg font-medium ${surveyData.features.length > 0 ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-border text-kustody-muted cursor-not-allowed'}`}
                  >
                    다음 →
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: 추가 정보 */}
            {surveyStep === 4 && (
              <div>
                <h3 className="text-lg text-kustody-text mb-4">마지막으로, 연락처를 남겨주세요 (선택)</h3>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm text-kustody-muted mb-2">회사명</label>
                    <input
                      type="text"
                      value={surveyData.company}
                      onChange={(e) => setSurveyData(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="예: 스테이블 주식회사"
                      className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text placeholder-kustody-muted focus:border-kustody-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-kustody-muted mb-2">이메일</label>
                    <input
                      type="email"
                      value={surveyData.email}
                      onChange={(e) => setSurveyData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text placeholder-kustody-muted focus:border-kustody-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-kustody-muted mb-2">추가로 하고 싶은 말씀</label>
                    <textarea
                      value={surveyData.feedback}
                      onChange={(e) => setSurveyData(prev => ({ ...prev, feedback: e.target.value }))}
                      placeholder="예: 수출 결제가 월 $100만 정도인데, 환율 관리가 너무 어려워요..."
                      className="w-full px-4 py-3 bg-kustody-navy border border-kustody-border rounded-lg text-kustody-text placeholder-kustody-muted focus:border-kustody-accent focus:outline-none resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setSurveyStep(3)} className="px-6 py-2 text-kustody-muted hover:text-kustody-text">← 이전</button>
                  <button onClick={handleSurveySubmit} className="px-8 py-3 bg-kustody-accent text-kustody-dark font-semibold rounded-lg hover:bg-kustody-accent/90">
                    제출하기 ✓
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Survey Submitted */}
        {surveySubmitted && (
          <div className="mt-12 bg-kustody-surface rounded-2xl p-8 shadow-xl text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-semibold text-kustody-text mb-3">감사합니다!</h3>
            <p className="text-kustody-muted mb-6">소중한 의견 잘 받았어요.<br />더 나은 서비스로 찾아뵐게요!</p>
            <a href="/console" className="inline-block px-8 py-3 bg-kustody-accent text-kustody-dark font-semibold rounded-lg hover:bg-kustody-accent/90">
              🚀 전문가 콘솔 둘러보기
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-kustody-muted text-sm">
          <p>© 2025 StableFX. FX Infrastructure Platform.</p>
        </div>
      </div>
        </>
      )}

      {/* Floating Feedback Button */}
      {!showSurvey && !surveySubmitted && (
        <button
          onClick={() => setShowSurvey(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-kustody-accent text-kustody-dark rounded-full shadow-lg hover:bg-kustody-accent/90 transition-all hover:scale-110 flex items-center justify-center text-2xl"
          title="의견 남기기"
        >
          💬
        </button>
      )}

      {/* 환율 알림 설정 모달 */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-kustody-surface rounded-2xl w-full max-w-md overflow-hidden border border-kustody-border shadow-2xl">
            {/* 모달 헤더 */}
            <div className="p-5 border-b border-kustody-border flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-purple-600/10">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span>🔔</span> 환율 알림 설정
              </h3>
              <button 
                onClick={() => { setShowAlertModal(false); setAlertSubmitted(false); }}
                className="text-kustody-muted hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {!alertSubmitted ? (
              <div className="p-5 space-y-5">
                {/* 설명 */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-sm text-blue-300">
                    💡 목표 환율에 도달하면 이메일로 알려드려요!<br/>
                    <span className="text-xs text-blue-400">무료 서비스입니다.</span>
                  </p>
                </div>

                {/* 현재 환율 표시 */}
                <div className="bg-kustody-navy rounded-xl p-4">
                  <div className="text-xs text-kustody-muted mb-1">현재 USD/KRW 환율</div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">USD/KRW</span>
                    <span className="text-2xl font-mono text-kustody-accent">{spot ? formatNumber(spot, 2) : '1,442.80'}</span>
                  </div>
                </div>

                {/* 목표 환율 입력 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">목표 환율</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAlertTarget(((spot || 1442.80) * 0.99).toFixed(0))}
                      className="px-3 py-2.5 bg-green-600/20 border border-green-600/50 rounded-lg text-xs text-green-400 hover:bg-green-600/30 transition-colors"
                    >
                      ▼ 1% 하락
                    </button>
                    <input
                      type="number"
                      step="1"
                      value={alertTarget}
                      onChange={(e) => setAlertTarget(e.target.value)}
                      placeholder={(spot || 1442.80).toFixed(0)}
                      className="flex-1 px-4 py-2.5 bg-kustody-dark border border-kustody-border rounded-lg text-center font-mono text-lg focus:border-kustody-accent focus:outline-none"
                    />
                    <button 
                      onClick={() => setAlertTarget(((spot || 1442.80) * 1.01).toFixed(0))}
                      className="px-3 py-2.5 bg-red-600/20 border border-red-600/50 rounded-lg text-xs text-red-400 hover:bg-red-600/30 transition-colors"
                    >
                      ▲ 1% 상승
                    </button>
                  </div>
                </div>

                {/* 이메일 입력 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">이메일 주소</label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="example@company.com"
                    className="w-full px-4 py-3 bg-kustody-dark border border-kustody-border rounded-lg focus:border-kustody-accent focus:outline-none"
                  />
                </div>

                {/* 알림 조건 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">알림 조건</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="py-2.5 rounded-lg text-sm border bg-blue-600/20 border-blue-500 text-blue-400">
                      도달 시 1회
                    </button>
                    <button className="py-2.5 rounded-lg text-sm border bg-kustody-dark border-kustody-border text-kustody-muted">
                      매일 오전 (준비중)
                    </button>
                  </div>
                </div>

                {/* 제출 버튼 */}
                <button
                  onClick={() => {
                    if (alertEmail && alertTarget) {
                      setAlertSubmitted(true);
                      console.log('Alert request:', { email: alertEmail, target: alertTarget, pair: 'USDKRW' });
                    }
                  }}
                  disabled={!alertEmail || !alertTarget}
                  className="w-full py-3.5 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  알림 설정하기
                </button>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h4 className="text-xl font-bold mb-2">알림이 설정되었습니다!</h4>
                <p className="text-sm text-kustody-muted mb-6">
                  USD/KRW가 <span className="text-kustody-accent font-mono font-bold">{formatNumber(parseFloat(alertTarget), 0)}</span>원에 도달하면<br/>
                  <span className="text-blue-400">{alertEmail}</span>로 알림을 보내드릴게요.
                </p>
                
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-5 mb-5 text-left">
                  <p className="text-sm text-kustody-text mb-3 text-center">🎁 더 많은 기능이 필요하세요?</p>
                  <ul className="text-xs text-kustody-muted space-y-2">
                    <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 무제한 알림 설정</li>
                    <li className="flex items-center gap-2"><span className="text-green-400">✓</span> EUR, JPY 등 다양한 통화</li>
                    <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 스왑포인트 이론가 계산기</li>
                    <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 선물환 헤지 시뮬레이션</li>
                  </ul>
                </div>

                <a
                  href="/console"
                  className="block w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold hover:opacity-90 transition-opacity mb-3"
                >
                  전문가 콘솔 시작하기 →
                </a>
                <button
                  onClick={() => { setShowAlertModal(false); setAlertSubmitted(false); setAlertEmail(''); setAlertTarget(''); }}
                  className="w-full py-2 text-kustody-muted text-sm hover:text-kustody-text"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
