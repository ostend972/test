import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWhitelist, addWhitelistDomain, deleteWhitelistDomain, importWhitelist, exportWhitelist } from '../../services/api';
import { Domain } from '../../types';
import { Card } from '../ui/Card';
import { DomainTable } from './DomainTable';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

// Domain validation regex (RFC 1035)
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
const MAX_DOMAIN_LENGTH = 253;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domainName: string;
  isLoading: boolean;
  title: string;
}> = ({ isOpen, onClose, onConfirm, domainName, isLoading, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg p-8 m-4 max-w-md w-full shadow-xl">
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                <p className="text-text-subtle mb-6">
                    Êtes-vous sûr de vouloir supprimer le domaine{' '}
                    <strong className="font-bold">{domainName}</strong> de la liste blanche ?
                </p>
                <div className="flex justify-end space-x-4">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annuler</Button>
                    <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>Supprimer</Button>
                </div>
            </div>
        </div>
    );
};


export const WhitelistManager: React.FC = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [newDomain, setNewDomain] = useState('');
    const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
    const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: whitelist, isLoading, isError, error } = useQuery<Domain[], Error>({
        queryKey: ['whitelist'],
        queryFn: getWhitelist,
    });

    const addMutation = useMutation({
        mutationFn: (domain: string) => addWhitelistDomain(domain),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whitelist'] });
            setNewDomain('');
            toast.showSuccess('Domaine ajouté à la liste blanche');
        },
        onError: (addError: Error) => {
            toast.showError(`Erreur lors de l'ajout : ${addError.message}`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteWhitelistDomain,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whitelist'] });
            toast.showSuccess('Domaine supprimé de la liste blanche');
        },
        onSettled: () => {
            setDeletingDomain(null);
        }
    });

    const exportMutation = useMutation({
        mutationFn: exportWhitelist,
        onSuccess: () => {
            toast.showSuccess('Liste exportée avec succès');
        },
        onError: (exportError: Error) => {
            toast.showError(`Erreur d'exportation: ${exportError.message}`);
        },
    });

    const importMutation = useMutation({
        mutationFn: importWhitelist,
        onSuccess: (data) => {
            toast.showSuccess(data.message || 'Importation réussie');
            queryClient.invalidateQueries({ queryKey: ['whitelist'] });
        },
        onError: (importError: Error) => {
            toast.showError(`Erreur d'importation: ${importError.message}`);
        },
    });

    const handleAddDomain = (e: React.FormEvent) => {
        e.preventDefault();
        const domain = newDomain.trim().toLowerCase();

        if (!domain) {
            toast.showWarning('Veuillez entrer un domaine');
            return;
        }

        if (domain.length > MAX_DOMAIN_LENGTH) {
            toast.showError(`Le domaine est trop long (maximum ${MAX_DOMAIN_LENGTH} caractères)`);
            return;
        }

        if (!DOMAIN_REGEX.test(domain)) {
            toast.showError('Format de domaine invalide. Exemple valide: example.com');
            return;
        }

        addMutation.mutate(domain);
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
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            toast.showError('Seuls les fichiers CSV sont acceptés');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast.showError(`Le fichier est trop volumineux (maximum ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
            return;
        }

        importMutation.mutate(file);
    };

    return (
        <>
            <Card>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Gestion de la Liste Blanche</h2>
                        <p className="text-text-subtle mt-1">Les domaines ajoutés ici seront toujours autorisés.</p>
                    </div>
                    <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={importMutation.isPending}>Importer CSV</Button>
                        <Button variant="secondary" onClick={() => exportMutation.mutate()} isLoading={exportMutation.isPending}>Exporter CSV</Button>
                    </div>
                </div>
                
                <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 my-6">
                    <div className="flex-grow w-full">
                        <label htmlFor="whitelist-domain" className="sr-only">Nouveau domaine</label>
                        <input
                            id="whitelist-domain"
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="exemple.com"
                            className="w-full h-12 px-4 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                            aria-label="Nouveau domaine à ajouter à la liste blanche"
                            disabled={addMutation.isPending}
                            required
                        />
                    </div>
                    <Button type="submit" isLoading={addMutation.isPending} className="w-full sm:w-auto">
                        Ajouter le domaine
                    </Button>
                </form>

                {isError && <p className="text-danger">Erreur de chargement: {error.message}</p>}
                
                <DomainTable
                    domains={whitelist || []}
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
            />
        </>
    );
};