import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardStats } from '../../services/api.js';
import { useWebSocket } from '../../hooks/useWebSocket.js';
import { Card } from '../ui/Card.jsx';

const TrendIndicator = ({ trend }) => {
    const isUp = trend > 0;
    const isDown = trend < 0;
    const color = isUp ? 'text-danger' : isDown ? 'text-success' : 'text-text-subtle';
    const icon = isUp ? '▲' : '▼';

    if (trend === 0) return null;

    return (
        <span className={`text-xs font-bold flex items-center ${color}`}>
            {icon} {Math.abs(trend)}%
        </span>
    );
};

const StatCard = ({ title, value, trend, description, icon }) => (
  <Card>
    <div className="flex items-start justify-between">
        <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
                {icon}
            </div>
            <div className="ml-4">
                <p className="text-sm font-medium text-text-subtle">{title}</p>
                <p className="text-2xl font-bold text-text-main">{value}</p>
            </div>
        </div>
        {typeof trend !== 'undefined' && <TrendIndicator trend={trend} />}
    </div>
    {description && <p className="text-xs text-text-subtle mt-2 truncate" title={description}>{description}</p>}
  </Card>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a11.955 11.955 0 018.618-3.04 12.02 12.02 0 008.618-12.944z" />
    </svg>
);

const BarChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
);

const DatabaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
);


export const StatsCards = () => {
    const queryClient = useQueryClient();
    const { data: stats, isLoading, isError, error } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: getDashboardStats,
        staleTime: 10000, // Les données restent fraîches pendant 10 secondes
        refetchOnWindowFocus: true // Rafraîchir quand on revient sur la fenêtre
    });
    
    // WebSocket temps réel pour mises à jour instantanées
    useWebSocket('stats_update', (updatedStats) => {
        queryClient.setQueryData(['dashboardStats'], (prevStats) => {
            if (!prevStats) return prevStats;

            // Si c'est un événement de blocage individuel
            if (updatedStats.type === 'blocked') {
                return {
                    ...prevStats,
                    blockedToday: {
                        ...prevStats.blockedToday,
                        value: prevStats.blockedToday.value + 1
                    },
                    totalBlocked: prevStats.totalBlocked + 1,
                    lastThreat: {
                        domain: updatedStats.domain,
                        timestamp: updatedStats.timestamp,
                    }
                };
            }

            // Sinon, c'est une mise à jour complète des stats
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

    if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-lg"></div>)}
    </div>;

    if (isError) return <Card className="bg-danger/10 text-danger"><p>Erreur de chargement des statistiques: {error.message}</p></Card>;

    const advanced = stats?.advanced || {};
    const threats = advanced.threats || {};
    const urlhaus = advanced.urlhaus || {};
    const geoBlocker = advanced.geoBlocker || {};
    const behaviorAnalyzer = advanced.behaviorAnalyzer || {};

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Stats de base */}
            <StatCard
                title="Bloqués aujourd'hui"
                value={stats?.blockedToday.value ?? 0}
                trend={stats?.blockedToday.trend}
                icon={<ShieldIcon />}
            />
            <StatCard
                title="Total bloqués"
                value={stats?.totalBlocked ?? 0}
                icon={<BarChartIcon />}
            />
            <StatCard
                title="Dernière menace"
                value={stats?.lastThreat?.domain ?? 'Aucune'}
                description={stats?.lastThreat ? `à ${new Date(stats.lastThreat.timestamp).toLocaleTimeString('fr-FR')}` : 'Aucune menace récente'}
                icon={<ClockIcon />}
            />

            {/* Stats avancées (9.8/10) */}
            <StatCard
                title="URLhaus - Menaces détectées"
                value={threats.urlhausBlocks ?? 0}
                description={`${urlhaus.requests ?? 0} requêtes API • Cache: ${urlhaus.cacheHitRate ?? '0%'}`}
                icon={<DatabaseIcon />}
            />
            <StatCard
                title="Géo-Blocking - IPs bloquées"
                value={threats.geoBlocks ?? 0}
                description={`${geoBlocker.requests ?? 0} vérifications • Cache: ${geoBlocker.cacheHitRate ?? '0%'}`}
                icon={<GlobeIcon />}
            />
            <StatCard
                title="Bots & Scanning détectés"
                value={threats.suspiciousBehavior ?? 0}
                description={`${behaviorAnalyzer.trackedIPs ?? 0} IPs trackées • ${behaviorAnalyzer.totalRequests ?? 0} requêtes`}
                icon={<BotIcon />}
            />
        </div>
    );
};
