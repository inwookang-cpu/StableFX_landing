'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';

function HolidaysTab({ holidays, setHolidays }) {
  const [selectedCountry, setSelectedCountry] = useState('KR');
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('fixed');
  const currentHolidays = holidays[selectedCountry] || [];

  const handleAdd = () => {
    if (!newDate || !newName) return;
    const updated = [...currentHolidays, { date: newDate, name: newName, type: newType }].sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(prev => ({ ...prev, [selectedCountry]: updated }));
    setNewDate(''); setNewName(''); setNewType('fixed');
  };

  const handleDelete = (index) => setHolidays(prev => ({ ...prev, [selectedCountry]: currentHolidays.filter((_, i) => i !== index) }));

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ year: 2025, country: selectedCountry, holidays: currentHolidays }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${selectedCountry.toLowerCase()}_holidays.json`; a.click();
  };

  const typeColors = { fixed: 'bg-blue-500', lunar: 'bg-yellow-500', substitute: 'bg-green-500', floating: 'bg-orange-500' };

  return (
    <div className="grid lg:grid-cols-3 gap-8 animate-fade-in">
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4"><div className="w-1 h-6 bg-kustody-accent rounded-full" /><h2 className="text-lg font-semibold">휴일 추가</h2></div>
        <div className="space-y-4">
          <div><label className="block text-sm text-kustody-muted mb-2">국가</label><select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className="w-full"><option value="KR">🇰🇷 한국</option><option value="US">🇺🇸 미국</option></select></div>
          <div><label className="block text-sm text-kustody-muted mb-2">날짜</label><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full font-mono" /></div>
          <div><label className="block text-sm text-kustody-muted mb-2">휴일명</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 광복절" className="w-full" /></div>
          <div><label className="block text-sm text-kustody-muted mb-2">유형</label><select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full"><option value="fixed">Fixed</option><option value="lunar">Lunar</option><option value="substitute">Substitute</option><option value="floating">Floating</option></select></div>
          <button onClick={handleAdd} disabled={!newDate || !newName} className="w-full py-3 bg-kustody-accent text-kustody-dark font-semibold rounded-lg disabled:opacity-50">➕ 휴일 추가</button>
          <button onClick={handleExport} className="w-full py-3 bg-kustody-navy text-kustody-text rounded-lg">💾 JSON 다운로드</button>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{selectedCountry} 휴일 목록</h2><span className="text-sm text-kustody-muted">{currentHolidays.length}개</span></div>
        <div className="bg-kustody-surface rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
          {currentHolidays.map((h, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 border-b border-kustody-border/50 hover:bg-kustody-navy/30">
              <div className="flex items-center gap-4"><span className="font-mono text-sm text-kustody-muted w-24">{h.date}</span><span>{h.name}</span></div>
              <div className="flex items-center gap-3"><span className={`px-2 py-0.5 text-xs rounded-full text-white ${typeColors[h.type]}`}>{h.type}</span><button onClick={() => handleDelete(i)} className="text-kustody-muted hover:text-red-400">🗑️</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HolidaysTab;
