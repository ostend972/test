import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlocklist, addBlocklistDomain, deleteBlocklistDomain, importBlocklist, exportBlocklist } from '../../services/api';
import { Domain } from '../../types';
import { Card } from '../ui/Card';
import { DomainTable } from './DomainTable';
import { Button } from '../ui/Button';

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domainName: string;
  isLoading: boolean;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, domainName, isLoading, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg p-8 m-4 max-w-md w-full shadow-xl">
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                <p className="text-text-subtle mb-6" dangerouslySetInnerHTML={{ __html: message }} />
                <div className="flex justify-end space-x-4">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annuler</Button>
                    <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>Supprimer</Button>
                </div>
            </div>
        </div>
    );
};

export const BlocklistManager: React.FC = () => {
    const queryClient = useQueryClient();
    const [newDomain, setNewDomain] = useState('');
    const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
    const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: blocklist, isLoading, isError, error } = useQuery<Domain[], Error>({
        queryKey: ['blocklist'],
        queryFn: getBlocklist,
    });

    const addMutation = useMutation({
        mutationFn: (domain: string) => addBlocklistDomain(domain),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['blocklist'] });
            setNewDomain('');
        },
        onError: (addError: Error) => {
            alert(`Erreur lors de l'ajout du domaine : ${addError.message}`);
        }
    });
    
    const deleteMutation = useMutation({
        mutationFn: deleteBlocklistDomain,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['blocklist'] });
        },
        onSettled: () => {
            setDeletingDomain(null);
        }
    });
    
    const exportMutation = useMutation({
        mutationFn: exportBlocklist,
        onError: (exportError: Error) => alert(`Erreur d'exportation: ${exportError.message}`),
    });

    const importMutation = useMutation({
        mutationFn: importBlocklist,
        onSuccess: (data) => {
            alert(data.message || 'Importation réussie');
            queryClient.invalidateQueries({ queryKey: ['blocklist'] });
        },
        onError: (importError: Error) => alert(`Erreur d'importation: ${importError.message}`),
    });

    const handleAddDomain = (e: React.FormEvent) => {
        e.preventDefault();
        if (newDomain.trim()) {
            addMutation.mutate(newDomain.trim());
        }
    };

    const handleDeleteDomain = (domain: string) => {
        setDomainToDelete(domain);
    };

    const confirmDeletion = () => {
        if (domainToDelete) {
            setDeletingDomain(domainToDelete);
            deleteMutation.mutate(domainToDelete);
        }
        setDomainToDelete(null);
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importMutation.mutate(file);
        }
    };

    return (
        <>
            <Card>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Gestion de la Liste Noire</h2>
                        <p className="text-text-subtle mt-1">Les domaines ajoutés ici seront toujours bloqués.</p>
                    </div>
                     <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={importMutation.isPending}>Importer CSV</Button>
                        <Button variant="secondary" onClick={() => exportMutation.mutate()} isLoading={exportMutation.isPending}>Exporter CSV</Button>
                    </div>
                </div>
                
                <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 my-6">
                    <div className="flex-grow w-full">
                        <label htmlFor="blocklist-domain" className="sr-only">Nouveau domaine</label>
                        <input
                            id="blocklist-domain"
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="exemple-malveillant.com"
                            className="w-full h-12 px-4 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                            aria-label="Nouveau domaine à ajouter à la liste noire"
                            disabled={addMutation.isPending}
                            required
                        />
                    </div>
                    <Button type="submit" isLoading={addMutation.isPending} className="w-full sm:w-auto">
                        Bloquer le domaine
                    </Button>
                </form>

                {isError && <p className="text-danger">Erreur de chargement: {error.message}</p>}
                
                <DomainTable
                    domains={blocklist || []}
                    onDelete={handleDeleteDomain}
                    isLoading={isLoading}
                    isDeleting={(domain) => deletingDomain === domain && deleteMutation.isPending}
                />
            </Card>
            <ConfirmationModal
                isOpen={!!domainToDelete}
                onClose={() => setDomainToDelete(null)}
                onConfirm={confirmDeletion}
                domainName={domainToDelete || ''}
                isLoading={deleteMutation.isPending && deletingDomain === domainToDelete}
                title="Confirmer la suppression"
                message={`Êtes-vous sûr de vouloir supprimer le domaine <strong>${domainToDelete}</strong> de la liste noire ?`}
            />
        </>
    );
};