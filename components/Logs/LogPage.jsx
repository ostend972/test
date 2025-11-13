import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSecurityEvents, getLogs, exportLogs, generateDiagnosticReport } from '../../services/api.js';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { useWebSocket } from '../../hooks/useWebSocket.js';

export const LogPage = () => {
  const [activeLogType, setActiveLogType] = useState('security'); // 'security' ou 'technical'
  const [filters, setFilters] = useState({
    type: '', // 'blocked', 'allowed', 'all'
    search: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Query pour les événements de sécurité
  const { data: securityData, isLoading: securityLoading, refetch: refetchSecurity } = useQuery({
    queryKey: ['securityEvents', filters, page],
    queryFn: () => getSecurityEvents(filters, page, pageSize),
    enabled: activeLogType === 'security',
  });

  // Query pour les logs techniques
  const { data: technicalData, isLoading: technicalLoading, refetch: refetchTechnical } = useQuery({
    queryKey: ['technicalLogs', filters, page],
    queryFn: () => getLogs(filters, page, pageSize),
    enabled: activeLogType === 'technical',
  });

  // WebSocket pour les nouveaux événements de sécurité (blocages/autorisations)
  useWebSocket('domain_event', () => {
    if (activeLogType === 'security') {
      refetchSecurity();
    }
  });

  // WebSocket pour les nouveaux logs techniques
  useWebSocket('new_log', () => {
    if (activeLogType === 'technical') {
      refetchTechnical();
    }
  });

  const currentData = activeLogType === 'security' ? securityData : technicalData;
  const isLoading = activeLogType === 'security' ? securityLoading : technicalLoading;

  const handleExportLogs = async () => {
    try {
      await exportLogs();
    } catch (error) {
      alert(`Erreur lors de l'export: ${error.message}`);
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateDiagnosticReport();
    } catch (error) {
      alert(`Erreur lors de la génération du rapport: ${error.message}`);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset à la page 1
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEventTypeColor = (type) => {
    switch (type) {
      case 'blocked':
        return 'text-red-600 bg-red-50';
      case 'allowed':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Logs & Événements</h2>
            <p className="text-text-subtle mt-1">Historique complet des événements de sécurité et logs techniques</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportLogs} variant="secondary" className="text-sm">
              📥 Exporter Logs
            </Button>
            <Button onClick={handleGenerateReport} variant="secondary" className="text-sm">
              📋 Rapport Diagnostic
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border-color">
          <button
            onClick={() => {
              setActiveLogType('security');
              setPage(1);
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeLogType === 'security'
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-subtle hover:text-text-primary'
            }`}
          >
            🔒 Événements de Sécurité
          </button>
          <button
            onClick={() => {
              setActiveLogType('technical');
              setPage(1);
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeLogType === 'technical'
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-subtle hover:text-primary'
            }`}
          >
            🛠️ Logs Techniques
          </button>
        </div>

        {/* Filtres */}
        {activeLogType === 'security' && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Rechercher un domaine..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-4 py-2 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="px-4 py-2 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">Tous les types</option>
              <option value="blocked">Bloqués uniquement</option>
              <option value="allowed">Autorisés uniquement</option>
            </select>
          </div>
        )}

        {/* Liste des événements */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-text-subtle">Chargement des logs...</p>
          </div>
        ) : !currentData || currentData.logs?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-subtle">Aucun événement trouvé</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {currentData.logs.map((log) => (
                <div
                  key={log.id}
                  className="border border-border-color rounded-lg p-4 hover:bg-bg-hover transition-colors"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {activeLogType === 'security' && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${getEventTypeColor(
                              log.type
                            )}`}
                          >
                            {log.type === 'blocked' ? '🚫 Bloqué' : '✅ Autorisé'}
                          </span>
                        )}
                        <span className="font-mono text-sm font-semibold text-primary">
                          {log.domain || log.message}
                        </span>
                      </div>
                      {log.reason && (
                        <p className="text-sm text-text-subtle mb-1">
                          <strong>Raison:</strong> {log.reason}
                        </p>
                      )}
                      {log.source && (
                        <p className="text-sm text-text-subtle">
                          <strong>Source:</strong> {log.source}
                        </p>
                      )}
                      {log.level && activeLogType === 'technical' && (
                        <p className="text-sm">
                          <span
                            className={`font-semibold ${
                              log.level === 'error'
                                ? 'text-red-600'
                                : log.level === 'warn'
                                ? 'text-yellow-600'
                                : 'text-blue-600'
                            }`}
                          >
                            [{log.level.toUpperCase()}]
                          </span>{' '}
                          {log.message}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-text-subtle whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {currentData.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="secondary"
                  className="text-sm"
                >
                  ← Précédent
                </Button>
                <span className="text-sm text-text-subtle">
                  Page {currentData.currentPage} sur {currentData.totalPages} ({currentData.totalLogs} logs)
                </span>
                <Button
                  onClick={() => setPage((p) => Math.min(currentData.totalPages, p + 1))}
                  disabled={page >= currentData.totalPages}
                  variant="secondary"
                  className="text-sm"
                >
                  Suivant →
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
