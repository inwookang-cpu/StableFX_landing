'use client';

import '../globals.css';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  DateRuleCalculator, 
  CALENDAR_MAP, 
  TENORS, 
  DATE_RULES,
  formatDate,
  getDayName,
  getDayNameEn
} from '../../lib/dateCalculator';

// Enter 또는 blur 시에만 값을 반영하는 Input 컴포넌트
function DeferredInput({ value, onCommit, className, placeholder, type = 'text' }) {
  const [localValue, setLocalValue] = useState(value || '');
  
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  const handleCommit = () => {
    if (localValue !== (value || '')) {
      onCommit(localValue);
    }
  };
  
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCommit();
          e.target.blur();
        }
      }}
      className={className}
    />
  );
}

const DEFAULT_HOLIDAYS = {
  KR: [
    {"date": "2025-01-01", "name": "신정", "type": "fixed"},
    {"date": "2025-03-01", "name": "삼일절", "type": "fixed"},
    {"date": "2025-05-05", "name": "어린이날", "type": "fixed"},
    {"date": "2025-06-06", "name": "현충일", "type": "fixed"},
    {"date": "2025-08-15", "name": "광복절", "type": "fixed"},
    {"date": "2025-10-03", "name": "개천절", "type": "fixed"},
    {"date": "2025-10-09", "name": "한글날", "type": "fixed"},
    {"date": "2025-12-25", "name": "크리스마스", "type": "fixed"},
  ],
  US: [
    {"date": "2025-01-01", "name": "New Year's Day", "type": "fixed"},
    {"date": "2025-07-04", "name": "Independence Day", "type": "fixed"},
    {"date": "2025-12-25", "name": "Christmas", "type": "fixed"},
  ]
};

