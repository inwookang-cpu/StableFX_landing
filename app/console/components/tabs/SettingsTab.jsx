'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import { formatNumber } from '../../services/formatters';

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

export default SettingsTab;
