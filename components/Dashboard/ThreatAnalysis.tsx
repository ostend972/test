import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getThreatAnalysis } from '../../services/api';
import { ThreatAnalysis as ThreatAnalysisType } from '../../types';

const LightbulbIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

export const ThreatAnalysis: React.FC = () => {
    const { data, isLoading, isError } = useQuery<ThreatAnalysisType, Error>({
        queryKey: ['threatAnalysis'],
        queryFn: getThreatAnalysis,
        refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    });

    if (isLoading) {
        return (
            <div className="bg-primary/5 border border-primary/20 p-6 rounded-lg animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
        );
    }

    if (isError) {
        // En cas d'erreur, on n'affiche simplement pas le composant
        return null;
    }

    return (
        <div className="bg-primary/5 border border-primary/20 p-6 rounded-lg">
            <div className="flex items-center text-primary mb-3">
                <LightbulbIcon />
                <h3 className="text-lg font-bold ml-2">{data?.title}</h3>
            </div>
            <p className="text-text-main mb-4">{data?.summary}</p>
            <p className="text-sm font-semibold text-primary/80">{data?.recommendation}</p>
        </div>
    );
};
