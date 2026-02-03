'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import DeferredInput from '../common/DeferredInput';
import { formatNumber } from '../../services/formatters';

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

export default BlotterTab;
