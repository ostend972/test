import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardStats } from '../../services/api.js';
import { useWebSocket } from '../../hooks/useWebSocket.js';

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
);

const MetricCard = ({ title, icon, stats, color = "primary" }) => {
    const colorClasses = {
        primary: "bg-primary/10 border-primary/30 text-primary",
        success: "bg-success/10 border-success/30 text-success",
        warning: "bg-warning/10 border-warning/30 text-warning",
        danger: "bg-danger/10 border-danger/30 text-danger"
    };

    return (
        <div className={`${colorClasses[color]} border rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <h4 className="font-semibold text-sm">{title}</h4>
            </div>
            <div className="space-y-1.5">
                {stats.map((stat, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-text-subtle">{stat.label}</span>
                        <span className="font-semibold text-text-main">{stat.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AdvancedSecurityMetrics = () => {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: getDashboardStats,
        staleTime: 10000, // Les données restent fraîches pendant 10 secondes
        refetchOnWindowFocus: true // Rafraîchir quand on revient sur la fenêtre
    });

    // WebSocket temps réel pour mises à jour instantanées
    useWebSocket('stats_update', (updatedStats) => {
        queryClient.setQueryData(['dashboardStats'], (prevStats) => {
            if (!prevStats) return prevStats;
            return {
                ...prevStats,
                ...updatedStats,
                // Fusionner les stats avancées si disponibles
                advanced: {
                    ...prevStats.advanced,
                    ...updatedStats.advanced
                }
            };
        });
    });

    if (isLoading) {
        return (
            <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
                <h3 className="text-lg font-bold text-text-main mb-4">🔒 Métriques de Sécurité Avancées</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                    <div className="bg-gray-200 rounded-lg h-32"></div>
                    <div className="bg-gray-200 rounded-lg h-32"></div>
                    <div className="bg-gray-200 rounded-lg h-32"></div>
                </div>
            </div>
        );
    }

    if (!data?.advanced) {
        return null;
    }

    const { urlhaus, geoBlocker, behaviorAnalyzer, threats } = data.advanced;

    const urlhausStats = [
        { label: 'Requêtes API', value: urlhaus.requests || 0 },
        { label: 'Menaces détectées', value: threats.urlhausBlocks || 0 },
        { label: 'Cache hit rate', value: urlhaus.cacheHitRate || '0%' }
    ];

    const geoBlockerStats = [
        { label: 'Requêtes analysées', value: geoBlocker.requests || 0 },
        { label: 'IPs bloquées', value: threats.geoBlocks || 0 },
        { label: 'Cache hit rate', value: geoBlocker.cacheHitRate || '0%' }
    ];

    const behaviorStats = [
        { label: 'IPs trackées', value: behaviorAnalyzer.trackedIPs || 0 },
        { label: 'Comportements suspects', value: threats.suspiciousBehavior || 0 },
        { label: 'Requêtes analysées', value: behaviorAnalyzer.totalRequests || 0 }
    ];

    // Déterminer la couleur basée sur l'activité
    const getUrlhausColor = () => {
        const malicious = threats.urlhausBlocks || 0;
        if (malicious > 10) return "danger";
        if (malicious > 0) return "warning";
        return "success";
    };

    const getGeoBlockerColor = () => {
        const blocked = threats.geoBlocks || 0;
        if (blocked > 5) return "danger";
        if (blocked > 0) return "warning";
        return "primary";
    };

    const getBehaviorColor = () => {
        const suspicious = threats.suspiciousBehavior || 0;
        if (suspicious > 10) return "danger";
        if (suspicious > 0) return "warning";
        return "success";
    };

    return (
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-text-main">🔒 Métriques de Sécurité Avancées</h3>
                <span className="text-xs text-text-subtle bg-primary/10 px-2 py-1 rounded">9.8/10</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    title="URLhaus API - Threat Intelligence"
                    icon={<ShieldIcon />}
                    stats={urlhausStats}
                    color={getUrlhausColor()}
                />

                <MetricCard
                    title="Géo-Blocking"
                    icon={<GlobeIcon />}
                    stats={geoBlockerStats}
                    color={getGeoBlockerColor()}
                />

                <MetricCard
                    title="Behavior Analyzer"
                    icon={<BotIcon />}
                    stats={behaviorStats}
                    color={getBehaviorColor()}
                />
            </div>

            {/* Section des menaces détaillées */}
            <div className="mt-4 pt-4 border-t border-border-subtle">
                <h4 className="text-sm font-semibold text-text-main mb-2">📊 Détection des Menaces</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    <div className="bg-bg-subtle p-2 rounded">
                        <div className="text-text-subtle">Domaines invalides</div>
                        <div className="font-bold text-text-main">{threats.invalidDomains || 0}</div>
                    </div>
                    <div className="bg-bg-subtle p-2 rounded">
                        <div className="text-text-subtle">DNS Tunneling</div>
                        <div className="font-bold text-text-main">{threats.dnsTunneling || 0}</div>
                    </div>
                    <div className="bg-bg-subtle p-2 rounded">
                        <div className="text-text-subtle">Rate Limit</div>
                        <div className="font-bold text-text-main">{threats.rateLimitHits || 0}</div>
                    </div>
                    <div className="bg-bg-subtle p-2 rounded">
                        <div className="text-text-subtle">URLhaus</div>
                        <div className="font-bold text-danger">{threats.urlhausBlocks || 0}</div>
                    </div>
                    <div className="bg-bg-subtle p-2 rounded">
                        <div className="text-text-subtle">Géo-bloqués</div>
                        <div className="font-bold text-warning">{threats.geoBlocks || 0}</div>
                    </div>
                    <div className="bg-bg-subtle p-2 rounded">
                        <div className="text-text-subtle">Bots/Scanning</div>
                        <div className="font-bold text-danger">{threats.suspiciousBehavior || 0}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
