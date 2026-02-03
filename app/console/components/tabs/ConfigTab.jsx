'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';

function ConfigTab() {
  const [selectedPair, setSelectedPair] = useState('USDKRW');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const currencyPairs = ['USDKRW', 'USDJPY', 'EURUSD', 'USDCNH'];

  useEffect(() => {
    setLoading(true);
    fetch(`/config/currencies/${selectedPair}.json`).then(res => res.ok ? res.json() : null).then(data => { setConfig(data); setLoading(false); }).catch(() => setLoading(false));
  }, [selectedPair]);

  if (loading) return <div className="text-center py-20 text-kustody-muted">로딩 중...</div>;
  if (!config) return <div className="text-center py-20 text-kustody-muted">Config를 불러올 수 없습니다</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <span className="text-sm text-kustody-muted">통화쌍:</span>
        <div className="flex gap-2">{currencyPairs.map(pair => <button key={pair} onClick={() => setSelectedPair(pair)} className={`px-4 py-2 rounded-lg font-mono text-sm ${selectedPair === pair ? 'bg-kustody-accent text-kustody-dark font-semibold' : 'bg-kustody-surface text-kustody-muted hover:bg-kustody-navy'}`}>{pair}</button>)}</div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-kustody-surface rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">📅 Date Convention</h3>
          <div className="space-y-2">
            <ConfigRow label="Spot Days" value={config.dateConvention.spotDays} />
            <ConfigRow label="Business Day Conv." value={config.dateConvention.businessDayConvention} />
            <ConfigRow label="EOM Rule" value={config.dateConvention.endOfMonthRule ? 'Yes' : 'No'} />
            <ConfigRow label="Calendars" value={config.dateConvention.calendars.join(', ')} />
          </div>
        </div>
        <div className="bg-kustody-surface rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">🔢 Day Count</h3>
          <div className="space-y-2">
            <ConfigRow label={`${config.dayCount.base.currency}`} value={`${config.dayCount.base.convention} (${config.dayCount.base.daysPerYear})`} />
            <ConfigRow label={`${config.dayCount.quote.currency}`} value={`${config.dayCount.quote.convention} (${config.dayCount.quote.daysPerYear})`} />
          </div>
        </div>
        <div className="bg-kustody-surface rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">⚠️ Risk Parameters</h3>
          <div className="space-y-2">
            <ConfigRow label="Line Fee" value={`${(config.riskParameters.lineFee * 100).toFixed(2)}%`} />
            <ConfigRow label="FNGB Rate" value={`${(config.riskParameters.fngbRate * 100).toFixed(2)}%`} />
            <ConfigRow label="RWA Multiplier" value={config.riskParameters.rwaMultiplier} />
          </div>
        </div>
        <div className="bg-kustody-surface rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">💱 Quote Convention</h3>
          <div className="space-y-2">
            <ConfigRow label="Spot Decimals" value={config.quoteConvention.spotDecimalPlaces} />
            <ConfigRow label="Fwd Points Decimals" value={config.quoteConvention.forwardPointsDecimalPlaces} />
            <ConfigRow label="Rate Decimals" value={config.quoteConvention.rateDecimalPlaces} />
          </div>
        </div>
        <div className="bg-kustody-surface rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">📊 Cash Instruments</h3>
          <table className="w-full text-sm"><thead><tr className="border-b border-kustody-border"><th className="text-left py-2 px-3 text-kustody-muted">Tenor</th><th className="text-left py-2 px-3 text-kustody-muted">Base Ticker</th><th className="text-left py-2 px-3 text-kustody-muted">Quote Ticker</th></tr></thead>
            <tbody>{config.instruments.cash.map((inst, i) => <tr key={i} className="border-b border-kustody-border/30"><td className="py-2 px-3 font-mono">{inst.tenor}</td><td className="py-2 px-3 font-mono text-xs text-kustody-muted">{inst.baseTicker || '-'}</td><td className="py-2 px-3 font-mono text-xs text-kustody-muted">{inst.quoteTicker || '-'}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="bg-kustody-surface rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">🔄 Swap Instruments</h3>
          <table className="w-full text-sm"><thead><tr className="border-b border-kustody-border"><th className="text-left py-2 px-3 text-kustody-muted">Tenor</th><th className="text-left py-2 px-3 text-kustody-muted">Base Ticker</th><th className="text-left py-2 px-3 text-kustody-muted">Quote Ticker</th></tr></thead>
            <tbody>{config.instruments.swap.map((inst, i) => <tr key={i} className="border-b border-kustody-border/30"><td className="py-2 px-3 font-mono">{inst.tenor}</td><td className="py-2 px-3 font-mono text-xs text-kustody-muted">{inst.baseTicker || '-'}</td><td className="py-2 px-3 font-mono text-xs text-kustody-muted">{inst.quoteTicker || '-'}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="bg-kustody-surface rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">💹 FX Swap Instruments</h3>
          <table className="w-full text-sm"><thead><tr className="border-b border-kustody-border"><th className="text-left py-2 px-3 text-kustody-muted">Tenor</th><th className="text-left py-2 px-3 text-kustody-muted">Ticker</th><th className="text-left py-2 px-3 text-kustody-muted">NDF Ticker</th></tr></thead>
            <tbody>{config.instruments.fxSwap.map((inst, i) => <tr key={i} className="border-b border-kustody-border/30"><td className="py-2 px-3 font-mono">{inst.tenor}</td><td className="py-2 px-3 font-mono text-xs text-kustody-muted">{inst.ticker}</td><td className="py-2 px-3 font-mono text-xs text-kustody-muted">{inst.ndfTicker || '-'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }) {
  return <div className="flex justify-between py-2 border-b border-kustody-border/30"><span className="text-kustody-muted text-sm">{label}</span><span className="font-mono">{value}</span></div>;
}

export default ConfigTab;
