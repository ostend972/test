import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLogs, exportLogs, generateDiagnosticReport, getSecurityEvents, addWhitelistDomain, addBlocklistDomain, deleteWhitelistDomain, deleteBlocklistDomain, getWhitelist, getBlocklist } from '../../services/api';
import { Log, LogLevel, SecurityEvent, BlockReason } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

type LogTab = 'security' | 'technical';

const LogLevelBadge: React.FC<{ level: LogLevel }> = ({ level }) => {
    const colors = {
        INFO: 'bg-blue-100 text-blue-800',
        WARNING: 'bg-yellow-100 text-yellow-800',
        ERROR: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[level]}`}>
            {level}
        </span>
    );
};

const blockReasons: BlockReason[] = ['Phishing', 'Malware', 'Adware', 'Scam', 'IP Block', 'Remote Desktop', 'Port Block'];
const sources = ['Red Flag Domains', 'Hagezi Ultimate', 'Easylist FR', 'StevenBlack/hosts', 'PhishTank', 'Règle Système'];

const TechnicalLogs: React.FC = () => {
    const [filters, setFilters] = useState<{ level?: LogLevel }>({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const { data: logs, isLoading, isError, error } = useQuery<Log[], Error>({
        queryKey: ['logs', filters],
        queryFn: () => getLogs(filters),
    });

    // Calcul de la pagination
    const safeLogs = Array.isArray(logs) ? logs : [];
    const totalItems = safeLogs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedLogs = safeLogs.slice(startIndex, endIndex);

    // Réinitialiser à la page 1 quand les filtres changent
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    return (
        <div>
            <div className="p-4 bg-gray-50 rounded-lg mb-6 flex items-center gap-4 border border-border-color">
                <label htmlFor="level-filter" className="font-medium text-sm">Filtrer par niveau:</label>
                <select
                    id="level-filter"
                    value={filters.level || ''}
                    onChange={(e) => setFilters({ ...filters, level: e.target.value as LogLevel || undefined })}
                    className="h-10 px-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                >
                    <option value="">Tous les niveaux</option>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Error</option>
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Date & Heure</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Niveau</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Message</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                        {isLoading && <tr><td colSpan={3} className="text-center p-8 text-text-subtle">Chargement...</td></tr>}
                        {isError && <tr><td colSpan={3} className="text-center p-8 text-danger">Erreur: {error.message}</td></tr>}
                        {paginatedLogs.map((log) => (
                            <tr key={log.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-subtle font-mono">{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><LogLevelBadge level={log.level} /></td>
                                <td className="px-6 py-4 text-sm text-text-main font-mono">{log.message}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-border-color pt-4" role="navigation" aria-label="Pagination des logs techniques">
                    <div className="text-sm text-text-subtle">
                        Affichage de {startIndex + 1} à {Math.min(endIndex, totalItems)} sur {totalItems} entrées
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-color rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label="Page précédente"
                        >
                            Précédent
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-text-main" aria-current="page">
                            Page {currentPage} sur {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-color rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label="Page suivante"
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


const SecurityHistory: React.FC = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ reason?: BlockReason, source?: string, type?: 'blocked' | 'allowed' }>({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Rafraîchissement automatique toutes les 5 secondes
    const { data: events, isLoading, isError, error } = useQuery<SecurityEvent[], Error>({
        queryKey: ['securityEvents'],
        queryFn: getSecurityEvents,
        refetchInterval: 5000,
    });

    // Charger la whitelist et la blocklist
    const { data: whitelist = [] } = useQuery({
        queryKey: ['whitelist'],
        queryFn: getWhitelist,
    });

    const { data: blocklist = [] } = useQuery({
        queryKey: ['blocklist'],
        queryFn: getBlocklist,
    });

    // Optimisation: Créer des Sets pour lookup rapide en O(1)
    const whitelistDomains = useMemo(() =>
        new Set(Array.isArray(whitelist) ? whitelist.map(d => d.domain) : []),
        [whitelist]
    );

    const blocklistDomains = useMemo(() =>
        new Set(Array.isArray(blocklist) ? blocklist.map(d => d.domain) : []),
        [blocklist]
    );

    const addWhitelistMutation = useMutation({
        mutationFn: (domain: string) => addWhitelistDomain(domain),
        onSuccess: () => {
            toast.showSuccess('Domaine ajouté à la liste blanche');
            queryClient.invalidateQueries({ queryKey: ['whitelist'] });
        },
        onError: (e: Error) => toast.showError(e.message)
    });

    const removeWhitelistMutation = useMutation({
        mutationFn: (domain: string) => deleteWhitelistDomain(domain),
        onSuccess: () => {
            toast.showSuccess('Domaine retiré de la liste blanche');
            queryClient.invalidateQueries({ queryKey: ['whitelist'] });
        },
        onError: (e: Error) => toast.showError(e.message)
    });

    const addBlocklistMutation = useMutation({
        mutationFn: (domain: string) => addBlocklistDomain(domain),
        onSuccess: () => {
            toast.showSuccess('Domaine ajouté à la liste noire');
            queryClient.invalidateQueries({ queryKey: ['blocklist'] });
        },
        onError: (e: Error) => toast.showError(e.message)
    });

    const removeBlocklistMutation = useMutation({
        mutationFn: (domain: string) => deleteBlocklistDomain(domain),
        onSuccess: () => {
            toast.showSuccess('Domaine retiré de la liste noire');
            queryClient.invalidateQueries({ queryKey: ['blocklist'] });
        },
        onError: (e: Error) => toast.showError(e.message)
    });

    const filteredEvents = useMemo(() => {
        if (!Array.isArray(events)) return [];
        return events.filter(event => {
            const searchMatch = event.domain.toLowerCase().includes(searchTerm.toLowerCase());
            const reasonMatch = !filters.reason || event.reason === filters.reason;
            const sourceMatch = !filters.source || event.source === filters.source;
            const typeMatch = !filters.type || event.type === filters.type;
            return searchMatch && reasonMatch && sourceMatch && typeMatch;
        });
    }, [events, searchTerm, filters]);

    // Calcul de la pagination
    const totalItems = filteredEvents.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

    // Réinitialiser à la page 1 quand les filtres ou la recherche changent
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filters]);

    return (
        <div>
            <div className="p-4 bg-gray-50 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border border-border-color">
                <input
                    type="text"
                    placeholder="Rechercher un domaine..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-10 px-4 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <select
                    value={filters.type || ''}
                    onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as 'blocked' | 'allowed' | undefined }))}
                    className="h-10 px-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                >
                    <option value="">Tous les types</option>
                    <option value="blocked">Bloqués</option>
                    <option value="allowed">Autorisés</option>
                </select>
                 <select
                    value={filters.reason || ''}
                    onChange={(e) => setFilters(f => ({ ...f, reason: e.target.value as BlockReason | undefined }))}
                    className="h-10 px-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                >
                    <option value="">Toutes les raisons</option>
                    {blockReasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                    value={filters.source || ''}
                    onChange={(e) => setFilters(f => ({ ...f, source: e.target.value || undefined }))}
                    className="h-10 px-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                >
                    <option value="">Toutes les sources</option>
                    {sources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Date & Heure</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Domaine</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">Détails</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-text-subtle uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                        {isLoading && <tr><td colSpan={5} className="text-center p-8">Chargement...</td></tr>}
                        {isError && <tr><td colSpan={5} className="text-center p-8 text-danger">{error.message}</td></tr>}
                        {paginatedEvents.map(event => (
                            <tr key={event.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-subtle font-mono">{new Date(event.timestamp).toLocaleString('fr-FR')}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${event.type === 'blocked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{event.type}</span>
                                </td>
                                <td className="px-6 py-4 font-mono text-sm">{event.domain}</td>
                                <td className="px-6 py-4 text-sm">
                                    {event.reason && <div className="font-semibold">{event.reason}</div>}
                                    {event.source && <div className="text-text-subtle">{event.source}</div>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {event.type === 'blocked' && (() => {
                                        const isInWhitelist = whitelistDomains.has(event.domain);
                                        return isInWhitelist ? (
                                            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => removeWhitelistMutation.mutate(event.domain)}>
                                                Retirer de la liste blanche
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => addWhitelistMutation.mutate(event.domain)}>
                                                Ajouter à la liste blanche
                                            </Button>
                                        );
                                    })()}
                                    {event.type === 'allowed' && (() => {
                                        const isInBlocklist = blocklistDomains.has(event.domain);
                                        return isInBlocklist ? (
                                            <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => removeBlocklistMutation.mutate(event.domain)}>
                                                Retirer de la liste noire
                                            </Button>
                                        ) : (
                                            <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => addBlocklistMutation.mutate(event.domain)}>
                                                Ajouter à la liste noire
                                            </Button>
                                        );
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-border-color pt-4" role="navigation" aria-label="Pagination de l'historique de sécurité">
                    <div className="text-sm text-text-subtle">
                        Affichage de {startIndex + 1} à {Math.min(endIndex, totalItems)} sur {totalItems} événements
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-color rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label="Page précédente"
                        >
                            Précédent
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-text-main" aria-current="page">
                            Page {currentPage} sur {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-color rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label="Page suivante"
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const LogPage: React.FC = () => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<LogTab>('security');

    const exportMutation = useMutation({
        mutationFn: exportLogs,
        onSuccess: () => {
            toast.showSuccess('Logs exportés avec succès');
        },
        onError: (err: Error) => toast.showError(`Erreur d'exportation: ${err.message}`)
    });

    const diagnosticMutation = useMutation({
        mutationFn: generateDiagnosticReport,
        onSuccess: () => {
            toast.showSuccess('Rapport de diagnostic généré avec succès');
        },
        onError: (err: Error) => toast.showError(`Erreur de génération du rapport: ${err.message}`)
    });

    return (
        <Card>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold">Journaux d'Activité</h2>
                    <p className="text-text-subtle mt-1">Consultez l'activité et les logs système pour le diagnostic.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => diagnosticMutation.mutate()} isLoading={diagnosticMutation.isPending}>Générer un diagnostic</Button>
                    <Button variant="secondary" onClick={() => exportMutation.mutate()} isLoading={exportMutation.isPending}>Exporter les logs techniques</Button>
                </div>
            </div>

            <div className="border-b border-border-color mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'security' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-gray-300'}`}
                    >
                        Historique de Sécurité
                    </button>
                    <button
                        onClick={() => setActiveTab('technical')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'technical' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-gray-300'}`}
                    >
                        Logs Techniques
                    </button>
                </nav>
            </div>
            
            {activeTab === 'security' ? <SecurityHistory /> : <TechnicalLogs />}

        </Card>
    );
};