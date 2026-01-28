-- Global Forward Points 테이블
-- USDJPY, EURUSD, GBPUSD, EURJPY 등 글로벌 통화쌍 포워드 포인트

CREATE TABLE IF NOT EXISTS global_forward_points (
  id BIGSERIAL PRIMARY KEY,
  currency_pair VARCHAR(10) NOT NULL,  -- USDJPY, EURUSD, etc.
  tenor VARCHAR(5) NOT NULL,           -- ON, TN, 1W, 1M, 3M, 6M, 1Y, etc.
  mid_points DECIMAL(12, 6),           -- Mid forward points
  bid_points DECIMAL(12, 6),           -- Bid (spread 적용)
  ask_points DECIMAL(12, 6),           -- Ask (spread 적용)
  forward_rate DECIMAL(12, 6),         -- Forward outright rate (optional)
  source VARCHAR(20) DEFAULT 'fxempire',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for upsert
  UNIQUE(currency_pair, tenor)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_global_forward_points_pair 
  ON global_forward_points(currency_pair);
CREATE INDEX IF NOT EXISTS idx_global_forward_points_fetched 
  ON global_forward_points(fetched_at DESC);

-- 예시 데이터 (테스트용)
INSERT INTO global_forward_points (currency_pair, tenor, mid_points, bid_points, ask_points, source)
VALUES 
  ('USDJPY', '1M', -0.45, -0.50, -0.40, 'manual'),
  ('USDJPY', '3M', -1.35, -1.45, -1.25, 'manual'),
  ('USDJPY', '6M', -2.80, -2.95, -2.65, 'manual'),
  ('USDJPY', '1Y', -5.50, -5.75, -5.25, 'manual'),
  ('EURUSD', '1M', 0.00135, 0.00125, 0.00145, 'manual'),
  ('EURUSD', '3M', 0.00425, 0.00405, 0.00445, 'manual'),
  ('EURUSD', '6M', 0.00860, 0.00830, 0.00890, 'manual'),
  ('EURUSD', '1Y', 0.01720, 0.01680, 0.01760, 'manual')
ON CONFLICT (currency_pair, tenor) DO UPDATE SET
  mid_points = EXCLUDED.mid_points,
  bid_points = EXCLUDED.bid_points,
  ask_points = EXCLUDED.ask_points,
  source = EXCLUDED.source,
  fetched_at = NOW();

-- RLS 설정 (필요시)
-- ALTER TABLE global_forward_points ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON global_forward_points FOR SELECT USING (true);
