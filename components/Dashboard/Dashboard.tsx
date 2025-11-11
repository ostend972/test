import React from 'react';
import { StatsCards } from './StatsCards';
import { RealtimeFeed } from './RealtimeFeed';
import { BlockChart } from './BlockChart';
import { TopThreats } from './TopBlockedCategories';
import { ThreatAnalysis } from './ThreatAnalysis';
import { ProtectionStatus } from './ProtectionStatus';

export const Dashboard: React.FC = () => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold mb-2">Vue d'ensemble de la protection</h1>
                <p className="text-text-subtle">Voici le résumé de l'activité et de la configuration de CalmWeb.</p>
            </div>
            <StatsCards />
            <ThreatAnalysis />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <BlockChart />
                    <ProtectionStatus />
                </div>
                <div className="space-y-8">
                    <TopThreats />
                    <RealtimeFeed />
                </div>
            </div>
        </div>
    );
};