export default function Console() {
  const [activeTab, setActiveTab] = useState('calculator');
  const [holidays, setHolidays] = useState({ KR: [], US: [] });
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Curves 탭에서 로드한 데이터를 Advisory와 공유
  const [sharedCurveData, setSharedCurveData] = useState(null);

  // 금융결제원 은행코드
  const BANK_CODES = [
    { code: "004", name: "KB국민은행" },
    { code: "011", name: "NH농협은행" },
    { code: "020", name: "우리은행" },
    { code: "081", name: "하나은행" },
    { code: "088", name: "신한은행" },
    { code: "003", name: "IBK기업은행" },
    { code: "023", name: "SC제일은행" },
    { code: "027", name: "한국씨티은행" },
    { code: "071", name: "우체국" },
    { code: "089", name: "케이뱅크" },
    { code: "090", name: "카카오뱅크" },
    { code: "092", name: "토스뱅크" },
    { code: "005", name: "외환은행" },
    { code: "032", name: "부산은행" },
    { code: "031", name: "대구은행" },
    { code: "039", name: "경남은행" },
    { code: "034", name: "광주은행" },
    { code: "037", name: "전북은행" },
    { code: "035", name: "제주은행" },
  ];

  // Company Config & Clients 관리
  const DEFAULT_CONFIG = {
    companyId: "KUSTODYFI",
    companyName: "KustodyFi Co., Ltd.",
    creditTiers: {
      "1": { name: "Prime", pointMargin: 0, bpMargin: 0 },
      "2": { name: "Standard", pointMargin: 5, bpMargin: 5 },
      "3": { name: "Subprime", pointMargin: 20, bpMargin: 15 },
      "4": { name: "Discouraged", pointMargin: 100, bpMargin: 50 },
      "5": { name: "Blocked", pointMargin: null, bpMargin: null }
    },
    notionalTiers: [
      { min: 0, max: 1000000, margin: 10, name: "Small (<$1M)" },
      { min: 1000000, max: 10000000, margin: 0, name: "Standard ($1M~$10M)" },
      { min: 10000000, max: null, margin: 5, name: "Large (>$10M)" }
    ],
    counterParties: [
      { cpId: "CP001", bankCode: "004", name: "KB국민은행", accounts: { USD: "123-456-789", KRW: "987-654-321" } },
      { cpId: "CP002", bankCode: "088", name: "신한은행", accounts: { USD: "111-222-333", KRW: "333-222-111" } },
      { cpId: "CP003", bankCode: "081", name: "하나은행", accounts: { USD: "444-555-666", KRW: "666-555-444" } },
    ],
    users: [
      { userId: "U001", name: "홍길동", role: "trader" },
      { userId: "U002", name: "김철수", role: "input" },
      { userId: "U003", name: "이영희", role: "approver" },
    ],
    clients: [
      {
        clientId: "NPS001",
        clientName: "국민연금",
        creditTier: 1,
        marginType: "point",
        overrides: { ignoreCredit: true, ignoreNotional: true, customMargin: null },
        sealLayer: { status: "active", walletAddress: "0x1234...abcd", lastSync: "2025-01-06T10:00:00Z", kycStatus: "approved" },
        // 고객별 설정
        bankAccounts: [
          { bankCode: "004", bankName: "KB국민은행", usdAccount: "123-45-678901", krwAccount: "123-45-678902" },
          { bankCode: "088", bankName: "신한은행", usdAccount: "110-123-456789", krwAccount: "110-123-456790" },
        ],
        traders: [
          { name: "박재무", role: "trader", phone: "02-1234-5678", email: "park@nps.or.kr" },
          { name: "김승인", role: "approver", phone: "02-1234-5679", email: "kim@nps.or.kr" },
        ]
      },
      {
        clientId: "ABC001",
        clientName: "ABC증권",
        creditTier: 2,
        marginType: "bp",
        overrides: {},
        sealLayer: { status: "active", walletAddress: "0x5678...efgh", lastSync: "2025-01-06T09:30:00Z", kycStatus: "approved" },
        bankAccounts: [
          { bankCode: "081", bankName: "하나은행", usdAccount: "267-910123-45678", krwAccount: "267-910123-45679" },
        ],
        traders: [
          { name: "이트레이더", role: "trader", phone: "02-2222-3333", email: "lee@abc.com" },
        ]
      },
      {
        clientId: "XYZ001",
        clientName: "XYZ캐피탈",
        creditTier: 3,
        marginType: "point",
        overrides: {},
        sealLayer: { status: "pending", walletAddress: "", lastSync: null, kycStatus: "pending" },
        bankAccounts: [],
        traders: []
      },
      {
        clientId: "DEF001",
        clientName: "DEF투자",
        creditTier: 5,
        marginType: "point",
        overrides: {},
        sealLayer: { status: "blocked", walletAddress: "", lastSync: null, kycStatus: "rejected", reason: "AML 검토 중" },
        bankAccounts: [],
        traders: []
      }
    ]
  };

  const [companyConfig, setCompanyConfig] = useState(DEFAULT_CONFIG);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [pricingNotional, setPricingNotional] = useState(5000000);
  const [editingClient, setEditingClient] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);

  // Blotter (거래 기록)
  const [blotter, setBlotter] = useState([]);
  
  // Valuation 설정
  const [fixingRate, setFixingRate] = useState(1442.80); // 재무환율 (Accounting Rates USD)

  // localStorage에서 Config 로드
  useEffect(() => {
    const saved = localStorage.getItem('kustodyfi_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompanyConfig(parsed);
      } catch (e) {
        console.warn('Failed to load config:', e);
      }
    }
    // Blotter 로드
    const savedBlotter = localStorage.getItem('kustodyfi_blotter');
    if (savedBlotter) {
      try {
        setBlotter(JSON.parse(savedBlotter));
      } catch (e) {
        console.warn('Failed to load blotter:', e);
      }
    }
  }, []);

  // Blotter 저장
  const saveBlotter = (newBlotter) => {
    setBlotter(newBlotter);
    localStorage.setItem('kustodyfi_blotter', JSON.stringify(newBlotter));
  };

  // 거래 추가
  const addTrade = (trade) => {
    const newTrade = {
      ...trade,
      tradeId: `T${Date.now()}`,
      inputTime: new Date().toISOString(),
    };
    const newBlotter = [...blotter, newTrade];
    saveBlotter(newBlotter);
    return newTrade;
  };

  // 거래 삭제
  const deleteTrade = (tradeId) => {
    const newBlotter = blotter.filter(t => t.tradeId !== tradeId);
    saveBlotter(newBlotter);
  };

  // Config 저장 함수
  const saveConfig = () => {
    localStorage.setItem('kustodyfi_config', JSON.stringify(companyConfig));
    alert('Config 저장 완료!');
  };

  // Config 내보내기
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(companyConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyConfig.companyId}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Config 가져오기
  const importConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setCompanyConfig(parsed);
        localStorage.setItem('kustodyfi_config', JSON.stringify(parsed));
        alert('Config 가져오기 완료!');
      } catch (err) {
        alert('잘못된 JSON 파일입니다.');
      }
    };
    reader.readAsText(file);
  };

  // Client 추가/수정
  const saveClient = (client) => {
    setCompanyConfig(prev => {
      const existing = prev.clients.findIndex(c => c.clientId === client.clientId);
      const newClients = [...prev.clients];
      if (existing >= 0) {
        newClients[existing] = client;
      } else {
        newClients.push(client);
      }
      return { ...prev, clients: newClients };
    });
    setShowClientModal(false);
    setEditingClient(null);
  };

  // Client 삭제
  const deleteClient = (clientId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setCompanyConfig(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.clientId !== clientId)
    }));
  };

  useEffect(() => {
    const loadHolidays = async () => {
      const loaded = {};
      const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031];
      for (const country of ['KR', 'US']) {
        loaded[country] = [];
        for (const year of years) {
          try {
            const res = await fetch(`/holidays/${country.toLowerCase()}_${year}.json`);
            if (res.ok) { const data = await res.json(); loaded[country] = [...loaded[country], ...data.holidays]; }
          } catch {}
        }
        if (loaded[country].length === 0) loaded[country] = DEFAULT_HOLIDAYS[country] || [];
      }
      setHolidays(loaded);
      setIsLoaded(true);
    };
    loadHolidays();
  }, []);

  const tabs = [
    { id: 'calculator', label: '🧮 Date 계산' },
    { id: 'curves', label: '📈 Curves' },
    { id: 'clients', label: '👥 Clients' },
    { id: 'clientPricing', label: '💰 Client Pricing' },
    { id: 'advisory', label: '🎯 Advisory' },
    { id: 'blotter', label: '📋 Blotter' },
    { id: 'cashBalance', label: '💰 Cash Balance' },
    { id: 'cashSchedule', label: '💵 Cash Schedule' },
    { id: 'valuation', label: '📊 Valuation' },
    { id: 'accountingRates', label: '🏦 Accounting Rates' },
    { id: 'config', label: '⚙️ Settings' },
  ];

  return (
    <div className="min-h-screen bg-kustody-dark">
      <header className="border-b border-kustody-border bg-kustody-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="w-8 h-8 rounded-lg bg-gradient-to-br from-kustody-accent to-kustody-accent-dim flex items-center justify-center text-kustody-dark font-bold text-sm hover:opacity-80 transition-opacity">S</a>
              <div><h1 className="text-lg font-semibold text-kustody-text">FX Professional Console</h1><p className="text-xs text-kustody-muted">커브 관리 · 고객 설정 · 거래 기록 · 밸류에이션</p></div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/" className="px-3 py-1.5 text-xs text-kustody-muted hover:text-kustody-text hover:bg-kustody-navy/50 rounded-lg transition-all">🏠 About</a>
              <a href="/" className="px-3 py-1.5 text-xs text-kustody-muted hover:text-kustody-text hover:bg-kustody-navy/50 rounded-lg transition-all">🧮 Calculator</a>
              <span className="px-3 py-1.5 text-xs bg-kustody-accent/10 text-kustody-accent rounded-lg">🚀 Console</span>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-kustody-border bg-kustody-surface/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-kustody-accent' : 'text-kustody-muted hover:text-kustody-text'}`}>
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-kustody-accent" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!isLoaded ? <div className="text-center py-20 text-kustody-muted">로딩 중...</div> : (
          <>
            {activeTab === 'calculator' && <CalculatorTab holidays={holidays} />}
            {activeTab === 'config' && (
              <SettingsTab 
                config={companyConfig}
                setConfig={setCompanyConfig}
                saveConfig={saveConfig} 
                bankCodes={BANK_CODES}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
              />
            )}
            {activeTab === 'curves' && <CurvesTab onCurveDataChange={setSharedCurveData} />}
            {activeTab === 'clients' && (
              <ClientsTab 
                config={companyConfig}
                setConfig={setCompanyConfig}
                saveConfig={saveConfig}
                exportConfig={exportConfig}
                importConfig={importConfig}
                editingClient={editingClient}
                setEditingClient={setEditingClient}
                showClientModal={showClientModal}
                setShowClientModal={setShowClientModal}
                saveClient={saveClient}
                deleteClient={deleteClient}
              />
            )}
            {activeTab === 'clientPricing' && (
              <ClientPricingTab 
                config={companyConfig}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
                pricingNotional={pricingNotional}
                setPricingNotional={setPricingNotional}
              />
            )}
            {activeTab === 'advisory' && (
              <AdvisoryTab 
                config={companyConfig}
                addTrade={addTrade}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
                pricingNotional={pricingNotional}
                setPricingNotional={setPricingNotional}
                sharedCurveData={sharedCurveData}
              />
            )}
            {activeTab === 'blotter' && (
              <BlotterTab 
                blotter={blotter}
                config={companyConfig}
                deleteTrade={deleteTrade}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
              />
            )}
            {activeTab === 'cashBalance' && (
              <CashBalanceTab 
                blotter={blotter}
                config={companyConfig}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
              />
            )}
            {activeTab === 'cashSchedule' && (
              <CashScheduleTab 
                blotter={blotter}
                config={companyConfig}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
              />
            )}
            {activeTab === 'valuation' && (
              <ValuationTab 
                blotter={blotter}
                fixingRate={fixingRate}
                setFixingRate={setFixingRate}
                sharedCurveData={sharedCurveData}
              />
            )}
            {activeTab === 'accountingRates' && (
              <AccountingRatesTab />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-kustody-border py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-kustody-muted">KustodyFi © 2025 · FX Professional Console v1.0</div>
      </footer>
    </div>
  );
}

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

// ============================================================
// Curves Tab with Interpolation - Excel Style
// ============================================================

// 통화별 소수점 포맷팅
const formatSpotRate = (pair, rate) => {
  if (rate === null || rate === undefined || isNaN(rate)) return '-';
  if (pair === 'USDKRW' || pair === 'USDJPY') {
    return rate.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return rate.toFixed(5);
};

// 네이버 환율 캐시 (전역)
let naverRateCache = {
  data: null,
  lastFetch: null,
  CACHE_DURATION: 4 * 60 * 1000 // 4분
};

function CurvesTab({ onCurveDataChange }) {
  const [curveData, setCurveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCcy, setSelectedCcy] = useState('USD');
  const [rebuilding, setRebuilding] = useState(false);
  
  // Override values (user input)
  const [overrides, setOverrides] = useState({});
  const [bidOverrides, setBidOverrides] = useState({});
  const [askOverrides, setAskOverrides] = useState({});
  
  // Interpolation state
  const [interpDate, setInterpDate] = useState('2026-02-27'); // Maturity (1M)
  const [interpStartDate, setInterpStartDate] = useState('2026-01-29'); // Start (Spot)
  const [interpMethod, setInterpMethod] = useState('swap_point_linear');
  const [viewMode, setViewMode] = useState('pro'); // 'beginner' or 'pro'
  
  // Supabase 연동 state
  const [dataLoading, setDataLoading] = useState(false);
  const [ipsDate, setIpsDate] = useState('2026-01-27');
  const [ipsSpotDate, setIpsSpotDate] = useState('2026-01-29');
  
  // 네이버 환율 state
  const [naverRates, setNaverRates] = useState(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [naverLastUpdate, setNaverLastUpdate] = useState(null);
  
  // Market 실시간 state
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLastUpdate, setMarketLastUpdate] = useState(null);
  
  // Spread settings (DB에서 가져옴)
  const [spreadSettings, setSpreadSettings] = useState({});
  
  // Supabase 설정
  const SUPABASE_URL = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';
  
  // Market 캐시 (30분)
  const MARKET_CACHE_DURATION = 30 * 60 * 1000;
  
  // curveData 변경 시 부모에게 전달 (Advisory 탭과 공유)
  useEffect(() => {
    if (curveData && onCurveDataChange) {
      onCurveDataChange(curveData);
    }
  }, [curveData, onCurveDataChange]);
  
  // Spread settings 가져오기
  // 기본 spread 설정 (DB에 없을 경우 fallback)
  // spread_pips = 한쪽 spread (bid = mid - spread, ask = mid + spread)
  const DEFAULT_SPREADS = {
    'O/N': 1.5, 'T/N': 1.5, '1W': 4,
    '1M': 10, '2M': 20, '3M': 30,
    '6M': 40, '9M': 60, '1Y': 80
  };
  
  const fetchSpreadSettings = async () => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/spread_settings?select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const settings = {};
          data.forEach(row => {
            const tenorName = row.tenor === 'ON' ? 'O/N' : row.tenor === 'TN' ? 'T/N' : row.tenor;
            settings[tenorName] = row.spread_pips || 0;
          });
          setSpreadSettings(settings);
          return settings;
        }
      }
    } catch (error) {
      console.error('Spread settings fetch error:', error);
    }
    // DB에 데이터 없으면 기본값 사용
    console.log('Using default spread settings');
    setSpreadSettings(DEFAULT_SPREADS);
    return DEFAULT_SPREADS;
  };
  
  // mid에 spread 적용해서 bid/ask 계산
  const applySpreadToSwapPoints = (swapPoints, spreads) => {
    return swapPoints.map(sp => {
      const spreadPips = spreads[sp.tenor] || 0;
      const spreadValue = spreadPips / 100; // pips를 원 단위로 변환
      return {
        ...sp,
        bid: sp.points - spreadValue,
        ask: sp.points + spreadValue
      };
    });
  };
  
  // Market에서 스왑포인트 가져오기 + DB 저장
  const fetchMarketSwapPoints = async (force = false) => {
    setMarketLoading(true);
    
    try {
      // 1. DB에서 최신 데이터 시간 확인
      if (!force) {
        const checkResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/fx_swap_points?select=updated_at&order=updated_at.desc&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.length > 0) {
            const lastUpdate = new Date(checkData[0].updated_at);
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / 1000 / 60;
            
            if (diffMinutes < 30) {
              console.log(`DB 캐시 사용 (${Math.round(diffMinutes)}분 전 데이터)`);
              // DB에서 가져오기
              await fetchCurveData();
              setMarketLastUpdate(lastUpdate);
              setMarketLoading(false);
              return;
            }
          }
        }
      }
      
      // 2. Market에서 새로 가져오기 (API route 통해서 - CORS 우회)
      console.log('Market 데이터 수집 중...');
      const response = await fetch('/api/ips-swap');
      
      if (!response.ok) {
        throw new Error('Market API 오류');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Market API 실패');
      }
      
      const data = result.data;
      
      if (!data.broker || data.broker.length === 0) {
        throw new Error('Market 데이터 없음');
      }
      
      // 3. 테너 매핑 및 파싱
      const tenorMap = [
        { tenor: 'ON', days: -1 },
        { tenor: 'TN', days: 0 },
        { tenor: '1W', days: 7 },
        { tenor: '2W', days: 14 },
        { tenor: '1M', days: 30 },
        { tenor: '2M', days: 60 },
        { tenor: '3M', days: 90 },
        { tenor: '6M', days: 180 },
        { tenor: '9M', days: 270 },
        { tenor: '1Y', days: 365 },
      ];
      
      const today = new Date().toISOString().split('T')[0];
      const spotDate = new Date();
      spotDate.setDate(spotDate.getDate() + 2);
      while (spotDate.getDay() === 0 || spotDate.getDay() === 6) {
        spotDate.setDate(spotDate.getDate() + 1);
      }
      const spotDateStr = spotDate.toISOString().split('T')[0];
      
      const swapPoints = [];
      
      for (let i = 0; i < Math.min(data.broker.length, tenorMap.length); i++) {
        const row = data.broker[i];
        const { tenor, days } = tenorMap[i];
        
        const mid = parseFloat(row.mid) || null;
        const bid = parseFloat(row.bid) || null;
        const ask = parseFloat(row.ask) || null;
        
        if (mid !== null) {
          swapPoints.push({
            reference_date: today,
            spot_date: spotDateStr,
            tenor: tenor,
            days: days,
            mid_points: mid,
            bid_points: bid,
            ask_points: ask,
            source: 'MARKET'
          });
        }
      }
      
      // 4. DB에 저장 (upsert)
      for (const sp of swapPoints) {
        await fetch(`${SUPABASE_URL}/rest/v1/fx_swap_points`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(sp)
        });
      }
      
      console.log(`✅ ${swapPoints.length}개 스왑포인트 DB 저장 완료`);
      
      // 5. Spread settings 가져오기
      const spreads = await fetchSpreadSettings();
      
      // 6. curveData 업데이트 (spread 적용)
      if (curveData) {
        const newData = JSON.parse(JSON.stringify(curveData));
        
        newData.metadata.referenceDate = today;
        if (newData.curves?.USDKRW?.USD) {
          newData.curves.USDKRW.USD.spotDate = spotDateStr;
        }
        if (newData.curves?.USDKRW?.KRW) {
          newData.curves.USDKRW.KRW.spotDate = spotDateStr;
        }
        
        // fxSwapPoints 업데이트 (spread 적용)
        const tenorNameMap = { 'ON': 'O/N', 'TN': 'T/N' };
        newData.curves.USDKRW.fxSwapPoints = newData.curves.USDKRW.fxSwapPoints.map(sp => {
          const marketData = swapPoints.find(d => 
            (tenorNameMap[d.tenor] || d.tenor) === sp.tenor
          );
          if (marketData) {
            const mid = marketData.mid_points;
            const spreadPips = spreads[sp.tenor] || 0;
            const spreadValue = spreadPips / 100;
            return {
              ...sp,
              points: mid,
              bid: mid - spreadValue,
              ask: mid + spreadValue
            };
          }
          return sp;
        });
        
        setCurveData(newData);
        setInterpStartDate(spotDateStr);
      }
      
      setMarketLastUpdate(new Date());
      alert('✅ Market 데이터 갱신 완료!');
      
    } catch (error) {
      console.error('Market fetch error:', error);
      alert('❌ Market 연결 실패: ' + error.message);
    } finally {
      setMarketLoading(false);
    }
  };
  
  // 네이버 환율 가져오기 - Supabase 우선, fallback으로 API route
  const fetchNaverRates = async (force = false) => {
    const now = Date.now();
    
    // 캐시 유효성 체크 (4분)
    if (!force && naverRateCache.data && naverRateCache.lastFetch && 
        (now - naverRateCache.lastFetch) < naverRateCache.CACHE_DURATION) {
      setNaverRates(naverRateCache.data);
      setNaverLastUpdate(new Date(naverRateCache.lastFetch));
      return naverRateCache.data;
    }
    
    setNaverLoading(true);
    try {
      // 1. Supabase에서 먼저 조회 (GitHub Actions가 15분마다 업데이트)
      const supabaseResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/spot_rates?source=eq.naver&order=fetched_at.desc&limit=20`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (supabaseResponse.ok) {
        const supabaseData = await supabaseResponse.json();
        console.log('📊 Supabase spot_rates:', supabaseData.length, 'records');
        
        if (supabaseData && supabaseData.length > 0) {
          const latestRecord = supabaseData[0];
          const fetchedAt = new Date(latestRecord.fetched_at);
          const ageMinutes = (now - fetchedAt.getTime()) / (1000 * 60);
          
          console.log(`⏱️ Supabase data age: ${Math.round(ageMinutes)}분`);
          
          // 30분 이내 데이터면 사용
          if (ageMinutes < 30) {
            const rates = {};
            supabaseData.forEach(record => {
              if (!rates[record.currency_pair]) {
                rates[record.currency_pair] = parseFloat(record.rate);
              }
            });
            
            naverRateCache.data = rates;
            naverRateCache.lastFetch = now;
            
            setNaverRates(rates);
            setNaverLastUpdate(fetchedAt);
            console.log('✅ Spot rates from Supabase:', rates);
            
            return rates;
          } else {
            console.log('⚠️ Supabase 데이터가 30분 이상 오래됨, API 호출...');
          }
        }
      }
      
      // 2. Supabase에 없으면 내부 API route 호출 (fallback)
      console.log('📡 Supabase에 데이터 없음, API route 호출...');
      const response = await fetch('/api/naver-rates');
      
      if (!response.ok) {
        throw new Error('API 오류');
      }
      
      const result = await response.json();
      
      if (result.success && result.rates) {
        // API 응답 변환 (객체 → 숫자)
        const rates = {};
        Object.keys(result.rates).forEach(pair => {
          const val = result.rates[pair];
          rates[pair] = typeof val === 'object' ? val.rate : val;
        });
        
        // 캐시 업데이트
        naverRateCache.data = rates;
        naverRateCache.lastFetch = now;
        
        setNaverRates(rates);
        setNaverLastUpdate(new Date(now));
        console.log('✅ Spot rates from API:', rates);
        
        return rates;
      } else {
        throw new Error(result.error || '데이터 없음');
      }
    } catch (error) {
      console.error('Naver rates fetch error:', error);
      // 에러 시 조용히 실패 (alert 제거)
      console.warn('⚠️ 환율 조회 실패, 기본값 사용');
      return null;
    } finally {
      setNaverLoading(false);
    }
  };
  
  // 네이버 환율을 curveData에 적용
  const applyNaverRates = async () => {
    const rates = await fetchNaverRates(true);
    if (rates && curveData) {
      const newData = JSON.parse(JSON.stringify(curveData));
      
      // spotRates 업데이트
      Object.keys(newData.spotRates).forEach(pair => {
        if (rates[pair] !== undefined) {
          // 객체면 rate 추출, 숫자면 그대로 사용
          const rateValue = typeof rates[pair] === 'object' ? rates[pair].rate : rates[pair];
          if (rateValue) {
            newData.spotRates[pair] = rateValue;
          }
        }
      });
      
      setCurveData(newData);
    }
  };
  
  // Supabase에서 커브 데이터 가져오기
  const fetchCurveData = async () => {
    setDataLoading(true);
    try {
      // 1. Spread settings 먼저 가져오기
      const spreads = await fetchSpreadSettings();
      
      // 2. Supabase REST API 호출
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/latest_fx_curve?select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('데이터를 가져올 수 없습니다');
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        // curveData 업데이트
        const newData = JSON.parse(JSON.stringify(originalData));
        
        // Spot date 업데이트
        const spotDate = data[0]?.spot_date;
        if (spotDate && newData.curves?.USDKRW?.USD) {
          newData.curves.USDKRW.USD.spotDate = spotDate;
        }
        if (spotDate && newData.curves?.USDKRW?.KRW) {
          newData.curves.USDKRW.KRW.spotDate = spotDate;
        }
        
        // metadata 업데이트
        const refDate = data[0]?.reference_date;
        if (refDate) {
          newData.metadata.referenceDate = refDate;
        }
        
        // fxSwapPoints 업데이트 (spread 적용)
        if (newData.curves?.USDKRW?.fxSwapPoints) {
          const tenorMap = {
            'ON': 'O/N', 'TN': 'T/N',
            '1W': '1W', '2W': '2W', '3W': '3W',
            '1M': '1M', '2M': '2M', '3M': '3M',
            '4M': '4M', '5M': '5M', '6M': '6M',
            '7M': '7M', '8M': '8M', '9M': '9M',
            '10M': '10M', '11M': '11M', '1Y': '1Y'
          };
          
          newData.curves.USDKRW.fxSwapPoints = newData.curves.USDKRW.fxSwapPoints.map(sp => {
            const dbRow = data.find(d => tenorMap[d.tenor] === sp.tenor || d.tenor === sp.tenor);
            if (dbRow) {
              const mid = dbRow.mid_points;
              const spreadPips = spreads[sp.tenor] || 0;
              const spreadValue = spreadPips / 100; // pips를 원 단위로 변환
              return {
                ...sp,
                points: mid,
                bid: mid - spreadValue,
                ask: mid + spreadValue,
                days: dbRow.days
              };
            }
            return sp;
          });
        }
        
        setOriginalData(newData);
        setCurveData(newData);
        
        // Interpolation 날짜 업데이트
        if (data[0]?.spot_date) {
          setInterpStartDate(data[0].spot_date);
          const oneMonthLater = new Date(data[0].spot_date);
          oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
          setInterpDate(oneMonthLater.toISOString().split('T')[0]);
        }
        
        alert('✅ 데이터 로드 완료!');
      } else {
        alert('⚠️ 데이터가 없습니다. 먼저 data-collector를 실행하세요.');
      }
    } catch (error) {
      console.error('Supabase fetch error:', error);
      alert('❌ 데이터 로드 실패: ' + error.message);
    } finally {
      setDataLoading(false);
    }
  };

  // ============================================================
  // USD Bootstrapping: Rate → DF 계산
  // ============================================================
  const bootstrapUSD = (curve) => {
    if (!curve || !curve.tenors) return curve;
    
    const dayCount = curve.dayCount || 360;
    const tenors = [...curve.tenors].sort((a, b) => a.days - b.days);
    const bootstrapped = [];
    
    // 연간 DF 저장 (Swap bootstrapping용)
    const annualDFs = {};
    
    for (let i = 0; i < tenors.length; i++) {
      const tenor = tenors[i];
      const days = tenor.days;
      const yearFrac = days / dayCount;
      
      const rate = tenor.rate / 100;
      let df;
      
      if (tenor.type === 'CASH' || Math.abs(days) <= 365) {
        // Cash: Simple Interest
        df = 1 / (1 + rate * yearFrac);
      } else {
        // Swap: Bootstrapping with annual compounding
        const years = Math.floor(Math.abs(days) / 365);
        let couponPV = 0;
        for (let y = 1; y < years; y++) {
          if (annualDFs[y]) couponPV += rate * annualDFs[y];
        }
        df = (1 - couponPV) / (1 + rate);
      }
      
      // 연간 DF 저장
      const years = Math.round(Math.abs(days) / 365);
      if (years >= 1 && Math.abs(Math.abs(days) - years * 365) < 30) {
        annualDFs[years] = df;
      }
      
      const lnDF = Math.log(df);
      const zeroRate = Math.abs(yearFrac) > 0 ? ((1/df - 1) / yearFrac) * 100 : tenor.rate;
      
      bootstrapped.push({
        ...tenor,
        df: df,
        lnDF: lnDF,
        zeroRate: zeroRate
      });
    }
    
    return { ...curve, tenors: bootstrapped, lastBootstrap: new Date().toISOString() };
  };

  // ============================================================
  // KRW DF 역산: FX Swap Points + USD DF + Spot → KRW DF
  // Forward = Spot + SwapPoint
  // KRW_DF = USD_DF × Spot / Forward
  // ============================================================
  const bootstrapKRW = (krwCurve, usdCurve, fxSwapPoints, spot, screenOvr = {}, bidOvr = {}, askOvr = {}) => {
    if (!krwCurve || !usdCurve || !fxSwapPoints || !spot) return krwCurve;
    
    const dayCount = krwCurve.dayCount || 365;
    const tenors = [...krwCurve.tenors].sort((a, b) => a.days - b.days);
    const bootstrapped = [];
    
    // USD DF 보간 함수
    const getUsdDF = (targetDays) => {
      const usdTenors = usdCurve.tenors.filter(t => t.df).sort((a, b) => a.days - b.days);
      if (usdTenors.length === 0) return 1;
      
      // 정확히 일치하는 tenor 찾기
      const exact = usdTenors.find(t => t.days === targetDays);
      if (exact) return exact.df;
      
      // 범위 밖
      if (targetDays <= usdTenors[0].days) return usdTenors[0].df;
      if (targetDays >= usdTenors[usdTenors.length - 1].days) return usdTenors[usdTenors.length - 1].df;
      
      // Log-linear 보간
      let lower = usdTenors[0], upper = usdTenors[1];
      for (let i = 0; i < usdTenors.length - 1; i++) {
        if (targetDays >= usdTenors[i].days && targetDays <= usdTenors[i + 1].days) {
          lower = usdTenors[i];
          upper = usdTenors[i + 1];
          break;
        }
      }
      
      const t = (targetDays - lower.days) / (upper.days - lower.days);
      const lnDfLower = Math.log(lower.df);
      const lnDfUpper = Math.log(upper.df);
      return Math.exp(lnDfLower + (lnDfUpper - lnDfLower) * t);
    };
    
    // FX Swap Point에서 해당 tenor 찾기 (오버라이드 반영)
    // 오버라이드는 전단위 입력 (예: -100) → 원단위 변환 (예: -1.00)
    const getSwapPoint = (days, tenorName) => {
      const sp = fxSwapPoints.find(s => s.days === days);
      if (!sp) return null;
      
      // 오버라이드 적용 (전단위 입력 → 원단위 변환: / 100)
      const points = screenOvr[tenorName] !== undefined && screenOvr[tenorName] !== '' 
        ? parseFloat(screenOvr[tenorName]) / 100 
        : sp.points;
      const bid = bidOvr[tenorName] !== undefined && bidOvr[tenorName] !== '' 
        ? parseFloat(bidOvr[tenorName]) / 100 
        : sp.bid;
      const ask = askOvr[tenorName] !== undefined && askOvr[tenorName] !== '' 
        ? parseFloat(askOvr[tenorName]) / 100 
        : sp.ask;
      
      return { ...sp, points, bid, ask };
    };
    
    for (let i = 0; i < tenors.length; i++) {
      const tenor = tenors[i];
      const days = tenor.days;
      const yearFrac = days / dayCount;
      
      let dfMid, dfBid, dfAsk;
      
      // FX Swap Points에서 역산 (오버라이드 포함)
      const swapPoint = getSwapPoint(days, tenor.tenor);
      const usdDF = getUsdDF(days);
      
      if (swapPoint && usdDF) {
        // Forward = Spot + SwapPoint
        // KRW_DF = USD_DF × Spot / Forward = USD_DF / (1 + SwapPoint/Spot)
        const forwardMid = spot + (swapPoint.points || 0);
        const forwardBid = spot + (swapPoint.bid !== null ? swapPoint.bid : swapPoint.points || 0);
        const forwardAsk = spot + (swapPoint.ask !== null ? swapPoint.ask : swapPoint.points || 0);
        
        dfMid = usdDF * spot / forwardMid;
        dfBid = usdDF * spot / forwardBid;
        dfAsk = usdDF * spot / forwardAsk;
      } else if (days < 0) {
        // O/N 등 Spot 이전 - JSON의 기존 값 사용
        const rate = tenor.rate / 100;
        dfMid = 1 / (1 + rate * Math.abs(yearFrac));
        dfBid = tenor.dfBid || dfMid;
        dfAsk = tenor.dfAsk || dfMid;
      } else {
        // FX Swap Point 없으면 Rate에서 계산
        const rate = tenor.rate / 100;
        dfMid = 1 / (1 + rate * yearFrac);
        dfBid = tenor.dfBid || dfMid;
        dfAsk = tenor.dfAsk || dfMid;
      }
      
      const lnDF = Math.log(dfMid);
      const lnDfBid = Math.log(dfBid);
      const lnDfAsk = Math.log(dfAsk);
      const zeroRate = Math.abs(yearFrac) > 0 ? ((1/dfMid - 1) / yearFrac) * 100 : tenor.rate;
      
      bootstrapped.push({
        ...tenor,
        df: dfMid,
        dfBid: dfBid,
        dfAsk: dfAsk,
        lnDF: lnDF,
        lnDfBid: lnDfBid,
        lnDfAsk: lnDfAsk,
        zeroRate: zeroRate
      });
    }
    
    return { ...krwCurve, tenors: bootstrapped, lastBootstrap: new Date().toISOString() };
  };
  
  // Curve Rebuild 함수 (강제 bootstrap)
  const rebuildCurves = () => {
    if (!originalData) return;
    
    setRebuilding(true);
    
    setTimeout(() => {
      const newData = JSON.parse(JSON.stringify(originalData));
      
      if (newData.curves?.USDKRW) {
        const spot = newData.spotRates?.USDKRW;
        const fxSwapPoints = newData.curves.USDKRW.fxSwapPoints;
        
        // Rate override 적용
        ['USD', 'KRW'].forEach(ccy => {
          if (newData.curves.USDKRW[ccy]?.tenors) {
            newData.curves.USDKRW[ccy].tenors = newData.curves.USDKRW[ccy].tenors.map(t => {
              const key = `${ccy}_${t.tenor}`;
              if (rateOverrides[key] !== undefined && rateOverrides[key] !== '') {
                return { ...t, rate: parseFloat(rateOverrides[key]) };
              }
              return t;
            });
          }
        });
        
        // 1. USD Bootstrap 먼저 (Rate → DF)
        newData.curves.USDKRW.USD = bootstrapUSD(newData.curves.USDKRW.USD);
        
        // 2. KRW Bootstrap (FX Swap Points + USD DF → KRW DF, 오버라이드 포함)
        newData.curves.USDKRW.KRW = bootstrapKRW(
          newData.curves.USDKRW.KRW,
          newData.curves.USDKRW.USD,
          fxSwapPoints,
          spot,
          overrides,
          bidOverrides,
          askOverrides
        );
      }
      setCurveData(newData);
      setRebuilding(false);
    }, 100);
  };

  // Rate 수정 state
  const [rateOverrides, setRateOverrides] = useState({});
  const [originalData, setOriginalData] = useState(null);
  
  // Rate 및 FX Swap Points 변경 시 자동 Bootstrap
  useEffect(() => {
    if (!originalData) return;
    
    // 오버라이드가 하나도 없으면 스킵
    const hasAnyOverride = 
      Object.keys(rateOverrides).length > 0 ||
      Object.keys(overrides).length > 0 ||
      Object.keys(bidOverrides).length > 0 ||
      Object.keys(askOverrides).length > 0;
    
    if (!hasAnyOverride) return;
    
    // Rate override 적용 후 bootstrap
    const newData = JSON.parse(JSON.stringify(originalData));
    
    if (newData.curves?.USDKRW) {
      const spot = newData.spotRates?.USDKRW;
      const fxSwapPoints = newData.curves.USDKRW.fxSwapPoints;
      
      // Rate override 적용
      ['USD', 'KRW'].forEach(ccy => {
        if (newData.curves.USDKRW[ccy]?.tenors) {
          newData.curves.USDKRW[ccy].tenors = newData.curves.USDKRW[ccy].tenors.map(t => {
            const key = `${ccy}_${t.tenor}`;
            if (rateOverrides[key] !== undefined && rateOverrides[key] !== '') {
              return { ...t, rate: parseFloat(rateOverrides[key]) };
            }
            return t;
          });
        }
      });
      
      // 1. USD Bootstrap 먼저 (Rate → DF)
      newData.curves.USDKRW.USD = bootstrapUSD(newData.curves.USDKRW.USD);
      
      // 2. KRW Bootstrap (FX Swap Points + USD DF → KRW DF, 오버라이드 포함)
      newData.curves.USDKRW.KRW = bootstrapKRW(
        newData.curves.USDKRW.KRW,
        newData.curves.USDKRW.USD,
        fxSwapPoints,
        spot,
        overrides,
        bidOverrides,
        askOverrides
      );
      
      // 3. Forward Spreads에 Near/Far Bid/Ask 정보 추가 (오버라이드 반영)
      if (newData.forwardSpreads?.USDKRW && fxSwapPoints) {
        newData.forwardSpreads.USDKRW = newData.forwardSpreads.USDKRW.map(s => {
          const nearSp = fxSwapPoints.find(sp => sp.tenor === s.nearTenor);
          const farSp = fxSwapPoints.find(sp => sp.tenor === s.farTenor);
          
          // 오버라이드 적용 (전단위 → 원단위)
          const nearBid = bidOverrides[s.nearTenor] !== undefined && bidOverrides[s.nearTenor] !== ''
            ? parseFloat(bidOverrides[s.nearTenor]) / 100 : (nearSp?.bid ?? null);
          const nearAsk = askOverrides[s.nearTenor] !== undefined && askOverrides[s.nearTenor] !== ''
            ? parseFloat(askOverrides[s.nearTenor]) / 100 : (nearSp?.ask ?? null);
          const farBid = bidOverrides[s.farTenor] !== undefined && bidOverrides[s.farTenor] !== ''
            ? parseFloat(bidOverrides[s.farTenor]) / 100 : (farSp?.bid ?? null);
          const farAsk = askOverrides[s.farTenor] !== undefined && askOverrides[s.farTenor] !== ''
            ? parseFloat(askOverrides[s.farTenor]) / 100 : (farSp?.ask ?? null);
          
          return { ...s, nearBid, nearAsk, farBid, farAsk };
        });
      }
    }
    
    setCurveData(newData);
  }, [rateOverrides, overrides, bidOverrides, askOverrides, originalData]);

  useEffect(() => {
    const loadInitialData = async () => {
      // 1. JSON 로드
      const res = await fetch('/config/curves/20260127_IW.json');
      if (!res.ok) return;
      const data = await res.json();
      
      if (!data) return;
      
      // 2. Supabase에서 최신 환율 가져오기
      try {
        const spotRes = await fetch(
          `${SUPABASE_URL}/rest/v1/spot_rates?source=eq.naver&order=fetched_at.desc&limit=20`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        if (spotRes.ok) {
          const spotData = await spotRes.json();
          if (spotData && spotData.length > 0) {
            // 최신 환율로 spotRates 업데이트
            spotData.forEach(record => {
              if (data.spotRates && data.spotRates[record.currency_pair] !== undefined) {
                data.spotRates[record.currency_pair] = parseFloat(record.rate);
              }
            });
            console.log('✅ Initial spot rates from Supabase:', data.spotRates);
          }
        }
      } catch (e) {
        console.warn('Supabase spot rate fetch failed:', e);
      }
      
      // 3. Spread 설정 가져오기
      const spreads = await fetchSpreadSettings();
      
      // 4. fxSwapPoints에 spread 적용
      if (data.curves?.USDKRW?.fxSwapPoints) {
        data.curves.USDKRW.fxSwapPoints = data.curves.USDKRW.fxSwapPoints.map(sp => {
          const spreadPips = spreads[sp.tenor] || 0;
          const spreadValue = spreadPips / 100;
          return {
            ...sp,
            bid: sp.points - spreadValue,
            ask: sp.points + spreadValue
          };
        });
      }
      
      setOriginalData(data);
      
      // Market 날짜 초기화
      setIpsDate(data.metadata?.referenceDate || '2026-01-27');
      setIpsSpotDate(data.curves?.USDKRW?.USD?.spotDate || '2026-01-29');
      
      // 초기 로드 시에도 Bootstrap 실행 (FX Swap Points 기준 KRW DF 계산)
      if (data.curves?.USDKRW) {
        const spot = data.spotRates?.USDKRW;
        const fxSwapPoints = data.curves.USDKRW.fxSwapPoints;
        
        // 1. USD Bootstrap
        data.curves.USDKRW.USD = bootstrapUSD(data.curves.USDKRW.USD);
        
        // 2. KRW Bootstrap (FX Swap Points 기준)
        data.curves.USDKRW.KRW = bootstrapKRW(
          data.curves.USDKRW.KRW,
          data.curves.USDKRW.USD,
          fxSwapPoints,
          spot
        );
        
        // 3. Forward Spreads에 Near/Far Bid/Ask 정보 추가 (Tight 계산용)
        if (data.forwardSpreads?.USDKRW && fxSwapPoints) {
          data.forwardSpreads.USDKRW = data.forwardSpreads.USDKRW.map(s => {
            const nearSp = fxSwapPoints.find(sp => sp.tenor === s.nearTenor);
            const farSp = fxSwapPoints.find(sp => sp.tenor === s.farTenor);
            return {
              ...s,
              nearBid: nearSp?.bid ?? null,
              nearAsk: nearSp?.ask ?? null,
              farBid: farSp?.bid ?? null,
              farAsk: farSp?.ask ?? null
            };
          });
        }
      }
          
      setCurveData(data);
      setLoading(false);
    };
    
    loadInitialData();
  }, []);

  // Swap Point Linear Interpolation
  const interpolateSwapPointLinear = (days, swapPoints, spotDateStr, targetDateStr) => {
    if (!swapPoints || swapPoints.length === 0) return null;
    
    // Spot 이전 (days < 0): 해당 구간의 T/N, O/N 값 그대로 반환
    // 표시: Start(입력일) → Maturity(Spot)
    if (days < 0) {
      const tn = swapPoints.find(sp => sp.tenor === 'T/N');
      const on = swapPoints.find(sp => sp.tenor === 'O/N');
      
      if (days === -1) {
        // Tom: T/N 구간 (입력일 → Spot)
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: 1,
          tenor: 'T/N',
          points: tn?.points || 0,
          bid: tn?.bid || 0,
          ask: tn?.ask || 0
        };
      } else if (days <= -2) {
        // Today: O/N + T/N 구간
        // Start(입력일) → Spot, 2일
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: Math.abs(days),
          tenor: 'O/N+T/N',
          points: (on?.points || 0) + (tn?.points || 0),
          bid: (on?.bid || 0) + (tn?.bid || 0),
          ask: (on?.ask || 0) + (tn?.ask || 0)
        };
      }
    }
    
    // Spot (days = 0)
    if (days === 0) {
      return { 
        startDate: spotDateStr,
        maturityDate: spotDateStr,
        displayDays: 0,
        tenor: 'Spot',
        points: 0, 
        bid: 0, 
        ask: 0 
      };
    }
    
    // Spot 이후 (days > 0): 1W, 1M, ... 등 Spot 이후 tenor들만 사용
    // 표시: Start(Spot) → Maturity(입력일)
    const postSpot = swapPoints.filter(sp => sp.days > 0).sort((a, b) => a.days - b.days);
    
    if (postSpot.length === 0) return null;
    
    let result;
    let tenor = '';
    
    // 범위 체크
    if (days <= postSpot[0].days) {
      // 1W 이전: 0 ~ 1W 사이 비례 계산
      const t = days / postSpot[0].days;
      tenor = `<${postSpot[0].tenor}`;
      result = {
        points: postSpot[0].points * t,
        bid: postSpot[0].bid !== null ? postSpot[0].bid * t : null,
        ask: postSpot[0].ask !== null ? postSpot[0].ask * t : null
      };
    } else if (days >= postSpot[postSpot.length - 1].days) {
      tenor = `>${postSpot[postSpot.length - 1].tenor}`;
      result = { 
        points: postSpot[postSpot.length - 1].points, 
        bid: postSpot[postSpot.length - 1].bid, 
        ask: postSpot[postSpot.length - 1].ask 
      };
    } else {
      // 보간할 구간 찾기
      let lower = postSpot[0], upper = postSpot[1];
      for (let i = 0; i < postSpot.length - 1; i++) {
        if (days >= postSpot[i].days && days <= postSpot[i + 1].days) {
          lower = postSpot[i];
          upper = postSpot[i + 1];
          break;
        }
      }
      
      tenor = `${lower.tenor}-${upper.tenor}`;
      
      // Linear interpolation
      const t = (days - lower.days) / (upper.days - lower.days);
      result = {
        points: lower.points + (upper.points - lower.points) * t,
        bid: (lower.bid !== null && upper.bid !== null) ? lower.bid + (upper.bid - lower.bid) * t : null,
        ask: (lower.ask !== null && upper.ask !== null) ? lower.ask + (upper.ask - lower.ask) * t : null
      };
    }
    
    return {
      startDate: spotDateStr,
      maturityDate: targetDateStr,
      displayDays: days,
      tenor: tenor,
      ...result
    };
  };

  // Raw Interpolation (Log-Linear DF)
  // 저장된 lnDF를 linear interpolation → exp() → DF
  // Bid/Mid/Ask 커브 각각 보간
  const interpolateRaw = (days, usdCurve, krwCurve, spot, fxSwapPoints, spotDateStr, targetDateStr) => {
    if (!usdCurve || !krwCurve || !spot) return null;
    
    // Spot 이전 (days < 0): Swap Point Linear와 동일
    if (days < 0 && fxSwapPoints) {
      const tn = fxSwapPoints.find(sp => sp.tenor === 'T/N');
      const on = fxSwapPoints.find(sp => sp.tenor === 'O/N');
      
      if (days === -1) {
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: 1,
          tenor: 'T/N',
          usdDF: 1,
          krwDF: 1,
          forward: spot + (tn?.points || 0),
          points: tn?.points || 0,
          bid: tn?.bid || 0,
          ask: tn?.ask || 0
        };
      } else if (days <= -2) {
        const totalPoints = (on?.points || 0) + (tn?.points || 0);
        return {
          startDate: targetDateStr,
          maturityDate: spotDateStr,
          displayDays: Math.abs(days),
          tenor: 'O/N+T/N',
          usdDF: 1,
          krwDF: 1,
          forward: spot + totalPoints,
          points: totalPoints,
          bid: (on?.bid || 0) + (tn?.bid || 0),
          ask: (on?.ask || 0) + (tn?.ask || 0)
        };
      }
    }
    
    // Spot (days = 0)
    if (days === 0) {
      return {
        startDate: spotDateStr,
        maturityDate: spotDateStr,
        displayDays: 0,
        tenor: 'Spot',
        usdDF: 1,
        krwDF: 1,
        forward: spot,
        points: 0,
        bid: 0,
        ask: 0
      };
    }
    
    // Spot 이후 (days > 0): Log-Linear DF 보간
    // lnDF 보간 함수 (lnDfType: 'lnDF', 'lnDfBid', 'lnDfAsk')
    const interpolateLnDF = (curve, targetDays, lnDfType = 'lnDF') => {
      const sorted = [...curve.tenors].filter(t => t[lnDfType] !== undefined && t.days > 0).sort((a, b) => a.days - b.days);
      
      if (sorted.length === 0) return null;
      
      // 범위 밖 처리
      if (targetDays <= sorted[0].days) {
        // Spot ~ 첫 tenor 사이: 비례 보간
        const t = targetDays / sorted[0].days;
        return sorted[0][lnDfType] * t;
      }
      if (targetDays >= sorted[sorted.length - 1].days) return sorted[sorted.length - 1][lnDfType];
      
      // 보간 구간 찾기
      let lower = sorted[0], upper = sorted[1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (targetDays >= sorted[i].days && targetDays <= sorted[i + 1].days) {
          lower = sorted[i];
          upper = sorted[i + 1];
          break;
        }
      }
      
      // Linear interpolation on ln(DF)
      const lnDfLower = lower[lnDfType];
      const lnDfUpper = upper[lnDfType];
      const t = (targetDays - lower.days) / (upper.days - lower.days);
      
      return lnDfLower + (lnDfUpper - lnDfLower) * t;
    };
    
    // USD는 단일 커브 (Bid/Ask 없음)
    const usdLnDF = interpolateLnDF(usdCurve, days, 'lnDF');
    const usdDF = usdLnDF !== null ? Math.exp(usdLnDF) : null;
    
    // KRW는 Bid/Mid/Ask 각각 보간
    const krwLnDFMid = interpolateLnDF(krwCurve, days, 'lnDF');
    const krwLnDFBid = interpolateLnDF(krwCurve, days, 'lnDfBid');
    const krwLnDFAsk = interpolateLnDF(krwCurve, days, 'lnDfAsk');
    
    const krwDFMid = krwLnDFMid !== null ? Math.exp(krwLnDFMid) : null;
    const krwDFBid = krwLnDFBid !== null ? Math.exp(krwLnDFBid) : null;
    const krwDFAsk = krwLnDFAsk !== null ? Math.exp(krwLnDFAsk) : null;
    
    if (!usdDF || !krwDFMid) return null;
    
    // Forward 계산: Forward = Spot × (USD_DF / KRW_DF)
    const forwardMid = spot * (usdDF / krwDFMid);
    const swapPointsMid = forwardMid - spot;
    
    const forwardBid = krwDFBid ? spot * (usdDF / krwDFBid) : null;
    const swapPointsBid = forwardBid ? forwardBid - spot : null;
    
    const forwardAsk = krwDFAsk ? spot * (usdDF / krwDFAsk) : null;
    const swapPointsAsk = forwardAsk ? forwardAsk - spot : null;
    
    return {
      startDate: spotDateStr,
      maturityDate: targetDateStr,
      displayDays: days,
      tenor: 'Interpolated',
      usdDF,
      krwDF: krwDFMid,
      krwDFBid,
      krwDFAsk,
      forward: forwardMid,
      points: swapPointsMid,
      bid: swapPointsBid,
      ask: swapPointsAsk
    };
  };

  // 계산 결과
  const interpResult = useMemo(() => {
    try {
      if (!curveData || !interpDate || !interpStartDate) return null;
      
      const usdkrw = curveData.curves?.USDKRW;
      const spot = curveData.spotRates?.USDKRW;
      if (!usdkrw || !spot) return null;
      
      const spotDate = new Date(usdkrw?.USD?.spotDate || curveData.metadata.referenceDate);
      const targetDate = new Date(interpDate);
      const startDate = new Date(interpStartDate);
      
      // 날짜 유효성 검사
      if (isNaN(spotDate.getTime()) || isNaN(targetDate.getTime()) || isNaN(startDate.getTime())) {
        return null;
      }
      
      const spotDateStr = spotDate.toISOString().split('T')[0];
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // 오버라이드가 적용된 fxSwapPoints (전단위 입력 → 원단위 변환)
      const fxSwapPointsWithOverrides = usdkrw?.fxSwapPoints?.map(sp => ({
        ...sp,
        points: overrides[sp.tenor] !== undefined && overrides[sp.tenor] !== '' 
          ? parseFloat(overrides[sp.tenor]) / 100 : sp.points,
        bid: bidOverrides[sp.tenor] !== undefined && bidOverrides[sp.tenor] !== '' 
          ? parseFloat(bidOverrides[sp.tenor]) / 100 : sp.bid,
        ask: askOverrides[sp.tenor] !== undefined && askOverrides[sp.tenor] !== '' 
          ? parseFloat(askOverrides[sp.tenor]) / 100 : sp.ask
      }));
      
      if (viewMode === 'beginner') {
        // 초보 모드: Spot 기준으로 Target Date까지 계산
        const days = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        
        let result;
        if (interpMethod === 'swap_point_linear') {
          result = interpolateSwapPointLinear(days, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        } else {
          result = interpolateRaw(days, usdkrw?.USD, usdkrw?.KRW, spot, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        }
        
        return result ? { ...result, days } : null;
      } else {
        // Pro 모드: Start Date ~ Maturity Date 구간 계산
        const startDays = Math.round((startDate - spotDate) / (1000 * 60 * 60 * 24));
        const maturityDays = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        const periodDays = maturityDays - startDays;
        
        // Start와 Maturity 각각의 Swap Point 계산
        let startResult, maturityResult;
        
        if (interpMethod === 'swap_point_linear') {
          startResult = interpolateSwapPointLinear(startDays, fxSwapPointsWithOverrides, spotDateStr, startDateStr);
          maturityResult = interpolateSwapPointLinear(maturityDays, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        } else {
          startResult = interpolateRaw(startDays, usdkrw?.USD, usdkrw?.KRW, spot, fxSwapPointsWithOverrides, spotDateStr, startDateStr);
          maturityResult = interpolateRaw(maturityDays, usdkrw?.USD, usdkrw?.KRW, spot, fxSwapPointsWithOverrides, spotDateStr, targetDateStr);
        }
        
        if (!startResult || !maturityResult) return null;
      
      // Forward Spread = Maturity - Start
      const forwardPoints = maturityResult.points - startResult.points;
      
      // Conservative (보수적): 양쪽 스프레드 지불 - Roll 관점
      const conservativeBid = (maturityResult.bid !== null && startResult.ask !== null) 
        ? maturityResult.bid - startResult.ask  // Taker: Far sell (hit bid), Near buy (lift ask)
        : null;
      const conservativeAsk = (maturityResult.ask !== null && startResult.bid !== null)
        ? maturityResult.ask - startResult.bid  // Taker: Far buy (lift ask), Near sell (hit bid)
        : null;
      
      // Tight (타이트): 같은 방향 매칭 - Market Making 관점
      const tightBid = (maturityResult.bid !== null && startResult.bid !== null)
        ? maturityResult.bid - startResult.bid  // 양쪽 Bid 매칭
        : null;
      const tightAsk = (maturityResult.ask !== null && startResult.ask !== null)
        ? maturityResult.ask - startResult.ask  // 양쪽 Ask 매칭
        : null;
      
      return {
        startDate: startDateStr,
        maturityDate: targetDateStr,
        displayDays: periodDays,
        days: periodDays,
        tenor: `${startDays === 0 ? 'Spot' : startDays + 'D'} → ${maturityDays}D`,
        points: forwardPoints,
        // Conservative (Roll)
        bid: conservativeBid,
        ask: conservativeAsk,
        // Tight (Market Making)
        tightBid: tightBid,
        tightAsk: tightAsk,
        // 추가 정보
        startDays: startDays,
        maturityDays: maturityDays,
        startPoints: startResult.points,
        maturityPoints: maturityResult.points,
        startBid: startResult.bid,
        startAsk: startResult.ask,
        maturityBid: maturityResult.bid,
        maturityAsk: maturityResult.ask,
        usdDF: maturityResult.usdDF,
        krwDF: maturityResult.krwDF,
        forward: maturityResult.forward
      };
    }
    } catch (e) {
      console.warn('Interpolation calculation error:', e);
      return null;
    }
  }, [curveData, interpDate, interpStartDate, interpMethod, viewMode, overrides, bidOverrides, askOverrides]);

  if (loading) return <div className="text-center py-20 text-kustody-muted">로딩 중...</div>;
  if (!curveData) return <div className="text-center py-20 text-kustody-muted">커브 데이터가 없습니다</div>;

  const usdkrw = curveData.curves?.USDKRW;
  const spot = curveData.spotRates?.USDKRW;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Curve Snapshot</h2>
          <p className="text-sm text-kustody-muted mt-1">
            Reference: {curveData.metadata.referenceDate} | By: {curveData.metadata.createdBy}
            {usdkrw?.USD?.lastBootstrap && <span className="ml-2 text-kustody-accent">| Bootstrapped</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* DB에서 데이터 로드 */}
          <div className="flex items-center gap-1 bg-kustody-surface rounded-lg p-1">
            <button
              onClick={fetchCurveData}
              disabled={dataLoading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                dataLoading
                  ? 'bg-green-500/50 text-white cursor-wait'
                  : 'bg-green-500 text-white hover:bg-green-400'
              }`}
            >
              {dataLoading ? '⏳' : '🔄 Load DB'}
            </button>
            <button
              onClick={() => fetchMarketSwapPoints(true)}
              disabled={marketLoading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                marketLoading
                  ? 'bg-blue-500/50 text-white cursor-wait'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
              title={marketLastUpdate ? `최근: ${marketLastUpdate.toLocaleTimeString('ko-KR')}` : '30분 캐싱'}
            >
              {marketLoading ? '⏳' : '📡 Market'}
            </button>
          </div>
          <button 
            onClick={rebuildCurves}
            disabled={rebuilding}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              rebuilding 
                ? 'bg-kustody-muted text-kustody-dark cursor-wait' 
                : 'bg-yellow-500 text-kustody-dark hover:bg-yellow-400'
            }`}
          >
            {rebuilding ? '⏳ Building...' : '🔄 Rebuild Curve'}
          </button>
          {['USD','KRW'].map(c => (
            <button key={c} onClick={() => setSelectedCcy(c)} 
              className={`px-4 py-2 rounded-lg font-mono text-sm ${selectedCcy === c ? 'bg-kustody-accent text-kustody-dark font-semibold' : 'bg-kustody-surface text-kustody-muted'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Spot Rates - 엑셀 스타일 */}
      <div className="bg-kustody-surface rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">💱 Spot Rates</h3>
            <button
              onClick={applyNaverRates}
              disabled={naverLoading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                naverLoading
                  ? 'bg-orange-500/50 text-white cursor-wait'
                  : 'bg-orange-500 text-white hover:bg-orange-400'
              }`}
            >
              {naverLoading ? '⏳' : '📡 네이버'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            {naverLastUpdate && (
              <span className="text-xs text-kustody-muted">
                Last: {naverLastUpdate.toLocaleTimeString('ko-KR')}
              </span>
            )}
            <span className="text-xs text-kustody-muted">{curveData.metadata.referenceDate}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {Object.entries(curveData.spotRates).map(([pair, rate]) => (
            <div key={pair} className="text-center">
              <div className="text-xs text-kustody-muted mb-1">{pair}</div>
              <div className="font-mono font-semibold text-kustody-accent">{formatSpotRate(pair, rate)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FX Swap Points - Excel Style - 상단 전체 너비 */}
        <div className="bg-kustody-surface rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">💹 FX Swap Points</h3>
            <span className="text-xs text-kustody-muted">USDKRW</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                  <th className="text-left py-2 px-2 font-medium">Tenor</th>
                  <th className="text-center py-2 px-2 font-medium">Start</th>
                  <th className="text-center py-2 px-2 font-medium">Maturity</th>
                  <th className="text-right py-2 px-2 font-medium">Days</th>
                  <th className="text-right py-2 px-2 font-medium">Screen</th>
                  <th className="text-right py-2 px-2 font-medium">Sp/Day</th>
                  <th className="text-right py-2 px-2 font-medium">Indic_rate</th>
                  <th className="text-center py-2 px-2 font-medium bg-yellow-500/20">O/R</th>
                  <th className="text-right py-2 px-2 font-medium">Bid</th>
                  <th className="text-right py-2 px-2 font-medium">Ask</th>
                </tr>
              </thead>
              <tbody>
                {usdkrw?.fxSwapPoints.map((p, i) => {
                  // 표시용 days: Start에서 Maturity까지의 실제 기간
                  const displayDays = p.start && p.maturity 
                    ? Math.round((new Date(p.maturity) - new Date(p.start)) / (1000 * 60 * 60 * 24))
                    : (p.days > 0 ? p.days : 1);
                  
                  // 전단위 표시 (× 100) - O/R 우선 적용
                  const screenPips = overrides[p.tenor] !== undefined && overrides[p.tenor] !== ''
                    ? parseInt(overrides[p.tenor])
                    : (p.points !== null ? Math.round(p.points * 100) : null);
                  const bidPips = bidOverrides[p.tenor] !== undefined && bidOverrides[p.tenor] !== ''
                    ? parseInt(bidOverrides[p.tenor])
                    : (p.bid !== null ? Math.round(p.bid * 100) : null);
                  const askPips = askOverrides[p.tenor] !== undefined && askOverrides[p.tenor] !== ''
                    ? parseInt(askOverrides[p.tenor])
                    : (p.ask !== null ? Math.round(p.ask * 100) : null);
                  
                  // Sp/Day, indicRate도 오버라이드된 값으로 계산
                  const effectivePoints = screenPips !== null ? screenPips / 100 : null;
                  const spPerDay = (displayDays > 0 && screenPips !== null) ? (screenPips / displayDays).toFixed(2) : '-';
                  const indicRate = (displayDays > 0 && effectivePoints !== null) ? ((effectivePoints / spot) * (365 / displayDays) * 100).toFixed(2) : '-';
                  
                  // 오버라이드 여부 표시
                  const hasOverride = overrides[p.tenor] !== undefined && overrides[p.tenor] !== '';
                  
                  return (
                    <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 px-2 font-mono font-semibold text-kustody-text">{p.tenor}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.start || '-'}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.maturity || '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{displayDays}</td>
                      <td className={`py-2 px-2 text-right font-mono ${hasOverride ? 'text-yellow-400' : 'text-kustody-text'}`}>
                        {screenPips !== null ? screenPips : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-accent">{spPerDay}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{indicRate}%</td>
                      <td className="py-2 px-1 bg-yellow-500/10">
                        <DeferredInput
                          placeholder=""
                          value={overrides[p.tenor] || ''}
                          onCommit={(val) => setOverrides(prev => ({ ...prev, [p.tenor]: val }))}
                          className="w-20 px-2 py-1 bg-transparent border border-kustody-border/50 rounded text-center font-mono text-sm text-yellow-400 focus:border-yellow-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <DeferredInput
                          placeholder={p.bid !== null ? Math.round(p.bid * 100).toString() : ''}
                          value={bidOverrides[p.tenor] || ''}
                          onCommit={(val) => setBidOverrides(prev => ({ ...prev, [p.tenor]: val }))}
                          className="w-20 px-2 py-1 bg-transparent border border-kustody-border/50 rounded text-right font-mono text-sm text-red-400 focus:border-red-400 focus:outline-none placeholder-red-400/50"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <DeferredInput
                          placeholder={p.ask !== null ? Math.round(p.ask * 100).toString() : ''}
                          value={askOverrides[p.tenor] || ''}
                          onCommit={(val) => setAskOverrides(prev => ({ ...prev, [p.tenor]: val }))}
                          className="w-20 px-2 py-1 bg-transparent border border-kustody-border/50 rounded text-right font-mono text-sm text-green-400 focus:border-green-400 focus:outline-none placeholder-green-400/50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Interpolation Calculator */}
          <div className="mt-6 pt-4 border-t border-kustody-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-kustody-accent">🔢 Point Interpolation</h4>
              {/* Mode Toggle */}
              <div className="flex bg-kustody-dark rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('beginner')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    viewMode === 'beginner' 
                      ? 'bg-kustody-accent text-kustody-dark font-semibold' 
                      : 'text-kustody-muted hover:text-kustody-text'
                  }`}
                >
                  초보
                </button>
                <button
                  onClick={() => setViewMode('pro')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    viewMode === 'pro' 
                      ? 'bg-kustody-accent text-kustody-dark font-semibold' 
                      : 'text-kustody-muted hover:text-kustody-text'
                  }`}
                >
                  Pro
                </button>
              </div>
            </div>
            <div className={`grid ${viewMode === 'pro' ? 'grid-cols-4' : 'grid-cols-3'} gap-3 mb-3`}>
              {viewMode === 'pro' && (
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">Start Date</label>
                  <DeferredInput 
                    type="date" 
                    value={interpStartDate} 
                    onCommit={(val) => setInterpStartDate(val)}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-kustody-muted mb-1">
                  {viewMode === 'beginner' ? '결제일' : 'Maturity Date'}
                </label>
                <DeferredInput 
                  type="date" 
                  value={interpDate} 
                  onCommit={(val) => setInterpDate(val)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Method</label>
                <select 
                  value={interpMethod}
                  onChange={(e) => setInterpMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
                >
                  <option value="swap_point_linear">Swap Point Linear</option>
                  <option value="raw_interpolation">Raw (Log-Linear DF)</option>
                </select>
              </div>
              {/* Result inline - 전단위 표시 */}
              {interpResult && !interpResult.error && (
                <div className="bg-kustody-navy/50 rounded-lg p-2 flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-xs text-kustody-muted">Screen</div>
                    <div className="font-mono text-kustody-accent font-semibold">{interpResult.points !== null ? (interpResult.points * 100).toFixed(2) : '-'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-kustody-muted">{interpResult.displayDays}D</div>
                    <div className="font-mono text-xs text-kustody-muted">{interpResult.displayDays > 0 ? (interpResult.points * 100 / interpResult.displayDays).toFixed(2) : '-'}/d</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Detailed Result - 전단위 표시 */}
            {interpResult && !interpResult.error && (
              <div className="bg-kustody-navy/30 rounded-lg p-3">
                {viewMode === 'beginner' ? (
                  /* 초보 모드: Start < Maturity, Bid/Ask 반전 (Spot 이전) */
                  <div className="grid grid-cols-7 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xs text-kustody-muted">시작일</div>
                      <div className="font-mono text-kustody-text text-xs">{interpResult.startDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">결제일</div>
                      <div className="font-mono text-kustody-text text-xs">{interpResult.maturityDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">기간</div>
                      <div className="font-mono text-kustody-accent">{interpResult.displayDays}일</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Tenor</div>
                      <div className="font-mono text-kustody-accent text-xs">{interpResult.tenor || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Mid</div>
                      <div className="font-mono text-kustody-text">{interpResult.points !== null ? (interpResult.points * 100).toFixed(2) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Bid</div>
                      {/* Spot 이전: Swap Ask가 Outright Bid가 됨 */}
                      <div className="font-mono text-red-400">
                        {interpResult.days < 0 
                          ? (interpResult.ask !== null ? (interpResult.ask * 100).toFixed(2) : '-')
                          : (interpResult.bid !== null ? (interpResult.bid * 100).toFixed(2) : '-')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Ask</div>
                      {/* Spot 이전: Swap Bid가 Outright Ask가 됨 */}
                      <div className="font-mono text-green-400">
                        {interpResult.days < 0 
                          ? (interpResult.bid !== null ? (interpResult.bid * 100).toFixed(2) : '-')
                          : (interpResult.ask !== null ? (interpResult.ask * 100).toFixed(2) : '-')}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Pro 모드: Start Date ~ Maturity Date 구간 */
                  <div>
                    <div className="grid grid-cols-7 gap-2 text-center text-sm">
                      <div>
                        <div className="text-xs text-kustody-muted">Start</div>
                        <div className="font-mono text-kustody-text text-xs">{interpResult.startDate}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Maturity</div>
                        <div className="font-mono text-kustody-text text-xs">{interpResult.maturityDate}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Days</div>
                        <div className="font-mono text-kustody-accent">{interpResult.displayDays}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Mid</div>
                        <div className="font-mono text-kustody-text">{interpResult.points !== null ? (interpResult.points * 100).toFixed(2) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Bid</div>
                        <div className="font-mono text-red-400">{interpResult.tightBid !== null ? (interpResult.tightBid * 100).toFixed(2) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Ask</div>
                        <div className="font-mono text-green-400">{interpResult.tightAsk !== null ? (interpResult.tightAsk * 100).toFixed(2) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-kustody-muted">Spread</div>
                        <div className="font-mono text-kustody-accent">{interpResult.tightAsk !== null && interpResult.tightBid !== null ? ((interpResult.tightAsk - interpResult.tightBid) * 100).toFixed(2) : '-'}</div>
                      </div>
                    </div>
                    
                    {/* Start/Maturity 상세 - 전단위 */}
                    <div className="mt-2 pt-2 border-t border-kustody-border/30 grid grid-cols-2 gap-2 text-center text-xs">
                      <div>
                        <span className="text-kustody-muted">Start ({interpResult.startDays}D): </span>
                        <span className="font-mono">{interpResult.startPoints !== null ? (interpResult.startPoints * 100).toFixed(2) : '-'}</span>
                        <span className="text-red-400/70 ml-1">B:{interpResult.startBid !== null ? (interpResult.startBid * 100).toFixed(2) : '-'}</span>
                        <span className="text-green-400/70 ml-1">A:{interpResult.startAsk !== null ? (interpResult.startAsk * 100).toFixed(2) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-kustody-muted">Maturity ({interpResult.maturityDays}D): </span>
                        <span className="font-mono">{interpResult.maturityPoints !== null ? (interpResult.maturityPoints * 100).toFixed(2) : '-'}</span>
                        <span className="text-red-400/70 ml-1">B:{interpResult.maturityBid !== null ? (interpResult.maturityBid * 100).toFixed(2) : '-'}</span>
                        <span className="text-green-400/70 ml-1">A:{interpResult.maturityAsk !== null ? (interpResult.maturityAsk * 100).toFixed(2) : '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
                {interpMethod === 'raw_interpolation' && interpResult.usdDF && interpResult.displayDays > 0 && viewMode === 'beginner' && (
                  <div className="mt-2 pt-2 border-t border-kustody-border/30 grid grid-cols-4 gap-2 text-center text-xs">
                    <div><span className="text-kustody-muted">USD DF:</span> <span className="font-mono">{interpResult.usdDF.toFixed(6)}</span></div>
                    <div><span className="text-kustody-muted">KRW DF:</span> <span className="font-mono">{interpResult.krwDF.toFixed(6)}</span></div>
                    <div><span className="text-kustody-muted">Forward:</span> <span className="font-mono">{interpResult.forward?.toFixed(2)}</span></div>
                    <div><span className="text-kustody-muted">Indic:</span> <span className="font-mono">{((interpResult.points / spot) * (365 / interpResult.displayDays) * 100).toFixed(2)}%</span></div>
                  </div>
                )}
              </div>
            )}
            {interpResult?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {interpResult.error}
              </div>
            )}
          </div>
        </div>

        {/* Interest Rate Curve */}
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">📈 {selectedCcy} Curve</h3>
            <span className="text-xs text-kustody-muted bg-kustody-navy px-2 py-1 rounded">DC: {usdkrw?.[selectedCcy]?.dayCount}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs">
                  <th className="text-left py-2 font-medium">Tenor</th>
                  <th className="text-center py-2 font-medium">Maturity</th>
                  <th className="text-right py-2 font-medium">Days</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">DF</th>
                  <th className="text-right py-2 font-medium">Ln(DF)</th>
                  <th className="text-right py-2 font-medium">Zero Rate</th>
                </tr>
              </thead>
              <tbody>
                {usdkrw?.[selectedCcy]?.tenors.map((t, i) => {
                  const rateKey = `${selectedCcy}_${t.tenor}`;
                  return (
                    <tr key={i} className="border-t border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 font-mono font-semibold text-kustody-text">{t.tenor}</td>
                      <td className="py-2 text-center font-mono text-xs text-kustody-muted">{t.maturity}</td>
                      <td className="py-2 text-right text-kustody-muted">{t.days}</td>
                      <td className="py-1 text-right">
                        <DeferredInput
                          value={rateOverrides[rateKey] !== undefined ? rateOverrides[rateKey] : t.rate.toFixed(4)}
                          onCommit={(val) => setRateOverrides(prev => ({ ...prev, [rateKey]: val }))}
                          className="w-20 px-2 py-1 bg-kustody-dark border border-kustody-border rounded text-right font-mono text-sm text-kustody-accent focus:border-kustody-accent focus:outline-none"
                        />
                        <span className="text-kustody-muted ml-1">%</span>
                      </td>
                      <td className="py-2 text-right font-mono text-kustody-text">{t.df?.toFixed(6) || '-'}</td>
                      <td className="py-2 text-right font-mono text-kustody-muted text-xs">{t.lnDF?.toExponential(5) || '-'}</td>
                      <td className="py-2 text-right font-mono text-kustody-text">{t.zeroRate?.toFixed(4) || '-'}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Implied Yield - 동적 계산 */}
        <div className="bg-kustody-surface rounded-xl p-5">
          <h3 className="font-semibold mb-3">📊 Implied Yield</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs">
                  <th className="text-left py-2 font-medium">Tenor</th>
                  <th className="text-right py-2 font-medium">Days</th>
                  <th className="text-right py-2 font-medium">USD Rate</th>
                  <th className="text-right py-2 font-medium text-red-400">Impl Bid</th>
                  <th className="text-right py-2 font-medium text-kustody-accent">Impl Screen</th>
                  <th className="text-right py-2 font-medium text-green-400">Impl Ask</th>
                  <th className="text-right py-2 font-medium text-yellow-400">Spread</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // KRW tenor들로 implied yield 계산
                  const usdTenors = usdkrw?.USD?.tenors || [];
                  const krwTenors = usdkrw?.KRW?.tenors || [];
                  
                  const impliedData = [];
                  krwTenors.forEach(krw => {
                    if (krw.days <= 0) return; // O/N, T/N, Spot 제외
                    
                    // USD에서 같은 days tenor 찾기
                    let usd = usdTenors.find(u => u.days === krw.days);
                    if (!usd) {
                      // 가장 가까운 tenor 찾기
                      const validUsd = usdTenors.filter(u => u.days > 0);
                      if (validUsd.length > 0) {
                        usd = validUsd.reduce((prev, curr) => 
                          Math.abs(curr.days - krw.days) < Math.abs(prev.days - krw.days) ? curr : prev
                        );
                      }
                    }
                    
                    if (usd && krw) {
                      const days = krw.days;
                      const dayCount = 365;
                      
                      // DF 값들
                      const usdDF = usd.df;
                      const krwDFMid = krw.df;
                      const krwDFBid = krw.dfBid || krw.df;
                      const krwDFAsk = krw.dfAsk || krw.df;
                      
                      // Implied KRW Rate (DF에서 역산)
                      // KRW DF = 1 / (1 + r × days / dayCount)
                      // r = (1/DF - 1) × dayCount / days
                      const impliedMid = (1/krwDFMid - 1) * (dayCount / days) * 100;
                      const impliedBid = (1/krwDFBid - 1) * (dayCount / days) * 100;
                      const impliedAsk = (1/krwDFAsk - 1) * (dayCount / days) * 100;
                      
                      const usdRate = usd.zeroRate || usd.rate;
                      
                      impliedData.push({
                        tenor: krw.tenor,
                        days: days,
                        usdRate: usdRate,
                        impliedBid: impliedBid,
                        impliedMid: impliedMid,
                        impliedAsk: impliedAsk,
                        spread: impliedMid - usdRate
                      });
                    }
                  });
                  
                  return impliedData.map((y, i) => (
                    <tr key={i} className="border-t border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 font-mono font-semibold">{y.tenor}</td>
                      <td className="py-2 text-right text-kustody-muted">{y.days}</td>
                      <td className="py-2 text-right font-mono">{y.usdRate?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-red-400">{y.impliedBid?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-kustody-accent">{y.impliedMid?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-green-400">{y.impliedAsk?.toFixed(4)}%</td>
                      <td className="py-2 text-right font-mono text-yellow-400">{y.spread?.toFixed(4)}%</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Forward Spreads */}
        <div className="bg-kustody-surface rounded-xl p-5">
          <h3 className="font-semibold mb-3">🔀 Forward Spreads</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-kustody-muted text-xs">
                <th className="text-left py-2 font-medium">Spread</th>
                <th className="text-center py-2 font-medium">Near→Far</th>
                <th className="text-right py-2 font-medium">Bid</th>
                <th className="text-right py-2 font-medium">Mid</th>
                <th className="text-right py-2 font-medium">Ask</th>
                <th className="text-right py-2 font-medium">Spread</th>
              </tr>
            </thead>
            <tbody>
              {curveData.forwardSpreads?.USDKRW.map((s, i) => {
                // Tight: Far Bid - Near Bid, Far Ask - Near Ask
                const bid = (s.farBid !== null && s.nearBid !== null) 
                  ? s.farBid - s.nearBid : null;
                const ask = (s.farAsk !== null && s.nearAsk !== null)
                  ? s.farAsk - s.nearAsk : null;
                const spread = (ask !== null && bid !== null)
                  ? ask - bid : null;
                
                return (
                  <tr key={i} className="border-t border-kustody-border/30 hover:bg-kustody-navy/20">
                    <td className="py-2 font-mono font-semibold text-kustody-accent">{s.spread}</td>
                    <td className="py-2 text-center text-kustody-muted text-xs">{s.nearTenor}→{s.farTenor}</td>
                    <td className="py-2 text-right font-mono text-red-400">{bid !== null ? Math.round(bid * 100) : '-'}</td>
                    <td className="py-2 text-right font-mono">{s.points !== null ? Math.round(s.points * 100) : '-'}</td>
                    <td className="py-2 text-right font-mono text-green-400">{ask !== null ? Math.round(ask * 100) : '-'}</td>
                    <td className="py-2 text-right font-mono text-kustody-accent">{spread !== null ? Math.round(spread * 100) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== Clients Tab ====================
function ClientsTab({ config, setConfig, saveConfig, exportConfig, importConfig, editingClient, setEditingClient, showClientModal, setShowClientModal, saveClient, deleteClient }) {
  const tierColors = {
    1: 'text-yellow-400',
    2: 'text-kustody-text',
    3: 'text-orange-400',
    4: 'text-red-400',
    5: 'text-red-600'
  };

  const tierBadges = {
    1: '⭐',
    2: '',
    3: '⚠️',
    4: '🚨',
    5: '🚫'
  };

  const statusColors = {
    active: 'bg-green-500',
    pending: 'bg-yellow-500',
    blocked: 'bg-red-500'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">👥 Client Management</h2>
          <p className="text-sm text-kustody-muted mt-1">{config.companyName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingClient(null); setShowClientModal(true); }}
            className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg text-sm font-semibold hover:bg-kustody-accent-dim transition-colors"
          >
            + 고객 추가
          </button>
          <button
            onClick={saveConfig}
            className="px-4 py-2 bg-kustody-navy text-kustody-text rounded-lg text-sm hover:bg-kustody-surface transition-colors"
          >
            💾 저장
          </button>
          <button
            onClick={exportConfig}
            className="px-4 py-2 bg-kustody-navy text-kustody-text rounded-lg text-sm hover:bg-kustody-surface transition-colors"
          >
            📤 내보내기
          </button>
          <label className="px-4 py-2 bg-kustody-navy text-kustody-text rounded-lg text-sm hover:bg-kustody-surface transition-colors cursor-pointer">
            📥 가져오기
            <input type="file" accept=".json" onChange={importConfig} className="hidden" />
          </label>
        </div>
      </div>

      {/* Credit Tier 범례 */}
      <div className="bg-kustody-surface rounded-xl p-4">
        <h3 className="font-semibold mb-3">📊 Credit Tier 정의</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(config.creditTiers).map(([tier, info]) => (
            <div key={tier} className={`p-3 rounded-lg bg-kustody-navy/50 ${tierColors[tier]}`}>
              <div className="font-semibold">{tierBadges[tier]} Tier {tier}</div>
              <div className="text-sm">{info.name}</div>
              <div className="text-xs text-kustody-muted mt-1">
                {info.pointMargin !== null ? `+${info.pointMargin} pt / +${info.bpMargin} bp` : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notional Tier 범례 */}
      <div className="bg-kustody-surface rounded-xl p-4">
        <h3 className="font-semibold mb-3">💵 Notional Size Tier</h3>
        <div className="grid grid-cols-3 gap-4">
          {config.notionalTiers.map((tier, i) => (
            <div key={i} className="p-3 rounded-lg bg-kustody-navy/50">
              <div className="font-semibold">{tier.name}</div>
              <div className="text-xs text-kustody-muted">+{tier.margin} points</div>
            </div>
          ))}
        </div>
      </div>

      {/* Client List */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <h3 className="font-semibold mb-4">📋 등록된 고객</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-kustody-muted text-xs border-b border-kustody-border">
              <th className="text-left py-3 font-medium">Client ID</th>
              <th className="text-left py-3 font-medium">고객명</th>
              <th className="text-center py-3 font-medium">Credit Tier</th>
              <th className="text-center py-3 font-medium">Margin Type</th>
              <th className="text-center py-3 font-medium">SEAL Status</th>
              <th className="text-center py-3 font-medium">예외</th>
              <th className="text-center py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {config.clients.map((client) => (
              <tr key={client.clientId} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                <td className="py-3 font-mono text-kustody-muted">{client.clientId}</td>
                <td className="py-3 font-semibold">{client.clientName}</td>
                <td className="py-3 text-center">
                  <span className={`font-semibold ${tierColors[client.creditTier]}`}>
                    {tierBadges[client.creditTier]} {client.creditTier} - {config.creditTiers[client.creditTier]?.name}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${client.marginType === 'point' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {client.marginType === 'point' ? 'Point' : 'BP'}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="flex items-center justify-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[client.sealLayer?.status] || 'bg-gray-500'}`}></span>
                    <span className="text-xs capitalize">{client.sealLayer?.status || 'unknown'}</span>
                  </span>
                </td>
                <td className="py-3 text-center">
                  {(client.overrides?.ignoreCredit || client.overrides?.ignoreNotional) ? (
                    <span className="text-yellow-400" title="예외 적용됨">✓</span>
                  ) : '-'}
                </td>
                <td className="py-3 text-center">
                  <button
                    onClick={() => { setEditingClient(client); setShowClientModal(true); }}
                    className="px-2 py-1 text-xs bg-kustody-navy rounded hover:bg-kustody-surface mr-1"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteClient(client.clientId)}
                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Client Modal */}
      {showClientModal && (
        <ClientModal
          client={editingClient}
          config={config}
          onSave={saveClient}
          onClose={() => { setShowClientModal(false); setEditingClient(null); }}
        />
      )}
    </div>
  );
}

