/**
 * SupabaseService 사용 예시
 * 
 * 기존 코드 vs 새 코드 비교
 */

// ==================== 기존 코드 (Before) ====================

// 환율 가져오기 - 약 20줄
const SUPABASE_URL = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';

const today = new Date().toISOString().split('T')[0];
const spotRes = await fetch(
  `${SUPABASE_URL}/rest/v1/spot_rates?source=eq.naver&reference_date=eq.${today}&order=fetched_at.desc`,
  {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  }
);
if (spotRes.ok) {
  const spotData = await spotRes.json();
  if (spotData && spotData.length > 0) {
    const rates = {};
    spotData.forEach(record => {
      if (!rates[record.currency_pair]) {
        rates[record.currency_pair] = parseFloat(record.rate);
      }
    });
    // ... 사용
  }
}


// ==================== 새 코드 (After) ====================

import supabase from '@/app/console/services/SupabaseService';

// 환율 가져오기 - 1줄!
const rates = await supabase.getSpotRatesSimple();
// { USDKRW: 1445.9, EURKRW: 1708.4, ... }


// ==================== 다른 예시들 ====================

// 스왑포인트 가져오기
const swapData = await supabase.getLatestSwapPoints();
// {
//   referenceDate: '2026-02-03',
//   spotDate: '2026-02-05',
//   points: [
//     { tenor: '1W', days: 7, mid: 0.245, bid: null, ask: null },
//     { tenor: '1M', days: 30, mid: 1.05, ... },
//     ...
//   ]
// }


// 스프레드 설정 가져오기
const spreads = await supabase.getSpreadSettings();
// { 'O/N': 1.5, 'T/N': 1.5, '1W': 4, '1M': 10, ... }


// 재무환율 가져오기
const { date, rates } = await supabase.getLatestAccountingRates();
// date: '2026-02-03'
// rates: [{ currency_code: 'USD', rate_krw: 1443.6, ... }, ...]


// 스왑포인트 저장 (upsert)
await supabase.saveSwapPoints([
  {
    reference_date: '2026-02-03',
    spot_date: '2026-02-05',
    tenor: '1W',
    days: 7,
    mid_points: 0.245,
    source: 'IPS'
  }
]);


// ==================== CurvesTab에서 사용 예시 ====================

import { useState, useEffect } from 'react';
import supabase from '@/app/console/services/SupabaseService';
import { DEFAULT_SPREADS } from '@/app/console/services/constants';
import { formatRate, formatSwapPoint } from '@/app/console/services/formatters';

function CurvesTab() {
  const [rates, setRates] = useState({});
  const [swapPoints, setSwapPoints] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. 환율 로드
        const spotRates = await supabase.getSpotRatesSimple();
        setRates(spotRates);

        // 2. 스왑포인트 로드
        const swapData = await supabase.getLatestSwapPoints();
        setSwapPoints(swapData);

        // 3. 스프레드 설정 로드
        let spreads;
        try {
          spreads = await supabase.getSpreadSettings();
        } catch {
          spreads = DEFAULT_SPREADS;
        }

        console.log('✅ Data loaded:', { spotRates, swapData, spreads });
      } catch (error) {
        console.error('Load failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Spot Rate: {formatRate('USDKRW', rates.USDKRW)}</h2>
      <h2>1M Swap: {formatSwapPoint(swapPoints?.points?.find(p => p.tenor === '1M')?.mid)}</h2>
    </div>
  );
}
