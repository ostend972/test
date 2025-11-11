import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardStats } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { RealtimeEvent, DashboardStats } from '../../types';
import { Card } from '../ui/Card';

const TrendIndicator: React.FC<{ trend: number }> = ({ trend }) => {
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

const StatCard: React.FC<{ title: string; value: string | number; trend?: number, description?: string, icon: React.ReactNode }> = ({ title, value, trend, description, icon }) => (
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


export const StatsCards: React.FC = () => {
    const queryClient = useQueryClient();
    const { data: stats, isLoading, isError, error } = useQuery<DashboardStats, Error>({
        queryKey: ['dashboardStats'],
        queryFn: getDashboardStats,
    });
    
    useWebSocket<RealtimeEvent>('stats_update', (event) => {
        if (event.type === 'blocked') {
            queryClient.setQueryData<DashboardStats | undefined>(['dashboardStats'], (prevStats) => {
                 if (!prevStats) return prevStats;
                return {
                    ...prevStats,
                    blockedToday: { ...prevStats.blockedToday, value: prevStats.blockedToday.value + 1 },
                    totalBlocked: prevStats.totalBlocked + 1,
                    lastThreat: {
                        domain: event.domain,
                        timestamp: event.timestamp,
                    }
                }
            });
        }
    });

    if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-lg"></div>)}
    </div>;
    
    if (isError) return <Card className="bg-danger/10 text-danger"><p>Erreur de chargement des statistiques: {error.message}</p></Card>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard 
                title="Bloqués aujourd'hui" 
                value={stats?.blockedToday.value ?? 0} 
                trend={stats?.blockedToday.trend}
                icon={<ShieldIcon />} 
            />
            <StatCard title="Total bloqués" value={stats?.totalBlocked ?? 0} icon={<BarChartIcon />} />
            <StatCard 
                title="Dernière menace" 
                value={stats?.lastThreat?.domain ?? 'Aucune'}
                description={stats?.lastThreat ? `à ${new Date(stats.lastThreat.timestamp).toLocaleTimeString('fr-FR')}` : 'Aucune menace récente'}
                icon={<ClockIcon />}
            />
        </div>
    );
};