// Client 추가/수정 Modal
function ClientModal({ client, config, onSave, onClose }) {
  const [form, setForm] = useState(client || {
    clientId: '',
    clientName: '',
    creditTier: 2,
    marginType: 'point',
    overrides: { ignoreCredit: false, ignoreNotional: false, customMargin: null },
    sealLayer: { status: 'pending', walletAddress: '', lastSync: null, kycStatus: 'pending' }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.clientId || !form.clientName) {
      alert('Client ID와 고객명을 입력해주세요.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-kustody-surface rounded-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-semibold mb-4">{client ? '고객 수정' : '고객 추가'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-kustody-muted mb-1">Client ID</label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                disabled={!!client}
                className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-kustody-muted mb-1">고객명</label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-kustody-muted mb-1">Credit Tier</label>
              <select
                value={form.creditTier}
                onChange={(e) => setForm({ ...form, creditTier: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
              >
                {Object.entries(config.creditTiers).map(([tier, info]) => (
                  <option key={tier} value={tier}>Tier {tier} - {info.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-kustody-muted mb-1">Margin Type</label>
              <select
                value={form.marginType}
                onChange={(e) => setForm({ ...form, marginType: e.target.value })}
                className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
              >
                <option value="point">Point (직접 가감)</option>
                <option value="bp">BP (금리 환산)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-kustody-muted mb-2">SEAL Layer</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Status</label>
                <select
                  value={form.sealLayer?.status || 'pending'}
                  onChange={(e) => setForm({ ...form, sealLayer: { ...form.sealLayer, status: e.target.value } })}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Wallet Address</label>
                <input
                  type="text"
                  value={form.sealLayer?.walletAddress || ''}
                  onChange={(e) => setForm({ ...form, sealLayer: { ...form.sealLayer, walletAddress: e.target.value } })}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-kustody-muted mb-2">예외 설정</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.overrides?.ignoreCredit || false}
                  onChange={(e) => setForm({ ...form, overrides: { ...form.overrides, ignoreCredit: e.target.checked } })}
                  className="rounded"
                />
                Credit 무시
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.overrides?.ignoreNotional || false}
                  onChange={(e) => setForm({ ...form, overrides: { ...form.overrides, ignoreNotional: e.target.checked } })}
                  className="rounded"
                />
                Notional 무시
              </label>
            </div>
            <div className="mt-2">
              <label className="block text-xs text-kustody-muted mb-1">Custom Margin (point) - 빈칸이면 Tier 기본값</label>
              <input
                type="number"
                value={form.overrides?.customMargin ?? ''}
                onChange={(e) => setForm({ ...form, overrides: { ...form.overrides, customMargin: e.target.value === '' ? null : parseFloat(e.target.value) } })}
                placeholder="미지정"
                className="w-32 px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-kustody-navy text-kustody-text rounded-lg text-sm hover:bg-kustody-surface"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg text-sm font-semibold hover:bg-kustody-accent-dim"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Client Pricing Tab ====================
function ClientPricingTab({ config, selectedClientId, setSelectedClientId, pricingNotional, setPricingNotional }) {
  const [curveData, setCurveData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Point Interpolation 관련 state
  const [viewMode, setViewMode] = useState('beginner');
  const [interpDate, setInterpDate] = useState('2020-04-06');
  const [interpStartDate, setInterpStartDate] = useState('2020-03-04');
  
  // 네이버 환율 state
  const [liveSpot, setLiveSpot] = useState(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [naverLastUpdate, setNaverLastUpdate] = useState(null);

  // 네이버 환율 가져오기 (4분 캐싱)
  const fetchNaverSpot = async (force = false) => {
    const now = Date.now();
    
    // 전역 캐시 체크
    if (!force && naverRateCache.data && naverRateCache.lastFetch && 
        (now - naverRateCache.lastFetch) < naverRateCache.CACHE_DURATION) {
      if (naverRateCache.data.USDKRW) {
        setLiveSpot(naverRateCache.data.USDKRW);
        setNaverLastUpdate(new Date(naverRateCache.lastFetch));
      }
      return naverRateCache.data.USDKRW;
    }
    
    setNaverLoading(true);
    try {
      const response = await fetch('/api/naver-rates', {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.rates?.USDKRW) {
          const rate = data.rates.USDKRW;
          setLiveSpot(rate);
          setNaverLastUpdate(new Date(now));
          
          // 전역 캐시 업데이트
          naverRateCache.data = data.rates;
          
          naverRateCache.lastFetch = now;
          
          return rate;
        }
      }
    } catch (error) {
      console.error('Naver spot fetch error:', error);
    } finally {
      setNaverLoading(false);
    }
    return null;
  };

  // Supabase 설정
  const SUPABASE_URL = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';
  
  // 기본 spread 설정 (DB에 없을 경우 fallback)
  // spread_pips = 한쪽 spread (bid = mid - spread, ask = mid + spread)
  const DEFAULT_SPREADS = {
    'O/N': 1.5, 'T/N': 1.5, '1W': 4,
    '1M': 10, '2M': 20, '3M': 30,
    '6M': 40, '9M': 60, '1Y': 80
  };
  
  // Spread settings 가져오기
  const fetchSpreadSettings = async () => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/spread_settings?select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const settings = {};
          data.forEach(row => {
            const tenorName = row.tenor === 'ON' ? 'O/N' : row.tenor === 'TN' ? 'T/N' : row.tenor;
            settings[tenorName] = row.spread_pips || 0;
          });
          return settings;
        }
      }
    } catch (error) {
      console.error('Spread settings fetch error:', error);
    }
    return DEFAULT_SPREADS;
  };

  // Curve 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. JSON 로드
        const res = await fetch('/config/curves/20260127_IW.json');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        
        // 2. Spread settings 가져오기
        const spreads = await fetchSpreadSettings();
        
        // 3. fxSwapPoints에 spread 적용
        if (data.curves?.USDKRW?.fxSwapPoints) {
          data.curves.USDKRW.fxSwapPoints = data.curves.USDKRW.fxSwapPoints.map(sp => {
            const spreadPips = spreads[sp.tenor] || 0;
            const spreadValue = spreadPips / 100;
            return {
              ...sp,
              bid: sp.points - spreadValue,
              ask: sp.points + spreadValue
            };
          });
        }
        
        // Spot Date 기준으로 기본 날짜 설정
        const spotDate = data.curves?.USDKRW?.USD?.spotDate;
        if (spotDate) {
          setInterpStartDate(spotDate);
          const maturity = new Date(spotDate);
          maturity.setMonth(maturity.getMonth() + 1);
          setInterpDate(maturity.toISOString().split('T')[0]);
        }
        setCurveData(data);
        setLoading(false);
      } catch (error) {
        console.error('Load error:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const selectedClient = config.clients.find(c => c.clientId === selectedClientId);
  const spot = liveSpot || curveData?.spotRates?.USDKRW || 1450.00;

  // Notional Tier 찾기
  const getNotionalTier = (notional) => {
    return config.notionalTiers.find(t => 
      notional >= t.min && (t.max === null || notional < t.max)
    ) || config.notionalTiers[1];
  };

  // Margin 계산 (Point 방식) - 전단위로 반환
  const calculatePointMargin = (client, days) => {
    if (!client) return { credit: 0, notional: 0, total: 0 };
    
    const tier = config.creditTiers[client.creditTier];
    if (!tier || tier.pointMargin === null) return null; // Blocked

    // Custom Margin 체크
    if (client.overrides?.customMargin !== null && client.overrides?.customMargin !== undefined) {
      return { credit: client.overrides.customMargin, notional: 0, total: client.overrides.customMargin, isCustom: true };
    }

    // Credit Margin
    let creditMargin = 0;
    if (!client.overrides?.ignoreCredit) {
      if (client.marginType === 'point') {
        creditMargin = tier.pointMargin;
      } else {
        // BP → Point 환산: bp × days / 365 × spot / 10000
        creditMargin = tier.bpMargin * days / 365 * spot / 10000;
      }
    }

    // Notional Margin
    let notionalMargin = 0;
    if (!client.overrides?.ignoreNotional) {
      const notionalTier = getNotionalTier(pricingNotional);
      notionalMargin = notionalTier.margin;
    }

    return {
      credit: creditMargin,
      notional: notionalMargin,
      total: creditMargin + notionalMargin,
      isCustom: false
    };
  };

  // 고객용 커브 생성 (마진 적용)
  const getClientSwapPoints = () => {
    if (!curveData || !selectedClient) return [];
    const fxSwapPoints = curveData.curves?.USDKRW?.fxSwapPoints || [];
    
    return fxSwapPoints.map(p => {
      const margin = calculatePointMargin(selectedClient, p.days);
      if (!margin) return { ...p, clientBid: null, clientAsk: null };
      
      // 마진은 전단위로 계산됨, 원단위로 변환 필요 (/100)
      const marginInWon = margin.total / 100;
      
      return {
        ...p,
        clientBid: p.bid !== null ? p.bid - marginInWon : null,
        clientAsk: p.ask !== null ? p.ask + marginInWon : null
      };
    });
  };

  // Swap Point Linear Interpolation (고객용 커브 기반)
  const interpolateClientSwapPoint = (days, swapPoints) => {
    if (!swapPoints || swapPoints.length === 0) return null;
    
    // Spot 이전 처리
    if (days <= 0) {
      if (days === 0) {
        return { points: 0, bid: 0, ask: 0, displayDays: 0 };
      }
      const tn = swapPoints.find(p => p.tenor === 'T/N');
      const on = swapPoints.find(p => p.tenor === 'O/N');
      if (days === -1 && tn) {
        return { points: tn.points, bid: tn.clientBid, ask: tn.clientAsk, displayDays: 1, tenor: 'T/N' };
      }
      if (days === -2 && on) {
        return { points: on.points, bid: on.clientBid, ask: on.clientAsk, displayDays: 1, tenor: 'O/N' };
      }
      return null;
    }

    const sorted = swapPoints.filter(p => p.days > 0).sort((a, b) => a.days - b.days);
    if (sorted.length === 0) return null;

    // 정확히 일치하는 경우
    const exact = sorted.find(p => p.days === days);
    if (exact) {
      return {
        points: exact.points,
        bid: exact.clientBid,
        ask: exact.clientAsk,
        displayDays: days,
        tenor: exact.tenor
      };
    }

    // 범위 밖
    if (days < sorted[0].days) {
      return {
        points: sorted[0].points * days / sorted[0].days,
        bid: sorted[0].clientBid !== null ? sorted[0].clientBid * days / sorted[0].days : null,
        ask: sorted[0].clientAsk !== null ? sorted[0].clientAsk * days / sorted[0].days : null,
        displayDays: days
      };
    }
    if (days > sorted[sorted.length - 1].days) {
      const last = sorted[sorted.length - 1];
      return {
        points: last.points * days / last.days,
        bid: last.clientBid !== null ? last.clientBid * days / last.days : null,
        ask: last.clientAsk !== null ? last.clientAsk * days / last.days : null,
        displayDays: days
      };
    }

    // 선형 보간
    let lower = sorted[0], upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].days <= days && sorted[i + 1].days >= days) {
        lower = sorted[i];
        upper = sorted[i + 1];
        break;
      }
    }

    const ratio = (days - lower.days) / (upper.days - lower.days);
    const interpPoints = lower.points + (upper.points - lower.points) * ratio;
    const interpBid = (lower.clientBid !== null && upper.clientBid !== null)
      ? lower.clientBid + (upper.clientBid - lower.clientBid) * ratio : null;
    const interpAsk = (lower.clientAsk !== null && upper.clientAsk !== null)
      ? lower.clientAsk + (upper.clientAsk - lower.clientAsk) * ratio : null;

    return {
      points: interpPoints,
      bid: interpBid,
      ask: interpAsk,
      displayDays: days,
      lowerTenor: lower.tenor,
      upperTenor: upper.tenor
    };
  };

  // 보간 결과 계산
  const clientInterpResult = useMemo(() => {
    if (!curveData || !interpDate || !selectedClient || selectedClient.creditTier === 5) return null;
    
    try {
      const clientSwapPoints = getClientSwapPoints();
      const usdkrw = curveData.curves?.USDKRW;
      const spotDate = new Date(usdkrw?.USD?.spotDate || curveData.metadata.referenceDate);
      const targetDate = new Date(interpDate);
      const startDate = new Date(interpStartDate);
      
      if (isNaN(spotDate.getTime()) || isNaN(targetDate.getTime()) || isNaN(startDate.getTime())) {
        return null;
      }

      if (viewMode === 'beginner') {
        const days = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        const result = interpolateClientSwapPoint(days, clientSwapPoints);
        return result ? { ...result, days } : null;
      } else {
        // Pro 모드
        const startDays = Math.round((startDate - spotDate) / (1000 * 60 * 60 * 24));
        const maturityDays = Math.round((targetDate - spotDate) / (1000 * 60 * 60 * 24));
        const periodDays = maturityDays - startDays;

        const startResult = interpolateClientSwapPoint(startDays, clientSwapPoints);
        const maturityResult = interpolateClientSwapPoint(maturityDays, clientSwapPoints);

        if (!startResult || !maturityResult) return null;

        // Forward Spread (Tight 방식)
        const forwardPoints = maturityResult.points - startResult.points;
        const tightBid = (maturityResult.bid !== null && startResult.bid !== null)
          ? maturityResult.bid - startResult.bid : null;
        const tightAsk = (maturityResult.ask !== null && startResult.ask !== null)
          ? maturityResult.ask - startResult.ask : null;

        return {
          startDate: interpStartDate,
          maturityDate: interpDate,
          displayDays: periodDays,
          days: periodDays,
          tenor: `${startDays === 0 ? 'Spot' : startDays + 'D'} → ${maturityDays}D`,
          points: forwardPoints,
          tightBid,
          tightAsk,
          startDays,
          maturityDays,
          startPoints: startResult.points,
          maturityPoints: maturityResult.points,
          startBid: startResult.bid,
          startAsk: startResult.ask,
          maturityBid: maturityResult.bid,
          maturityAsk: maturityResult.ask
        };
      }
    } catch (e) {
      console.warn('Client interpolation error:', e);
      return null;
    }
  }, [curveData, interpDate, interpStartDate, viewMode, selectedClient, pricingNotional]);

  if (loading) return <div className="text-center py-20 text-kustody-muted">로딩 중...</div>;

  const fxSwapPoints = curveData?.curves?.USDKRW?.fxSwapPoints || [];
  const clientSwapPoints = getClientSwapPoints();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">💰 Client Pricing</h2>
          <p className="text-sm text-kustody-muted mt-1">고객별 마진 적용 가격 산출</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchNaverSpot(true)}
            disabled={naverLoading}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              naverLoading
                ? 'bg-orange-500/50 text-white cursor-wait'
                : 'bg-orange-500 text-white hover:bg-orange-400'
            }`}
          >
            {naverLoading ? '⏳' : '📡'}
          </button>
          <div className="text-right text-sm">
            <div className="text-kustody-muted">Spot (USDKRW)</div>
            <div className="font-mono text-lg font-bold text-kustody-accent">
              {spot.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </div>
            {naverLastUpdate && (
              <div className="text-xs text-kustody-muted">{naverLastUpdate.toLocaleTimeString('ko-KR')}</div>
            )}
          </div>
        </div>
      </div>

      {/* 고객 선택 & Notional 입력 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs text-kustody-muted mb-2">고객 선택</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-3 bg-kustody-dark border border-kustody-border rounded-lg text-sm"
            >
              <option value="">-- 고객 선택 --</option>
              {config.clients.map(c => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName} (Tier {c.creditTier})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-kustody-muted mb-2">Notional (USD)</label>
            <input
              type="number"
              value={pricingNotional}
              onChange={(e) => setPricingNotional(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-kustody-dark border border-kustody-border rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-kustody-muted mb-2">적용 마진 (1M 기준)</label>
            <div className="px-4 py-3 bg-kustody-accent/20 border border-kustody-accent/30 rounded-lg text-sm font-mono text-kustody-accent font-semibold">
              ±{selectedClient ? Math.round(calculatePointMargin(selectedClient, 33)?.total || 0) : 0} pt
              <span className="text-kustody-muted font-normal ml-2">
                (Credit: {selectedClient ? Math.round(calculatePointMargin(selectedClient, 33)?.credit || 0) : 0} + 
                Notional: {getNotionalTier(pricingNotional)?.margin || 0})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 5 Blocked */}
      {selectedClient && selectedClient.creditTier === 5 && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🚫</div>
          <div className="text-red-400 font-semibold text-lg">거래 불가 (Tier 5 - Blocked)</div>
          <div className="text-kustody-muted text-sm mt-2">
            {selectedClient.sealLayer?.reason || '내부 정책에 의해 거래가 제한되었습니다.'}
          </div>
        </div>
      )}

      {/* Tier 4 Warning */}
      {selectedClient && selectedClient.creditTier === 4 && (
        <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
          ⚠️ Tier 4 (Discouraged) - 거래 억제 가격이 적용됩니다.
        </div>
      )}

      {/* FX Swap Points - 고객용 (마진 적용) */}
      {selectedClient && selectedClient.creditTier !== 5 && (
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">📊 FX Swap Points - {selectedClient.clientName}</h3>
            <span className="text-xs bg-kustody-navy px-2 py-1 rounded text-kustody-muted">USDKRW · 전단위</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                  <th className="text-left py-2 px-2 font-medium">Tenor</th>
                  <th className="text-center py-2 px-2 font-medium">Start</th>
                  <th className="text-center py-2 px-2 font-medium">Maturity</th>
                  <th className="text-right py-2 px-2 font-medium">Days</th>
                  <th className="text-right py-2 px-2 font-medium">Screen</th>
                  <th className="text-right py-2 px-2 font-medium">Sp/Day</th>
                  <th className="text-right py-2 px-2 font-medium">Indic_rate</th>
                  <th className="text-right py-2 px-2 font-medium text-red-400">Bid</th>
                  <th className="text-right py-2 px-2 font-medium text-green-400">Ask</th>
                </tr>
              </thead>
              <tbody>
                {clientSwapPoints.map((p, i) => {
                  // 표시용 days: Start에서 Maturity까지의 실제 기간
                  const displayDays = p.start && p.maturity 
                    ? Math.round((new Date(p.maturity) - new Date(p.start)) / (1000 * 60 * 60 * 24))
                    : (p.days > 0 ? p.days : 1);
                  const screenPips = p.points !== null ? Math.round(p.points * 100) : null;
                  const bidPips = p.clientBid !== null ? Math.round(p.clientBid * 100) : null;
                  const askPips = p.clientAsk !== null ? Math.round(p.clientAsk * 100) : null;
                  const spPerDay = (displayDays > 0 && screenPips !== null) ? (screenPips / displayDays).toFixed(2) : '-';
                  const effectivePoints = p.points;
                  const indicRate = (displayDays > 0 && effectivePoints !== null) ? ((effectivePoints / spot) * (365 / displayDays) * 100).toFixed(2) : '-';

                  return (
                    <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                      <td className="py-2 px-2 font-mono font-semibold text-kustody-text">{p.tenor}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.start || '-'}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs text-kustody-muted">{p.maturity || '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{displayDays}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-text">{screenPips !== null ? screenPips : '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-accent">{spPerDay}</td>
                      <td className="py-2 px-2 text-right font-mono text-kustody-muted">{indicRate !== '-' ? indicRate + '%' : '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-red-400 font-semibold">{bidPips ?? '-'}</td>
                      <td className="py-2 px-2 text-right font-mono text-green-400 font-semibold">{askPips ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Point Interpolation - 고객용 */}
      {selectedClient && selectedClient.creditTier !== 5 && (
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">🎯 Point Interpolation - {selectedClient.clientName}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('beginner')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  viewMode === 'beginner' 
                    ? 'bg-kustody-accent text-kustody-dark font-semibold' 
                    : 'text-kustody-muted hover:text-kustody-text'
                }`}
              >
                초보
              </button>
              <button
                onClick={() => setViewMode('pro')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  viewMode === 'pro' 
                    ? 'bg-kustody-accent text-kustody-dark font-semibold' 
                    : 'text-kustody-muted hover:text-kustody-text'
                }`}
              >
                Pro
              </button>
            </div>
          </div>
          
          <div className={`grid ${viewMode === 'pro' ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-3`}>
            {viewMode === 'pro' && (
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={interpStartDate} 
                  onChange={(e) => setInterpStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-kustody-muted mb-1">
                {viewMode === 'beginner' ? '결제일' : 'Maturity Date'}
              </label>
              <input 
                type="date" 
                value={interpDate} 
                onChange={(e) => setInterpDate(e.target.value)}
                className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
              />
            </div>
            {/* Result inline */}
            {clientInterpResult && (
              <div className="bg-kustody-navy/50 rounded-lg p-2 flex items-center justify-around">
                <div className="text-center">
                  <div className="text-xs text-kustody-muted">Screen</div>
                  <div className="font-mono text-kustody-accent font-semibold">
                    {clientInterpResult.points !== null ? Math.round(clientInterpResult.points * 100) : '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-kustody-muted">{clientInterpResult.displayDays || clientInterpResult.days}D</div>
                  <div className="font-mono text-xs text-kustody-muted">
                    {clientInterpResult.displayDays > 0 
                      ? (clientInterpResult.points * 100 / clientInterpResult.displayDays).toFixed(2) + '/d'
                      : '-'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 결과 표시 */}
          {clientInterpResult && (
            <div className="bg-kustody-navy/30 rounded-lg p-4">
              {viewMode === 'beginner' ? (
                <div className="grid grid-cols-7 gap-2 text-center text-sm">
                  <div>
                    <div className="text-xs text-kustody-muted">Spot Date</div>
                    <div className="font-mono text-kustody-text text-xs">
                      {curveData?.curves?.USDKRW?.USD?.spotDate}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">결제일</div>
                    <div className="font-mono text-kustody-text text-xs">{interpDate}</div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">기간</div>
                    <div className="font-mono text-kustody-accent">{clientInterpResult.displayDays}일</div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Screen</div>
                    <div className="font-mono text-kustody-text">
                      {clientInterpResult.points !== null ? Math.round(clientInterpResult.points * 100) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Bid</div>
                    <div className="font-mono text-red-400 font-semibold">
                      {clientInterpResult.bid !== null ? Math.round(clientInterpResult.bid * 100) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Ask</div>
                    <div className="font-mono text-green-400 font-semibold">
                      {clientInterpResult.ask !== null ? Math.round(clientInterpResult.ask * 100) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-kustody-muted">Spread</div>
                    <div className="font-mono text-kustody-accent">
                      {clientInterpResult.bid !== null && clientInterpResult.ask !== null 
                        ? Math.round((clientInterpResult.ask - clientInterpResult.bid) * 100) : '-'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Pro 모드 */
                <div>
                  <div className="grid grid-cols-7 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xs text-kustody-muted">Start</div>
                      <div className="font-mono text-kustody-text text-xs">{clientInterpResult.startDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Maturity</div>
                      <div className="font-mono text-kustody-text text-xs">{clientInterpResult.maturityDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Days</div>
                      <div className="font-mono text-kustody-accent">{clientInterpResult.displayDays}</div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Mid</div>
                      <div className="font-mono text-kustody-text">
                        {clientInterpResult.points !== null ? Math.round(clientInterpResult.points * 100) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Bid</div>
                      <div className="font-mono text-red-400 font-semibold">
                        {clientInterpResult.tightBid !== null ? Math.round(clientInterpResult.tightBid * 100) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Ask</div>
                      <div className="font-mono text-green-400 font-semibold">
                        {clientInterpResult.tightAsk !== null ? Math.round(clientInterpResult.tightAsk * 100) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-kustody-muted">Spread</div>
                      <div className="font-mono text-kustody-accent">
                        {clientInterpResult.tightAsk !== null && clientInterpResult.tightBid !== null 
                          ? Math.round((clientInterpResult.tightAsk - clientInterpResult.tightBid) * 100) : '-'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Start/Maturity 상세 */}
                  <div className="mt-2 pt-2 border-t border-kustody-border/30 grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="text-kustody-muted">Start ({clientInterpResult.startDays}D): </span>
                      <span className="font-mono">{clientInterpResult.startPoints !== null ? Math.round(clientInterpResult.startPoints * 100) : '-'}</span>
                      <span className="text-red-400/70 ml-1">B:{clientInterpResult.startBid !== null ? Math.round(clientInterpResult.startBid * 100) : '-'}</span>
                      <span className="text-green-400/70 ml-1">A:{clientInterpResult.startAsk !== null ? Math.round(clientInterpResult.startAsk * 100) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">Maturity ({clientInterpResult.maturityDays}D): </span>
                      <span className="font-mono">{clientInterpResult.maturityPoints !== null ? Math.round(clientInterpResult.maturityPoints * 100) : '-'}</span>
                      <span className="text-red-400/70 ml-1">B:{clientInterpResult.maturityBid !== null ? Math.round(clientInterpResult.maturityBid * 100) : '-'}</span>
                      <span className="text-green-400/70 ml-1">A:{clientInterpResult.maturityAsk !== null ? Math.round(clientInterpResult.maturityAsk * 100) : '-'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedClient && (
        <div className="bg-kustody-surface rounded-xl p-10 text-center text-kustody-muted">
          👆 고객을 선택해주세요
        </div>
      )}
    </div>
  );
}

// ==================== Spread Settings Section ====================
function SpreadSettingsSection() {
  const TENOR_LIST = ['ON', 'TN', '1W', '1M', '2M', '3M', '6M', '1Y', '2Y'];
  
  const [mode, setMode] = useState('uniform'); // 'uniform' or 'byTenor'
  const [uniformBp, setUniformBp] = useState(5);
  const [tenorBp, setTenorBp] = useState({
    'ON': 20, 'TN': 15, '1W': 10, '1M': 5, '2M': 5, '3M': 5, '6M': 5, '1Y': 5, '2Y': 5
  });
  const [minimumPips, setMinimumPips] = useState(1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // localStorage에서 설정 로드
    const savedSettings = localStorage.getItem('stablefx_spread_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setMode(settings.mode || 'uniform');
        setUniformBp(settings.uniformBp || 5);
        setTenorBp(settings.tenorBp || tenorBp);
        setMinimumPips(settings.minimumPips || 1);
      } catch {}
    } else {
      // 레거시 호환: 기존 단일 값이 있으면 가져오기
      const legacySpread = localStorage.getItem('stablefx_spread_bp');
      if (legacySpread) {
        setUniformBp(Number(legacySpread));
      }
    }
  }, []);

  const handleSave = () => {
    const settings = { mode, uniformBp, tenorBp, minimumPips };
    localStorage.setItem('stablefx_spread_settings', JSON.stringify(settings));
    
    // 레거시 호환용
    localStorage.setItem('stablefx_spread_bp', String(uniformBp));
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    
    // 다른 탭에도 알림 (Landing 페이지)
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stablefx_spread_settings',
      newValue: JSON.stringify(settings),
    }));
  };

  const handleTenorBpChange = (tenor, value) => {
    setTenorBp(prev => ({ ...prev, [tenor]: Number(value) }));
  };

  return (
    <div className="bg-kustody-surface rounded-xl p-5">
      <h3 className="font-semibold mb-4">📊 Bid/Ask Spread 설정 (Landing 페이지)</h3>
      <p className="text-sm text-kustody-muted mb-4">
        Landing 페이지의 스왑포인트 조회에서 보여주는 Bid/Ask 추정 범위를 설정합니다.
      </p>
      
      {/* 모드 선택 */}
      <div className="mb-6">
        <label className="block text-sm text-kustody-muted mb-2">스프레드 적용 방식</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="spreadMode"
              checked={mode === 'uniform'}
              onChange={() => setMode('uniform')}
              className="accent-kustody-accent"
            />
            <span className="text-sm">일괄 적용</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="spreadMode"
              checked={mode === 'byTenor'}
              onChange={() => setMode('byTenor')}
              className="accent-kustody-accent"
            />
            <span className="text-sm">테너별 설정</span>
          </label>
        </div>
      </div>

      {/* 일괄 적용 */}
      {mode === 'uniform' && (
        <div className="mb-6 p-4 bg-kustody-navy/30 rounded-lg">
          <div className="flex items-center gap-4">
            <label className="text-sm text-kustody-muted">일괄 Spread:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={uniformBp}
              onChange={(e) => setUniformBp(Number(e.target.value))}
              className="w-20 px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono text-center"
            />
            <span className="text-sm text-kustody-muted">bp (연율 기준)</span>
          </div>
        </div>
      )}

      {/* 테너별 설정 */}
      {mode === 'byTenor' && (
        <div className="mb-6 p-4 bg-kustody-navy/30 rounded-lg">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {TENOR_LIST.map(tenor => (
              <div key={tenor} className="flex items-center gap-2">
                <label className="text-xs text-kustody-muted w-8">{tenor}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tenorBp[tenor]}
                  onChange={(e) => handleTenorBpChange(tenor, e.target.value)}
                  className="w-16 px-2 py-1 bg-kustody-dark border border-kustody-border rounded text-xs font-mono text-center"
                />
                <span className="text-xs text-kustody-muted">bp</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minimum Spread */}
      <div className="mb-6 p-4 bg-kustody-navy/30 rounded-lg">
        <div className="flex items-center gap-4">
          <label className="text-sm text-kustody-muted">Minimum Spread:</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={minimumPips}
            onChange={(e) => setMinimumPips(Number(e.target.value))}
            className="w-20 px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono text-center"
          />
          <span className="text-sm text-kustody-muted">전단위 (pips)</span>
        </div>
        <p className="text-xs text-kustody-muted mt-2">
          계산된 스프레드가 이 값보다 작으면 최소값이 적용됩니다.
        </p>
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-kustody-accent text-kustody-dark rounded font-semibold"
        >
          {saved ? '✓ 저장됨' : '저장'}
        </button>
        <span className="text-xs text-kustody-muted">
          저장 시 Landing 페이지에 즉시 반영됩니다.
        </span>
      </div>
      
      {/* 예시 */}
      <div className="p-3 bg-kustody-dark/50 rounded-lg">
        <p className="text-xs text-kustody-muted">
          <strong>적용 예시 (Spot 1,443 기준):</strong><br/>
          • O/N (1일), {mode === 'uniform' ? uniformBp : tenorBp['ON']}bp → 계산값 약 {((mode === 'uniform' ? uniformBp : tenorBp['ON']) / 10000 * 1443 * 1 / 360 * 100).toFixed(2)}전단위 → <span className="text-kustody-accent">Minimum {minimumPips}전단위 적용</span><br/>
          • 1M (33일), {mode === 'uniform' ? uniformBp : tenorBp['1M']}bp → 계산값 약 {((mode === 'uniform' ? uniformBp : tenorBp['1M']) / 10000 * 1443 * 33 / 360 * 100).toFixed(2)}전단위 → {((mode === 'uniform' ? uniformBp : tenorBp['1M']) / 10000 * 1443 * 33 / 360 * 100) < minimumPips ? <span className="text-kustody-accent">Minimum {minimumPips}전단위 적용</span> : '그대로 적용'}<br/>
          • 1Y (365일), {mode === 'uniform' ? uniformBp : tenorBp['1Y']}bp → 계산값 약 {((mode === 'uniform' ? uniformBp : tenorBp['1Y']) / 10000 * 1443 * 365 / 360 * 100).toFixed(2)}전단위 → 그대로 적용
        </p>
      </div>
    </div>
  );
}

// ==================== User Feedback Section ====================
function UserFeedbackSection() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const surveys = JSON.parse(localStorage.getItem('stablefx_surveys') || '[]');
    setFeedbacks(surveys.reverse());
  }, []);

  const JOB_LABELS = {
    cfo: 'CFO/경영진', treasury: '자금/재무', accounting: '회계/경리',
    trader: '트레이더/딜러', risk: '리스크 관리', backoffice: '백오피스/결제',
    it: 'IT/개발', other: '기타'
  };

  const BANK_LABELS = {
    kb: 'KB국민', shinhan: '신한', woori: '우리', hana: '하나',
    nh: 'NH농협', ibk: 'IBK기업', sc: 'SC제일', citi: '씨티',
    bnk: 'BNK', dgb: 'DGB대구', foreign: '외국계', other: '기타'
  };

  const PAIN_LABELS = {
    compare: '은행별 비교 어려움', timing: '거래 타이밍', excel: '엑셀 관리',
    report: '보고서 작성', hedge: '헤지 전략', settlement: '결제 일정'
  };

  const FEATURE_LABELS = {
    multi_bank_compare: '은행 환율 비교', realtime_pricing: '실시간 알림',
    cash_schedule: '자금 일정', hedge_dashboard: '헤지 대시보드',
    auto_report: '자동 리포팅', approval_workflow: '승인 워크플로우',
    trader_limit: '담당자 한도', audit_trail: '거래 추적', api_erp: 'ERP 연동'
  };

  const clearFeedbacks = () => {
    if (confirm('모든 피드백을 삭제하시겠습니까?')) {
      localStorage.removeItem('stablefx_surveys');
      setFeedbacks([]);
    }
  };

  // 통계 집계
  const bankCounts = feedbacks.reduce((acc, fb) => {
    fb.banks?.forEach(b => { acc[b] = (acc[b] || 0) + 1; });
    return acc;
  }, {});

  const painCounts = feedbacks.reduce((acc, fb) => {
    fb.painPoints?.forEach(p => { acc[p] = (acc[p] || 0) + 1; });
    return acc;
  }, {});

  const featureCounts = feedbacks.reduce((acc, fb) => {
    fb.features?.forEach(f => { acc[f] = (acc[f] || 0) + 1; });
    return acc;
  }, {});

  const sortedBanks = Object.entries(bankCounts).sort((a, b) => b[1] - a[1]);
  const sortedPains = Object.entries(painCounts).sort((a, b) => b[1] - a[1]);
  const sortedFeatures = Object.entries(featureCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-kustody-surface rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">💬 User Feedback ({feedbacks.length}건)</h3>
        {feedbacks.length > 0 && (
          <button onClick={clearFeedbacks} className="text-xs text-red-400 hover:text-red-300">전체 삭제</button>
        )}
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center text-kustody-muted py-8">
          아직 수집된 피드백이 없습니다.<br />
          <span className="text-xs">랜딩 페이지에서 설문을 진행하면 여기에 표시됩니다.</span>
        </div>
      ) : (
        <>
          {/* 3가지 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 주거래 은행 */}
            <div className="p-4 bg-kustody-navy/30 rounded-lg">
              <h4 className="text-xs font-semibold mb-3 text-kustody-accent">🏦 주거래 은행</h4>
              <div className="space-y-1">
                {sortedBanks.slice(0, 5).map(([bank, count]) => (
                  <div key={bank} className="flex justify-between text-xs">
                    <span className="text-kustody-muted">{BANK_LABELS[bank] || bank}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pain Points */}
            <div className="p-4 bg-kustody-navy/30 rounded-lg">
              <h4 className="text-xs font-semibold mb-3 text-red-400">😤 Pain Points</h4>
              <div className="space-y-1">
                {sortedPains.slice(0, 5).map(([pain, count]) => (
                  <div key={pain} className="flex justify-between text-xs">
                    <span className="text-kustody-muted">{PAIN_LABELS[pain] || pain}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 관심 기능 */}
            <div className="p-4 bg-kustody-navy/30 rounded-lg">
              <h4 className="text-xs font-semibold mb-3 text-green-400">⭐ 관심 기능</h4>
              <div className="space-y-1">
                {sortedFeatures.slice(0, 5).map(([feature, count]) => (
                  <div key={feature} className="flex justify-between text-xs">
                    <span className="text-kustody-muted">{FEATURE_LABELS[feature] || feature}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 개별 피드백 목록 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {feedbacks.map((fb, idx) => {
              const roleIcons = { cfo: '👔', treasury: '💰', accounting: '📊', trader: '📈', risk: '🛡️', backoffice: '📋', it: '💻', other: '👤' };
              return (
              <div key={idx} className="border border-kustody-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === idx ? null : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-kustody-navy/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{roleIcons[fb.role] || '👤'}</span>
                    <div>
                      <div className="text-sm font-medium">
                        {fb.company ? `${fb.company} · ` : ''}{JOB_LABELS[fb.role] || fb.role}
                      </div>
                      <div className="text-xs text-kustody-muted">{new Date(fb.timestamp).toLocaleString('ko-KR')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fb.banks?.length > 0 && <span className="text-xs text-blue-400">{fb.banks.length}개 은행</span>}
                    <span className="text-xs text-kustody-accent">{fb.features?.length || 0}개 기능</span>
                    <span className="text-kustody-muted">{expanded === idx ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expanded === idx && (
                  <div className="px-4 py-3 border-t border-kustody-border bg-kustody-navy/20 space-y-3">
                    {/* 거래 은행 */}
                    {fb.banks?.length > 0 && (
                      <div>
                        <span className="text-xs text-kustody-muted">거래 은행 ({fb.bankCount}):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fb.banks.map(b => (
                            <span key={b} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                              {BANK_LABELS[b] || b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Pain Points */}
                    {fb.painPoints?.length > 0 && (
                      <div>
                        <span className="text-xs text-kustody-muted">불편한 점:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fb.painPoints.map(p => (
                            <span key={p} className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                              {PAIN_LABELS[p] || p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 관심 기능 */}
                    {fb.features?.length > 0 && (
                      <div>
                        <span className="text-xs text-kustody-muted">관심 기능:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fb.features.map(f => (
                            <span key={f} className="px-2 py-0.5 bg-kustody-accent/20 text-kustody-accent text-xs rounded">
                              {FEATURE_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 추가 의견 */}
                    {fb.feedback && (
                      <div>
                        <span className="text-xs text-kustody-muted">추가 의견:</span>
                        <p className="text-sm mt-1 p-2 bg-kustody-dark rounded">{fb.feedback}</p>
                      </div>
                    )}
                    {/* 연락처 */}
                    {fb.email && (
                      <div className="text-xs">
                        <span className="text-kustody-muted">이메일:</span> 
                        <span className="font-mono ml-1">{fb.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );})}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== Usage Analytics Section ====================
function UsageAnalyticsSection() {
  const [usageLogs, setUsageLogs] = useState([]);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, all

  useEffect(() => {
    const logs = JSON.parse(localStorage.getItem('stablefx_usage') || '[]');
    setUsageLogs(logs);
  }, []);

  const clearLogs = () => {
    if (confirm('모든 사용 로그를 삭제하시겠습니까?')) {
      localStorage.removeItem('stablefx_usage');
      setUsageLogs([]);
    }
  };

  // 날짜 필터링
  const getFilteredLogs = () => {
    const now = new Date();
    let cutoff = new Date(0);
    if (dateRange === '7d') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === '30d') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    return usageLogs.filter(log => new Date(log.timestamp) >= cutoff);
  };

  const filteredLogs = getFilteredLogs();

  // 일별 통계
  const dailyStats = filteredLogs.reduce((acc, log) => {
    const date = log.timestamp.split('T')[0];
    if (!acc[date]) acc[date] = { date_calc: 0, swap_points_load: 0, swap_points_interp: 0 };
    acc[date][log.type] = (acc[date][log.type] || 0) + 1;
    return acc;
  }, {});

  const sortedDays = Object.keys(dailyStats).sort().reverse();

  // 전체 통계
  const totalStats = filteredLogs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {});

  // 테너별 통계 (date_calc)
  const tenorStats = filteredLogs
    .filter(l => l.type === 'date_calc')
    .reduce((acc, log) => {
      const tenor = log.data?.tenor || 'unknown';
      acc[tenor] = (acc[tenor] || 0) + 1;
      return acc;
    }, {});

  // 통화쌍별 통계
  const currencyStats = filteredLogs
    .filter(l => l.type === 'date_calc')
    .reduce((acc, log) => {
      const ccy = log.data?.currency || 'unknown';
      acc[ccy] = (acc[ccy] || 0) + 1;
      return acc;
    }, {});

  const totalCount = filteredLogs.length;
  const avgPerDay = sortedDays.length > 0 ? (totalCount / sortedDays.length).toFixed(1) : 0;

  return (
    <div className="bg-kustody-surface rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">📊 Usage Analytics</h3>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1 bg-kustody-dark border border-kustody-border rounded text-sm"
          >
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="all">전체</option>
          </select>
          {usageLogs.length > 0 && (
            <button onClick={clearLogs} className="text-xs text-red-400 hover:text-red-300">전체 삭제</button>
          )}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center text-kustody-muted py-8">
          아직 수집된 사용 로그가 없습니다.<br />
          <span className="text-xs">랜딩 페이지에서 조회 시 여기에 기록됩니다.</span>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-kustody-accent">{totalCount}</div>
              <div className="text-xs text-kustody-muted mt-1">총 조회수</div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-kustody-text">{avgPerDay}</div>
              <div className="text-xs text-kustody-muted mt-1">일평균</div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{totalStats.date_calc || 0}</div>
              <div className="text-xs text-kustody-muted mt-1">날짜 계산</div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{(totalStats.swap_points_load || 0) + (totalStats.swap_points_interp || 0)}</div>
              <div className="text-xs text-kustody-muted mt-1">스왑포인트</div>
            </div>
          </div>

          {/* 테너/통화 분포 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-kustody-navy/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">📈 테너별 조회</h4>
              <div className="space-y-2">
                {Object.entries(tenorStats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tenor, count]) => (
                  <div key={tenor} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-12">{tenor}</span>
                    <div className="flex-1 h-4 bg-kustody-dark rounded overflow-hidden">
                      <div 
                        className="h-full bg-blue-500/60"
                        style={{ width: `${(count / (totalStats.date_calc || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-kustody-navy/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">💱 통화쌍별 조회</h4>
              <div className="space-y-2">
                {Object.entries(currencyStats).sort((a, b) => b[1] - a[1]).map(([ccy, count]) => (
                  <div key={ccy} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-16">{ccy}</span>
                    <div className="flex-1 h-4 bg-kustody-dark rounded overflow-hidden">
                      <div 
                        className="h-full bg-green-500/60"
                        style={{ width: `${(count / (totalStats.date_calc || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 일별 추이 */}
          <div className="bg-kustody-navy/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">📅 일별 추이</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-kustody-muted border-b border-kustody-border">
                    <th className="text-left py-2">날짜</th>
                    <th className="text-right py-2">날짜계산</th>
                    <th className="text-right py-2">스왑조회</th>
                    <th className="text-right py-2">스왑보간</th>
                    <th className="text-right py-2">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDays.slice(0, 14).map(date => {
                    const stats = dailyStats[date];
                    const total = (stats.date_calc || 0) + (stats.swap_points_load || 0) + (stats.swap_points_interp || 0);
                    return (
                      <tr key={date} className="border-b border-kustody-border/30">
                        <td className="py-2 font-mono">{date}</td>
                        <td className="py-2 text-right text-blue-400">{stats.date_calc || 0}</td>
                        <td className="py-2 text-right text-green-400">{stats.swap_points_load || 0}</td>
                        <td className="py-2 text-right text-yellow-400">{stats.swap_points_interp || 0}</td>
                        <td className="py-2 text-right font-semibold">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== Settings Tab ====================
function SettingsTab({ config, setConfig, saveConfig, bankCodes, selectedClientId, setSelectedClientId }) {
  const [viewMode, setViewMode] = useState('master'); // 'master' or 'client'
  const [newCP, setNewCP] = useState({ cpId: '', bankCode: '004', name: '', accounts: { USD: '', KRW: '' } });
  const [newUser, setNewUser] = useState({ userId: '', name: '', role: 'trader' });
  const [newClientBank, setNewClientBank] = useState({ bankCode: '004', bankName: '', usdAccount: '', krwAccount: '' });
  const [newClientTrader, setNewClientTrader] = useState({ name: '', role: 'trader', phone: '', email: '' });

  const selectedClient = config.clients?.find(c => c.clientId === selectedClientId);

  // Master용 함수들
  const addCounterParty = () => {
    if (!newCP.cpId || !newCP.name) return alert('필수 정보를 입력해주세요.');
    setConfig(prev => ({ ...prev, counterParties: [...(prev.counterParties || []), newCP] }));
    setNewCP({ cpId: '', bankCode: '004', name: '', accounts: { USD: '', KRW: '' } });
  };
  const deleteCP = (cpId) => setConfig(prev => ({ ...prev, counterParties: prev.counterParties.filter(cp => cp.cpId !== cpId) }));

  const addUser = () => {
    if (!newUser.userId || !newUser.name) return alert('필수 정보를 입력해주세요.');
    setConfig(prev => ({ ...prev, users: [...(prev.users || []), newUser] }));
    setNewUser({ userId: '', name: '', role: 'trader' });
  };
  const deleteUser = (userId) => setConfig(prev => ({ ...prev, users: prev.users.filter(u => u.userId !== userId) }));

  // Client용 함수들
  const addClientBank = () => {
    if (!selectedClientId || !newClientBank.usdAccount) return alert('계좌번호를 입력해주세요.');
    const bank = bankCodes.find(b => b.code === newClientBank.bankCode);
    const bankData = { ...newClientBank, bankName: bank?.name || '' };
    setConfig(prev => ({
      ...prev,
      clients: prev.clients.map(c => 
        c.clientId === selectedClientId 
          ? { ...c, bankAccounts: [...(c.bankAccounts || []), bankData] }
          : c
      )
    }));
    setNewClientBank({ bankCode: '004', bankName: '', usdAccount: '', krwAccount: '' });
  };
  const deleteClientBank = (idx) => {
    setConfig(prev => ({
      ...prev,
      clients: prev.clients.map(c => 
        c.clientId === selectedClientId 
          ? { ...c, bankAccounts: c.bankAccounts.filter((_, i) => i !== idx) }
          : c
      )
    }));
  };

  const addClientTrader = () => {
    if (!selectedClientId || !newClientTrader.name) return alert('담당자명을 입력해주세요.');
    setConfig(prev => ({
      ...prev,
      clients: prev.clients.map(c => 
        c.clientId === selectedClientId 
          ? { ...c, traders: [...(c.traders || []), newClientTrader] }
          : c
      )
    }));
    setNewClientTrader({ name: '', role: 'trader', phone: '', email: '' });
  };
  const deleteClientTrader = (idx) => {
    setConfig(prev => ({
      ...prev,
      clients: prev.clients.map(c => 
        c.clientId === selectedClientId 
          ? { ...c, traders: c.traders.filter((_, i) => i !== idx) }
          : c
      )
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">⚙️ Settings</h2>
        <div className="flex items-center gap-3">
          {/* Master/Client 토글 */}
          <div className="flex bg-kustody-navy rounded-lg p-1">
            <button onClick={() => setViewMode('master')} 
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${viewMode === 'master' ? 'bg-kustody-accent text-kustody-dark' : 'text-kustody-muted'}`}>
              🏢 Master
            </button>
            <button onClick={() => setViewMode('client')} 
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${viewMode === 'client' ? 'bg-kustody-accent text-kustody-dark' : 'text-kustody-muted'}`}>
              👤 Client
            </button>
          </div>
          <button onClick={saveConfig} className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg text-sm font-semibold">💾 저장</button>
        </div>
      </div>

      {/* ========== Master View ========== */}
      {viewMode === 'master' && (
        <>
          <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-4">
            <p className="text-sm text-kustody-accent">🏢 <span className="font-semibold">Master 설정</span> - KustodyFi 내부 관리용 (거래 상대방, 내부 사용자)</p>
          </div>

          {/* Counter Party (KustodyFi의 거래상대방 = 은행들) */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <h3 className="font-semibold mb-4">🏦 Counter Party (거래상대방 은행)</h3>
            <div className="grid grid-cols-6 gap-2 mb-4">
              <input placeholder="CP ID" value={newCP.cpId} onChange={(e) => setNewCP({...newCP, cpId: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
              <select value={newCP.bankCode} onChange={(e) => { const bank = bankCodes.find(b => b.code === e.target.value); setNewCP({...newCP, bankCode: e.target.value, name: bank?.name || ''}); }} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                {bankCodes.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
              </select>
              <input placeholder="명칭" value={newCP.name} onChange={(e) => setNewCP({...newCP, name: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
              <input placeholder="USD 계좌" value={newCP.accounts.USD} onChange={(e) => setNewCP({...newCP, accounts: {...newCP.accounts, USD: e.target.value}})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
              <input placeholder="KRW 계좌" value={newCP.accounts.KRW} onChange={(e) => setNewCP({...newCP, accounts: {...newCP.accounts, KRW: e.target.value}})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
              <button onClick={addCounterParty} className="px-3 py-2 bg-kustody-accent text-kustody-dark rounded text-sm font-semibold">추가</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2">CP ID</th><th className="text-left py-2">은행코드</th><th className="text-left py-2">명칭</th><th className="text-left py-2">USD 계좌</th><th className="text-left py-2">KRW 계좌</th><th className="text-center py-2">삭제</th></tr></thead>
              <tbody>
                {(config.counterParties || []).map(cp => (
                  <tr key={cp.cpId} className="border-b border-kustody-border/30">
                    <td className="py-2 font-mono">{cp.cpId}</td><td className="py-2">{cp.bankCode}</td><td className="py-2">{cp.name}</td><td className="py-2 font-mono text-xs">{cp.accounts?.USD}</td><td className="py-2 font-mono text-xs">{cp.accounts?.KRW}</td>
                    <td className="py-2 text-center"><button onClick={() => deleteCP(cp.cpId)} className="text-red-400 hover:text-red-300">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* KustodyFi 내부 사용자 */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <h3 className="font-semibold mb-4">👤 내부 사용자 (KustodyFi)</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <input placeholder="User ID" value={newUser.userId} onChange={(e) => setNewUser({...newUser, userId: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
              <input placeholder="이름" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
              <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                <option value="trader">Trader</option><option value="input">Input</option><option value="approver">Approver</option>
              </select>
              <button onClick={addUser} className="px-3 py-2 bg-kustody-accent text-kustody-dark rounded text-sm font-semibold">추가</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2">User ID</th><th className="text-left py-2">이름</th><th className="text-left py-2">역할</th><th className="text-center py-2">삭제</th></tr></thead>
              <tbody>
                {(config.users || []).map(u => (
                  <tr key={u.userId} className="border-b border-kustody-border/30">
                    <td className="py-2 font-mono">{u.userId}</td><td className="py-2">{u.name}</td><td className="py-2 capitalize">{u.role}</td>
                    <td className="py-2 text-center"><button onClick={() => deleteUser(u.userId)} className="text-red-400 hover:text-red-300">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bid/Ask Spread 설정 */}
          <SpreadSettingsSection />

          {/* User Feedback 조회 */}
          <UserFeedbackSection />

          {/* Usage Analytics */}
          <UsageAnalyticsSection />
        </>
      )}

      {/* ========== Client View ========== */}
      {viewMode === 'client' && (
        <>
          {/* 고객 선택 */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <div className="flex items-center gap-4">
              <label className="text-sm text-kustody-muted">고객 선택:</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                className="flex-1 px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg">
                <option value="">-- 고객을 선택하세요 --</option>
                {config.clients?.map(c => (
                  <option key={c.clientId} value={c.clientId}>{c.clientName} (Tier {c.creditTier})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedClient ? (
            <>
              {/* 고객 기본 정보 */}
              <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-kustody-accent text-lg">{selectedClient.clientName}</h3>
                    <p className="text-sm text-kustody-muted mt-1">
                      Client ID: {selectedClient.clientId} · Credit Tier: {selectedClient.creditTier} · 
                      SEAL: <span className={selectedClient.sealLayer?.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>{selectedClient.sealLayer?.status || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-kustody-muted">KYC: {selectedClient.sealLayer?.kycStatus || 'N/A'}</div>
                    {selectedClient.sealLayer?.walletAddress && (
                      <div className="font-mono text-xs text-kustody-muted mt-1">{selectedClient.sealLayer.walletAddress}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 고객 은행 계좌 */}
              <div className="bg-kustody-surface rounded-xl p-5">
                <h3 className="font-semibold mb-4">🏦 {selectedClient.clientName} 결제 계좌</h3>
                <p className="text-xs text-kustody-muted mb-4">고객이 등록한 입출금 계좌 (고객 전용 화면에서는 본인 계좌만 표시)</p>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  <select value={newClientBank.bankCode} onChange={(e) => setNewClientBank({...newClientBank, bankCode: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    {bankCodes.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
                  </select>
                  <input placeholder="USD 계좌번호" value={newClientBank.usdAccount} onChange={(e) => setNewClientBank({...newClientBank, usdAccount: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                  <input placeholder="KRW 계좌번호" value={newClientBank.krwAccount} onChange={(e) => setNewClientBank({...newClientBank, krwAccount: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                  <button onClick={addClientBank} className="px-3 py-2 bg-kustody-accent text-kustody-dark rounded text-sm font-semibold col-span-2">계좌 추가</button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2">은행</th><th className="text-left py-2">USD 계좌</th><th className="text-left py-2">KRW 계좌</th><th className="text-center py-2">삭제</th></tr></thead>
                  <tbody>
                    {(selectedClient.bankAccounts || []).length === 0 ? (
                      <tr><td colSpan="4" className="py-4 text-center text-kustody-muted">등록된 계좌가 없습니다.</td></tr>
                    ) : (
                      (selectedClient.bankAccounts || []).map((acc, idx) => (
                        <tr key={idx} className="border-b border-kustody-border/30">
                          <td className="py-2">{acc.bankName || acc.bankCode}</td>
                          <td className="py-2 font-mono">{acc.usdAccount}</td>
                          <td className="py-2 font-mono">{acc.krwAccount}</td>
                          <td className="py-2 text-center"><button onClick={() => deleteClientBank(idx)} className="text-red-400 hover:text-red-300">✕</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 고객 담당자 */}
              <div className="bg-kustody-surface rounded-xl p-5">
                <h3 className="font-semibold mb-4">👤 {selectedClient.clientName} 담당자</h3>
                <p className="text-xs text-kustody-muted mb-4">거래 권한이 있는 담당자 (고객 전용 화면에서는 본인 팀만 표시)</p>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  <input placeholder="이름" value={newClientTrader.name} onChange={(e) => setNewClientTrader({...newClientTrader, name: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                  <select value={newClientTrader.role} onChange={(e) => setNewClientTrader({...newClientTrader, role: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="trader">Trader (거래)</option><option value="viewer">Viewer (조회)</option><option value="approver">Approver (승인)</option>
                  </select>
                  <input placeholder="전화번호" value={newClientTrader.phone} onChange={(e) => setNewClientTrader({...newClientTrader, phone: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                  <input placeholder="이메일" value={newClientTrader.email} onChange={(e) => setNewClientTrader({...newClientTrader, email: e.target.value})} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                  <button onClick={addClientTrader} className="px-3 py-2 bg-kustody-accent text-kustody-dark rounded text-sm font-semibold">담당자 추가</button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2">이름</th><th className="text-left py-2">역할</th><th className="text-left py-2">전화번호</th><th className="text-left py-2">이메일</th><th className="text-center py-2">삭제</th></tr></thead>
                  <tbody>
                    {(selectedClient.traders || []).length === 0 ? (
                      <tr><td colSpan="5" className="py-4 text-center text-kustody-muted">등록된 담당자가 없습니다.</td></tr>
                    ) : (
                      (selectedClient.traders || []).map((t, idx) => (
                        <tr key={idx} className="border-b border-kustody-border/30">
                          <td className="py-2 font-semibold">{t.name}</td>
                          <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${t.role === 'trader' ? 'bg-blue-500/20 text-blue-400' : t.role === 'approver' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>{t.role}</span></td>
                          <td className="py-2 font-mono text-xs">{t.phone}</td>
                          <td className="py-2 text-xs">{t.email}</td>
                          <td className="py-2 text-center"><button onClick={() => deleteClientTrader(idx)} className="text-red-400 hover:text-red-300">✕</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-kustody-surface rounded-xl p-10 text-center text-kustody-muted">
              👆 고객을 선택해주세요
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 숫자 포맷팅 헬퍼
const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// USD 금액 한글 읽기
const formatUsdKorean = (amount) => {
  if (!amount || amount <= 0) return '';
  if (amount >= 100000000) {
    const uk = amount / 100000000;
    return Number.isInteger(uk) ? `${uk}억불` : `${uk.toFixed(1)}억불`;
  } else if (amount >= 10000000) {
    const cheonman = amount / 10000000;
    return Number.isInteger(cheonman) ? `${cheonman}천만불` : `${cheonman.toFixed(1)}천만불`;
  } else if (amount >= 1000000) {
    const baekman = amount / 1000000;
    return Number.isInteger(baekman) ? `${baekman}백만불` : `${baekman.toFixed(1)}백만불`;
  } else if (amount >= 100000) {
    const shipman = amount / 100000;
    return Number.isInteger(shipman) ? `${shipman}십만불` : `${shipman.toFixed(1)}십만불`;
  } else if (amount >= 10000) {
    const man = amount / 10000;
    return Number.isInteger(man) ? `${man}만불` : `${man.toFixed(1)}만불`;
  } else {
    return `${formatNumber(amount, 0)}불`;
  }
};

// ==================== Advisory Tab ====================
function AdvisoryTab({ config, addTrade, selectedClientId, setSelectedClientId, pricingNotional, setPricingNotional, sharedCurveData }) {
  const [curveData, setCurveData] = useState(null);
  const [nearDate, setNearDate] = useState('2020-03-04'); // Swap Near leg (Start)
  const [farDate, setFarDate] = useState('2020-04-06'); // Swap Far leg (Maturity) / Outright 결제일
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [queryLog, setQueryLog] = useState([]); // 조회 로그 (tracking용)
  const [tradeType, setTradeType] = useState('swap'); // 'outright' | 'swap'
  const [direction, setDirection] = useState('borrow_usd'); // outright: 'buy'|'sell', swap: 'borrow_usd'|'lend_usd'
  const [proMode, setProMode] = useState(false); // Pro Mode 토글
  const [usdMmda, setUsdMmda] = useState(4.5); // USD MMDA 금리 (%)
  const [krwMmda, setKrwMmda] = useState(3.0); // KRW 고금리통장 금리 (%)
  
  // 네이버 환율 state
  const [liveSpot, setLiveSpot] = useState(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [naverLastUpdate, setNaverLastUpdate] = useState(null);
  
  const [tradeForm, setTradeForm] = useState({ 
    instrument: 'FX_SWAP',      // 'FX_SWAP' | 'OUTRIGHT'
    direction: 'B/S',           // FX Swap: 'B/S' | 'S/B', Outright: 'Buy' | 'Sell'
    tradeDate: new Date().toISOString().split('T')[0],
    nearDate: '',
    farDate: '',
    spotRate: 0,
    swapPoint: 0,
    farRate: 0,
    ccy1: 'USD',
    ccy2: 'KRW',
    nearCcy1Amt: 0,
    farCcy1Amt: 0,
    nearCcy2Amt: 0,
    farCcy2Amt: 0,
    counterParty: '', 
    trader: '' 
  });
  
  // 네이버 환율 가져오기 (4분 캐싱)
  const fetchNaverSpot = async (force = false) => {
    const now = Date.now();
    
    // 전역 캐시 체크
    if (!force && naverRateCache.data && naverRateCache.lastFetch && 
        (now - naverRateCache.lastFetch) < naverRateCache.CACHE_DURATION) {
      if (naverRateCache.data.USDKRW) {
        setLiveSpot(naverRateCache.data.USDKRW);
        setNaverLastUpdate(new Date(naverRateCache.lastFetch));
      }
      return naverRateCache.data.USDKRW;
    }
    
    setNaverLoading(true);
    try {
      const response = await fetch('/api/naver-rates');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.rates?.USDKRW) {
          const rate = result.rates.USDKRW;
          setLiveSpot(rate);
          setNaverLastUpdate(new Date(now));
          
          // 전역 캐시 업데이트
          naverRateCache.data = result.rates;
          naverRateCache.lastFetch = now;
          
          return rate;
        }
      }
    } catch (error) {
      console.error('Naver spot fetch error:', error);
    } finally {
      setNaverLoading(false);
    }
    return null;
  };

  // sharedCurveData (Curves 탭에서 이미 spread 적용됨)를 사용
  useEffect(() => {
    if (sharedCurveData) {
      setCurveData(sharedCurveData);
      
      const spotDate = sharedCurveData.curves?.USDKRW?.USD?.spotDate;
      if (spotDate) {
        setNearDate(spotDate);
        const m = new Date(spotDate);
        m.setMonth(m.getMonth() + 1);
        setFarDate(m.toISOString().split('T')[0]);
      }
    }
    
    // 조회 로그 로드
    const saved = localStorage.getItem('kustodyfi_query_log');
    if (saved) try { setQueryLog(JSON.parse(saved)); } catch(e) {}
  }, [sharedCurveData]);

  // Spot 환율: liveSpot(네이버 실시간) > curveData > fallback
  const spot = liveSpot || curveData?.spotRates?.USDKRW || 1443.00;
  const fxSwapPoints = curveData?.curves?.USDKRW?.fxSwapPoints || [];

  // 선택된 고객
  const selectedClient = config.clients?.find(c => c.clientId === selectedClientId);
  const creditTier = selectedClient ? config.creditTiers?.[selectedClient.creditTier] : null;
  const isBlocked = selectedClient?.creditTier === 5;

  // 마진 계산 (Client Pricing과 동일)
  const calculateMargin = () => {
    if (!selectedClient || isBlocked) return { credit: 0, notional: 0, total: 0 };
    let creditMargin = 0, notionalMargin = 0;
    if (!selectedClient.overrides?.ignoreCredit && creditTier) {
      creditMargin = selectedClient.marginType === 'bp' ? (creditTier.bpMargin || 0) * 33 / 365 * spot / 10000 : (creditTier.pointMargin || 0);
    }
    if (!selectedClient.overrides?.ignoreNotional) {
      const tier = config.notionalTiers?.find(t => pricingNotional >= t.min && (t.max === null || pricingNotional < t.max));
      notionalMargin = tier?.margin || 0;
    }
    if (selectedClient.overrides?.customMargin !== null && selectedClient.overrides?.customMargin !== undefined) {
      return { credit: 0, notional: 0, total: selectedClient.overrides.customMargin };
    }
    return { credit: creditMargin, notional: notionalMargin, total: creditMargin + notionalMargin };
  };
  const margin = calculateMargin();

  // 마진 적용된 Bid/Ask
  const getClientPoints = (basePoints, baseBid, baseAsk) => {
    const marginInWon = margin.total / 100;
    return {
      bid: baseBid !== null ? baseBid - marginInWon : null,
      ask: baseAsk !== null ? baseAsk + marginInWon : null,
      mid: basePoints
    };
  };

  // 보간 함수
  const interpolateValue = (days, getValue) => {
    if (days <= 0) return 0;
    const sorted = fxSwapPoints.filter(p => p.days > 0).sort((a, b) => a.days - b.days);
    if (sorted.length === 0) return 0;
    const exact = sorted.find(p => p.days === days);
    if (exact) return getValue(exact);
    if (days < sorted[0].days) return getValue(sorted[0]) * days / sorted[0].days;
    if (days > sorted[sorted.length - 1].days) return getValue(sorted[sorted.length - 1]) * days / sorted[sorted.length - 1].days;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].days <= days && sorted[i + 1].days >= days) {
        const ratio = (days - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
        return getValue(sorted[i]) + (getValue(sorted[i + 1]) - getValue(sorted[i])) * ratio;
      }
    }
    return 0;
  };

  // 원화 환산
  const krwAmount = pricingNotional * spot;

  const handleQuery = () => {
    if (!selectedClient) { alert('고객을 먼저 선택해주세요.'); return; }
    if (isBlocked) { alert('거래가 제한된 고객입니다.'); return; }
    
    const spotDateObj = new Date(curveData?.curves?.USDKRW?.USD?.spotDate);
    const targetDate = new Date(farDate);
    const days = Math.round((targetDate - spotDateObj) / (1000 * 60 * 60 * 24));
    
    // Near leg days (Swap용)
    const nearDateObj = new Date(nearDate);
    const nearDays = Math.round((nearDateObj - spotDateObj) / (1000 * 60 * 60 * 24));
    
    const midPoints = interpolateValue(days, p => p.points);
    const bidPoints = interpolateValue(days, p => p.bid);
    const askPoints = interpolateValue(days, p => p.ask);
    const clientPts = getClientPoints(midPoints, bidPoints, askPoints);
    
    // 적용 환율 결정 (방향에 따라)
    // Outright: buy→Ask, sell→Bid
    // Swap B/S (외화 차입): Far에서 USD 매도→Bid, Swap S/B (외화 대여): Far에서 USD 매수→Ask
    const appliedRate = (direction === 'buy' || direction === 'lend_usd')
      ? (clientPts.ask !== null ? spot + clientPts.ask : spot + midPoints)
      : (clientPts.bid !== null ? spot + clientPts.bid : spot + midPoints);
    
    const queryData = {
      nearDate: tradeType === 'swap' ? nearDate : null,
      farDate,
      nearDays: tradeType === 'swap' ? nearDays : null,
      days,
      points: midPoints,
      bid: clientPts.bid,
      ask: clientPts.ask,
      forwardRate: spot + midPoints,
      clientBidRate: clientPts.bid !== null ? spot + clientPts.bid : null,
      clientAskRate: clientPts.ask !== null ? spot + clientPts.ask : null,
      appliedRate,
      tradeType,
      direction,
      timestamp: Date.now(),
      clientId: selectedClientId,
      clientName: selectedClient.clientName,
      notional: pricingNotional,
      krwAmount,
      margin: margin.total
    };
    
    setLastQuery(queryData);
    
    // tradeForm 업데이트 (모든 필드 채우기)
    const instrument = tradeType === 'outright' ? 'OUTRIGHT' : 'FX_SWAP';
    const swapPoint = direction === 'borrow_usd' || direction === 'sell' ? clientPts.bid : clientPts.ask;
    const nearCcy2 = pricingNotional * spot;
    const farCcy2 = pricingNotional * appliedRate;
    
    // Direction 변환: borrow_usd -> B/S, lend_usd -> S/B, buy -> Buy, sell -> Sell
    const directionLabel = 
      direction === 'borrow_usd' ? 'B/S' :
      direction === 'lend_usd' ? 'S/B' :
      direction === 'buy' ? 'Buy' : 'Sell';
    
    setTradeForm({ 
      instrument,
      direction: directionLabel,
      tradeDate: new Date().toISOString().split('T')[0],
      nearDate: tradeType === 'swap' ? nearDate : '',
      farDate: farDate,
      spotRate: spot,
      swapPoint: swapPoint || 0,
      farRate: appliedRate,
      ccy1: 'USD',
      ccy2: 'KRW',
      nearCcy1Amt: pricingNotional,
      farCcy1Amt: pricingNotional,  // Even Swap이므로 같은 값
      nearCcy2Amt: nearCcy2,
      farCcy2Amt: farCcy2,
      counterParty: '',
      trader: ''
    });
    
    // 조회 로그 저장 (tracking)
    const newLog = [...queryLog, queryData].slice(-100); // 최근 100건만
    setQueryLog(newLog);
    localStorage.setItem('kustodyfi_query_log', JSON.stringify(newLog));
    
    setCountdown(10);
    const timer = setInterval(() => { setCountdown(prev => { if (prev <= 1) { clearInterval(timer); setShowTradeForm(true); return null; } return prev - 1; }); }, 1000);
  };

  const handleSaveTrade = () => {
    addTrade({ 
      ...tradeForm, 
      clientId: selectedClientId,
      queryTimestamp: lastQuery?.timestamp, 
      fairValue: lastQuery?.forwardRate 
    });
    setShowTradeForm(false); 
    setCountdown(null); 
    setLastQuery(null); 
    alert('거래가 기록되었습니다!');
  };

  const optimal = fxSwapPoints.filter(p => p.days > 0 && p.days <= 90).sort((a, b) => Math.abs(a.points) / a.days - Math.abs(b.points) / b.days)[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더: 타이틀 + 고객 선택 + Spot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">🎯 Customer Advisory</h2>
            <p className="text-sm text-kustody-muted mt-1">공정가치 조회 및 최적 전략 추천</p>
          </div>
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-4 py-2 bg-kustody-surface border border-kustody-border rounded-lg text-sm">
            <option value="">-- 고객 선택 --</option>
            {config.clients?.filter(c => c.creditTier !== 5).map(c => (
              <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNaverSpot(true)}
              disabled={naverLoading}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                naverLoading
                  ? 'bg-orange-500/50 text-white cursor-wait'
                  : 'bg-orange-500 text-white hover:bg-orange-400'
              }`}
            >
              {naverLoading ? '⏳' : '📡'}
            </button>
            <div className="text-right text-sm">
              <div className="text-kustody-muted">Spot (USDKRW)</div>
              <div className="font-mono text-lg font-bold text-kustody-accent">
                {liveSpot ? liveSpot.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : formatNumber(spot, 3)}
              </div>
              {naverLastUpdate && (
                <div className="text-xs text-kustody-muted">{naverLastUpdate.toLocaleTimeString('ko-KR')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedClient && !isBlocked && (
        <>
          {/* FX Swap Points 테이블 */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">📊 FX Swap Points</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-kustody-muted">Pro Mode</span>
                  <button onClick={() => setProMode(!proMode)} 
                    className={`w-10 h-5 rounded-full transition-colors ${proMode ? 'bg-kustody-accent' : 'bg-kustody-border'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${proMode ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                  </button>
                </label>
                <span className="text-xs text-kustody-muted">USDKRW · 전단위</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                    <th className="text-left py-2 px-2">Tenor</th>
                    <th className="text-left py-2 px-2">Start</th>
                    <th className="text-left py-2 px-2">Maturity</th>
                    <th className="text-right py-2 px-2">Days</th>
                    <th className="text-right py-2 px-2">Screen</th>
                    <th className="text-right py-2 px-2 text-kustody-accent">Sp/Day</th>
                    {proMode && <th className="text-right py-2 px-2 text-yellow-400">Indic_rate</th>}
                    <th className="text-right py-2 px-2 text-red-400">Bid</th>
                    <th className="text-right py-2 px-2 text-green-400">Ask</th>
                  </tr>
                </thead>
                <tbody>
                  {fxSwapPoints.map(p => {
                    const clientPts = getClientPoints(p.points, p.bid, p.ask);
                    // 표시용 days: Start에서 Maturity까지의 실제 기간
                    const displayDays = p.start && p.maturity 
                      ? Math.round((new Date(p.maturity) - new Date(p.start)) / (1000 * 60 * 60 * 24))
                      : (p.days > 0 ? p.days : 1);
                    // Screen은 전단위 (×100)
                    const screenPips = p.points !== null ? Math.round(p.points * 100) : null;
                    // Sp/Day도 전단위 기준으로 계산
                    const spDay = (displayDays > 0 && screenPips !== null) ? (screenPips / displayDays).toFixed(2) : '-';
                    const indicRate = (displayDays > 0 && p.points !== null) ? ((p.points / displayDays / spot) * 365 * 100).toFixed(2) + '%' : '-';
                    return (
                      <tr key={p.tenor} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                        <td className="py-2 px-2 font-semibold">{p.tenor}</td>
                        <td className="py-2 px-2 font-mono text-xs text-kustody-muted">{p.start || '-'}</td>
                        <td className="py-2 px-2 font-mono text-xs text-kustody-muted">{p.maturity || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono">{displayDays}</td>
                        <td className="py-2 px-2 text-right font-mono">{screenPips !== null ? screenPips : '-'}</td>
                        <td className="py-2 px-2 text-right font-mono text-kustody-accent">{spDay}</td>
                        {proMode && <td className="py-2 px-2 text-right font-mono text-yellow-400">{indicRate}</td>}
                        <td className="py-2 px-2 text-right font-mono text-red-400">{clientPts.bid !== null ? Math.round(clientPts.bid * 100) : '-'}</td>
                        <td className="py-2 px-2 text-right font-mono text-green-400">{clientPts.ask !== null ? Math.round(clientPts.ask * 100) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 공정가치 조회 */}
          <div className="bg-kustody-surface rounded-xl p-5">
            <h3 className="font-semibold mb-4">📈 Point Interpolation - {selectedClient.clientName}</h3>
            
            {/* 거래 유형 선택 */}
            <div className="mb-5 p-4 bg-kustody-navy/30 rounded-lg">
              <div className="grid grid-cols-2 gap-6">
                {/* 거래 유형 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">거래 유형</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setTradeType('outright'); setDirection('sell'); }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tradeType === 'outright' ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                      📤 단방향 (Outright)
                    </button>
                    <button onClick={() => { setTradeType('swap'); setDirection('borrow_usd'); }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tradeType === 'swap' ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                      🔄 스왑 (FX Swap)
                    </button>
                  </div>
                </div>
                
                {/* 방향 선택 */}
                <div>
                  <label className="block text-xs text-kustody-muted mb-2">
                    {tradeType === 'outright' ? '거래 방향' : '무엇이 먼저 필요하세요?'}
                  </label>
                  {tradeType === 'outright' ? (
                    <div className="flex gap-2">
                      <button onClick={() => setDirection('sell')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${direction === 'sell' ? 'bg-red-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        🔴 외화 매도 (Sell USD)
                      </button>
                      <button onClick={() => setDirection('buy')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${direction === 'buy' ? 'bg-green-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        🟢 외화 매수 (Buy USD)
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setDirection('borrow_usd')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${direction === 'borrow_usd' ? 'bg-blue-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        <div className="font-semibold">💵 외화가 먼저 필요해요</div>
                        <div className="text-xs opacity-80">외화 빌렸다가 갚기 (B/S)</div>
                      </button>
                      <button onClick={() => setDirection('lend_usd')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${direction === 'lend_usd' ? 'bg-purple-500 text-white' : 'bg-kustody-dark text-kustody-muted border border-kustody-border'}`}>
                        <div className="font-semibold">💴 원화가 먼저 필요해요</div>
                        <div className="text-xs opacity-80">외화 빌려줬다가 받기 (S/B)</div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 설명 */}
              <div className="mt-3 text-xs text-kustody-muted">
                {tradeType === 'outright' ? (
                  direction === 'buy' 
                    ? '💡 외화를 사서 보유합니다. 결제일에 원화를 지급하고 외화를 받습니다.'
                    : '💡 외화를 팔아 원화를 받습니다. 결제일에 외화를 지급하고 원화를 받습니다.'
                ) : (
                  direction === 'borrow_usd'
                    ? '💡 지금 외화를 빌리고(매수), 만기에 외화를 갚습니다(매도). 단기 외화 자금 필요 시 유용합니다.'
                    : '💡 지금 외화를 빌려주고(매도), 만기에 외화를 돌려받습니다(매수). 외화 여유자금 운용 시 유용합니다.'
                )}
              </div>
            </div>
            
            {/* 조회 입력 */}
            <div className={`grid ${tradeType === 'swap' ? 'grid-cols-6' : 'grid-cols-5'} gap-4 mb-4`}>
              {tradeType === 'swap' && (
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">
                    {direction === 'borrow_usd' ? '💵 외화 빌리는 날' : '💴 외화 빌려주는 날'}
                  </label>
                  <input type="date" value={nearDate} onChange={(e) => setNearDate(e.target.value)}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm" />
                </div>
              )}
              <div>
                <label className="block text-xs text-kustody-muted mb-1">
                  {tradeType === 'swap' 
                    ? (direction === 'borrow_usd' ? '💵 외화 갚을 날' : '💴 외화 돌려받을 날')
                    : '결제일'}
                </label>
                <input type="date" value={farDate} onChange={(e) => setFarDate(e.target.value)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm" />
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">Notional (USD)</label>
                <input 
                  type="text" 
                  value={formatNumber(pricingNotional, 0)} 
                  onChange={(e) => setPricingNotional(parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                  className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm" />
                {pricingNotional > 0 && (
                  <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(pricingNotional)}</div>
                )}
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">원화 환산</label>
                <div className="px-3 py-2 bg-kustody-navy rounded-lg font-mono text-sm">₩{formatNumber(krwAmount, 0)}</div>
              </div>
              <div>
                <label className="block text-xs text-kustody-muted mb-1">
                  Forward Points (전단위)
                  {lastQuery && <span className="ml-1 text-kustody-accent">
                    {(direction === 'sell' || direction === 'borrow_usd') ? '(Bid)' : '(Ask)'}
                  </span>}
                </label>
                <div className={`px-3 py-2 bg-kustody-navy rounded-lg font-mono ${
                  (direction === 'sell' || direction === 'borrow_usd') ? 'text-red-400' : 'text-green-400'
                }`}>
                  {lastQuery 
                    ? ((direction === 'sell' || direction === 'borrow_usd') 
                        ? (lastQuery.bid !== null ? Math.round(lastQuery.bid * 100) : '-')
                        : (lastQuery.ask !== null ? Math.round(lastQuery.ask * 100) : '-'))
                    : '-'}
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={handleQuery} className="w-full px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-semibold">조회</button>
              </div>
            </div>

            {lastQuery && (
              <div className="bg-kustody-navy/50 rounded-lg p-4">
                {/* 거래 유형 표시 */}
                <div className="mb-3 pb-3 border-b border-kustody-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-sm font-semibold ${tradeType === 'outright' ? 'bg-kustody-accent/20 text-kustody-accent' : 'bg-blue-500/20 text-blue-400'}`}>
                      {tradeType === 'outright' ? '📤 Outright' : '🔄 FX Swap'}
                    </span>
                    <span className={`px-3 py-1 rounded text-sm ${
                      direction === 'buy' ? 'bg-green-500/20 text-green-400' :
                      direction === 'sell' ? 'bg-red-500/20 text-red-400' :
                      direction === 'borrow_usd' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {direction === 'buy' ? '매수 (Buy)' :
                       direction === 'sell' ? '매도 (Sell)' :
                       direction === 'borrow_usd' ? 'B/S (외화 차입)' :
                       'S/B (외화 대여)'}
                    </span>
                  </div>
                  <div className="text-sm font-mono">
                    <span className="text-kustody-muted">Days: </span>
                    <span className="text-kustody-accent font-semibold">{lastQuery.days}</span>
                  </div>
                </div>
                
                {tradeType === 'swap' ? (
                  /* Swap 결과 - 빌리는/갚는 환율 */
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '💵 빌리는 날' : '💴 빌려주는 날'}
                      </div>
                      <div className="font-mono text-blue-400 mb-3">{lastQuery.nearDate}</div>
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '빌리는 환율 (Near)' : '빌려주는 환율 (Near)'}
                      </div>
                      <div className="font-mono text-2xl font-semibold">{formatNumber(spot, 2)}</div>
                      <div className="text-xs text-kustody-muted mt-1">Spot Rate</div>
                    </div>
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '💵 갚을 날' : '💴 돌려받을 날'}
                      </div>
                      <div className="font-mono text-blue-400 mb-3">{lastQuery.farDate}</div>
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'borrow_usd' ? '갚는 환율 (Far)' : '돌려받는 환율 (Far)'}
                      </div>
                      <div className={`font-mono text-2xl font-semibold ${direction === 'borrow_usd' ? 'text-red-400' : 'text-green-400'}`}>
                        {formatNumber(lastQuery.appliedRate, 2)}
                      </div>
                      <div className="text-xs text-kustody-muted mt-1">
                        Spot {direction === 'borrow_usd' ? '+' : '+'} {direction === 'borrow_usd' 
                          ? (lastQuery.bid !== null ? (lastQuery.bid).toFixed(2) : '-')
                          : (lastQuery.ask !== null ? (lastQuery.ask).toFixed(2) : '-')} 원
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Outright 결과 */
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">결제일</div>
                      <div className="font-mono text-blue-400 text-lg">{lastQuery.farDate}</div>
                    </div>
                    <div className="bg-kustody-dark/50 rounded-lg p-4 text-center">
                      <div className="text-xs text-kustody-muted mb-1">
                        {direction === 'buy' ? '매수 환율' : '매도 환율'}
                      </div>
                      <div className={`font-mono text-2xl font-semibold ${direction === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(lastQuery.appliedRate, 2)}
                      </div>
                      <div className="text-xs text-kustody-muted mt-1">
                        {direction === 'buy' ? 'Ask' : 'Bid'} Rate
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {countdown && <div className="mt-4 text-center text-kustody-muted">거래 여부 확인까지 <span className="text-kustody-accent font-mono">{countdown}</span>초...</div>}
          </div>

          {/* 최적 구간 추천 */}
          {optimal && (
            <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-5">
              <h3 className="font-semibold mb-2 text-kustody-accent">⭐ 최적 구간 추천</h3>
              <p className="text-sm">일정에 이슈가 없다면, <span className="font-semibold text-kustody-accent">{optimal.tenor} ({optimal.days}일)</span>이 carry 효율이 가장 좋습니다. (Sp/Day: {(optimal.points * 100 / optimal.days).toFixed(2)})</p>
            </div>
          )}

          {/* 기회비용 비교 */}
          {lastQuery && tradeType === 'swap' && (
            <div className="bg-kustody-surface rounded-xl p-5 border border-kustody-border">
              <h3 className="font-semibold mb-4 text-kustody-accent">💰 기회비용 비교</h3>
              
              {/* 금리 입력 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-kustody-muted">USD MMDA:</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={usdMmda} 
                    onChange={(e) => setUsdMmda(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-kustody-dark border border-kustody-border rounded font-mono text-sm text-center" 
                  />
                  <span className="text-sm text-kustody-muted">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-kustody-muted">KRW MMDA:</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={krwMmda} 
                    onChange={(e) => setKrwMmda(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-kustody-dark border border-kustody-border rounded font-mono text-sm text-center" 
                  />
                  <span className="text-sm text-kustody-muted">%</span>
                </div>
              </div>

              {(() => {
                const days = lastQuery.days;
                const swapPoint = direction === 'borrow_usd' ? lastQuery.bid : lastQuery.ask;
                
                // 캐시플로우 계산
                const nearKrw = pricingNotional * spot;
                const farKrw = pricingNotional * (spot + swapPoint);
                const swapCostKrw = nearKrw - farKrw; // B/S: 양수면 비용, S/B: 음수면 비용
                
                let option1Label, option1Cost, option1Detail;
                let option2Label, option2Cost, option2Detail;
                let recommendation, analysis;
                
                if (direction === 'borrow_usd') {
                  // B/S: USD 필요 → KRW 담보로 USD 빌림
                  // Option 1: FX Swap B/S
                  //   - Swap 비용 (KRW 차이)
                  //   - KRW 기회비용 (담보 묶임)
                  const krwOpportunityCost = nearKrw * (krwMmda / 100) * (days / 365);
                  const totalSwapCost = swapCostKrw + krwOpportunityCost;
                  const swapAnnualized = (totalSwapCost / nearKrw) * (365 / days) * 100;
                  
                  option1Label = 'FX Swap B/S';
                  option1Cost = totalSwapCost;
                  option1Detail = {
                    swapCost: swapCostKrw,
                    opportunityCost: krwOpportunityCost,
                    annualized: swapAnnualized
                  };
                  
                  // Option 2: USD MMDA 해지
                  //   - USD 이자 포기
                  const usdInterestForgone = pricingNotional * (usdMmda / 100) * (days / 365);
                  const usdInterestForgoneKrw = usdInterestForgone * spot;
                  
                  option2Label = 'USD MMDA 해지';
                  option2Cost = usdInterestForgoneKrw;
                  option2Detail = {
                    usdInterest: usdInterestForgone,
                    krwEquivalent: usdInterestForgoneKrw,
                    annualized: usdMmda
                  };
                  
                  // 비교
                  if (option1Cost < option2Cost) {
                    recommendation = 'swap';
                    analysis = `FX Swap이 ${formatNumber(option2Cost - option1Cost, 0)}원 유리. USD MMDA ${usdMmda}% 유지하면서 저렴하게 USD 조달`;
                  } else {
                    recommendation = 'mmda';
                    analysis = `USD MMDA 해지가 ${formatNumber(option1Cost - option2Cost, 0)}원 유리. Swap 비용 + KRW 기회비용이 더 큼`;
                  }
                  
                } else {
                  // S/B: KRW 필요 → USD 담보로 KRW 빌림
                  // Option 1: FX Swap S/B
                  //   - Swap 비용/수익 (KRW 차이, S/B면 부호 반대)
                  //   - USD 기회비용 (담보 묶임)
                  const usdOpportunityCost = pricingNotional * (usdMmda / 100) * (days / 365);
                  const usdOpportunityCostKrw = usdOpportunityCost * spot;
                  const sbSwapCost = -swapCostKrw; // S/B는 부호 반대
                  const totalSwapCost = sbSwapCost + usdOpportunityCostKrw;
                  const swapAnnualized = (totalSwapCost / nearKrw) * (365 / days) * 100;
                  
                  option1Label = 'FX Swap S/B';
                  option1Cost = totalSwapCost;
                  option1Detail = {
                    swapCost: sbSwapCost,
                    opportunityCost: usdOpportunityCostKrw,
                    usdOpportunityCostRaw: usdOpportunityCost,
                    annualized: swapAnnualized
                  };
                  
                  // Option 2: KRW MMDA 해지
                  //   - KRW 이자 포기
                  const krwInterestForgone = nearKrw * (krwMmda / 100) * (days / 365);
                  
                  option2Label = 'KRW MMDA 해지';
                  option2Cost = krwInterestForgone;
                  option2Detail = {
                    krwInterest: krwInterestForgone,
                    annualized: krwMmda
                  };
                  
                  // 비교
                  if (option1Cost < option2Cost) {
                    recommendation = 'swap';
                    analysis = `FX Swap이 ${formatNumber(option2Cost - option1Cost, 0)}원 유리. KRW MMDA ${krwMmda}% 유지하면서 저렴하게 KRW 조달`;
                  } else {
                    recommendation = 'mmda';
                    analysis = `KRW MMDA 해지가 ${formatNumber(option1Cost - option2Cost, 0)}원 유리. Swap 비용 + USD 기회비용이 더 큼`;
                  }
                }

                return (
                  <div className="space-y-4">
                    {/* 두 옵션 비교 */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Option 1: FX Swap */}
                      <div className={`rounded-lg p-4 border ${recommendation === 'swap' ? 'bg-green-500/10 border-green-500/50' : 'bg-kustody-navy/50 border-kustody-border'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold">{option1Label}</span>
                          {recommendation === 'swap' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">추천</span>}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-kustody-muted">Swap 비용:</span>
                            <span className={`font-mono ${option1Detail.swapCost >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {option1Detail.swapCost >= 0 ? '' : '+'}₩{formatNumber(Math.abs(option1Detail.swapCost), 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-kustody-muted">
                              {direction === 'borrow_usd' ? 'KRW' : 'USD'} 기회비용:
                            </span>
                            <span className="font-mono text-red-400">
                              ₩{formatNumber(option1Detail.opportunityCost, 0)}
                              {direction === 'lend_usd' && <span className="text-xs text-kustody-muted ml-1">(${formatNumber(option1Detail.usdOpportunityCostRaw, 0)})</span>}
                            </span>
                          </div>
                          <div className="border-t border-kustody-border pt-2 flex justify-between font-semibold">
                            <span>합계:</span>
                            <span className="font-mono text-red-400">₩{formatNumber(option1Cost, 0)}</span>
                          </div>
                          <div className="text-xs text-kustody-muted text-right">
                            연율화: {option1Detail.annualized.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* Option 2: MMDA 해지 */}
                      <div className={`rounded-lg p-4 border ${recommendation === 'mmda' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-kustody-navy/50 border-kustody-border'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold">{option2Label}</span>
                          {recommendation === 'mmda' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">추천</span>}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-kustody-muted">이자 포기:</span>
                            <span className="font-mono text-red-400">
                              {direction === 'borrow_usd' 
                                ? `$${formatNumber(option2Detail.usdInterest, 0)}`
                                : `₩${formatNumber(option2Detail.krwInterest, 0)}`}
                            </span>
                          </div>
                          {direction === 'borrow_usd' && (
                            <div className="flex justify-between">
                              <span className="text-kustody-muted">원화 환산:</span>
                              <span className="font-mono text-red-400">₩{formatNumber(option2Detail.krwEquivalent, 0)}</span>
                            </div>
                          )}
                          <div className="border-t border-kustody-border pt-2 flex justify-between font-semibold">
                            <span>합계:</span>
                            <span className="font-mono text-red-400">₩{formatNumber(option2Cost, 0)}</span>
                          </div>
                          <div className="text-xs text-kustody-muted text-right">
                            연율화: {option2Detail.annualized.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 결론 */}
                    <div className={`rounded-lg p-4 ${recommendation === 'swap' ? 'bg-green-500/10 border border-green-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{recommendation === 'swap' ? '🔄' : '🏦'}</span>
                        <span className={`font-semibold ${recommendation === 'swap' ? 'text-green-400' : 'text-blue-400'}`}>
                          {recommendation === 'swap' ? option1Label + ' 추천' : option2Label + ' 추천'}
                        </span>
                      </div>
                      <p className="text-sm text-kustody-muted">{analysis}</p>
                    </div>

                    {/* 계산 기준 */}
                    <div className="text-xs text-kustody-muted bg-kustody-dark/30 rounded p-3">
                      <div className="font-semibold mb-1">계산 기준</div>
                      <div>• Notional: USD {formatUsdKorean(pricingNotional)} | 기간: {days}일</div>
                      <div>• Near KRW: ₩{formatNumber(nearKrw, 0)} (Spot {formatNumber(spot, 2)})</div>
                      <div>• Far KRW: ₩{formatNumber(farKrw, 0)} (Spot {swapPoint >= 0 ? '+' : ''}{swapPoint.toFixed(2)})</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Uneven Swap 관심도 수집 */}
          {selectedClient && tradeType === 'swap' && (
            <div className="bg-kustody-surface rounded-xl p-4 border border-kustody-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-kustody-muted">Near/Far 금액이 다른 <span className="text-kustody-accent font-semibold">Uneven Swap</span>이 필요하신가요?</p>
                  <p className="text-xs text-kustody-muted mt-1">현재는 Even Swap만 지원됩니다</p>
                </div>
                <button 
                  onClick={() => {
                    const existing = JSON.parse(localStorage.getItem('stablefx_feature_interest') || '{}');
                    existing.unevenSwap = (existing.unevenSwap || 0) + 1;
                    existing.lastClicked = new Date().toISOString();
                    localStorage.setItem('stablefx_feature_interest', JSON.stringify(existing));
                    alert('관심 등록되었습니다! Uneven Swap 기능 개발 시 반영하겠습니다.');
                  }}
                  className="px-4 py-2 bg-kustody-navy hover:bg-kustody-accent/20 border border-kustody-border rounded-lg text-sm transition-colors"
                >
                  🙋 필요해요
                </button>
              </div>
            </div>
          )}

          {/* 거래 기록 폼 */}
          {showTradeForm && (
            <div className="bg-kustody-surface rounded-xl p-5 border-2 border-kustody-accent">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">📝 거래 기록</h3>
                <div className="text-xs text-kustody-muted">* 실제 거래 조건을 입력하세요</div>
              </div>
              
              {/* 기본 정보 */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">Instrument</label>
                  <select 
                    value={tradeForm.instrument} 
                    onChange={(e) => {
                      const inst = e.target.value;
                      const dir = inst === 'FX_SWAP' ? 'B/S' : 'Buy';
                      setTradeForm({...tradeForm, instrument: inst, direction: dir});
                    }}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="FX_SWAP">🔄 FX Swap</option>
                    <option value="OUTRIGHT">📤 Outright</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">Direction</label>
                  <select 
                    value={tradeForm.direction} 
                    onChange={(e) => setTradeForm({...tradeForm, direction: e.target.value})}
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    {tradeForm.instrument === 'FX_SWAP' ? (
                      <>
                        <option value="B/S">B/S (외화 차입)</option>
                        <option value="S/B">S/B (외화 대여)</option>
                      </>
                    ) : (
                      <>
                        <option value="Buy">Buy (매수)</option>
                        <option value="Sell">Sell (매도)</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">거래일</label>
                  <input type="date" value={tradeForm.tradeDate} 
                    onChange={(e) => setTradeForm({...tradeForm, tradeDate: e.target.value})} 
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">거래상대방</label>
                  <select value={tradeForm.counterParty} onChange={(e) => setTradeForm({...tradeForm, counterParty: e.target.value})} 
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="">선택</option>
                    {(config.counterParties || []).map(cp => <option key={cp.cpId} value={cp.cpId}>{cp.name}</option>)}
                  </select>
                </div>
              </div>

              {/* FX Swap 상세 */}
              {tradeForm.instrument === 'FX_SWAP' && (
                <div className="bg-kustody-navy/30 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Near Leg */}
                    <div>
                      <div className="text-sm font-semibold text-blue-400 mb-3">
                        Near Leg {tradeForm.direction === 'B/S' ? '(USD 매수)' : '(USD 매도)'}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Near Date</label>
                            <input type="date" value={tradeForm.nearDate} 
                              onChange={(e) => setTradeForm({...tradeForm, nearDate: e.target.value})}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Start Rate</label>
                            <input type="number" step="0.01" value={tradeForm.spotRate || ''} 
                              onChange={(e) => {
                                const spotRate = parseFloat(e.target.value) || 0;
                                const farRate = spotRate + tradeForm.swapPoint;
                                const nearCcy2 = tradeForm.nearCcy1Amt * spotRate;
                                const farCcy2 = tradeForm.farCcy1Amt * farRate;
                                setTradeForm({...tradeForm, spotRate, farRate, nearCcy2Amt: nearCcy2, farCcy2Amt: farCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Near CCY1 (USD)</label>
                            <input 
                              type="text" 
                              value={formatNumber(tradeForm.nearCcy1Amt, 0)} 
                              onChange={(e) => {
                                const amt = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                const nearCcy2 = amt * tradeForm.spotRate;
                                setTradeForm({...tradeForm, nearCcy1Amt: amt, nearCcy2Amt: nearCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                            <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(tradeForm.nearCcy1Amt)}</div>
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Near CCY2 (KRW)</label>
                            <div className={`px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono ${tradeForm.direction === 'B/S' ? 'text-red-400' : 'text-green-400'}`}>
                              {tradeForm.direction === 'B/S' ? '-' : '+'}{formatNumber(tradeForm.nearCcy2Amt, 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Far Leg */}
                    <div>
                      <div className="text-sm font-semibold text-purple-400 mb-3">
                        Far Leg {tradeForm.direction === 'B/S' ? '(USD 매도)' : '(USD 매수)'}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Far Date</label>
                            <input type="date" value={tradeForm.farDate} 
                              onChange={(e) => setTradeForm({...tradeForm, farDate: e.target.value})}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Swap Point</label>
                            <input type="number" step="0.01" value={tradeForm.swapPoint || ''} 
                              onChange={(e) => {
                                const swapPoint = parseFloat(e.target.value) || 0;
                                const farRate = tradeForm.spotRate + swapPoint;
                                const farCcy2 = tradeForm.farCcy1Amt * farRate;
                                setTradeForm({...tradeForm, swapPoint, farRate, farCcy2Amt: farCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Far CCY1 (USD)</label>
                            <input 
                              type="text" 
                              value={formatNumber(tradeForm.farCcy1Amt, 0)} 
                              onChange={(e) => {
                                const amt = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                const farCcy2 = amt * tradeForm.farRate;
                                setTradeForm({...tradeForm, farCcy1Amt: amt, farCcy2Amt: farCcy2});
                              }}
                              className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                            <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(tradeForm.farCcy1Amt)}</div>
                          </div>
                          <div>
                            <label className="block text-xs text-kustody-muted mb-1">Far CCY2 (KRW)</label>
                            <div className={`px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono ${tradeForm.direction === 'B/S' ? 'text-green-400' : 'text-red-400'}`}>
                              {tradeForm.direction === 'B/S' ? '+' : '-'}{formatNumber(tradeForm.farCcy2Amt, 0)}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-kustody-muted mb-1">Far Rate</label>
                          <div className="px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono">
                            {formatNumber(tradeForm.farRate, 2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Swap 요약 */}
                  <div className="mt-4 pt-4 border-t border-kustody-border/30 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-kustody-muted">기간: </span>
                      <span className="font-mono font-semibold">
                        {tradeForm.nearDate && tradeForm.farDate 
                          ? Math.round((new Date(tradeForm.farDate) - new Date(tradeForm.nearDate)) / (1000*60*60*24)) + '일'
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">USD Net: </span>
                      <span className={`font-mono ${tradeForm.nearCcy1Amt === tradeForm.farCcy1Amt ? '' : 'text-yellow-400'}`}>
                        {tradeForm.nearCcy1Amt === tradeForm.farCcy1Amt ? '0 (Even)' : formatNumber(tradeForm.farCcy1Amt - tradeForm.nearCcy1Amt, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">KRW Net: </span>
                      <span className={`font-mono font-semibold ${
                        (tradeForm.direction === 'B/S' ? 1 : -1) * (tradeForm.farCcy2Amt - tradeForm.nearCcy2Amt) >= 0 
                          ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatNumber((tradeForm.direction === 'B/S' ? 1 : -1) * (tradeForm.farCcy2Amt - tradeForm.nearCcy2Amt), 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">내재금리: </span>
                      <span className="font-mono">
                        {tradeForm.nearDate && tradeForm.farDate && tradeForm.spotRate
                          ? (((tradeForm.swapPoint / tradeForm.spotRate) * (365 / Math.round((new Date(tradeForm.farDate) - new Date(tradeForm.nearDate)) / (1000*60*60*24)))) * 100).toFixed(2) + '%'
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Outright 상세 */}
              {tradeForm.instrument === 'OUTRIGHT' && (
                <div className="bg-kustody-navy/30 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">결제일</label>
                      <input type="date" value={tradeForm.farDate} 
                        onChange={(e) => setTradeForm({...tradeForm, farDate: e.target.value})}
                        className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">CCY1 Amount (USD)</label>
                      <input 
                        type="text" 
                        value={formatNumber(tradeForm.farCcy1Amt, 0)} 
                        onChange={(e) => {
                          const amt = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          const farCcy2 = amt * tradeForm.farRate;
                          setTradeForm({...tradeForm, farCcy1Amt: amt, farCcy2Amt: farCcy2});
                        }}
                        className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                      <div className="text-xs text-kustody-accent mt-1">{formatUsdKorean(tradeForm.farCcy1Amt)}</div>
                    </div>
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">환율</label>
                      <input type="number" step="0.01" value={tradeForm.farRate || ''} 
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) || 0;
                          setTradeForm({...tradeForm, farRate: rate, farCcy2Amt: tradeForm.farCcy1Amt * rate});
                        }}
                        className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-kustody-muted mb-1">CCY2 Amount (KRW)</label>
                      <div className={`px-3 py-2 bg-kustody-dark/50 rounded text-sm font-mono ${tradeForm.direction === 'Buy' ? 'text-red-400' : 'text-green-400'}`}>
                        {tradeForm.direction === 'Buy' ? '-' : '+'}₩{formatNumber(tradeForm.farCcy2Amt, 0)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-kustody-border/30 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-kustody-muted">USD: </span>
                      <span className={`font-mono font-semibold ${tradeForm.direction === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {tradeForm.direction === 'Buy' ? '+' : '-'}{formatNumber(tradeForm.farCcy1Amt, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-kustody-muted">KRW: </span>
                      <span className={`font-mono font-semibold ${tradeForm.direction === 'Buy' ? 'text-red-400' : 'text-green-400'}`}>
                        {tradeForm.direction === 'Buy' ? '-' : '+'}₩{formatNumber(tradeForm.farCcy2Amt, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 거래자 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-kustody-muted mb-1">거래자</label>
                  <select value={tradeForm.trader} onChange={(e) => setTradeForm({...tradeForm, trader: e.target.value})} 
                    className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded text-sm">
                    <option value="">선택</option>
                    {(config.users || []).filter(u => u.role === 'trader').map(u => <option key={u.userId} value={u.userId}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSaveTrade} className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded font-semibold">💾 저장</button>
                <button onClick={() => setShowTradeForm(false)} className="px-4 py-2 bg-kustody-navy text-kustody-text rounded">취소</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 고객 미선택 또는 Blocked */}
      {!selectedClient && (
        <div className="bg-kustody-surface rounded-xl p-10 text-center text-kustody-muted">
          👆 고객을 선택해주세요
        </div>
      )}
      {!selectedClient && (
        <div className="bg-kustody-surface rounded-xl p-10 text-center">
          <div className="text-kustody-muted text-lg mb-2">👆 고객을 선택해주세요</div>
          <div className="text-sm text-kustody-muted">상단에서 고객을 선택하면 FX Swap Points와 조회 기능을 사용할 수 있습니다.</div>
        </div>
      )}
      {isBlocked && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-10 text-center">
          <div className="text-red-400 text-xl mb-2">🚫 거래 불가</div>
          <div className="text-kustody-muted">내부 정책에 의해 거래가 제한되었습니다.</div>
        </div>
      )}
    </div>
  );
}

// ==================== Blotter Tab ====================
function BlotterTab({ blotter, config, deleteTrade, selectedClientId, setSelectedClientId }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const getCP = (cpId) => (config.counterParties || []).find(c => c.cpId === cpId)?.name || cpId;
  const getClient = (clientId) => config.clients?.find(c => c.clientId === clientId)?.clientName || '';
  const getTrader = (traderId) => (config.users || []).find(u => u.userId === traderId)?.name || traderId;
  
  // 고객 필터 적용
  const filteredBlotter = selectedClientId 
    ? blotter.filter(t => t.clientId === selectedClientId)
    : blotter;
  
  const selectedClient = config.clients?.find(c => c.clientId === selectedClientId);
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">📋 Blotter</h2><p className="text-sm text-kustody-muted mt-1">거래 내역 관리</p></div>
        <div className="flex items-center gap-4">
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm">
            <option value="">🔍 전체 고객</option>
            {config.clients?.map(c => (
              <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
            ))}
          </select>
          <div className="text-sm text-kustody-muted">
            {selectedClientId ? `${selectedClient?.clientName}: ` : ''}총 {filteredBlotter.length}건
          </div>
        </div>
      </div>
      
      {selectedClientId && selectedClient && (
        <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-kustody-accent font-semibold">👤 {selectedClient.clientName}</span>
            <span className="text-kustody-muted">Tier {selectedClient.creditTier}</span>
            <span className="text-kustody-muted">|</span>
            <span className="text-kustody-muted">등록 은행: {selectedClient.bankAccounts?.length || 0}개</span>
            <span className="text-kustody-muted">|</span>
            <span className="text-kustody-muted">담당자: {selectedClient.traders?.length || 0}명</span>
          </div>
        </div>
      )}
      
      <div className="bg-kustody-surface rounded-xl p-5"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border">
            <th className="text-left py-2 px-2 w-8"></th>
            <th className="text-left py-2 px-2">Trade ID</th>
            {!selectedClientId && <th className="text-left py-2 px-2">고객</th>}
            <th className="text-left py-2 px-2">거래일</th>
            <th className="text-center py-2 px-2">Instrument</th>
            <th className="text-center py-2 px-2">Direction</th>
            <th className="text-left py-2 px-2">Near Date</th>
            <th className="text-left py-2 px-2">Far Date</th>
            <th className="text-right py-2 px-2">CCY1 Amt</th>
            <th className="text-right py-2 px-2">Rate</th>
            <th className="text-left py-2 px-2">상대방</th>
            <th className="text-center py-2 px-2">삭제</th>
          </tr></thead>
          <tbody>{filteredBlotter.length === 0 ? (
            <tr><td colSpan={selectedClientId ? "11" : "12"} className="py-8 text-center text-kustody-muted">거래 내역이 없습니다.</td></tr>
          ) : filteredBlotter.map(t => (
            <Fragment key={t.tradeId}>
              {/* 메인 행 */}
              <tr 
                className={`border-b border-kustody-border/30 hover:bg-kustody-navy/20 cursor-pointer ${expandedRow === t.tradeId ? 'bg-kustody-navy/30' : ''}`}
                onClick={() => setExpandedRow(expandedRow === t.tradeId ? null : t.tradeId)}
              >
                <td className="py-2 px-2 text-kustody-muted">
                  {expandedRow === t.tradeId ? '▼' : '▶'}
                </td>
                <td className="py-2 px-2 font-mono text-xs">{t.tradeId}</td>
                {!selectedClientId && <td className="py-2 px-2 text-xs">{getClient(t.clientId)}</td>}
                <td className="py-2 px-2 font-mono text-xs">{t.tradeDate}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    t.instrument === 'FX_SWAP' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {t.instrument === 'FX_SWAP' ? '🔄 Swap' : '📤 Outright'}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    t.direction === 'B/S' ? 'bg-blue-500/20 text-blue-400' :
                    t.direction === 'S/B' ? 'bg-orange-500/20 text-orange-400' :
                    t.direction === 'Buy' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {t.direction}
                  </span>
                </td>
                <td className="py-2 px-2 font-mono text-xs">{t.nearDate || '-'}</td>
                <td className="py-2 px-2 font-mono text-xs">{t.farDate}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {t.instrument === 'FX_SWAP' 
                    ? formatNumber(t.nearCcy1Amt || t.farCcy1Amt, 0)
                    : formatNumber(t.farCcy1Amt, 0)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-kustody-accent">
                  {t.instrument === 'FX_SWAP' 
                    ? `${formatNumber(t.spotRate, 2)} (${t.swapPoint >= 0 ? '+' : ''}${t.swapPoint?.toFixed(2) || '-'})`
                    : formatNumber(t.farRate, 2)}
                </td>
                <td className="py-2 px-2 text-xs">{getCP(t.counterParty)}</td>
                <td className="py-2 px-2 text-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteTrade(t.tradeId); }} 
                    className="text-red-400 hover:text-red-300"
                  >✕</button>
                </td>
              </tr>
              
              {/* 확장 상세 행 */}
              {expandedRow === t.tradeId && (
                <tr className="bg-kustody-navy/20">
                  <td colSpan={selectedClientId ? "11" : "12"} className="py-4 px-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* FX Swap 상세 */}
                      {t.instrument === 'FX_SWAP' && (
                        <>
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-blue-400">Near Leg</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-kustody-muted">Date: </span>
                                <span className="font-mono">{t.nearDate}</span>
                              </div>
                              <div>
                                <span className="text-kustody-muted">Rate: </span>
                                <span className="font-mono">{formatNumber(t.spotRate, 2)}</span>
                              </div>
                              <div>
                                <span className="text-kustody-muted">USD: </span>
                                <span className={`font-mono ${t.direction === 'B/S' ? 'text-green-400' : 'text-red-400'}`}>
                                  {t.direction === 'B/S' ? '+' : '-'}{formatNumber(t.nearCcy1Amt, 0)}
                                </span>
                              </div>
                              <div>
                                <span className="text-kustody-muted">KRW: </span>
                                <span className={`font-mono ${t.direction === 'B/S' ? 'text-red-400' : 'text-green-400'}`}>
                                  {t.direction === 'B/S' ? '-' : '+'}{formatNumber(t.nearCcy2Amt, 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-purple-400">Far Leg</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-kustody-muted">Date: </span>
                                <span className="font-mono">{t.farDate}</span>
                              </div>
                              <div>
                                <span className="text-kustody-muted">Rate: </span>
                                <span className="font-mono">{formatNumber(t.farRate, 2)}</span>
                                <span className="text-kustody-muted text-xs ml-1">
                                  (Swap: {t.swapPoint >= 0 ? '+' : ''}{t.swapPoint?.toFixed(2)})
                                </span>
                              </div>
                              <div>
                                <span className="text-kustody-muted">USD: </span>
                                <span className={`font-mono ${t.direction === 'B/S' ? 'text-red-400' : 'text-green-400'}`}>
                                  {t.direction === 'B/S' ? '-' : '+'}{formatNumber(t.farCcy1Amt, 0)}
                                </span>
                              </div>
                              <div>
                                <span className="text-kustody-muted">KRW: </span>
                                <span className={`font-mono ${t.direction === 'B/S' ? 'text-green-400' : 'text-red-400'}`}>
                                  {t.direction === 'B/S' ? '+' : '-'}{formatNumber(t.farCcy2Amt, 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Outright 상세 */}
                      {t.instrument === 'OUTRIGHT' && (
                        <div className="space-y-3 col-span-2">
                          <div className="text-sm font-semibold text-green-400">Settlement</div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-kustody-muted">Date: </span>
                              <span className="font-mono">{t.farDate}</span>
                            </div>
                            <div>
                              <span className="text-kustody-muted">Rate: </span>
                              <span className="font-mono">{formatNumber(t.farRate, 2)}</span>
                            </div>
                            <div>
                              <span className="text-kustody-muted">USD: </span>
                              <span className={`font-mono ${t.direction === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {t.direction === 'Buy' ? '+' : '-'}{formatNumber(t.farCcy1Amt, 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-kustody-muted">KRW: </span>
                              <span className={`font-mono ${t.direction === 'Buy' ? 'text-red-400' : 'text-green-400'}`}>
                                {t.direction === 'Buy' ? '-' : '+'}{formatNumber(t.farCcy2Amt, 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 공통 정보 */}
                    <div className="mt-4 pt-4 border-t border-kustody-border/30 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-kustody-muted">거래자: </span>
                        <span>{getTrader(t.trader) || '-'}</span>
                      </div>
                      <div>
                        <span className="text-kustody-muted">거래상대방: </span>
                        <span>{getCP(t.counterParty) || '-'}</span>
                      </div>
                      {t.instrument === 'FX_SWAP' && (
                        <>
                          <div>
                            <span className="text-kustody-muted">기간: </span>
                            <span className="font-mono">
                              {t.nearDate && t.farDate 
                                ? Math.round((new Date(t.farDate) - new Date(t.nearDate)) / (1000*60*60*24)) + '일'
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-kustody-muted">KRW Net: </span>
                            <span className={`font-mono font-semibold ${
                              (t.direction === 'B/S' ? 1 : -1) * ((t.farCcy2Amt || 0) - (t.nearCcy2Amt || 0)) >= 0 
                                ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatNumber((t.direction === 'B/S' ? 1 : -1) * ((t.farCcy2Amt || 0) - (t.nearCcy2Amt || 0)), 0)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}</tbody>
        </table>
      </div></div>
    </div>
  );
}

// ==================== Cash Schedule Tab ====================
function CashScheduleTab({ blotter, config, selectedClientId, setSelectedClientId }) {
  const [selectedCcy, setSelectedCcy] = useState('USD');
  const [curveData, setCurveData] = useState(null);
  useEffect(() => { fetch('/config/curves/20260127_IW.json').then(res => res.ok ? res.json() : null).then(data => setCurveData(data)); }, []);

  // 고객 필터 적용
  const filteredBlotter = selectedClientId 
    ? blotter.filter(t => t.clientId === selectedClientId)
    : blotter;
  
  const selectedClient = config.clients?.find(c => c.clientId === selectedClientId);

  const getDF = (days, ccy) => {
    if (!curveData) return 1;
    const tenors = curveData.curves?.USDKRW?.[ccy]?.tenors || [];
    if (tenors.length === 0) return 1;
    
    const sorted = [...tenors].sort((a, b) => a.days - b.days);
    
    const interpolate = (d) => {
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].days <= d && sorted[i + 1].days >= d) {
          const r = (d - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
          return sorted[i].df + (sorted[i + 1].df - sorted[i].df) * r;
        }
      }
      if (d <= sorted[0].days) return sorted[0].df;
      if (d >= sorted[sorted.length - 1].days) return sorted[sorted.length - 1].df;
      return 1;
    };
    
    const todayDF = interpolate(0);
    const df = interpolate(days);
    return df / todayDF;
  };

  const schedule = (() => {
    const today = new Date(), flows = {};
    
    const addFlow = (date, instrument, amt) => {
      if (!date || !amt) return;
      if (!flows[date]) flows[date] = { SWAP: 0, OUTRIGHT: 0 };
      flows[date][instrument] += amt;
    };
    
    filteredBlotter.forEach(t => {
      if (t.instrument === 'FX_SWAP') {
        // Near leg
        if (selectedCcy === 'USD') {
          const nearUsd = t.direction === 'B/S' ? t.nearCcy1Amt : -t.nearCcy1Amt;
          addFlow(t.nearDate, 'SWAP', nearUsd);
        } else {
          const nearKrw = t.direction === 'B/S' ? -t.nearCcy2Amt : t.nearCcy2Amt;
          addFlow(t.nearDate, 'SWAP', nearKrw);
        }
        // Far leg
        if (selectedCcy === 'USD') {
          const farUsd = t.direction === 'B/S' ? -t.farCcy1Amt : t.farCcy1Amt;
          addFlow(t.farDate, 'SWAP', farUsd);
        } else {
          const farKrw = t.direction === 'B/S' ? t.farCcy2Amt : -t.farCcy2Amt;
          addFlow(t.farDate, 'SWAP', farKrw);
        }
      } else if (t.instrument === 'OUTRIGHT') {
        if (selectedCcy === 'USD') {
          const usd = t.direction === 'Buy' ? t.farCcy1Amt : -t.farCcy1Amt;
          addFlow(t.farDate, 'OUTRIGHT', usd);
        } else {
          const krw = t.direction === 'Buy' ? -t.farCcy2Amt : t.farCcy2Amt;
          addFlow(t.farDate, 'OUTRIGHT', krw);
        }
      }
    });
    
    return Object.entries(flows).map(([date, f]) => { 
      const days = Math.round((new Date(date) - today) / 864e5); 
      const sum = f.SWAP + f.OUTRIGHT; 
      const df = getDF(days, selectedCcy); 
      return { date, days, sum, df, npv: sum * df, ...f }; 
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  })();
  const totalNPV = schedule.reduce((s, r) => s + r.npv, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">💵 Cash Schedule</h2><p className="text-sm text-kustody-muted mt-1">통화별 캐시플로우</p></div>
        <div className="flex items-center gap-3">
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm">
            <option value="">🔍 전체 고객</option>
            {config.clients?.map(c => (
              <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
            ))}
          </select>
          <select value={selectedCcy} onChange={(e) => setSelectedCcy(e.target.value)} className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg text-sm">
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </select>
        </div>
      </div>
      
      {selectedClientId && selectedClient && (
        <div className="bg-kustody-accent/10 border border-kustody-accent/30 rounded-xl p-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-kustody-accent font-semibold">👤 {selectedClient.clientName}</span>
            <span className="text-kustody-muted">거래 {filteredBlotter.length}건</span>
          </div>
        </div>
      )}
      
      <div className="bg-kustody-surface rounded-xl p-5"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2 px-2">날짜</th><th className="text-right py-2 px-2">SUM</th><th className="text-right py-2 px-2">DF</th><th className="text-right py-2 px-2">NPV</th><th className="text-right py-2 px-2">SWAP</th><th className="text-right py-2 px-2">OUTRIGHT</th></tr></thead>
          <tbody>{schedule.length === 0 ? <tr><td colSpan="6" className="py-8 text-center text-kustody-muted">데이터가 없습니다.</td></tr> : schedule.map((r, i) => (
            <tr key={i} className="border-b border-kustody-border/30">
              <td className="py-2 px-2 font-mono">{r.date}</td>
              <td className={`py-2 px-2 text-right font-mono ${r.sum >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(r.sum, 0)}</td>
              <td className="py-2 px-2 text-right font-mono text-kustody-muted">{r.df.toFixed(10)}</td>
              <td className={`py-2 px-2 text-right font-mono ${r.npv >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(r.npv, 2)}</td>
              <td className="py-2 px-2 text-right font-mono text-purple-400">{r.SWAP !== 0 ? formatNumber(r.SWAP, 0) : '-'}</td>
              <td className="py-2 px-2 text-right font-mono text-green-400">{r.OUTRIGHT !== 0 ? formatNumber(r.OUTRIGHT, 0) : '-'}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr className="border-t-2 border-kustody-border font-semibold"><td className="py-2 px-2">Total NPV</td><td colSpan="2"></td><td className={`py-2 px-2 text-right font-mono ${totalNPV >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(totalNPV, 2)}</td><td colSpan="2"></td></tr></tfoot>
        </table>
      </div></div>
    </div>
  );
}

// ==================== Valuation Tab ====================
function ValuationTab({ blotter, fixingRate, setFixingRate, sharedCurveData }) {
  const [curveData, setCurveData] = useState(null);
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [decimalPlaces, setDecimalPlaces] = useState(10); // 기본 10자리
  const [showFull, setShowFull] = useState(true); // 기본 10자리 표시
  const [curveSource, setCurveSource] = useState('loading...');
  const [spotDays, setSpotDays] = useState(2); // T+2 기본
  
  // ========== 정밀도 표준 ==========
  // 내부 계산: JavaScript 그대로 (~15자리) - 오차 누적 방지
  // 출력: 10자리로 표시
  
  // sharedCurveData (Curves 탭에서 계산된 데이터) 우선 사용
  useEffect(() => {
    if (sharedCurveData) {
      setCurveData(sharedCurveData);
      setCurveSource('Curves 탭 (실시간)');
      
      // Spot Date 계산해서 spotDays 설정
      const spotDateStr = sharedCurveData.curves?.USDKRW?.USD?.spotDate;
      if (spotDateStr && valuationDate) {
        const spotDate = new Date(spotDateStr);
        const valDate = new Date(valuationDate);
        const diffDays = Math.round((spotDate - valDate) / (1000 * 60 * 60 * 24));
        setSpotDays(diffDays > 0 ? diffDays : 2);
      }
      return;
    }
    
    // Fallback: Supabase 또는 JSON
    const loadCurveData = async () => {
      try {
        const [usdRes, krwRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/usd_rates?order=tenor.asc`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/krw_rates?order=tenor.asc`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          })
        ]);
        
        if (usdRes.ok && krwRes.ok) {
          const usdRates = await usdRes.json();
          const krwRates = await krwRes.json();
          
          if (usdRates.length > 0 && krwRates.length > 0) {
            const tenorToDays = (tenor) => {
              const map = { 'ON': -1, 'TN': 0, '1W': 7, '2W': 14, '1M': 30, '2M': 60, '3M': 90, '6M': 180, '9M': 270, '1Y': 365, '2Y': 730 };
              return map[tenor] ?? 30;
            };
            
            // Rate에서 DF 계산
            const rateToDf = (rate, days, dayCount) => {
              if (days <= 0) return 1;
              return 1 / (1 + (rate / 100) * (days / dayCount));
            };
            
            const usdTenors = usdRates.map(r => {
              const days = tenorToDays(r.tenor);
              return {
                tenor: r.tenor,
                days: days,
                rate: r.rate,
                df: rateToDf(r.rate, days, 360)
              };
            });
            
            const krwTenors = krwRates.map(r => {
              const days = tenorToDays(r.tenor);
              return {
                tenor: r.tenor,
                days: days,
                rate: r.rate,
                df: rateToDf(r.rate, days, 365)
              };
            });
            
            setCurveData({
              curves: {
                USDKRW: {
                  USD: { tenors: usdTenors },
                  KRW: { tenors: krwTenors }
                }
              }
            });
            setCurveSource('Supabase');
            return;
          }
        }
        
        // JSON fallback
        const jsonRes = await fetch('/config/curves/20260127_IW.json');
        if (jsonRes.ok) {
          const data = await jsonRes.json();
          setCurveData(data);
          setCurveSource('JSON (fallback)');
        }
      } catch (e) {
        console.error('Curve load error:', e);
      }
    };
    
    loadCurveData();
  }, [sharedCurveData, valuationDate]);

  // DF 보간 함수 (Log-Linear) - 이미 계산된 DF 사용
  const interpolateDf = (tenors, targetDays) => {
    if (!tenors || tenors.length === 0) return 1;
    
    // DF가 있는 tenor만 필터링
    const sorted = [...tenors]
      .filter(t => t.df !== undefined && t.df !== null)
      .sort((a, b) => a.days - b.days);
    
    if (sorted.length === 0) return 1;
    
    // 정확히 일치하는 tenor 먼저 찾기
    const exact = sorted.find(t => t.days === targetDays);
    if (exact) return exact.df;
    
    // 범위 밖 - 첫 번째 포인트 이전
    if (targetDays < sorted[0].days) {
      // 비례 외삽 (음수 days 포함)
      if (sorted[0].days === 0) return sorted[0].df;
      const lnDf = Math.log(sorted[0].df);
      return Math.exp(lnDf * targetDays / sorted[0].days);
    }
    
    // 범위 밖 - 마지막 포인트 이후
    if (targetDays > sorted[sorted.length - 1].days) {
      return sorted[sorted.length - 1].df;
    }
    
    // Log-linear 보간
    for (let i = 0; i < sorted.length - 1; i++) {
      if (targetDays >= sorted[i].days && targetDays <= sorted[i + 1].days) {
        const t = (targetDays - sorted[i].days) / (sorted[i + 1].days - sorted[i].days);
        const lnDfLower = Math.log(sorted[i].df);
        const lnDfUpper = Math.log(sorted[i + 1].df);
        return Math.exp(lnDfLower + (lnDfUpper - lnDfLower) * t);
      }
    }
    
    return 1;
  };

  // Rebased DF 계산
  // Curves 탭: Spot Date 기준 DF=1
  // Valuation: Today (valuationDate) 기준 DF=1로 rebasing
  // 
  // curvesDays = daysFromValuation - spotDays
  // todayRatio = USD_DF(-spotDays) / KRW_DF(-spotDays)  (Today는 Spot보다 spotDays일 전)
  // rebasedDF = (USD_DF / KRW_DF) / todayRatio
  const getRebasedDF = (daysFromValuation) => {
    if (!curveData) return 1;
    
    const usdTenors = curveData.curves?.USDKRW?.USD?.tenors || [];
    const krwTenors = curveData.curves?.USDKRW?.KRW?.tenors || [];
    
    if (usdTenors.length === 0 || krwTenors.length === 0) return 1;
    
    // Curves는 Spot Date 기준 days
    // Today는 Spot보다 spotDays일 전 → curvesDays = -spotDays
    const todayCurvesDays = -spotDays;
    
    // Today의 ratio (이 값이 1.000024 같은 값)
    const usdDfToday = interpolateDf(usdTenors, todayCurvesDays);
    const krwDfToday = interpolateDf(krwTenors, todayCurvesDays);
    const todayRatio = usdDfToday / krwDfToday;
    
    // Target의 curvesDays
    const targetCurvesDays = daysFromValuation - spotDays;
    
    // Target의 ratio
    const usdDfTarget = interpolateDf(usdTenors, targetCurvesDays);
    const krwDfTarget = interpolateDf(krwTenors, targetCurvesDays);
    const targetRatio = usdDfTarget / krwDfTarget;
    
    // Rebased: Today=1
    const rebasedDf = targetRatio / todayRatio;
    
    return rebasedDf;
  };

  // Daily Forward Rates 계산 (valuationDate부터 730일)
  const dailyRates = (() => {
    const rates = [];
    const today = new Date(valuationDate);
    
    for (let d = 0; d <= 730; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      
      const df = getRebasedDF(d);
      const forwardRate = fixingRate * df;
      
      rates.push({
        date: date.toISOString().split('T')[0],
        days: d,
        df,
        forwardRate
      });
    }
    return rates;
  })();

  // Blotter 평가
  const evalTrades = (() => {
    const today = new Date(valuationDate);
    return blotter
      .filter(t => new Date(t.settlementDate) > today)
      .map(t => {
        const days = Math.round((new Date(t.settlementDate) - today) / 864e5);
        const df = getRebasedDF(days);
        const evalRate = fixingRate * df;
        const pnl = (evalRate - (parseFloat(t.rate) || 0)) * (t.ccy1Amt || 0);
        return { ...t, days, df, evalRate, pnl };
      });
  })();
  
  const totalPnL = evalTrades.reduce((s, t) => s + t.pnl, 0);

  const downloadCSV = () => { 
    const h = 'Date,Days,DF_Rebased,공정가치_환율\n'; 
    const r = dailyRates.map(x => `${x.date},${x.days},${x.df.toFixed(decimalPlaces)},${x.forwardRate.toFixed(3)}`).join('\n'); 
    const b = new Blob([h + r], { type: 'text/csv' }); 
    const u = URL.createObjectURL(b); 
    const a = document.createElement('a'); 
    a.href = u; 
    a.download = `공정가치환율_${valuationDate}.csv`; 
    a.click(); 
    URL.revokeObjectURL(u); 
  };
  
  const fmt = (n, f = null) => n.toFixed(f ?? (showFull ? 10 : 4));
  
  // Today ratio 계산 (디버깅/표시용)
  const getTodayRatio = () => {
    if (!curveData) return 1;
    const usdTenors = curveData.curves?.USDKRW?.USD?.tenors || [];
    const krwTenors = curveData.curves?.USDKRW?.KRW?.tenors || [];
    if (usdTenors.length === 0 || krwTenors.length === 0) return 1;
    
    const todayCurvesDays = -spotDays;
    const usdDfToday = interpolateDf(usdTenors, todayCurvesDays);
    const krwDfToday = interpolateDf(krwTenors, todayCurvesDays);
    return usdDfToday / krwDfToday;
  };
  const todayRatio = getTodayRatio();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">📊 IFRS Valuation</h2>
          <p className="text-sm text-kustody-muted mt-1">공정가치 평가 및 고시 (커브: {curveSource}, Spot T+{spotDays})</p>
        </div>
      </div>
      <div className="bg-kustody-surface rounded-xl p-5"><div className="grid grid-cols-4 gap-4">
        <div><label className="block text-xs text-kustody-muted mb-1">평가일 (Today=1 기준)</label><input type="date" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono" /></div>
        <div><label className="block text-xs text-kustody-muted mb-1">재무환율 (Accounting Rate USD)</label><input type="number" step="0.01" value={fixingRate} onChange={(e) => setFixingRate(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono" /></div>
        <div><label className="block text-xs text-kustody-muted mb-1">CSV 소수점 (DF)</label><select value={decimalPlaces} onChange={(e) => setDecimalPlaces(parseInt(e.target.value))} className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg"><option value={6}>6자리</option><option value={8}>8자리</option><option value={10}>10자리</option></select></div>
        <div className="flex items-end gap-2"><button onClick={() => setShowFull(!showFull)} className={`px-3 py-2 rounded-lg text-sm ${showFull ? 'bg-kustody-accent text-kustody-dark' : 'bg-kustody-navy'}`}>{showFull ? '10자리' : '4자리'}</button><button onClick={downloadCSV} className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-semibold">📥 CSV</button></div>
      </div></div>
      
      {/* 계산 로직 설명 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
        <p className="text-blue-300 mb-2">📐 <strong>공정가치 환율 계산 로직 (Today Rebasing)</strong></p>
        <ul className="text-blue-200/80 text-xs space-y-1">
          <li>• Curves 탭: Spot Date (T+{spotDays}) 기준 DF=1</li>
          <li>• Today (T+0) 원본 ratio = USD_DF / KRW_DF = <span className="font-mono text-yellow-300">{todayRatio.toFixed(10)}</span></li>
          <li>• <strong>Rebased DF(d) = 원본 ratio(d) / Today 원본 ratio</strong> → Today DF = 1</li>
          <li>• 공정가치 환율 = 재무환율 ({formatNumber(fixingRate, 2)}) × Rebased DF</li>
        </ul>
      </div>
      
      <div className="bg-kustody-surface rounded-xl p-5"><h3 className="font-semibold mb-4">📈 일별 공정가치 환율 (평가일={valuationDate}, Today DF=1)</h3><div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm"><thead className="sticky top-0 bg-kustody-surface"><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2 px-2">Date</th><th className="text-right py-2 px-2">Days</th><th className="text-right py-2 px-2">DF (Rebased)</th><th className="text-right py-2 px-2">공정가치 환율</th></tr></thead>
        <tbody>{dailyRates.slice(0, 100).map((r, i) => (<tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20"><td className="py-1 px-2 font-mono text-xs">{r.date}</td><td className="py-1 px-2 text-right font-mono text-kustody-muted">{r.days}</td><td className="py-1 px-2 text-right font-mono">{fmt(r.df, 10)}</td><td className="py-1 px-2 text-right font-mono text-kustody-accent">{r.forwardRate.toFixed(3)}</td></tr>))}</tbody></table>
        <p className="text-xs text-kustody-muted mt-2 text-center">처음 100일만 표시 (CSV로 전체 다운로드)</p>
      </div></div>
      {evalTrades.length > 0 && (<div className="bg-kustody-surface rounded-xl p-5"><h3 className="font-semibold mb-4">💹 미결제 거래 평가</h3>
        <table className="w-full text-sm"><thead><tr className="text-kustody-muted text-xs border-b border-kustody-border"><th className="text-left py-2">결제일</th><th className="text-right py-2">Days</th><th className="text-right py-2">거래환율</th><th className="text-right py-2">평가환율</th><th className="text-right py-2">Notional</th><th className="text-right py-2">미실현손익</th></tr></thead>
        <tbody>{evalTrades.map((t, i) => (<tr key={i} className="border-b border-kustody-border/30"><td className="py-2 font-mono text-xs">{t.settlementDate}</td><td className="py-2 text-right font-mono text-kustody-muted">{t.days}</td><td className="py-2 text-right font-mono">{formatNumber(parseFloat(t.rate), 2)}</td><td className="py-2 text-right font-mono text-kustody-accent">{t.evalRate.toFixed(3)}</td><td className="py-2 text-right font-mono">{formatNumber(t.ccy1Amt, 0)}</td><td className={`py-2 text-right font-mono font-semibold ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(t.pnl, 0)}</td></tr>))}</tbody>
        <tfoot><tr className="border-t-2 border-kustody-border font-semibold"><td colSpan="5" className="py-2">Total 미실현손익</td><td className={`py-2 text-right font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(totalPnL, 0)} KRW</td></tr></tfoot>
      </table></div>)}
    </div>
  );
}

// ==================== Cash Balance Tab ====================
function CashBalanceTab({ blotter, config, selectedClientId, setSelectedClientId }) {
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [usdBalance, setUsdBalance] = useState(0);
  const [krwBalance, setKrwBalance] = useState(0);
  
  // 선택된 고객의 잔액 계산
  const filteredTrades = selectedClientId === 'ALL' 
    ? blotter 
    : blotter.filter(t => t.clientId === selectedClientId);
  
  // 특정 날짜 기준 잔액 계산
  const calculateBalance = () => {
    let usd = 0;
    let krw = 0;
    
    filteredTrades.forEach(trade => {
      if (trade.settlementDate <= balanceDate) {
        if (trade.type === 'BUY') {
          usd += parseFloat(trade.ccy1Amt) || 0;
          krw -= parseFloat(trade.ccy2Amt) || 0;
        } else {
          usd -= parseFloat(trade.ccy1Amt) || 0;
          krw += parseFloat(trade.ccy2Amt) || 0;
        }
      }
    });
    
    return { usd, krw };
  };
  
  const balance = calculateBalance();
  
  // 일별 잔액 히스토리 생성
  const generateBalanceHistory = () => {
    const history = [];
    const sortedTrades = [...filteredTrades].sort((a, b) => 
      new Date(a.settlementDate) - new Date(b.settlementDate)
    );
    
    let runningUsd = 0;
    let runningKrw = 0;
    
    sortedTrades.forEach(trade => {
      if (trade.type === 'BUY') {
        runningUsd += parseFloat(trade.ccy1Amt) || 0;
        runningKrw -= parseFloat(trade.ccy2Amt) || 0;
      } else {
        runningUsd -= parseFloat(trade.ccy1Amt) || 0;
        runningKrw += parseFloat(trade.ccy2Amt) || 0;
      }
      
      history.push({
        date: trade.settlementDate,
        tradeId: trade.id,
        type: trade.type,
        usdChange: trade.type === 'BUY' ? parseFloat(trade.ccy1Amt) : -parseFloat(trade.ccy1Amt),
        krwChange: trade.type === 'BUY' ? -parseFloat(trade.ccy2Amt) : parseFloat(trade.ccy2Amt),
        usdBalance: runningUsd,
        krwBalance: runningKrw,
      });
    });
    
    return history;
  };
  
  const balanceHistory = generateBalanceHistory();
  
  const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="text-kustody-muted text-xs mb-2">기준일</div>
          <input 
            type="date" 
            value={balanceDate} 
            onChange={(e) => setBalanceDate(e.target.value)}
            className="w-full px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono"
          />
        </div>
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="text-kustody-muted text-xs mb-2">USD Balance</div>
          <div className={`text-2xl font-mono font-bold ${balance.usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatNumber(balance.usd)}
          </div>
        </div>
        <div className="bg-kustody-surface rounded-xl p-5">
          <div className="text-kustody-muted text-xs mb-2">KRW Balance</div>
          <div className={`text-2xl font-mono font-bold ${balance.krw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatNumber(balance.krw)}
          </div>
        </div>
      </div>
      
      {/* 고객 필터 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-kustody-muted">고객 필터:</label>
          <select 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg"
          >
            <option value="ALL">전체</option>
            {config.clients?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* 잔액 히스토리 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <h3 className="font-semibold mb-4">📊 잔액 변동 히스토리</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-kustody-surface">
              <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                <th className="text-left py-2 px-2">Settlement Date</th>
                <th className="text-center py-2 px-2">Type</th>
                <th className="text-right py-2 px-2">USD Change</th>
                <th className="text-right py-2 px-2">KRW Change</th>
                <th className="text-right py-2 px-2">USD Balance</th>
                <th className="text-right py-2 px-2">KRW Balance</th>
              </tr>
            </thead>
            <tbody>
              {balanceHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-kustody-muted">거래 내역이 없습니다</td>
                </tr>
              ) : (
                balanceHistory.map((row, i) => (
                  <tr key={i} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                    <td className="py-2 px-2 font-mono text-xs">{row.date}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${row.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{row.type}</td>
                    <td className={`py-2 px-2 text-right font-mono ${row.usdChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(row.usdChange)}</td>
                    <td className={`py-2 px-2 text-right font-mono ${row.krwChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(row.krwChange)}</td>
                    <td className="py-2 px-2 text-right font-mono text-kustody-accent">{formatNumber(row.usdBalance)}</td>
                    <td className="py-2 px-2 text-right font-mono text-kustody-accent">{formatNumber(row.krwBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== Accounting Rates Tab ====================
function AccountingRatesTab() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState(null);
  
  // Supabase 설정
  const SUPABASE_URL = 'https://dxenbwvhxdcgtdivjhpa.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_jmXQn-qfWdQ6XNOW9preiQ_bHgXbHxO';
  
  // 재무환율 데이터 로드
  const fetchRates = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/accounting_rates?reference_date=eq.${date}&order=currency_code.asc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('데이터를 가져올 수 없습니다');
      }
      
      const data = await response.json();
      setRates(data);
      
      if (data.length === 0) {
        setError('해당 날짜의 데이터가 없습니다.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 최신 날짜 데이터 로드
  const fetchLatestRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/accounting_rates?order=reference_date.desc,currency_code.asc&limit=100`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('데이터를 가져올 수 없습니다');
      }
      
      const data = await response.json();
      
      if (data.length > 0) {
        const latestDate = data[0].reference_date;
        setSelectedDate(latestDate);
        setRates(data.filter(r => r.reference_date === latestDate));
      } else {
        setError('데이터가 없습니다. 스크래퍼를 실행해주세요.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 컴포넌트 마운트 시 최신 데이터 로드
  useEffect(() => {
    fetchLatestRates();
  }, []);
  
  const formatNumber = (num, decimals = 2) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  
  // 주요 통화 분리 (USD 항상 맨 앞)
  const majorCurrencyOrder = ['USD', 'CNH', 'EUR', 'GBP', 'JPY'];
  const majorRates = majorCurrencyOrder
    .map(code => rates.find(r => r.currency_code === code))
    .filter(Boolean);
  
  // 전체 목록도 USD 우선 정렬
  const sortedRates = [...rates].sort((a, b) => {
    if (a.currency_code === 'USD') return -1;
    if (b.currency_code === 'USD') return 1;
    return a.currency_code.localeCompare(b.currency_code);
  });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">🏦 재무환율 (Accounting Rates)</h3>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-kustody-dark border border-kustody-border rounded-lg font-mono text-sm"
            />
            <button 
              onClick={() => fetchRates(selectedDate)}
              disabled={loading}
              className="px-4 py-2 bg-kustody-accent text-kustody-dark rounded-lg font-semibold text-sm hover:bg-kustody-accent/80 disabled:opacity-50"
            >
              {loading ? '⏳' : '🔍 조회'}
            </button>
            <button 
              onClick={fetchLatestRates}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-400 disabled:opacity-50"
            >
              {loading ? '⏳' : '📡 최신'}
            </button>
          </div>
        </div>
        <p className="text-xs text-kustody-muted">
          출처: 서울외국환중개 (smbs.biz) · 매일 08:40 KST 기준 · {selectedDate}
        </p>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}
      
      {/* 주요 통화 */}
      {majorRates.length > 0 && (
        <div className="bg-kustody-surface rounded-xl p-5">
          <h4 className="font-semibold mb-4">💱 주요 통화</h4>
          <div className="grid grid-cols-5 gap-4">
            {majorRates.map((rate) => (
              <div key={rate.currency_code} className="bg-kustody-dark rounded-lg p-4 text-center">
                <div className="text-xs text-kustody-muted mb-1">{rate.currency_name}</div>
                <div className="text-xl font-mono font-bold text-kustody-accent">
                  {formatNumber(rate.rate_krw, rate.currency_code === 'JPY' ? 4 : 2)}
                </div>
                {rate.change_rate !== null && rate.change_rate !== undefined && (
                  <div className={`text-xs mt-1 ${rate.change_rate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {rate.change_rate >= 0 ? '▲' : '▼'} {Math.abs(rate.change_rate).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 전체 통화 테이블 */}
      <div className="bg-kustody-surface rounded-xl p-5">
        <h4 className="font-semibold mb-4">📋 전체 통화 ({rates.length}개)</h4>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-kustody-surface">
              <tr className="text-kustody-muted text-xs border-b border-kustody-border">
                <th className="text-left py-2 px-3">통화</th>
                <th className="text-left py-2 px-3">통화명</th>
                <th className="text-right py-2 px-3">환율 (원)</th>
                <th className="text-right py-2 px-3">전일대비</th>
                <th className="text-right py-2 px-3">Cross Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-kustody-muted">
                    {loading ? '로딩 중...' : '데이터가 없습니다'}
                  </td>
                </tr>
              ) : (
                sortedRates.map((rate) => (
                  <tr key={rate.currency_code} className="border-b border-kustody-border/30 hover:bg-kustody-navy/20">
                    <td className="py-2 px-3 font-mono font-semibold">{rate.currency_code}</td>
                    <td className="py-2 px-3 text-kustody-muted text-xs">{rate.currency_name}</td>
                    <td className="py-2 px-3 text-right font-mono text-kustody-accent">
                      {formatNumber(rate.rate_krw, 4)}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono ${
                      rate.change_rate > 0 ? 'text-red-400' : rate.change_rate < 0 ? 'text-blue-400' : 'text-kustody-muted'
                    }`}>
                      {rate.change_rate !== null && rate.change_rate !== undefined 
                        ? `${rate.change_rate >= 0 ? '+' : ''}${rate.change_rate.toFixed(2)}` 
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-kustody-muted">
                      {rate.cross_rate ? formatNumber(rate.cross_rate, 6) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
