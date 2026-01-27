// 네이버 환율 프록시 API (CORS 우회)
// Dynamic route - 항상 서버에서 실행
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
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
          if (data && data.closePrice) {
            rates[pair] = parseFloat(data.closePrice);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch ${pair}:`, err);
      }
    }
    
    // 크로스 환율 계산
    if (rates.USDKRW && rates.EURKRW) {
      rates['EURUSD'] = rates.EURKRW / rates.USDKRW;
    }
    if (rates.USDKRW && rates.GBPKRW) {
      rates['GBPUSD'] = rates.GBPKRW / rates.USDKRW;
    }
    if (rates.USDKRW && rates.JPYKRW) {
      rates['USDJPY'] = rates.USDKRW / (rates.JPYKRW / 100);
    }
    if (rates.USDKRW && rates.CNYKRW) {
      rates['USDCNH'] = rates.USDKRW / rates.CNYKRW;
    }
    if (rates.USDKRW && rates.HKDKRW) {
      rates['USDHKD'] = rates.USDKRW / rates.HKDKRW;
    }
    if (rates.USDKRW && rates.CHFKRW) {
      rates['USDCHF'] = rates.USDKRW / rates.CHFKRW;
    }
    if (rates.USDKRW && rates.AUDKRW) {
      rates['AUDUSD'] = rates.AUDKRW / rates.USDKRW;
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
