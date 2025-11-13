import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProtectionStatusDetails } from '../../services/api';
import { Card } from '../ui/Card';
import { ProtectionLayer } from '../../types';

const StatusIcon: React.FC<{ status: ProtectionLayer['status'] }> = ({ status }) => {
    const baseClasses = "h-4 w-4 rounded-full flex-shrink-0";
    if (status === 'active') {
        return <div className={`${baseClasses} bg-success`} title="Actif"></div>;
    }
    if (status === 'inactive') {
        return <div className={`${baseClasses} bg-danger`} title="Inactif"></div>;
    }
    return <div className={`${baseClasses} bg-blue-500`} title="Configuré"></div>;
};

const ProtectionLayerItem: React.FC<{ layer: ProtectionLayer }> = ({ layer }) => (
    <div className="flex items-center space-x-4 py-2">
        <StatusIcon status={layer.status} />
        <div>
            <p className="font-semibold text-text-main">{layer.name}</p>
            <p className="text-xs text-text-subtle">{layer.description}</p>
        </div>
    </div>
);

export const ProtectionStatus: React.FC = () => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['protectionStatusDetails'],
        queryFn: getProtectionStatusDetails,
        refetchInterval: 10000, // Rafraîchir toutes les 10 secondes
    });

    return (
        <Card>
            <h3 className="text-lg font-bold mb-4">État de la Protection</h3>
            {isLoading && (
                 <div className="space-y-4 animate-pulse">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded w-full"></div>)}
                </div>
            )}
            {isError && <p className="text-danger">Erreur lors de la récupération du statut de la protection.</p>}
            {data && Array.isArray(data.layers) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {data.layers.map(layer => <ProtectionLayerItem key={layer.id} layer={layer} />)}
                </div>
            )}
        </Card>
    );
};
