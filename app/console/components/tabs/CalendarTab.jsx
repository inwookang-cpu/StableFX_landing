'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';

import { 
  DateRuleCalculator, 
  formatDate,
  getDayName
} from '../../../../lib/dateCalculator';

function CalendarTab({ holidays }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedCountries, setSelectedCountries] = useState(['KR', 'US']);

  const holidayMap = useMemo(() => {
    const map = {};
    for (const country of selectedCountries) {
      for (const h of (holidays[country] || [])) { if (!map[h.date]) map[h.date] = []; map[h.date].push({ ...h, country }); }
    }
    return map;
  }, [holidays, selectedCountries]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    for (let i = startOffset - 1; i >= 0; i--) { const d = new Date(viewYear, viewMonth, -i); days.push({ date: d, isCurrentMonth: false }); }
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(viewYear, viewMonth, i), isCurrentMonth: true });
    while (days.length < 42) { days.push({ date: new Date(viewYear, viewMonth + 1, days.length - lastDay.getDate() - startOffset + 1), isCurrentMonth: false }); }
    return days;
  }, [viewYear, viewMonth]);

  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const todayStr = formatDate(today);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => viewMonth === 0 ? (setViewYear(y => y-1), setViewMonth(11)) : setViewMonth(m => m-1)} className="w-10 h-10 rounded-lg bg-kustody-surface hover:bg-kustody-navy flex items-center justify-center">←</button>
          <div className="text-xl font-semibold min-w-[140px] text-center">{viewYear}년 {monthNames[viewMonth]}</div>
          <button onClick={() => viewMonth === 11 ? (setViewYear(y => y+1), setViewMonth(0)) : setViewMonth(m => m+1)} className="w-10 h-10 rounded-lg bg-kustody-surface hover:bg-kustody-navy flex items-center justify-center">→</button>
        </div>
        <div className="flex gap-2">{['KR','US'].map(c => <button key={c} onClick={() => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`px-3 py-1.5 text-sm rounded-lg ${selectedCountries.includes(c) ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-surface text-kustody-muted'}`}>{c}</button>)}</div>
      </div>
      <div className="bg-kustody-surface rounded-xl p-6">
        <div className="grid grid-cols-7 gap-2 mb-4">{['월','화','수','목','금','토','일'].map((d,i) => <div key={d} className={`text-center text-sm py-2 ${i >= 5 ? 'text-kustody-muted' : ''}`}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, i) => {
            const dateStr = formatDate(day.date);
            const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
            const holidayInfo = holidayMap[dateStr];
            return (
              <div key={i} title={holidayInfo?.map(h => `${h.country}: ${h.name}`).join('\n')}
                className={`cal-day relative ${!day.isCurrentMonth ? 'cal-day-other-month' : ''} ${isWeekend && day.isCurrentMonth ? 'cal-day-weekend' : ''} ${holidayInfo ? 'cal-day-holiday' : ''} ${dateStr === todayStr ? 'cal-day-today' : ''}`}>
                {day.date.getDate()}
                {holidayInfo && day.isCurrentMonth && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CalendarTab;
