
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { StatsCard } from '../ui/StatsCard';
import { DomainEvent } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { PauseModal } from '../ui/PauseModal';

export const NewDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [recentEvents, setRecentEvents] = useState<DomainEvent[]>([]);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const { t, locale } = useLanguage();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => window.electronAPI.getStats(),
    refetchInterval: 2000,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ['hourlyAnalytics'],
    queryFn: () => window.electronAPI.getHourlyAnalytics(13),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: proxyStatus } = useQuery({
    queryKey: ['proxyStatus'],
    queryFn: () => window.electronAPI.getProxyStatus(),
    refetchInterval: 2000,
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => window.electronAPI.getConfig(),
  });

  const stopProxyMutation = useMutation({
    mutationFn: async (duration: number) => {
      await window.electronAPI.stopProxy(duration);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setIsPauseModalOpen(false);
    },
  });

  const startProxyMutation = useMutation({
    mutationFn: async () => {
      await window.electronAPI.startProxy();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handlePauseClick = () => {
    setIsPauseModalOpen(true);
  };

  const handleResumeClick = () => {
    startProxyMutation.mutate();
  };

  useEffect(() => {
    window.electronAPI.onDomainEvent((event) => {
      setRecentEvents((prev) => [event, ...prev].slice(0, 8));
      // Chart data is auto-refreshed from API every minute
    });
  }, []);

  if (statsLoading || !stats || !proxyStatus) return null;

  const isActive = proxyStatus.status === 'active';

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Centered Header */}
      <header className="flex flex-col items-center justify-center mb-12 lg:mb-16 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-light tracking-tight text-black mb-4 transition-colors">{t('dashboard.title')}</h1>
        <p className="text-secondary text-base md:text-lg font-light mb-8 transition-colors">{t('dashboard.subtitle')}</p>

        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase ${isActive ? 'bg-black text-white' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-red-500'}`} />
              {isActive ? t('dashboard.active') : t('dashboard.inactive')}
            </div>
            {isActive ? (
              <button
                onClick={handlePauseClick}
                className="text-sm text-black underline decoration-1 underline-offset-4 hover:text-gray-600 transition-colors"
              >
                {t('dashboard.pause')}
              </button>
            ) : (
              <button
                onClick={handleResumeClick}
                className="text-sm text-black underline decoration-1 underline-offset-4 hover:text-gray-600 transition-colors"
              >
                {t('dashboard.resume')}
              </button>
            )}
          </div>

          {/* Security Policy Status */}
          {config && (
            <div className="flex flex-wrap justify-center gap-4 text-xs text-secondary">
              <span className={`flex items-center gap-1 ${config.blockNonStandardPorts ? 'text-black' : 'text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.blockNonStandardPorts ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                Ports
              </span>
              <span className={`flex items-center gap-1 ${config.blockNumericIPs ? 'text-black' : 'text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.blockNumericIPs ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                IPs
              </span>
              <span className={`flex items-center gap-1 ${config.forceHTTPS ? 'text-black' : 'text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.forceHTTPS ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                HTTPS
              </span>
            </div>
          )}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8 mb-12 lg:mb-16">
        <StatsCard
          title={t('dashboard.threats_blocked')}
          value={stats.blockedToday.toLocaleString(locale)}
          description={t('dashboard.today_activity')}
        />
        <StatsCard
          title={t('dashboard.safe_requests')}
          value={stats.allowedToday.toLocaleString(locale)}
          description={t('dashboard.today_activity')}
        />
        <StatsCard
          title={t('dashboard.active_rules')}
          value={stats.blocklistSize.toLocaleString(locale)}
          description={t('dashboard.total_signatures')}
        />
        <StatsCard
          title={t('dashboard.whitelist_count')}
          value={stats.whitelistSize.toLocaleString(locale)}
          description={t('dashboard.custom_exceptions')}
        />
      </section>

      {/* Visualizations */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Main Chart */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg md:text-xl font-normal text-black transition-colors">{t('dashboard.traffic_volume')}</h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs text-secondary">
                <div className="w-2 h-2 bg-black"></div> {t('dashboard.allowed')}
              </div>
              <div className="flex items-center gap-2 text-xs text-secondary">
                <div className="w-2 h-2 bg-gray-300"></div> {t('dashboard.blocked')}
              </div>
            </div>
          </div>

          <div className="h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={'#000000'} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={'#000000'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#999', fontSize: 12 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontFamily: 'Inter',
                    color: '#000'
                  }}
                  itemStyle={{ fontSize: '12px', color: '#000' }}
                />
                <Area
                  type="monotone"
                  dataKey="allowed"
                  stroke={'#000000'}
                  strokeWidth={1.5}
                  fill="url(#colorAllowed)"
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  stroke={'#cccccc'}
                  strokeWidth={1.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-1">
          <h2 className="text-lg md:text-xl font-normal mb-8 text-black transition-colors">{t('dashboard.recent_activity')}</h2>
          <div className="space-y-6 relative">
            {/* Subtle timeline line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-gray-100"></div>

            {recentEvents.length === 0 ? (
              <p className="text-secondary text-sm font-light italic">{t('dashboard.waiting')}</p>
            ) : (
              recentEvents.map((event, idx) => (
                <div key={idx} className="flex gap-4 items-start relative">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 z-10 border-2 border-white shrink-0 ${event.type === 'blocked' ? 'bg-black' : 'bg-gray-300'
                    }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-black">{event.domain}</p>
                    <p className="text-xs text-secondary mt-0.5">
                      {event.type === 'blocked' ? t('dashboard.blocked') : t('dashboard.allowed')} • {new Date(event.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <PauseModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
        onPause={(duration) => stopProxyMutation.mutate(duration)}
      />
    </div>
  );
};
