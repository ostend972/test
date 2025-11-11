import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTopBlockedDomains } from '../../services/api.js';
import { Card } from '../ui/Card.jsx';

const ThreatTypeBadge = ({ type }) => {
    const colors = {
        'Phishing': 'bg-red-100 text-red-800',
        'Malware': 'bg-purple-100 text-purple-800',
        'Adware': 'bg-orange-100 text-orange-800',
        'Scam': 'bg-pink-100 text-pink-800',
        'IP Block': 'bg-indigo-100 text-indigo-800',
        'Remote Desktop': 'bg-blue-100 text-blue-800',
        'Port Block': 'bg-gray-100 text-gray-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[type]}`}>
            {type}
        </span>
    );
};


export const TopThreats = () => {
    const { data: domains, isLoading, isError } = useQuery({
        queryKey: ['topBlockedDomains'],
        queryFn: getTopBlockedDomains,
    });

    return (
        <Card className="flex flex-col">
            <h3 className="text-lg font-bold mb-4">Top Menaces</h3>
            
            <div className="overflow-x-auto -mx-6">
                {isLoading && <div className="px-6 space-y-3 animate-pulse">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded w-full"></div>)}
                </div>}
                {isError && <p className="px-6 text-danger text-sm">Erreur de chargement des domaines.</p>}
                {domains && (
                    <table className="min-w-full">
                        <thead className="bg-gray-50/50">
                             <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Domaine</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-text-subtle uppercase tracking-wider">Bloqués</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color">
                            {domains.map((d) => (
                                <tr key={d.domain}>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        <div className="text-sm font-mono text-text-main truncate" title={d.domain}>{d.domain}</div>
                                        <div className="text-xs text-text-subtle">{d.source}</div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        <ThreatTypeBadge type={d.threatType} />
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-text-main font-bold text-center">{d.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </Card>
    );
};
