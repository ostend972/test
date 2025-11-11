import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProxyStatus } from '../../services/api.js';

export const StatusIndicator = () => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['proxyStatus'],
        queryFn: getProxyStatus,
        refetchInterval: 5000, // Poll every 5 seconds
    });

    const status = data?.status ?? 'inactive';
    const text = status === 'active' ? 'Protection Active' : 'Protection Inactive';
    const color = status === 'active' ? 'bg-success' : 'bg-danger';

    if (isLoading) {
        return <div className="text-text-subtle">Vérification du statut...</div>;
    }

    if(isError) {
        return <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
            </span>
            <span className="font-semibold text-warning">Erreur de connexion</span>
        </div>
    }

    return (
        <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
                {status === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`}></span>
            </span>
            <span className="font-semibold">{text}</span>
        </div>
    );
};
