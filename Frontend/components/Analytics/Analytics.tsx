
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { StatsCard } from '../ui/StatsCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

export const Analytics: React.FC = () => {
    const { t, locale } = useLanguage();
    const { showToast } = useToast();

    const { data: stats } = useQuery({
        queryKey: ['stats'],
        queryFn: () => window.electronAPI.getStats(),
    });

    const { data: weeklyData = [] } = useQuery({
        queryKey: ['dailyAnalytics'],
        queryFn: () => window.electronAPI.getDailyAnalytics(7),
        refetchInterval: 60000, // Refresh every minute
    });

    const { data: topThreats = [] } = useQuery({
        queryKey: ['topThreats'],
        queryFn: () => window.electronAPI.getTopThreats(5),
        refetchInterval: 60000, // Refresh every minute
    });

    if (!stats) return <div className="flex justify-center p-12 text-secondary font-light">{t('analytics.loading')}</div>;

    const totalRequests = stats.totalBlocked + stats.totalAllowed;
    const blockedPercentage = totalRequests > 0 ? ((stats.totalBlocked / totalRequests) * 100).toFixed(1) : '0.0';

    // Format uptime
    const hours = Math.floor(stats.uptime / 3600000);
    const minutes = Math.floor((stats.uptime % 3600000) / 60000);
    const uptimeString = `${hours}h ${minutes}m`;

    const PIE_DATA = [
        { name: t('dashboard.blocked'), value: stats.totalBlocked },
        { name: t('dashboard.allowed'), value: stats.totalAllowed },
    ];

    const handleExportCSV = () => {
        const headers = ['Domain', 'Category', 'Hits'];
        const rows = topThreats.map(item => [item.domain, item.category, item.hits]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `calmweb_threats_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(t('toasts.success_export'));
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-12 w-full">
            <header className="flex flex-col items-center justify-center mb-12 lg:mb-16 text-center px-4">
                <h1 className="text-3xl md:text-5xl font-light tracking-tight text-black mb-4 transition-colors">{t('analytics.title')}</h1>
                <p className="text-secondary text-base md:text-lg font-light transition-colors">{t('analytics.subtitle')}</p>
            </header>

            {/* Overview Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8 mb-12 lg:mb-16">
                <StatsCard
                    title={t('analytics.total_requests')}
                    value={totalRequests.toLocaleString(locale)}
                    description={t('analytics.all_time')}
                />
                <StatsCard
                    title={t('analytics.block_rate')}
                    value={`${blockedPercentage}%`}
                    description={t('analytics.intercepted')}
                />
                <StatsCard
                    title={t('analytics.uptime')}
                    value={uptimeString}
                    description={t('analytics.continuous')}
                />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12 lg:mb-16">
                {/* Weekly Volume Chart */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg md:text-xl font-normal text-black transition-colors">{t('analytics.weekly_volume')}</h2>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-xs text-secondary">
                                <div className="w-2 h-2 bg-gray-200"></div> {t('dashboard.allowed')}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-secondary">
                                <div className="w-2 h-2 bg-black"></div> {t('dashboard.blocked')}
                            </div>
                        </div>
                    </div>
                    <div className="h-[250px] md:h-[300px] w-full border border-border p-4 md:p-6 rounded-sm transition-colors">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData} barSize={32}>
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#999', fontSize: 12 }}
                                    dy={10}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e5e5',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        fontFamily: 'Inter',
                                        fontSize: '12px',
                                        color: '#000'
                                    }}
                                    itemStyle={{ color: '#000' }}
                                />
                                <Bar dataKey="allowed" stackId="a" fill={'#e5e5e5'} radius={[0, 0, 2, 2]} />
                                <Bar dataKey="blocked" stackId="a" fill={'#000000'} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Chart */}
                <div>
                    <h2 className="text-lg md:text-xl font-normal mb-6 text-black transition-colors">{t('analytics.traffic_dist')}</h2>
                    <div className="h-[250px] md:h-[300px] w-full border border-border p-4 md:p-6 rounded-sm flex items-center justify-center relative transition-colors">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={PIE_DATA}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    <Cell key="cell-blocked" fill={'#000000'} />
                                    <Cell key="cell-allowed" fill={'#e5e5e5'} />
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e5e5',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        fontFamily: 'Inter',
                                        fontSize: '12px',
                                        color: '#000'
                                    }}
                                    itemStyle={{ color: '#000' }}
                                />
                                <Legend
                                    verticalAlign="middle"
                                    layout="vertical"
                                    align="right"
                                    iconType="circle"
                                    formatter={(value) => <span className="text-sm text-secondary ml-2">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pr-24">
                            <div className="text-center">
                                <span className="text-3xl font-light text-black transition-colors">{blockedPercentage}%</span>
                                <p className="text-xs text-secondary uppercase tracking-wider mt-1 transition-colors">{t('dashboard.blocked')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Top Blocked Table */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg md:text-xl font-normal text-black transition-colors">{t('analytics.top_blocked')}</h2>
                    <button
                        onClick={handleExportCSV}
                        className="text-sm text-secondary hover:text-black transition-colors"
                    >
                        {t('analytics.export_csv')}
                    </button>
                </div>

                <div className="w-full overflow-x-auto border border-border rounded-sm transition-colors">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-border bg-subtle transition-colors">
                                <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider w-1/2">{t('analytics.table.domain')}</th>
                                <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider">{t('analytics.table.category')}</th>
                                <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider text-right">{t('analytics.table.hits')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topThreats.map((item, index) => (
                                <tr key={index} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors group bg-white">
                                    <td className="p-4 text-sm font-medium text-black group-hover:translate-x-1 transition-transform duration-300">
                                        {item.domain}
                                    </td>
                                    <td className="p-4 text-sm text-secondary">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm font-medium text-right text-secondary">
                                        {item.hits.toLocaleString(locale)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
