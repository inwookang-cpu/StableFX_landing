// IPS Corp 스왑포인트 프록시 API
// 브라우저 CORS 우회용

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const response = await fetch('https://www.ipscorp.co.kr/ajax/site/market/broker_data.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.ipscorp.co.kr/',
      },
      body: 'market_gb=FX_SWAP',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`IPS API error: ${response.status}`);
    }

    const data = await response.json();
    
    return Response.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('IPS fetch error:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
