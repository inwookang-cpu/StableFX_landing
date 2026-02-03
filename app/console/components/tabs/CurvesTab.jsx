'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  DateRuleCalculator, 
  formatDate,
  getDayName,
  getDayNameEn
} from '../../../../lib/dateCalculator';
import DeferredInput from '../common/DeferredInput';
import supabase from '../../services/SupabaseService';
import { CACHE_DURATION } from '../../services/constants';

// 네이버 환율 캐시 (모듈 레벨)
let naverRateCache = {
  data: null,
  lastFetch: null,
  CACHE_DURATION: CACHE_DURATION.SPOT_RATES
};

// Spot Rate 포맷팅
const formatSpotRate = (pair, rate) => {
  if (rate === null || rate === undefined || isNaN(rate)) return '-';
  if (pair === 'USDKRW' || pair === 'USDJPY') {
    return rate.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return rate.toFixed(5);
};

function CurvesTab({ onCurveDataChange }) {
  const [curveData, setCurveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCcy, setSelectedCcy] = useState('USD');
  const [rebuilding, setRebuilding] = useState(false);
  
  // Override values (user input)
  const [overrides, setOverrides] = useState({});
  const [bidOverrides, setBidOverrides] = useState({});
  const [askOverrides, setAskOverrides] = useState({});
  
  // Interpolation state
  const [interpDate, setInterpDate] = useState('2026-02-27'); // Maturity (1M)
  const [interpStartDate, setInterpStartDate] = useState('2026-01-29'); // Start (Spot)
  const [interpMethod, setInterpMethod] = useState('swap_point_linear');
  const [viewMode, setViewMode] = useState('pro'); // 'beginner' or 'pro'
  
  // Supabase 연동 state
  const [dataLoading, setDataLoading] = useState(false);
  const [ipsDate, setIpsDate] = useState('2026-01-27');
  const [ipsSpotDate, setIpsSpotDate] = useState('2026-01-29');
  
  // 네이버 환율 state
  const [naverRates, setNaverRates] = useState(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [naverLastUpdate, setNaverLastUpdate] = useState(null);
  
  // Market 실시간 state
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLastUpdate, setMarketLastUpdate] = useState(null);
  
  // Spread settings (DB에서 가져옴)
  const [spreadSettings, setSpreadSettings] = useState({});
  
  // Market 캐시 (30분)
  const MARKET_CACHE_DURATION = CACHE_DURATION.SWAP_POINTS;
  
  // curveData 변경 시 부모에게 전달 (Advisory 탭과 공유)
  useEffect(() => {
    if (curveData && onCurveDataChange) {
      onCurveDataChange(curveData);
    }
  }, [curveData, onCurveDataChange]);
  
  // Spread settings 가져오기
  // 기본 spread 설정 (DB에 없을 경우 fallback)
  // spread_pips = 한쪽 spread (bid = mid - spread, ask = mid + spread)
  const DEFAULT_SPREADS = {
    'O/N': 1.5, 'T/N': 1.5, '1W': 4,
    '1M': 10, '2M': 20, '3M': 30,
    '6M': 40, '9M': 60, '1Y': 80
  };
  
  const fetchSpreadSettings = async () => {
    try {
      const settings = await supabase.getSpreadSettings();
      if (Object.keys(settings).length > 0) {
        setSpreadSettings(settings);
        return settings;
      }
    } catch (error) {
      console.error('Spread settings fetch error:', error);
    }
    // DB에 데이터 없으면 기본값 사용
    console.log('Using default spread settings');
    setSpreadSettings(DEFAULT_SPREADS);
    return DEFAULT_SPREADS;
  };
  
  // mid에 spread 적용해서 bid/ask 계산
  const applySpreadToSwapPoints = (swapPoints, spreads) => {
    return swapPoints.map(sp => {
      const spreadPips = spreads[sp.tenor] || 0;
      const spreadValue = spreadPips / 100; // pips를 원 단위로 변환
      return {
        ...sp,
        bid: sp.points - spreadValue,
        ask: sp.points + spreadValue
      };
    });
  };
  
  // Market에서 스왑포인트 가져오기 + DB 저장
  const fetchMarketSwapPoints = async (force = false) => {
    setMarketLoading(true);
    
    try {
      // 1. DB에서 최신 데이터 시간 확인
      if (!force) {
        try {
          const lastUpdate = await supabase.getSwapPointsLastUpdate();
          if (lastUpdate) {
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / 1000 / 60;
            
            if (diffMinutes < 30) {
              console.log(`DB 캐시 사용 (${Math.round(diffMinutes)}분 전 데이터)`);
              // DB에서 가져오기
              await fetchCurveData();
              setMarketLastUpdate(lastUpdate);
              setMarketLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Cache check failed:', e);
        }
      }
      
      // 2. Market에서 새로 가져오기 (API route 통해서 - CORS 우회)
      console.log('Market 데이터 수집 중...');
      const response = await fetch('/api/ips-swap');
      
      if (!response.ok) {
        throw new Error('Market API 오류');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Market API 실패');
      }
      
      const data = result.data;
      
      if (!data.broker || data.broker.length === 0) {
        throw new Error('Market 데이터 없음');
      }
      
      // 3. 테너 매핑 및 파싱
      const tenorMap = [
        { tenor: 'ON', days: -1 },
        { tenor: 'TN', days: 0 },
        { tenor: '1W', days: 7 },
        { tenor: '2W', days: 14 },
        { tenor: '1M', days: 30 },
        { tenor: '2M', days: 60 },
        { tenor: '3M', days: 90 },
        { tenor: '6M', days: 180 },
        { tenor: '9M', days: 270 },
        { tenor: '1Y', days: 365 },
      ];
      
      const today = new Date().toISOString().split('T')[0];
      const spotDate = new Date();
      spotDate.setDate(spotDate.getDate() + 2);
      while (spotDate.getDay() === 0 || spotDate.getDay() === 6) {
        spotDate.setDate(spotDate.getDate() + 1);
      }
      const spotDateStr = spotDate.toISOString().split('T')[0];
      
      const swapPoints = [];
      
      for (let i = 0; i < Math.min(data.broker.length, tenorMap.length); i++) {
        const row = data.broker[i];
        const { tenor, days } = tenorMap[i];
        
        const mid = parseFloat(row.mid) || null;
        const bid = parseFloat(row.bid) || null;
        const ask = parseFloat(row.ask) || null;
        
        if (mid !== null) {
          swapPoints.push({
            reference_date: today,
            spot_date: spotDateStr,
            tenor: tenor,
            days: days,
            mid_points: mid,
            bid_points: bid,
            ask_points: ask,
            source: 'MARKET'
          });
        }
      }
      
      // 4. DB에 저장 (upsert)
      await supabase.saveSwapPoints(swapPoints);
      
      console.log(`✅ ${swapPoints.length}개 스왑포인트 DB 저장 완료`);
      
      // 5. Spread settings 가져오기
      const spreads = await fetchSpreadSettings();
      
      // 6. curveData 업데이트 (spread 적용)
      if (curveData) {
        const newData = JSON.parse(JSON.stringify(curveData));
        
        newData.metadata.referenceDate = today;
        if (newData.curves?.USDKRW?.USD) {
          newData.curves.USDKRW.USD.spotDate = spotDateStr;
        }
        if (newData.curves?.USDKRW?.KRW) {
          newData.curves.USDKRW.KRW.spotDate = spotDateStr;
        }
        
        // fxSwapPoints 업데이트 (spread 적용)
        const tenorNameMap = { 'ON': 'O/N', 'TN': 'T/N' };
        newData.curves.USDKRW.fxSwapPoints = newData.curves.USDKRW.fxSwapPoints.map(sp => {
          const marketData = swapPoints.find(d => 
            (tenorNameMap[d.tenor] || d.tenor) === sp.tenor
          );
          if (marketData) {
            const mid = marketData.mid_points;
            const spreadPips = spreads[sp.tenor] || 0;
            const spreadValue = spreadPips / 100;
            return {
              ...sp,
              points: mid,
              bid: mid - spreadValue,
              ask: mid + spreadValue
            };
          }
          return sp;
        });
        
        setCurveData(newData);
        setInterpStartDate(spotDateStr);
      }
      
      setMarketLastUpdate(new Date());
      alert('✅ Market 데이터 갱신 완료!');
      
    } catch (error) {
      console.error('Market fetch error:', error);
      alert('❌ Market 연결 실패: ' + error.message);
    } finally {
      setMarketLoading(false);
    }
  };
  
  // 네이버 환율 가져오기 - Supabase 우선, fallback으로 API route
  const fetchNaverRates = async (force = false) => {
    const now = Date.now();
    
    // 캐시 유효성 체크 (4분)
    if (!force && naverRateCache.data && naverRateCache.lastFetch && 
        (now - naverRateCache.lastFetch) < naverRateCache.CACHE_DURATION) {
      setNaverRates(naverRateCache.data);
      setNaverLastUpdate(new Date(naverRateCache.lastFetch));
      return naverRateCache.data;
    }
    
    setNaverLoading(true);
    try {
      // 1. Supabase에서 먼저 조회 (GitHub Actions가 15분마다 업데이트)
      const today = new Date().toISOString().split('T')[0];
      const supabaseData = await supabase.get(
        'spot_rates',
        `?source=eq.naver&reference_date=eq.${today}&order=fetched_at.desc`
      );
      
      console.log('📊 Supabase spot_rates:', supabaseData.length, 'records');
      
      if (supabaseData && supabaseData.length > 0) {
        const latestRecord = supabaseData[0];
        const fetchedAt = new Date(latestRecord.fetched_at);
        const ageMinutes = (now - fetchedAt.getTime()) / (1000 * 60);
        
        console.log(`⏱️ Supabase data age: ${Math.round(ageMinutes)}분`);
        
        // 24시간 이내 데이터면 사용
        if (ageMinutes < 1440) {
          const rates = {};
          supabaseData.forEach(record => {
            if (!rates[record.currency_pair]) {
              rates[record.currency_pair] = parseFloat(record.rate);
            }
          });
          
          naverRateCache.data = rates;
          naverRateCache.lastFetch = now;
          
          setNaverRates(rates);
          setNaverLastUpdate(fetchedAt);
          console.log('✅ Spot rates from Supabase:', rates);
          
          return rates;
        } else {
          console.log('⚠️ Supabase 데이터가 24시간 이상 오래됨, API 호출...');
        }
      }
      
      // 2. Supabase에 없으면 내부 API route 호출 (fallback)
      console.log('📡 Supabase에 데이터 없음, API route 호출...');
      const response = await fetch('/api/naver-rates');
      
      if (!response.ok) {
        throw new Error('API 오류');
      }
      
      const result = await response.json();
      
      if (result.success && result.rates) {
        // API 응답 변환 (객체 → 숫자)
        const rates = {};
        Object.keys(result.rates).forEach(pair => {
          const val = result.rates[pair];
          rates[pair] = typeof val === 'object' ? val.rate : val;
        });
        
        // 캐시 업데이트
        naverRateCache.data = rates;
        naverRateCache.lastFetch = now;
        
        setNaverRates(rates);
        setNaverLastUpdate(new Date(now));
        console.log('✅ Spot rates from API:', rates);
        
        return rates;
      } else {
        throw new Error(result.error || '데이터 없음');
      }
    } catch (error) {
      console.error('Naver rates fetch error:', error);
      // 에러 시 조용히 실패 (alert 제거)
      console.warn('⚠️ 환율 조회 실패, 기본값 사용');
      return null;
    } finally {
      setNaverLoading(false);
    }
  };
  
  // 네이버 환율을 curveData에 적용
  const applyNaverRates = async () => {
    const rates = await fetchNaverRates(true);
    if (rates && curveData) {
      const newData = JSON.parse(JSON.stringify(curveData));
      
      // spotRates 업데이트
      Object.keys(newData.spotRates).forEach(pair => {
        if (rates[pair] !== undefined) {
          // 객체면 rate 추출, 숫자면 그대로 사용
          const rateValue = typeof rates[pair] === 'object' ? rates[pair].rate : rates[pair];
          if (rateValue) {
            newData.spotRates[pair] = rateValue;
          }
        }
      });
      
      setCurveData(newData);
    }
  };
  
  // Supabase에서 커브 데이터 가져오기
  const fetchCurveData = async () => {
    setDataLoading(true);
    try {
      // 1. Spread settings 먼저 가져오기
      const spreads = await fetchSpreadSettings();
      
      // 2. Supabase에서 최신 커브 데이터 가져오기
      const data = await supabase.getLatestCurve();
      
      if (data && data.length > 0) {
        // curveData 업데이트
        const newData = JSON.parse(JSON.stringify(originalData));
        
        // Spot date 업데이트
        const spotDate = data[0]?.spot_date;
        if (spotDate && newData.curves?.USDKRW?.USD) {
          newData.curves.USDKRW.USD.spotDate = spotDate;
        }
        if (spotDate && newData.curves?.USDKRW?.KRW) {
          newData.curves.USDKRW.KRW.spotDate = spotDate;
        }
        
        // metadata 업데이트
        const refDate = data[0]?.reference_date;
        if (refDate) {
          newData.metadata.referenceDate = refDate;
        }
        
        // fxSwapPoints 업데이트 (spread 적용)
        if (newData.curves?.USDKRW?.fxSwapPoints) {
          const tenorMap = {
            'ON': 'O/N', 'TN': 'T/N',
            '1W': '1W', '2W': '2W', '3W': '3W',
            '1M': '1M', '2M': '2M', '3M': '3M',
            '4M': '4M', '5M': '5M', '6M': '6M',
            '7M': '7M', '8M': '8M', '9M': '9M',
            '10M': '10M', '11M': '11M', '1Y': '1Y'
          };
          
          newData.curves.USDKRW.fxSwapPoints = newData.curves.USDKRW.fxSwapPoints.map(sp => {
            const dbRow = data.find(d => tenorMap[d.tenor] === sp.tenor || d.tenor === sp.tenor);
            if (dbRow) {
              const mid = dbRow.mid_points;
              const spreadPips = spreads[sp.tenor] || 0;
              const spreadValue = spreadPips / 100; // pips를 원 단위로 변환
              return {
                ...sp,
                points: mid,
                bid: mid - spreadValue,
                ask: mid + spreadValue,
                days: dbRow.days
              };
            }
            return sp;
          });
        }
        
        setOriginalData(newData);
        setCurveData(newData);
        
        // Interpolation 날짜 업데이트
        if (data[0]?.spot_date) {
          setInterpStartDate(data[0].spot_date);
          const oneMonthLater = new Date(data[0].spot_date);
          oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
          setInterpDate(oneMonthLater.toISOString().split('T')[0]);
        }
        
        alert('✅ 데이터 로드 완료!');
      } else {
        alert('⚠️ 데이터가 없습니다. 먼저 data-collector를 실행하세요.');
      }
    } catch (error) {
      console.error('Supabase fetch error:', error);
      alert('❌ 데이터 로드 실패: ' + error.message);
    } finally {
      setDataLoading(false);
    }
  };

  // ============================================================
  // USD Bootstrapping: Rate → DF 계산
  // ============================================================
  const bootstrapUSD = (curve) => {
    if (!curve || !curve.tenors) return curve;
    
    const dayCount = curve.dayCount || 360;
    const tenors = [...curve.tenors].sort((a, b) => a.days - b.days);
    const bootstrapped = [];
    
    // 연간 DF 저장 (Swap bootstrapping용)
    const annualDFs = {};
    
    for (let i = 0; i < tenors.length; i++) {
      const tenor = tenors[i];
      const days = tenor.days;
      const yearFrac = days / dayCount;
      
      const rate = tenor.rate / 100;
      let df;
      
      if (tenor.type === 'CASH' || Math.abs(days) <= 365) {
        // Cash: Simple Interest
        df = 1 / (1 + rate * yearFrac);
      } else {
        // Swap: Bootstrapping with annual compounding
        const years = Math.floor(Math.abs(days) / 365);
        let couponPV = 0;
        for (let y = 1; y < years; y++) {
          if (annualDFs[y]) couponPV += rate * annualDFs[y];
        }
        df = (1 - couponPV) / (1 + rate);
      }
      
      // 연간 DF 저장
      const years = Math.round(Math.abs(days) / 365);
      if (years >= 1 && Math.abs(Math.abs(days) - years * 365) < 30) {
        annualDFs[years] = df;
      }
      
      const lnDF = Math.log(df);
      const zeroRate = Math.abs(yearFrac) > 0 ? ((1/df - 1) / yearFrac) * 100 : tenor.rate;
      
      bootstrapped.push({
        ...tenor,
        df: df,
        lnDF: lnDF,
        zeroRate: zeroRate
      });
    }
    
    return { ...curve, tenors: bootstrapped, lastBootstrap: new Date().toISOString() };
  };

  // ============================================================
  // KRW DF 역산: FX Swap Points + USD DF + Spot → KRW DF
  // Forward = Spot + SwapPoint
  // KRW_DF = USD_DF × Spot / Forward
  // ============================================================
  const bootstrapKRW = (krwCurve, usdCurve, fxSwapPoints, spot, screenOvr = {}, bidOvr = {}, askOvr = {}) => {
    if (!krwCurve || !usdCurve || !fxSwapPoints || !spot) return krwCurve;
    
    const dayCount = krwCurve.dayCount || 365;
    const tenors = [...krwCurve.tenors].sort((a, b) => a.days - b.days);
    const bootstrapped = [];
    
    // USD DF 보간 함수
    const getUsdDF = (targetDays) => {
      const usdTenors = usdCurve.tenors.filter(t => t.df).sort((a, b) => a.days - b.days);
      if (usdTenors.length === 0) return 1;
      
      // 정확히 일치하는 tenor 찾기
      const exact = usdTenors.find(t => t.days === targetDays);
      if (exact) return exact.df;
      
      // 범위 밖
      if (targetDays <= usdTenors[0].days) return usdTenors[0].df;
      if (targetDays >= usdTenors[usdTenors.length - 1].days) return usdTenors[usdTenors.length - 1].df;
      
      // Log-linear 보간
      let lower = usdTenors[0], upper = usdTenors[1];
      for (let i = 0; i < usdTenors.length - 1; i++) {
        if (targetDays >= usdTenors[i].days && targetDays <= usdTenors[i + 1].days) {
          lower = usdTenors[i];
          upper = usdTenors[i + 1];
          break;
        }
      }
      
      const t = (targetDays - lower.days) / (upper.days - lower.days);
      const lnDfLower = Math.log(lower.df);
      const lnDfUpper = Math.log(upper.df);
      return Math.exp(lnDfLower + (lnDfUpper - lnDfLower) * t);
    };
    
    // FX Swap Point에서 해당 tenor 찾기 (오버라이드 반영)
    // 오버라이드는 전단위 입력 (예: -100) → 원단위 변환 (예: -1.00)
    const getSwapPoint = (days, tenorName) => {
      const sp = fxSwapPoints.find(s => s.days === days);
      if (!sp) return null;
      
      // 오버라이드 적용 (전단위 입력 → 원단위 변환: / 100)
      const points = screenOvr[tenorName] !== undefined && screenOvr[tenorName] !== '' 
        ? parseFloat(screenOvr[tenorName]) / 100 
        : sp.points;
      const bid = bidOvr[tenorName] !== undefined && bidOvr[tenorName] !== '' 
        ? parseFloat(bidOvr[tenorName]) / 100 
        : sp.bid;
      const ask = askOvr[tenorName] !== undefined && askOvr[tenorName] !== '' 
        ? parseFloat(askOvr[tenorName]) / 100 
        : sp.ask;
      
      return { ...sp, points, bid, ask };
    };
    
    for (let i = 0; i < tenors.length; i++) {
      const tenor = tenors[i];
      const days = tenor.days;
      const yearFrac = days / dayCount;
      
      let dfMid, dfBid, dfAsk;
      
      // FX Swap Points에서 역산 (오버라이드 포함)
      const swapPoint = getSwapPoint(days, tenor.tenor);
      const usdDF = getUsdDF(days);
      
      if (swapPoint && usdDF) {
        // Forward = Spot + SwapPoint
        // KRW_DF = USD_DF × Spot / Forward = USD_DF / (1 + SwapPoint/Spot)
        const forwardMid = spot + (swapPoint.points || 0);
        const forwardBid = spot + (swapPoint.bid !== null ? swapPoint.bid : swapPoint.points || 0);
        const forwardAsk = spot + (swapPoint.ask !== null ? swapPoint.ask : swapPoint.points || 0);
        
        dfMid = usdDF * spot / forwardMid;
        dfBid = usdDF * spot / forwardBid;
        dfAsk = usdDF * spot / forwardAsk;
      } else if (days < 0) {
        // O/N 등 Spot 이전 - JSON의 기존 값 사용
        const rate = tenor.rate / 100;
        dfMid = 1 / (1 + rate * Math.abs(yearFrac));
        dfBid = tenor.dfBid || dfMid;
        dfAsk = tenor.dfAsk || dfMid;
      } else {
        // FX Swap Point 없으면 Rate에서 계산
        const rate = tenor.rate / 100;
        dfMid = 1 / (1 + rate * yearFrac);
        dfBid = tenor.dfBid || dfMid;
        dfAsk = tenor.dfAsk || dfMid;
      }
      
      const lnDF = Math.log(dfMid);
      const lnDfBid = Math.log(dfBid);
      const lnDfAsk = Math.log(dfAsk);
      const zeroRate = Math.abs(yearFrac) > 0 ? ((1/dfMid - 1) / yearFrac) * 100 : tenor.rate;
      
      bootstrapped.push({
        ...tenor,
        df: dfMid,
        dfBid: dfBid,
        dfAsk: dfAsk,
        lnDF: lnDF,
        lnDfBid: lnDfBid,
        lnDfAsk: lnDfAsk,
        zeroRate: zeroRate
      });
    }
    
    return { ...krwCurve, tenors: bootstrapped, lastBootstrap: new Date().toISOString() };
  };
  
  // Curve Rebuild 함수 (강제 bootstrap)
  const rebuildCurves = () => {
    if (!originalData) return;
    
    setRebuilding(true);
    
    setTimeout(() => {
      const newData = JSON.parse(JSON.stringify(originalData));
      
      if (newData.curves?.USDKRW) {
        const spot = newData.spotRates?.USDKRW;
        const fxSwapPoints = newData.curves.USDKRW.fxSwapPoints;
        
        // Rate override 적용
        ['USD', 'KRW'].forEach(ccy => {
          if (newData.curves.USDKRW[ccy]?.tenors) {
            newData.curves.USDKRW[ccy].tenors = newData.curves.USDKRW[ccy].tenors.map(t => {
              const key = `${ccy}_${t.tenor}`;
              if (rateOverrides[key] !== undefined && rateOverrides[key] !== '') {
                return { ...t, rate: parseFloat(rateOverrides[key]) };
              }
              return t;
            });
          }
        });
        
        // 1. USD Bootstrap 먼저 (Rate → DF)
        newData.curves.USDKRW.USD = bootstrapUSD(newData.curves.USDKRW.USD);
        
        // 2. KRW Bootstrap (FX Swap Points + USD DF → KRW DF, 오버라이드 포함)
        newData.curves.USDKRW.KRW = bootstrapKRW(
          newData.curves.USDKRW.KRW,
          newData.curves.USDKRW.USD,
          fxSwapPoints,
          spot,
          overrides,
          bidOverrides,
          askOverrides
        );
      }
      setCurveData(newData);
      setRebuilding(false);
    }, 100);
  };

  // Rate 수정 state
  const [rateOverrides, setRateOverrides] = useState({});
  const [originalData, setOriginalData] = useState(null);
  
  // Rate 및 FX Swap Points 변경 시 자동 Bootstrap
  useEffect(() => {
    if (!originalData) return;
    
    // 오버라이드가 하나도 없으면 스킵
    const hasAnyOverride = 
      Object.keys(rateOverrides).length > 0 ||
      Object.keys(overrides).length > 0 ||
      Object.keys(bidOverrides).length > 0 ||
      Object.keys(askOverrides).length > 0;
    
    if (!hasAnyOverride) return;
    
    // Rate override 적용 후 bootstrap
    const newData = JSON.parse(JSON.stringify(originalData));
    
    if (newData.curves?.USDKRW) {
      const spot = newData.spotRates?.USDKRW;
      const fxSwapPoints = newData.curves.USDKRW.fxSwapPoints;
      
      // Rate override 적용
      ['USD', 'KRW'].forEach(ccy => {
        if (newData.curves.USDKRW[ccy]?.tenors) {
          newData.curves.USDKRW[ccy].tenors = newData.curves.USDKRW[ccy].tenors.map(t => {
            const key = `${ccy}_${t.tenor}`;
            if (rateOverrides[key] !== undefined && rateOverrides[key] !== '') {
              return { ...t, rate: parseFloat(rateOverrides[key]) };
            }
            return t;
          });
        }
      });
      
      // 1. USD Bootstrap 먼저 (Rate → DF)
      newData.curves.USDKRW.USD = bootstrapUSD(newData.curves.USDKRW.USD);
      
      // 2. KRW Bootstrap (FX Swap Points + USD DF → KRW DF, 오버라이드 포함)
      newData.curves.USDKRW.KRW = bootstrapKRW(
        newData.curves.USDKRW.KRW,
        newData.curves.USDKRW.USD,
        fxSwapPoints,
        spot,
        overrides,
        bidOverrides,
        askOverrides
      );
      
      // 3. Forward Spreads에 Near/Far Bid/Ask 정보 추가 (오버라이드 반영)
      if (newData.forwardSpreads?.USDKRW && fxSwapPoints) {
        newData.forwardSpreads.USDKRW = newData.forwardSpreads.USDKRW.map(s => {
          const nearSp = fxSwapPoints.find(sp => sp.tenor === s.nearTenor);
          const farSp = fxSwapPoints.find(sp => sp.tenor === s.farTenor);
          
          // 오버라이드 적용 (전단위 → 원단위)
          const nearBid = bidOverrides[s.nearTenor] !== undefined && bidOverrides[s.nearTenor] !== ''
            ? parseFloat(bidOverrides[s.nearTenor]) / 100 : (nearSp?.bid ?? null);
          const nearAsk = askOverrides[s.nearTenor] !== undefined && askOverrides[s.nearTenor] !== ''
            ? parseFloat(askOverrides[s.nearTenor]) / 100 : (nearSp?.ask ?? null);
          const farBid = bidOverrides[s.farTenor] !== undefined && bidOverrides[s.farTenor] !== ''
            ? parseFloat(bidOverrides[s.farTenor]) / 100 : (farSp?.bid ?? null);
          const farAsk = askOverrides[s.farTenor] !== undefined && askOverrides[s.farTenor] !== ''
            ? parseFloat(askOverrides[s.farTenor]) / 100 : (farSp?.ask ?? null);
          
          return { ...s, nearBid, nearAsk, farBid, farAsk };
        });
      }
    }
    
    setCurveData(newData);
  }, [rateOverrides, overrides, bidOverrides, askOverrides, originalData]);

  useEffect(() => {
    const loadInitialData = async () => {
      // 1. JSON 로드 (fallback 구조용)
      const res = await fetch('/config/curves/20260127_IW.json');
      if (!res.ok) return;
      const data = await res.json();
      
      if (!data) return;
      
      // 2. Supabase에서 최신 환율 가져오기 (오늘 날짜만)
      try {
        const today = new Date().toISOString().split('T')[0];
        const spotData = await supabase.get(
          'spot_rates',
          `?source=eq.naver&reference_date=eq.${today}&order=fetched_at.desc`
        );
        
        if (spotData && spotData.length > 0) {
          // 최신 환율로 spotRates 업데이트 (첫 번째 값만 사용 - DESC 정렬이라 최신)
          const rates = {};
          spotData.forEach(record => {
            // 이미 있으면 스킵 (최신 값 유지)
            if (rates[record.currency_pair]) return;
            
            if (data.spotRates && data.spotRates[record.currency_pair] !== undefined) {
              data.spotRates[record.currency_pair] = parseFloat(record.rate);
            }
            rates[record.currency_pair] = parseFloat(record.rate);
          });
          
          // naverRates state 업데이트 (UI 표시용)
          setNaverRates(rates);
          setNaverLastUpdate(new Date(spotData[0].fetched_at));
          
          // 캐시도 업데이트 (fetchNaverRates 중복 호출 방지)
          naverRateCache.data = rates;
          naverRateCache.lastFetch = Date.now();
          
          console.log('✅ Initial spot rates from Supabase:', data.spotRates);
        }
      } catch (e) {
        console.warn('Supabase spot rate fetch failed:', e);
      }
      
      // 3. Supabase에서 최신 IPS 스왑포인트 자동 로드
      let ipsDataLoaded = false;
      try {
        const ipsData = await supabase.get(
          'fx_swap_points',
          '?order=reference_date.desc&limit=30'
        );
        
        if (ipsData && ipsData.length > 0) {
          // 최신 reference_date의 데이터만 필터링
          const latestDate = ipsData[0].reference_date;
          const latestData = ipsData.filter(d => d.reference_date === latestDate);
            
            // Spot date 업데이트
            const spotDate = latestData[0]?.spot_date;
            if (spotDate && data.curves?.USDKRW?.USD) {
              data.curves.USDKRW.USD.spotDate = spotDate;
            }
            if (spotDate && data.curves?.USDKRW?.KRW) {
              data.curves.USDKRW.KRW.spotDate = spotDate;
            }
            
            // metadata 업데이트
            data.metadata.referenceDate = latestDate;
            
            // fxSwapPoints 업데이트 (IPS 데이터로)
            const tenorMap = {
              'ON': 'O/N', 'TN': 'T/N',
              '1W': '1W', '2W': '2W', '3W': '3W',
              '1M': '1M', '2M': '2M', '3M': '3M',
              '4M': '4M', '5M': '5M', '6M': '6M',
              '7M': '7M', '8M': '8M', '9M': '9M',
              '10M': '10M', '11M': '11M', '1Y': '1Y'
            };
            
            if (data.curves?.USDKRW?.fxSwapPoints) {
              data.curves.USDKRW.fxSwapPoints = data.curves.USDKRW.fxSwapPoints.map(sp => {
                const dbRow = latestData.find(d => tenorMap[d.tenor] === sp.tenor || d.tenor === sp.tenor);
                if (dbRow) {
                  return {
                    ...sp,
                    points: dbRow.mid_points,
                    days: dbRow.days || sp.days
                  };
                }
                return sp;
              });
            }
            
            // 날짜 state 업데이트용
            setIpsDate(latestDate);
            setIpsSpotDate(spotDate || data.curves?.USDKRW?.USD?.spotDate || '2026-01-29');
            setInterpStartDate(spotDate || '2026-01-29');
            
            ipsDataLoaded = true;
            console.log(`✅ Auto-loaded IPS data: ${latestDate} (${latestData.length} tenors)`);
          }
      } catch (e) {
        console.warn('Auto IPS fetch failed, using JSON fallback:', e);
      }
      
      // IPS 데이터 못 가져왔으면 JSON 기본 날짜 사용
      if (!ipsDataLoaded) {
        setIpsDate(data.metadata?.referenceDate || '2026-01-27');
        setIpsSpotDate(data.curves?.USDKRW?.USD?.spotDate || '2026-01-29');
      }
      
      // 4. Spread 설정 가져오기
      const spreads = await fetchSpreadSettings();
      
      // 5. fxSwapPoints에 spread 적용 (bid/ask 계산)
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
      
      setOriginalData(data);
      
      // 초기 로드 시에도 Bootstrap 실행 (FX Swap Points 기준 KRW DF 계산)
      if (data.curves?.USDKRW) {
        const spot = data.spotRates?.USDKRW;
        const fxSwapPoints = data.curves.USDKRW.fxSwapPoints;
        
        // 1. USD Bootstrap
        data.curves.USDKRW.USD = bootstrapUSD(data.curves.USDKRW.USD);
        
        // 2. KRW Bootstrap (FX Swap Points 기준)
        data.curves.USDKRW.KRW = bootstrapKRW(
          data.curves.USDKRW.KRW,
          data.curves.USDKRW.USD,
          fxSwapPoints,
          spot
        );
        
        // 3. Forward Spreads에 Near/Far Bid/Ask 정보 추가 (Tight 계산용)
        if (data.forwardSpreads?.USDKRW && fxSwapPoints) {
          data.forwardSpreads.USDKRW = data.forwardSpreads.USDKRW.map(s => {
            const nearSp = fxSwapPoints.find(sp => sp.tenor === s.nearTenor);
            const farSp = fxSwapPoints.find(sp => sp.tenor === s.farTenor);
            return {
              ...s,
              nearBid: nearSp?.bid ?? null,
              nearAsk: nearSp?.ask ?? null,
              farBid: farSp?.bid ?? null,
              farAsk: farSp?.ask ?? null
            };
          });
        }
      }
          
      setCurveData(data);
      setLoading(false);
    };
    
    loadInitialData();
  }, []);

  // Swap Point Linear Interpolation
  const interpolateSwapPointLinear = (days, swapPoints, spotDateStr, targetDateStr) => {
    if (!swapPoints || swapPoints.length === 0) return null;
    
    // Spot 이전 (days < 0): 해당 구간의 T/N, O/N 값 그대로 반환
    // 표시: Start(입력일) → Maturity(Spot)
    if (days < 0) {
      const tn = swapPoints.find(sp => sp.tenor === 'T/N');
      const on = swapPoints.find(sp => sp.tenor === 'O/N');
      
      if (days === -1) {
        // Tom: T/N 구간 (입력일 → Spot)
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: 1,
          tenor: 'T/N',
          points: tn?.points || 0,
          bid: tn?.bid || 0,
          ask: tn?.ask || 0
        };
      } else if (days <= -2) {
        // Today: O/N + T/N 구간
        // Start(입력일) → Spot, 2일
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: Math.abs(days),
          tenor: 'O/N+T/N',
          points: (on?.points || 0) + (tn?.points || 0),
          bid: (on?.bid || 0) + (tn?.bid || 0),
          ask: (on?.ask || 0) + (tn?.ask || 0)
        };
      }
    }
    
    // Spot (days = 0)
    if (days === 0) {
      return { 
        startDate: spotDateStr,
        maturityDate: spotDateStr,
        displayDays: 0,
        tenor: 'Spot',
        points: 0, 
        bid: 0, 
        ask: 0 
      };
    }
    
    // Spot 이후 (days > 0): 1W, 1M, ... 등 Spot 이후 tenor들만 사용
    // 표시: Start(Spot) → Maturity(입력일)
    const postSpot = swapPoints.filter(sp => sp.days > 0).sort((a, b) => a.days - b.days);
    
    if (postSpot.length === 0) return null;
    
    let result;
    let tenor = '';
    
    // 범위 체크
    if (days <= postSpot[0].days) {
      // 1W 이전: 0 ~ 1W 사이 비례 계산
      const t = days / postSpot[0].days;
      tenor = `<${postSpot[0].tenor}`;
      result = {
        points: postSpot[0].points * t,
        bid: postSpot[0].bid !== null ? postSpot[0].bid * t : null,
        ask: postSpot[0].ask !== null ? postSpot[0].ask * t : null
      };
    } else if (days >= postSpot[postSpot.length - 1].days) {
      tenor = `>${postSpot[postSpot.length - 1].tenor}`;
      result = { 
        points: postSpot[postSpot.length - 1].points, 
        bid: postSpot[postSpot.length - 1].bid, 
        ask: postSpot[postSpot.length - 1].ask 
      };
    } else {
      // 보간할 구간 찾기
      let lower = postSpot[0], upper = postSpot[1];
      for (let i = 0; i < postSpot.length - 1; i++) {
        if (days >= postSpot[i].days && days <= postSpot[i + 1].days) {
          lower = postSpot[i];
          upper = postSpot[i + 1];
          break;
        }
      }
      
      tenor = `${lower.tenor}-${upper.tenor}`;
      
      // Linear interpolation
      const t = (days - lower.days) / (upper.days - lower.days);
      result = {
        points: lower.points + (upper.points - lower.points) * t,
        bid: (lower.bid !== null && upper.bid !== null) ? lower.bid + (upper.bid - lower.bid) * t : null,
        ask: (lower.ask !== null && upper.ask !== null) ? lower.ask + (upper.ask - lower.ask) * t : null
      };
    }
    
    return {
      startDate: spotDateStr,
      maturityDate: targetDateStr,
      displayDays: days,
      tenor: tenor,
      ...result
    };
  };

  // Raw Interpolation (Log-Linear DF)
  // 저장된 lnDF를 linear interpolation → exp() → DF
  // Bid/Mid/Ask 커브 각각 보간
  const interpolateRaw = (days, usdCurve, krwCurve, spot, fxSwapPoints, spotDateStr, targetDateStr) => {
    if (!usdCurve || !krwCurve || !spot) return null;
    
    // Spot 이전 (days < 0): Swap Point Linear와 동일
    if (days < 0 && fxSwapPoints) {
      const tn = fxSwapPoints.find(sp => sp.tenor === 'T/N');
      const on = fxSwapPoints.find(sp => sp.tenor === 'O/N');
      
      if (days === -1) {
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: 1,
          tenor: 'T/N',
          usdDF: 1,
          krwDF: 1,
          forward: spot + (tn?.points || 0),
          points: tn?.points || 0,
          bid: tn?.bid || 0,
          ask: tn?.ask || 0
        };
      } else if (days <= -2) {
        const totalPoints = (on?.points || 0) + (tn?.points || 0);
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: Math.abs(days),
          tenor: 'O/N+T/N',
          usdDF: 1,
          krwDF: 1,
          forward: spot + totalPoints,
          points: totalPoints,
          bid: (on?.bid || 0) + (tn?.bid || 0),
          ask: (on?.ask || 0) + (tn?.ask || 0)
        };
      }
    }
    
    // Spot (days = 0)
    if (days === 0) {
      return {
        startDate: spotDateStr,
        maturityDate: spotDateStr,
        displayDays: 0,
        tenor: 'Spot',
        usdDF: 1,
        krwDF: 1,
        forward: spot,
        points: 0,
        bid: 0,
        ask: 0
      };
    }
    
    // Spot 이후 (days > 0): Log-Linear DF 보간
    // lnDF 보간 함수 (lnDfType: 'lnDF', 'lnDfBid', 'lnDfAsk')
    const interpolateLnDF = (curve, targetDays, lnDfType = 'lnDF') => {
      const sorted = [...curve.tenors].filter(t => t[lnDfType] !== undefined && t.days > 0).sort((a, b) => a.days - b.days);
      
      if (sorted.length === 0) return null;
      
      // 범위 밖 처리
      if (targetDays <= sorted[0].days) {
        // Spot ~ 첫 tenor 사이: 비례 보간
        const t = targetDays / sorted[0].days;
        return sorted[0][lnDfType] * t;
      }
      if (targetDays >= sorted[sorted.length - 1].days) return sorted[sorted.length - 1][lnDfType];
      
      // 보간 구간 찾기
      let lower = sorted[0], upper = sorted[1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (targetDays >= sorted[i].days && targetDays <= sorted[i + 1].days) {
          lower = sorted[i];
          upper = sorted[i + 1];
          break;
        }
      }
      
      // Linear interpolation on ln(DF)
      const lnDfLower = lower[lnDfType];
      const lnDfUpper = upper[lnDfType];
      const t = (targetDays - lower.days) / (upper.days - lower.days);
      
      return lnDfLower + (lnDfUpper - lnDfLower) * t;
    };
    
    // USD는 단일 커브 (Bid/Ask 없음)
    const usdLnDF = interpolateLnDF(usdCurve, days, 'lnDF');
    const usdDF = usdLnDF !== null ? Math.exp(usdLnDF) : null;
    
    // KRW는 Bid/Mid/Ask 각각 보간
    const krwLnDFMid = interpolateLnDF(krwCurve, days, 'lnDF');
    const krwLnDFBid = interpolateLnDF(krwCurve, days, 'lnDfBid');
    const krwLnDFAsk = interpolateLnDF(krwCurve, days, 'lnDfAsk');
    
    const krwDFMid = krwLnDFMid !== null ? Math.exp(krwLnDFMid) : null;
    const krwDFBid = krwLnDFBid !== null ? Math.exp(krwLnDFBid) : null;
    const krwDFAsk = krwLnDFAsk !== null ? Math.exp(krwLnDFAsk) : null;
    
    if (!usdDF || !krwDFMid) return null;
    
    // Forward 계산: Forward = Spot × (USD_DF / KRW_DF)
    const forwardMid = spot * (usdDF / krwDFMid);
    const swapPointsMid = forwardMid - spot;
    
    const forwardBid = krwDFBid ? spot * (usdDF / krwDFBid) : null;
    const swapPointsBid = forwardBid ? forwardBid - spot : null;
    
    const forwardAsk = krwDFAsk ? spot * (usdDF / krwDFAsk) : null;
    const swapPointsAsk = forwardAsk ? forwardAsk - spot : null;
    
    return {
      startDate: spotDateStr,
      maturityDate: targetDateStr,
      displayDays: days,
      tenor: 'Interpolated',
      usdDF,
      krwDF: krwDFMid,
      krwDFBid,
      krwDFAsk,
      forward: forwardMid,
      points: swapPointsMid,
      bid: swapPointsBid,
      ask: swapPointsAsk
    };
  };

  // 계산 결과
  const interpResult = useMemo(() => {
    try {
      if (!curveData || !interpDate || !interpStartDate) return null;
      
      const usdkrw = curveData.curves?.USDKRW;
      const spot = curveData.spotRates?.USDKRW;
      if (!usdkrw || !spot) return null;
      
      const spotDate = new Date(usdkrw?.USD?.spotDate || curveData.metadata.referenceDate);
      const targetDate = new Date(interpDate);
      const startDate = new Date(interpStartDate);
      
      // 날짜 유효성 검사
      if (isNaN(spotDate.getTime()) || isNaN(targetDate.getTime()) || isNaN(startDate.getTime())) {
        return null;
      }
      
      const spotDateStr = spotDate.toISOString().split('T')[0];
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // 오버라이드가 적용된 fxSwapPoints (전단위 입력 → 원단위 변환)
      const fxSwapPointsWithOverrides = usdkrw?.fxSwapPoints?.map(sp => ({
        ...sp,
        points: overrides[sp.tenor] !== undefined && overrides[sp.tenor] !== '' 
          ? parseFloat(overrides[sp.tenor]) / 100 : sp.points,
        bid: bidOverrides[sp.tenor] !== undefined && bidOverrides[sp.tenor] !== '' 
          ? parseFloat(bidOverrides[sp.tenor]) / 100 : sp.bid,
        ask: askOverrides[sp.tenor] !== undefined && askOverrides[sp.tenor] !== '' 
          ? parseFloat(askOverrides[sp.tenor]) / 100 : sp.ask
      }));
      
      if (viewMode === 'beginner') {
        // 초보 모드: Spot 기준으로 Target Date까지 계산
        const days = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        
        let result;
        if (interpMethod === 'swap_point_linear') {
          result = interpolateSwapPointLinear(days, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        } else {
          result = interpolateRaw(days, usdkrw?.USD, usdkrw?.KRW, spot, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        }
        
        return result ? { ...result, days } : null;
      } else {
        // Pro 모드: Start Date ~ Maturity Date 구간 계산
        const startDays = Math.round((startDate - spotDate) / (1000 * 60 * 60 * 24));
        const maturityDays = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        const periodDays = maturityDays - startDays;
        
        // Start와 Maturity 각각의 Swap Point 계산
        let startResult, maturityResult;
        
        if (interpMethod === 'swap_point_linear') {
          startResult = interpolateSwapPointLinear(startDays, fxSwapPointsWithOverrides, spotDateStr, startDateStr);
          maturityResult = interpolateSwapPointLinear(maturityDays, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        } else {
          startResult = interpolateRaw(startDays, usdkrw?.USD, usdkrw?.KRW, spot, fxSwapPointsWithOverrides, spotDateStr, startDateStr);
          maturityResult = interpolateRaw(maturityDays, usdkrw?.USD, usdkrw?.KRW, spot, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        }
        
        if (!startResult || !maturityResult) return null;
      
      // Forward Spread = Maturity - Start
      const forwardPoints = maturityResult.points - startResult.points;
      
      // Conservative (보수적): 양쪽 스프레드 지불 - Roll 관점
      const conservativeBid = (maturityResult.bid !== null && startResult.ask !== null) 
        ? maturityResult.bid - startResult.ask  // Taker: Far sell (hit bid), Near buy (lift ask)
        : null;
      const conservativeAsk = (maturityResult.ask !== null && startResult.bid !== null)
        ? maturityResult.ask - startResult.bid  // Taker: Far buy (lift ask), Near sell (hit bid)
        : null;
      
      // Tight (타이트): 같은 방향 매칭 - Market Making 관점
      const tightBid = (maturityResult.bid !== null && startResult.bid !== null)
        ? maturityResult.bid - startResult.bid  // 양쪽 Bid 매칭
        : null;
      const tightAsk = (maturityResult.ask !== null && startResult.ask !== null)
        ? maturityResult.ask - startResult.ask  // 양쪽 Ask 매칭
        : null;
      
      return {
        startDate: startDateStr,
        maturityDate: targetDateStr,
        displayDays: periodDays,
        days: periodDays,
        tenor: `${startDays === 0 ? 'Spot' : startDays + 'D'} → ${maturityDays}D`,
        points: forwardPoints,
        // Conservative (Roll)
        bid: conservativeBid,
        ask: conservativeAsk,
        // Tight (Market Making)
        tightBid: tightBid,
        tightAsk: tightAsk,
        // 추가 정보
        startDays: startDays,
        maturityDays: maturityDays,
        startPoints: startResult.points,
        maturityPoints: maturityResult.points,
        startBid: startResult.bid,
        startAsk: startResult.ask,
        maturityBid: maturityResult.bid,
        maturityAsk: maturityResult.ask,
        usdDF: maturityResult.usdDF,
        krwDF: maturityResult.krwDF,
        forward: maturityResult.forward
      };
    }
    } catch (e) {
      console.warn('Interpolation calculation error:', e);
      return null;
    }
  }, [curveData, interpDate, interpStartDate, interpMethod, viewMode, overrides, bidOverrides, askOverrides]);

  if (loading) return <div className="text-center py-20 text-kustody-muted">로딩 중...</div>;
  if (!curveData) return <div className="text-center py-20 text-kustody-muted">커브 데이터가 없습니다</div>;

  const usdkrw = curveData.curves?.USDKRW;
  const spot = curveData.spotRates?.USDKRW;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Curve Snapshot</h2>
          <p className="text-sm text-kustody-muted mt-1">
            Reference: {curveData.metadata.referenceDate} | By: {curveData.metadata.createdBy}
            {usdkrw?.USD?.lastBootstrap && <span className="ml-2 text-kustody-accent">| Bootstrapped</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* DB에서 데이터 로드 */}
          <div className="flex items-center gap-1 bg-kustody-surface rounded-lg p-1">
            <button
              onClick={fetchCurveData}
              disabled={dataLoading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                dataLoading
                  ? 'bg-green-500/50 text-white cursor-wait'
                  : 'bg-green-500 text-white hover:bg-green-400'
              }`}
            >
              {dataLoading ? '⏳' : '🔄 Load DB'}
            </button>
            <button
              onClick={() => fetchMarketSwapPoints(true)}
              disabled={marketLoading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                marketLoading
                  ? 'bg-blue-500/50 text-white cursor-wait'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
              title={marketLastUpdate ? `최근: ${marketLastUpdate.toLocaleTimeString('ko-KR')}` : '30분 캐싱'}
            >
              {marketLoading ? '⏳' : '📡 Market'}
            </button>
          </div>
          <button 
            onClick={rebuildCurves}
            disabled={rebuilding}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              rebuilding 
                ? 'bg-kustody-muted text-kustody-dark cursor-wait' 
                : 'bg-yellow-500 text-kustody-dark hover:bg-yellow-400'
            }`}
          >
            {rebuilding ? '⏳ Building...' : '🔄 Rebuild Curve'}
          </button>
          {['USD','KRW'].map(c => (
            <button key={c} onClick={() => setSelectedCcy(c)} 
              className={`px-4 py-2 rounded-lg font-mono text-sm ${selectedCcy === c ? 'bg-kustody-accent text-kustody-dark font-semibold' : 'bg-kustody-surface text-kustody-muted'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Spot Rates - 엑셀 스타일 */}
      <div className="bg-kustody-surface rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">💱 Spot Rates</h3>
            <button
              onClick={applyNaverRates}
              disabled={naverLoading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                naverLoading
                  ? 'bg-orange-500/50 text-white cursor-wait'
                  : 'bg-orange-500 text-white hover:bg-orange-400'
              }`}
            >
              {naverLoading ? '⏳' : '📡 네이버'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            {naverLastUpdate && (
              <span className="text-xs text-kustody-muted">
                Last: {naverLastUpdate.toLocaleTimeString('ko-KR')}
              </span>
            )}
            <span className="text-xs text-kustody-muted">{curveData.metadata.referenceDate}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {Object.entries(curveData.spotRates).map(([pair, rate]) => (
            <div key={pair} className="text-center">
              <div className="text-xs text-kustody-muted mb-1">{pair}</div>
              <div className="font-mono font-semibold text-kustody-accent">{formatSpotRate(pair, rate)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FX Swap Points - Excel Style - 상단 전체 너비 */}
        <div className="bg-kustody-surface rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">💹 FX Swap Points</h3>
            <span className="text-xs text-kustody-muted">USDKRW</span>
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
                  <th className="text-center py-2 px-2 font-medium bg-yellow-500/20">O/R</th>
                  <th className="text-right py-2 px-2 font-medium">Bid</th>
                  <th className="text-right py-2 px-2 font-medium">Ask</th>
                </tr>
              </thead>
              <tbody>
                {usdkrw?.fxSwapPoints.map((p, i) => {
                  // 표시용 days: Start에서 Maturity까지의 실제 기간
                  const displayDays = p.start && p.maturity 
                    ? Math.round((new Date(p.maturity) - new Date(p.start)) / (1000 * 60 * 60 * 24))
                    : (p.days > 0 ? p.days : 1);
                  
                  // 전단위 표시 (× 100) - O/R 우선 적용
                  const screenPips = overrides[p.tenor] !== undefined && overrides[p.tenor] !== ''
                    ? parseInt(overrides[p.tenor])
                    : (p.points !== null ? Math.round(p.points * 100) : null);
                  const bidPips = bidOverrides[p.tenor] !== undefined && bidOverrides[p.tenor] !== ''
                    ? parseInt(bidOverrides[p.tenor])
                    : (p.bid !== null ? Math.round(p.bid * 100) : null);
                  const askPips = askOverrides[p.tenor] !== undefined && askOverrides[p.tenor] !== ''
                    ? parseInt(askOverrides[p.tenor])
                    : (p.ask !== null ? Math.round(p.ask * 100) : null);
                  
                  // Sp/Day, indicRate도 오버라이드된 값으로 계산
                  const effectivePoints = screenPips !== null ? screenPips / 100 : null;
                  const spPerDay = (displayDays > 0 && screenPips !== null) ? (screenPips / displayDays).toFixed(2) : '-';
                  const indicRate = (displayDays > 0 && effectivePoints !== null) ? ((effectivePoints / spot) * (365 / displayDays) * 100).toFixed(2) : '-';
                  
                  // 오버라이드 여부 표시
                  const hasOverride = overrides[p.tenor] !== undefined && overrides[p.tenor] !== '';
                  
                  return (
                    <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 px-2 font-mono font-semibold text-kustody-text">{p.tenor}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.start || '-'}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.maturity || '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{displayDays}</td>
                      <td className={`py-2 px-2 text-right font-mono ${hasOverride ? 'text-yellow-400' : 'text-kustody-text'}`}>
                        {screenPips !== null ? screenPips : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-accent">{spPerDay}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{indicRate}%</td>
                      <td className="py-2 px-1 bg-yellow-500/10">
                        <DeferredInput
                          placeholder=""
                          value={overrides[p.tenor] || ''}
                          onCommit={(val) => setOverrides(prev => ({ ...prev, [p.tenor]: val }))}
                          className="w-20 px-2 py-1 bg-transparent border border-kustody-border/50 rounded text-center font-mono text-sm text-yellow-400 focus:border-yellow-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <DeferredInput
                          placeholder={p.bid !== null ? Math.round(p.bid * 100).toString() : ''}
                          value={bidOverrides[p.tenor] || ''}
                          onCommit={(val) => setBidOverrides(prev => ({ ...prev, [p.tenor]: val }))}
                          className="w-20 px-2 py-1 bg-transparent border border-kustody-border/50 rounded text-right font-mono text-sm text-red-400 focus:border-red-400 focus:outline-none placeholder-red-400/50"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <DeferredInput
                          placeholder={p.ask !== null ? Math.round(p.ask * 100).toString() : ''}
                          value={askOverrides[p.tenor] || ''}
                          onCommit={(val) => setAskOverrides(prev => ({ ...prev, [p.tenor]: val }))}
                          className="w-20 px-2 py-1 bg-transparent border border-kustody-border/50 rounded text-right font-mono text-sm text-green-400 focus:border-green-400 focus:outline-none placeholder-green-400/50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Interpolation Calculator */}
          <div className="mt-6 pt-4 border-t border-kustody-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-kustody-accent">🔢 Point Interpolation</h4>
              {/* Mode Toggle */}
              <div className="flex bg-kustody-dark rounded-lg p-0.5">
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
            <div className={`grid ${viewMode === 'pro' ? 'grid-cols-4' : 'grid-cols-3'} gap-3 mb-3`}>
              {viewMode === 'pro' && (
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">Start Date</label>
                  <DeferredInput 
                    type="date" 
                    value={interpStartDate} 
                    onCommit={(val) => setInterpStartDate(val)}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-kustody-muted mb-1">
                  {viewMode === 'beginner' ? '결제일' : 'Maturity Date'}
                </label>
                <DeferredInput 
                  type="date" 
                  value={interpDate} 
                  onCommit={(val) => setInterpDate(val)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Method</label>
                <select 
                  value={interpMethod}
                  onChange={(e) => setInterpMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
                >
                  <option value="swap_point_linear">Swap Point Linear</option>
                  <option value="raw_interpolation">Raw (Log-Linear DF)</option>
                </select>
              </div>
              {/* Result inline - 전단위 표시 */}
              {interpResult && !interpResult.error && (
                <div className="bg-kustody-navy/50 rounded-lg p-2 flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-xs text-kustody-muted">Screen</div>
                    <div className="font-mono text-kustody-accent font-semibold">{interpResult.points !== null ? (interpResult.points * 100).toFixed(2) : '-'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-kustody-muted">{interpResult.displayDays}D</div>
                    <div className="font-mono text-xs text-kustody-muted">{interpResult.displayDays > 0 ? (interpResult.points * 100 / interpResult.displayDays).toFixed(2) : '-'}/d</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Detailed Result - 전단위 표시 */}
            {interpResult && !interpResult.error && (
              <div className="bg-kustody-navy/30 rounded-lg p-3">
                {viewMode === 'beginner' ? (
                  /* 초보 모드: Start < Maturity, Bid/Ask 반전 (Spot 이전) */
                  <div className="grid grid-cols-7 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xs text-kustody-muted">시작일</div>
                      <div className="font-mono text-kustody-text text-xs">{interpResult.startDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">결제일</div>
                      <div className="font-mono text-kustody-text text-xs">{interpResult.maturityDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">기간</div>
                      <div className="font-mono text-kustody-accent">{interpResult.displayDays}일</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Tenor</div>
                      <div className="font-mono text-kustody-accent text-xs">{interpResult.tenor || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Mid</div>
                      <div className="font-mono text-kustody-text">{interpResult.points !== null ? (interpResult.points * 100).toFixed(2) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Bid</div>
                      {/* Spot 이전: Swap Ask가 Outright Bid가 됨 */}
                      <div className="font-mono text-red-400">
                        {interpResult.days < 0 
                          ? (interpResult.ask !== null ? (interpResult.ask * 100).toFixed(2) : '-')
                          : (interpResult.bid !== null ? (interpResult.bid * 100).toFixed(2) : '-')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Ask</div>
                      {/* Spot 이전: Swap Bid가 Outright Ask가 됨 */}
                      <div className="font-mono text-green-400">
                        {interpResult.days < 0 
                          ? (interpResult.bid !== null ? (interpResult.bid * 100).toFixed(2) : '-')
                          : (interpResult.ask !== null ? (interpResult.ask * 100).toFixed(2) : '-')}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Pro 모드: Start Date ~ Maturity Date 구간 */
                  <div>
                    <div className="grid grid-cols-7 gap-2 text-center text-sm">
                      <div>
                        <div className="text-xs text-kustody-muted">Start</div>
                        <div className="font-mono text-kustody-text text-xs">{interpResult.startDate}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Maturity</div>
                        <div className="font-mono text-kustody-text text-xs">{interpResult.maturityDate}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Days</div>
                        <div className="font-mono text-kustody-accent">{interpResult.displayDays}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Mid</div>
                        <div className="font-mono text-kustody-text">{interpResult.points !== null ? (interpResult.points * 100).toFixed(2) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Bid</div>
                        <div className="font-mono text-red-400">{interpResult.tightBid !== null ? (interpResult.tightBid * 100).toFixed(2) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Ask</div>
                        <div className="font-mono text-green-400">{interpResult.tightAsk !== null ? (interpResult.tightAsk * 100).toFixed(2) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Spread</div>
                        <div className="font-mono text-kustody-accent">{interpResult.tightAsk !== null && interpResult.tightBid !== null ? ((interpResult.tightAsk - interpResult.tightBid) * 100).toFixed(2) : '-'}</div>
                      </div>
                    </div>
                    
                    {/* Start/Maturity 상세 - 전단위 */}
                    <div className="mt-2 pt-2 border-t border-kustody-border/30 grid grid-cols-2 gap-2 text-center text-xs">
                      <div>
                        <span className="text-kustody-muted">Start ({interpResult.startDays}D): </span>
                        <span className="font-mono">{interpResult.startPoints !== null ? (interpResult.startPoints * 100).toFixed(2) : '-'}</span>
                        <span className="text-red-400/70 ml-1">B:{interpResult.startBid !== null ? (interpResult.startBid * 100).toFixed(2) : '-'}</span>
                        <span className="text-green-400/70 ml-1">A:{interpResult.startAsk !== null ? (interpResult.startAsk * 100).toFixed(2) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-kustody-muted">Maturity ({interpResult.maturityDays}D): </span>
                        <span className="font-mono">{interpResult.maturityPoints !== null ? (interpResult.maturityPoints * 100).toFixed(2) : '-'}</span>
                        <span className="text-red-400/70 ml-1">B:{interpResult.maturityBid !== null ? (interpResult.maturityBid * 100).toFixed(2) : '-'}</span>
                        <span className="text-green-400/70 ml-1">A:{interpResult.maturityAsk !== null ? (interpResult.maturityAsk * 100).toFixed(2) : '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
                {interpMethod === 'raw_interpolation' && interpResult.usdDF && interpResult.displayDays > 0 && viewMode === 'beginner' && (
                  <div className="mt-2 pt-2 border-t border-kustody-border/30 grid grid-cols-4 gap-2 text-center text-xs">
                    <div><span className="text-kustody-muted">USD DF:</span> <span className="font-mono">{interpResult.usdDF.toFixed(6)}</span></div>
                    <div><span className="text-kustody-muted">KRW DF:</span> <span className="font-mono">{interpResult.krwDF.toFixed(6)}</span></div>
                    <div><span className="text-kustody-muted">Forward:</span> <span className="font-mono">{interpResult.forward?.toFixed(2)}</span></div>
                    <div><span className="text-kustody-muted">Indic:</span> <span className="font-mono">{((interpResult.points / spot) * (365 / interpResult.displayDays) * 100).toFixed(2)}%</span></div>
                  </div>
                )}
              </div>
            )}
            {interpResult?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {interpResult.error}
              </div>
            )}
          </div>
        </div>

        {/* Interest Rate Curve */}
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">📈 {selectedCcy} Curve</h3>
            <span className="text-xs text-kustody-muted bg-kustody-navy px-2 py-1 rounded">DC: {usdkrw?.[selectedCcy]?.dayCount}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs">
                  <th className="text-left py-2 font-medium">Tenor</th>
                  <th className="text-center py-2 font-medium">Maturity</th>
                  <th className="text-right py-2 font-medium">Days</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">DF</th>
                  <th className="text-right py-2 font-medium">Ln(DF)</th>
                  <th className="text-right py-2 font-medium">Zero Rate</th>
                </tr>
              </thead>
              <tbody>
                {usdkrw?.[selectedCcy]?.tenors.map((t, i) => {
                  const rateKey = `${selectedCcy}_${t.tenor}`;
                  return (
                    <tr key={i} className="border-t border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 font-mono font-semibold text-kustody-text">{t.tenor}</td>
                      <td className="py-2 text-center font-mono text-xs text-kustody-muted">{t.maturity}</td>
                      <td className="py-2 text-right text-kustody-muted">{t.days}</td>
                      <td className="py-1 text-right">
                        <DeferredInput
                          value={rateOverrides[rateKey] !== undefined ? rateOverrides[rateKey] : t.rate.toFixed(4)}
                          onCommit={(val) => setRateOverrides(prev => ({ ...prev, [rateKey]: val }))}
                          className="w-20 px-2 py-1 bg-kustody-dark border border-kustody-border rounded text-right font-mono text-sm text-kustody-accent focus:border-kustody-accent focus:outline-none"
                        />
                        <span className="text-kustody-muted ml-1">%</span>
                      </td>
                      <td className="py-2 text-right font-mono text-kustody-text">{t.df?.toFixed(6) || '-'}</td>
                      <td className="py-2 text-right font-mono text-kustody-muted text-xs">{t.lnDF?.toExponential(5) || '-'}</td>
                      <td className="py-2 text-right font-mono text-kustody-text">{t.zeroRate?.toFixed(4) || '-'}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Implied Yield - 동적 계산 */}
        <div className="bg-kustody-surface rounded-xl p-5">
          <h3 className="font-semibold mb-3">📊 Implied Yield</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs">
                  <th className="text-left py-2 font-medium">Tenor</th>
                  <th className="text-right py-2 font-medium">Days</th>
                  <th className="text-right py-2 font-medium">USD Rate</th>
                  <th className="text-right py-2 font-medium text-red-400">Impl Bid</th>
                  <th className="text-right py-2 font-medium text-kustody-accent">Impl Screen</th>
                  <th className="text-right py-2 font-medium text-green-400">Impl Ask</th>
                  <th className="text-right py-2 font-medium text-yellow-400">Spread</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // KRW tenor들로 implied yield 계산
                  const usdTenors = usdkrw?.USD?.tenors || [];
                  const krwTenors = usdkrw?.KRW?.tenors || [];
                  
                  const impliedData = [];
                  krwTenors.forEach(krw => {
                    if (krw.days <= 0) return; // O/N, T/N, Spot 제외
                    
                    // USD에서 같은 days tenor 찾기
                    let usd = usdTenors.find(u => u.days === krw.days);
                    if (!usd) {
                      // 가장 가까운 tenor 찾기
                      const validUsd = usdTenors.filter(u => u.days > 0);
                      if (validUsd.length > 0) {
                        usd = validUsd.reduce((prev, curr) => 
                          Math.abs(curr.days - krw.days) < Math.abs(prev.days - krw.days) ? curr : prev
                        );
                      }
                    }
                    
                    if (usd && krw) {
                      const days = krw.days;
                      const dayCount = 365;
                      
                      // DF 값들
                      const usdDF = usd.df;
                      const krwDFMid = krw.df;
                      const krwDFBid = krw.dfBid || krw.df;
                      const krwDFAsk = krw.dfAsk || krw.df;
                      
                      // Implied KRW Rate (DF에서 역산)
                      // KRW DF = 1 / (1 + r × days / dayCount)
                      // r = (1/DF - 1) × dayCount / days
                      const impliedMid = (1/krwDFMid - 1) * (dayCount / days) * 100;
                      const impliedBid = (1/krwDFBid - 1) * (dayCount / days) * 100;
                      const impliedAsk = (1/krwDFAsk - 1) * (dayCount / days) * 100;
                      
                      const usdRate = usd.zeroRate || usd.rate;
                      
                      impliedData.push({
                        tenor: krw.tenor,
                        days: days,
                        usdRate: usdRate,
                        impliedBid: impliedBid,
                        impliedMid: impliedMid,
                        impliedAsk: impliedAsk,
                        spread: impliedMid - usdRate
                      });
                    }
                  });
                  
                  return impliedData.map((y, i) => (
                    <tr key={i} className="border-t border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 font-mono font-semibold">{y.tenor}</td>
                      <td className="py-2 text-right text-kustody-muted">{y.days}</td>
                      <td className="py-2 text-right font-mono">{y.usdRate?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-red-400">{y.impliedBid?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-kustody-accent">{y.impliedMid?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-green-400">{y.impliedAsk?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-yellow-400">{y.spread?.toFixed(4)}%</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Forward Spreads */}
        <div className="bg-kustody-surface rounded-xl p-5">
          <h3 className="font-semibold mb-3">🔀 Forward Spreads</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-kustody-muted text-xs">
                <th className="text-left py-2 font-medium">Spread</th>
                <th className="text-center py-2 font-medium">Near→Far</th>
                <th className="text-right py-2 font-medium">Bid</th>
                <th className="text-right py-2 font-medium">Mid</th>
                <th className="text-right py-2 font-medium">Ask</th>
                <th className="text-right py-2 font-medium">Spread</th>
              </tr>
            </thead>
            <tbody>
              {curveData.forwardSpreads?.USDKRW.map((s, i) => {
                // Tight: Far Bid - Near Bid, Far Ask - Near Ask
                const bid = (s.farBid !== null && s.nearBid !== null) 
                  ? s.farBid - s.nearBid : null;
                const ask = (s.farAsk !== null && s.nearAsk !== null)
                  ? s.farAsk - s.nearAsk : null;
                const spread = (ask !== null && bid !== null)
                  ? ask - bid : null;
                
                return (
                  <tr key={i} className="border-t border-kustody-border/30 hover:bg-kustody-navy/20">
                    <td className="py-2 font-mono font-semibold text-kustody-accent">{s.spread}</td>
                    <td className="py-2 text-center text-kustody-muted text-xs">{s.nearTenor}→{s.farTenor}</td>
                    <td className="py-2 text-right font-mono text-red-400">{bid !== null ? Math.round(bid * 100) : '-'}</td>
                    <td className="py-2 text-right font-mono">{s.points !== null ? Math.round(s.points * 100) : '-'}</td>
                    <td className="py-2 text-right font-mono text-green-400">{ask !== null ? Math.round(ask * 100) : '-'}</td>
                    <td className="py-2 text-right font-mono text-kustody-accent">{spread !== null ? Math.round(spread * 100) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CurvesTab;
