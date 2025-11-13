import React from 'react';
import { StatsCards } from './StatsCards.jsx';
import { RealtimeFeed } from './RealtimeFeed.jsx';
import { BlockChart } from './BlockChart.jsx';
import { TopThreats } from './TopBlockedCategories.jsx';
import { ThreatAnalysis } from './ThreatAnalysis.jsx';
import { ProtectionStatus } from './ProtectionStatus.jsx';
import { AdvancedSecurityMetrics } from './AdvancedSecurityMetrics.jsx';

export const Dashboard = () => {
    return (
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold mb-2">Vue d'ensemble de la protection</h1>
                <p className="text-sm sm:text-base text-text-subtle">Voici le résumé de l'activité et de la configuration de CalmWeb.</p>
            </div>
            <StatsCards />
            <ThreatAnalysis />
            <AdvancedSecurityMetrics />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
                    <BlockChart />
                    <ProtectionStatus />
                </div>
                <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                    <TopThreats />
                    <RealtimeFeed />
                </div>
            </div>
        </div>
    );
};
