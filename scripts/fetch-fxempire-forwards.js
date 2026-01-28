/**
 * FXEmpire Forward Rates Scraper
 * - Puppeteer 없이 fetch로 가져오기
 * - Mid 값으로 저장, Bid/Ask는 spread 적용
 * 
 * 사용법: node fetch-fxempire-forwards.js
 */

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Supabase 설정
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 대상 통화쌍
const PAIRS = [
  { pair: 'USDJPY', url: 'https://www.fxempire.com/currencies/usd-jpy/forward-rates' },
  { pair: 'EURUSD', url: 'https://www.fxempire.com/currencies/eur-usd/forward-rates' },
  { pair: 'GBPUSD', url: 'https://www.fxempire.com/currencies/gbp-usd/forward-rates' },
  { pair: 'EURJPY', url: 'https://www.fxempire.com/currencies/eur-jpy/forward-rates' },
];

// Tier4 스프레드 설정 (bp)
const SPREAD_BP = {
  'ON': 50,
  'TN': 40,
  '1W': 30,
  '1M': 20,
  '2M': 18,
  '3M': 15,
  '6M': 12,
  '9M': 10,
  '1Y': 10,
};

/**
 * Forward points를 가져와 파싱
 */
async function fetchForwardRates(pair, url) {
  console.log(`\n=== Fetching ${pair} from ${url} ===`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ HTTP ${response.status} for ${pair}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const forwardPoints = [];
    
    // 테이블에서 데이터 추출 (사이트 구조에 따라 selector 조정 필요)
    $('table tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const tenor = $(cells[0]).text().trim();
        const points = parseFloat($(cells[1]).text().replace(/,/g, ''));
        const rate = parseFloat($(cells[2]).text().replace(/,/g, ''));
        
        if (tenor && !isNaN(points)) {
          // Tenor 정규화
          const normalizedTenor = normalizeTenor(tenor);
          if (normalizedTenor) {
            // Spread 적용
            const spreadBp = SPREAD_BP[normalizedTenor] || 15;
            const spreadPoints = calculateSpreadPoints(pair, points, spreadBp);
            
            forwardPoints.push({
              tenor: normalizedTenor,
              mid: points,
              bid: spreadPoints.bid,
              ask: spreadPoints.ask,
              forwardRate: rate || null,
            });
            
            console.log(`  ${normalizedTenor}: Mid=${points}, Bid=${spreadPoints.bid}, Ask=${spreadPoints.ask}`);
          }
        }
      }
    });
    
    return forwardPoints.length > 0 ? forwardPoints : null;
    
  } catch (error) {
    console.error(`Error fetching ${pair}:`, error.message);
    return null;
  }
}

/**
 * Tenor 문자열 정규화
 */
function normalizeTenor(tenor) {
  const upper = tenor.toUpperCase().trim();
  
  // 매핑
  const mapping = {
    'OVERNIGHT': 'ON',
    'O/N': 'ON',
    'TOM/NEXT': 'TN',
    'T/N': 'TN',
    'SPOT/NEXT': 'SN',
    'S/N': 'SN',
    '1 WEEK': '1W',
    '1W': '1W',
    '2 WEEKS': '2W',
    '2W': '2W',
    '1 MONTH': '1M',
    '1M': '1M',
    '2 MONTHS': '2M',
    '2M': '2M',
    '3 MONTHS': '3M',
    '3M': '3M',
    '6 MONTHS': '6M',
    '6M': '6M',
    '9 MONTHS': '9M',
    '9M': '9M',
    '1 YEAR': '1Y',
    '1Y': '1Y',
    '12M': '1Y',
    '2 YEARS': '2Y',
    '2Y': '2Y',
  };
  
  return mapping[upper] || null;
}

/**
 * Spread 계산 (Bid/Ask)
 * - USDJPY: 1pip = 0.01
 * - EURUSD: 1pip = 0.0001
 */
function calculateSpreadPoints(pair, midPoints, spreadBp) {
  // Forward points 기준으로 spread 적용
  // spreadBp는 내재금리 기준이지만, 단순화를 위해 points에 비례하여 적용
  
  let pipValue;
  if (pair.includes('JPY')) {
    pipValue = 0.01;  // JPY pairs
  } else {
    pipValue = 0.0001;  // Other pairs
  }
  
  // Spread를 points 기준으로 환산 (간략화)
  // 실제로는 spot rate 필요하지만, 여기서는 비율로 적용
  const spreadRatio = spreadBp / 10000;  // bp to ratio
  const halfSpread = Math.abs(midPoints) * spreadRatio / 2;
  
  // 최소 spread 보장 (5 pips 정도)
  const minSpread = 5 * pipValue;
  const actualHalfSpread = Math.max(halfSpread, minSpread);
  
  return {
    bid: midPoints - actualHalfSpread,
    ask: midPoints + actualHalfSpread,
  };
}

/**
 * Supabase에 저장
 */
async function saveToSupabase(pair, forwardPoints) {
  if (!forwardPoints || forwardPoints.length === 0) {
    console.log(`⚠️ No data to save for ${pair}`);
    return;
  }
  
  const records = forwardPoints.map(fp => ({
    currency_pair: pair,
    tenor: fp.tenor,
    mid_points: fp.mid,
    bid_points: fp.bid,
    ask_points: fp.ask,
    forward_rate: fp.forwardRate,
    source: 'fxempire',
    fetched_at: new Date().toISOString(),
  }));
  
  // Upsert (currency_pair + tenor 기준)
  const { error } = await supabase
    .from('global_forward_points')
    .upsert(records, { 
      onConflict: 'currency_pair,tenor',
      ignoreDuplicates: false 
    });
  
  if (error) {
    console.error(`❌ Failed to save ${pair}:`, error.message);
  } else {
    console.log(`✅ Saved ${pair}: ${records.length} tenors`);
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🚀 Fetching FXEmpire Forward Rates...\n');
  console.log('Spread Settings (bp):', SPREAD_BP);
  
  for (const { pair, url } of PAIRS) {
    const forwardPoints = await fetchForwardRates(pair, url);
    
    if (forwardPoints) {
      await saveToSupabase(pair, forwardPoints);
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n🎉 All forward rates fetched!');
}

main().catch(console.error);
