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

// Components
import DeferredInput from './components/common/DeferredInput';

// Tabs
import CurvesTab from './components/tabs/CurvesTab';
import CalculatorTab from './components/tabs/CalculatorTab';
import HolidaysTab from './components/tabs/HolidaysTab';
import CalendarTab from './components/tabs/CalendarTab';
import ConfigTab from './components/tabs/ConfigTab';
import ClientsTab from './components/tabs/ClientsTab';
import ClientModal from './components/tabs/ClientModal';
import ClientPricingTab from './components/tabs/ClientPricingTab';
import SettingsTab from './components/tabs/SettingsTab';
import AdvisoryTab from './components/tabs/AdvisoryTab';
import BlotterTab from './components/tabs/BlotterTab';
import CashScheduleTab from './components/tabs/CashScheduleTab';
import ValuationTab from './components/tabs/ValuationTab';
import CashBalanceTab from './components/tabs/CashBalanceTab';
import AccountingRatesTab from './components/tabs/AccountingRatesTab';

// 네이버 환율 캐시 (전역 - 여러 탭에서 공유)
let naverRateCache = {
  data: null,
  lastFetch: null,
  CACHE_DURATION: 4 * 60 * 1000 // 4분
};

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
