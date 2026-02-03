/**
 * SupabaseService - Supabase REST API 연동 클래스
 * 
 * 사용법:
 * import supabase from '@/app/console/services/SupabaseService';
 * const rates = await supabase.getSpotRates();
 */

class SupabaseService {
  constructor() {
    this.url = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
    this.key = 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';
  }

  // ==================== 기본 메서드 ====================
  
  /**
   * GET 요청
   */
  async get(table, query = '') {
    const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Supabase GET error: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * POST 요청 (Insert)
   */
  async insert(table, data) {
    const response = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase INSERT error: ${error}`);
    }
    
    return true;
  }

  /**
   * UPSERT 요청 (Insert or Update)
   */
  async upsert(table, data, conflictColumns) {
    const query = conflictColumns ? `?on_conflict=${conflictColumns}` : '';
    const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase UPSERT error: ${error}`);
    }
    
    return true;
  }

  // ==================== Spot Rates ====================
  
  /**
   * 오늘 환율 가져오기
   * @param {string} source - 'naver' | 'calculated'
   */
  async getSpotRates(source = 'naver') {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.get(
      'spot_rates',
      `?source=eq.${source}&reference_date=eq.${today}&order=fetched_at.desc`
    );
    
    // 통화쌍별로 최신 값만 반환
    const rates = {};
    data.forEach(record => {
      if (!rates[record.currency_pair]) {
        rates[record.currency_pair] = {
          rate: parseFloat(record.rate),
          change: record.change,
          changePercent: record.change_percent,
          fetchedAt: record.fetched_at
        };
      }
    });
    
    return rates;
  }

  /**
   * 환율 간단히 가져오기 (rate만)
   */
  async getSpotRatesSimple(source = 'naver') {
    const fullRates = await this.getSpotRates(source);
    const rates = {};
    Object.keys(fullRates).forEach(pair => {
      rates[pair] = fullRates[pair].rate;
    });
    return rates;
  }

  // ==================== FX Swap Points ====================
  
  /**
   * 최신 스왑포인트 가져오기
   */
  async getLatestSwapPoints() {
    const data = await this.get(
      'fx_swap_points',
      '?order=reference_date.desc&limit=30'
    );
    
    if (!data || data.length === 0) return null;
    
    // 최신 reference_date 데이터만 필터링
    const latestDate = data[0].reference_date;
    const latestData = data.filter(d => d.reference_date === latestDate);
    
    return {
      referenceDate: latestDate,
      spotDate: latestData[0]?.spot_date,
      points: latestData.map(d => ({
        tenor: d.tenor,
        days: d.days,
        mid: d.mid_points,
        bid: d.bid_points,
        ask: d.ask_points,
        source: d.source
      }))
    };
  }

  /**
   * 스왑포인트 저장 (upsert)
   */
  async saveSwapPoints(points) {
    for (const point of points) {
      await this.upsert('fx_swap_points', point, 'reference_date,tenor');
    }
    return true;
  }

  /**
   * 스왑포인트 마지막 업데이트 시간 확인
   */
  async getSwapPointsLastUpdate() {
    const data = await this.get(
      'fx_swap_points',
      '?select=updated_at&order=updated_at.desc&limit=1'
    );
    
    if (data && data.length > 0) {
      return new Date(data[0].updated_at);
    }
    return null;
  }

  // ==================== Spread Settings ====================
  
  /**
   * 스프레드 설정 가져오기
   */
  async getSpreadSettings() {
    const data = await this.get('spread_settings', '?select=*');
    
    const settings = {};
    data.forEach(row => {
      const tenorName = row.tenor === 'ON' ? 'O/N' : row.tenor === 'TN' ? 'T/N' : row.tenor;
      settings[tenorName] = row.spread_pips || 0;
    });
    
    return settings;
  }

  // ==================== Accounting Rates ====================
  
  /**
   * 재무환율 가져오기 (특정 날짜)
   */
  async getAccountingRates(date) {
    return this.get(
      'accounting_rates',
      `?reference_date=eq.${date}&order=currency_code.asc`
    );
  }

  /**
   * 최신 재무환율 가져오기
   */
  async getLatestAccountingRates() {
    const data = await this.get(
      'accounting_rates',
      '?order=reference_date.desc,currency_code.asc&limit=100'
    );
    
    if (!data || data.length === 0) return { date: null, rates: [] };
    
    const latestDate = data[0].reference_date;
    const rates = data.filter(r => r.reference_date === latestDate);
    
    return { date: latestDate, rates };
  }

  // ==================== Curve Data ====================
  
  /**
   * 최신 커브 데이터 가져오기 (View)
   */
  async getLatestCurve() {
    return this.get('latest_fx_curve', '?select=*');
  }

  /**
   * USD/KRW 금리 가져오기
   */
  async getRates(currency = 'usd') {
    const table = currency.toLowerCase() === 'usd' ? 'usd_rates' : 'krw_rates';
    return this.get(table, '?order=tenor.asc');
  }
}

// 싱글톤 인스턴스 export
const supabase = new SupabaseService();
export default supabase;

// 클래스도 export (테스트용)
export { SupabaseService };
