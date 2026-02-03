'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';

import { 
  DateRuleCalculator, 
  CALENDAR_MAP, 
  TENORS, 
  DATE_RULES,
  formatDate,
  getDayName,
  getDayNameEn
} from '../../../../lib/dateCalculator';

function CalculatorTab({ holidays }) {
  const today = formatDate(new Date());
  
  const [currencyPair, setCurrencyPair] = useState('USDKRW');
  const [tradeDate, setTradeDate] = useState(today);
  const [tenor, setTenor] = useState('1M');
  const [dateRule, setDateRule] = useState('MD_FOLLOWING');
  const [spotDays, setSpotDays] = useState(2);
  const [eomRule, setEomRule] = useState(true);

  // 지원 통화쌍 (Direct only)
  const supportedPairs = ['USDKRW', 'USDJPY', 'EURUSD'];

  useEffect(() => { 
    const config = CALENDAR_MAP[currencyPair]; 
    if (config) setSpotDays(config.spotDays); 
  }, [currencyPair]);

  const result = useMemo(() => {
    const config = CALENDAR_MAP[currencyPair] || { calendars: ['KR', 'US'], spotDays: 2 };
    const calendars = config.calendars;
    const holidayCalendars = {};
    for (const cal of calendars) { if (holidays[cal]) holidayCalendars[cal] = holidays[cal]; }
    const calc = new DateRuleCalculator(holidayCalendars);
    const tradeDt = new Date(tradeDate + 'T00:00:00');
    let spotDate = new Date(tradeDt);
    for (let i = 0; i < spotDays; i++) spotDate = calc.nextBusinessDay(spotDate, true, calendars);
    let maturityDate = tenor === 'SPOT' ? spotDate : calc.addTenor(tradeDt, tenor, spotDays, calendars, eomRule);
    return {
      tradeDate: tradeDt, spotDate, maturityDate,
      isTradeBD: calc.isBusinessDay(tradeDt, calendars),
      isSpotEOM: calc.isEndOfMonthBusinessDay(spotDate, calendars),
      daysToMaturity: Math.round((maturityDate - spotDate) / (1000 * 60 * 60 * 24)),
      businessDays: calc.countBusinessDays(spotDate, maturityDate, calendars),
      calendars
    };
  }, [currencyPair, tradeDate, tenor, spotDays, eomRule, holidays]);

  return (
    <div className="grid lg:grid-cols-2 gap-8 animate-fade-in">
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4"><div className="w-1 h-6 bg-kustody-accent rounded-full" /><h2 className="text-lg font-semibold">입력</h2></div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-kustody-muted mb-2">통화쌍</label>
            <select 
              value={currencyPair} 
              onChange={(e) => setCurrencyPair(e.target.value)} 
              className="w-full"
            >
              {supportedPairs.map(pair => <option key={pair} value={pair}>{pair}</option>)}
            </select>
          </div>
          <div><label className="block text-sm text-kustody-muted mb-2">거래일 (Trade Date)</label><input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="w-full font-mono" /></div>
          <div><label className="block text-sm text-kustody-muted mb-2">Spot Days <span className="ml-2 text-xs text-kustody-accent">(기본: 2일)</span></label><input type="number" min="0" max="5" value={spotDays} onChange={(e) => setSpotDays(parseInt(e.target.value) || 0)} className="w-full font-mono" /></div>
          <div><label className="block text-sm text-kustody-muted mb-2">Tenor</label><select value={tenor} onChange={(e) => setTenor(e.target.value)} className="w-full">{TENORS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="block text-sm text-kustody-muted mb-2">Date Rule</label><select value={dateRule} onChange={(e) => setDateRule(e.target.value)} className="w-full">{DATE_RULES.map(rule => <option key={rule.value} value={rule.value}>{rule.label}</option>)}</select></div>
          <div className="flex items-center justify-between py-3 px-4 bg-kustody-surface rounded-lg">
            <div><div className="text-sm text-kustody-text">End-of-Month Rule</div><div className="text-xs text-kustody-muted">Spot이 월말이면 만기도 월말</div></div>
            <button onClick={() => setEomRule(!eomRule)} className={`w-12 h-6 rounded-full transition-colors relative ${eomRule ? 'bg-kustody-accent' : 'bg-kustody-border'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${eomRule ? 'left-7' : 'left-1'}`} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2"><span className="text-xs text-kustody-muted">적용 캘린더:</span>{result.calendars.map(cal => <span key={cal} className="px-2 py-0.5 text-xs font-mono bg-kustody-navy rounded">{cal}</span>)}</div>
      </div>
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4"><div className="w-1 h-6 bg-kustody-accent rounded-full" /><h2 className="text-lg font-semibold">결과</h2></div>
        {!result.isTradeBD && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-yellow-400 text-sm">⚠️ 거래일이 휴일입니다</div>}
        {eomRule && result.isSpotEOM && tenor !== 'SPOT' && !['O/N','ON','T/N','TN','S/N','SN'].includes(tenor) && !tenor.endsWith('W') && <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-lg px-4 py-3 text-kustody-accent text-sm">📅 EOM Rule 적용됨</div>}
        <div className="space-y-4">
          <ResultCard label="거래일" date={result.tradeDate} sublabel="Trade Date" />
          <ResultCard label="Spot Date" date={result.spotDate} sublabel={`T+${spotDays}`} highlight />
          <ResultCard label="만기일" date={result.maturityDate} sublabel="Maturity Date" highlight />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="bg-kustody-surface rounded-lg p-4 text-center"><div className="text-2xl font-mono font-semibold text-kustody-accent">{result.daysToMaturity}</div><div className="text-xs text-kustody-muted mt-1">Calendar Days</div></div>
          <div className="bg-kustody-surface rounded-lg p-4 text-center"><div className="text-2xl font-mono font-semibold text-kustody-text">{result.businessDays}</div><div className="text-xs text-kustody-muted mt-1">Business Days</div></div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, date, sublabel, highlight }) {
  return (
    <div className={`result-card rounded-xl p-5 ${highlight ? 'ring-1 ring-kustody-accent/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div><div className="text-sm text-kustody-muted">{label}</div><div className="text-xs text-kustody-muted/60 mt-0.5">{sublabel}</div></div>
        <div className="text-right"><div className="text-xl font-mono font-semibold text-kustody-text">{formatDate(date)}</div><div className="text-sm text-kustody-muted mt-0.5">{getDayName(date)} ({getDayNameEn(date)})</div></div>
      </div>
    </div>
  );
}

export default CalculatorTab;
