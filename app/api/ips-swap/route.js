// IPS Corp 스왑포인트 프록시 API
// XML 형식 엔드포인트 사용

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `http://ipscorp.co.kr/tempdata/12_swapCurveXML.asp?date=${today}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/xml, application/xml',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`IPS API error: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // XML 파싱 (간단한 정규식 사용)
    const dateMatch = xmlText.match(/<item>\s*<date>([^<]+)<\/date>/);
    const refDate = dateMatch ? dateMatch[1] : today;
    
    // value1~value15 추출
    const values = [];
    for (let i = 1; i <= 15; i++) {
      const match = xmlText.match(new RegExp(`<value${i}>([^<]+)</value${i}>`));
      if (match) {
        values.push(parseFloat(match[1]));
      }
    }
    
    // Tenor 매핑 (IPS 화면 기준)
    // value1=1W, value2=2W, value3=3W, value4=1M, value5=2M, value6=3M
    // value7=4M, value8=5M, value9=6M, value10=9M, value15=12M
    const tenorMap = [
      { valueIdx: 0, tenor: '1W', days: 7 },
      { valueIdx: 1, tenor: '2W', days: 14 },
      { valueIdx: 2, tenor: '3W', days: 21 },
      { valueIdx: 3, tenor: '1M', days: 30 },
      { valueIdx: 4, tenor: '2M', days: 60 },
      { valueIdx: 5, tenor: '3M', days: 90 },
      { valueIdx: 6, tenor: '4M', days: 120 },
      { valueIdx: 7, tenor: '5M', days: 150 },
      { valueIdx: 8, tenor: '6M', days: 180 },
      { valueIdx: 9, tenor: '9M', days: 270 },
      { valueIdx: 14, tenor: '1Y', days: 365 },  // value15 = 12M
    ];
    
    // broker 형식으로 변환 (기존 코드와 호환)
    const brokerData = [];
    
    tenorMap.forEach(tm => {
      const midPoints = values[tm.valueIdx];
      if (midPoints !== undefined) {
        // Bid/Ask 스프레드: 짧은 tenor일수록 넓게
        let spreadPct = 0.02; // 기본 2%
        if (tm.days <= 14) spreadPct = 0.05;
        else if (tm.days <= 30) spreadPct = 0.03;
        
        const spread = Math.abs(midPoints * spreadPct) || 1;
        brokerData.push({
          tenor: tm.tenor,
          days: tm.days,
          b_bid: (midPoints - spread).toFixed(2),
          b_ask: (midPoints + spread).toFixed(2),
          b_mid: midPoints.toFixed(2),
        });
      }
    });
    
    return Response.json({
      success: true,
      data: {
        broker: brokerData,
        referenceDate: refDate,
        source: 'IPS Corp XML',
      },
      raw: values, // 디버깅용
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
