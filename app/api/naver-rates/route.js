// 네이버 환율 프록시 API (CORS 우회)
// Dynamic route - 항상 서버에서 실행
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 기본 KRW 페어만 fetch (cross rate는 계산)
    const pairs = [
      { code: 'FX_USDKRW', pair: 'USDKRW' },
      { code: 'FX_JPYKRW', pair: 'JPYKRW' },
      { code: 'FX_EURKRW', pair: 'EURKRW' },
      { code: 'FX_GBPKRW', pair: 'GBPKRW' },
      { code: 'FX_CNYKRW', pair: 'CNYKRW' },
      { code: 'FX_HKDKRW', pair: 'HKDKRW' },
      { code: 'FX_CHFKRW', pair: 'CHFKRW' },
      { code: 'FX_AUDKRW', pair: 'AUDKRW' },
    ];
    
    const rates = {};
    
    for (const { code, pair } of pairs) {
      try {
        const response = await fetch(`https://api.stock.naver.com/marketindex/exchange/${code}`, {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          const info = data.exchangeInfo;
          if (info && info.closePrice) {
            // 쉼표 제거 후 파싱 (예: "1,423.50" → 1423.50)
            const parseRate = (str) => parseFloat(String(str).replace(/,/g, '')) || 0;
            
            rates[pair] = {
              rate: parseRate(info.closePrice),
              change: parseRate(info.fluctuations),
              changePercent: parseRate(info.fluctuationsRatio),
              high: null,
              low: null,
            };
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch ${pair}:`, err);
      }
    }
    
    // 크로스 환율 계산 (직접 fetch 하지 않고 계산)
    const usd = rates.USDKRW?.rate;
    const eur = rates.EURKRW?.rate;
    const gbp = rates.GBPKRW?.rate;
    const jpy = rates.JPYKRW?.rate;  // 100엔당
    const cny = rates.CNYKRW?.rate;
    const hkd = rates.HKDKRW?.rate;
    const chf = rates.CHFKRW?.rate;
    const aud = rates.AUDKRW?.rate;
    
    if (usd && eur) {
      rates['EURUSD'] = { rate: eur / usd, change: 0, changePercent: 0 };
    }
    if (usd && gbp) {
      rates['GBPUSD'] = { rate: gbp / usd, change: 0, changePercent: 0 };
    }
    if (usd && jpy) {
      rates['USDJPY'] = { rate: usd / (jpy / 100), change: 0, changePercent: 0 };
    }
    if (usd && cny) {
      rates['USDCNH'] = { rate: usd / cny, change: 0, changePercent: 0 };
    }
    if (usd && hkd) {
      rates['USDHKD'] = { rate: usd / hkd, change: 0, changePercent: 0 };
    }
    if (usd && chf) {
      rates['USDCHF'] = { rate: usd / chf, change: 0, changePercent: 0 };
    }
    if (usd && aud) {
      rates['AUDUSD'] = { rate: aud / usd, change: 0, changePercent: 0 };
    }
    
    return Response.json({ 
      success: true, 
      rates, 
      timestamp: Date.now() 
    });
    
  } catch (error) {
    console.error('Naver API error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
