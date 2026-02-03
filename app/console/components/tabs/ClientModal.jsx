'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';

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

export default ClientModal;
