'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';

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

export default ClientsTab;
