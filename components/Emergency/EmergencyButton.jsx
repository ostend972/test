import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { updateConfig, getConfig } from '../../services/api.js';
import { Button } from '../ui/Button.jsx';

const Modal = ({ isOpen, onClose, onConfirm, isLoading, isEnabled }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg p-8 m-4 max-w-md w-full shadow-xl">
                <h2 className="text-xl font-bold mb-4">
                    {isEnabled ? 'Confirmer la désactivation' : 'Confirmer l\'activation'}
                </h2>
                <p className="text-text-subtle mb-6">
                    {isEnabled
                        ? 'Êtes-vous sûr de vouloir désactiver temporairement la protection ? Le système sera vulnérable aux menaces.'
                        : 'Êtes-vous sûr de vouloir activer la protection ? Cela va filtrer tout le trafic web.'
                    }
                </p>
                <div className="flex justify-end space-x-4">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Annuler
                    </Button>
                    <Button variant={isEnabled ? "danger" : "primary"} onClick={onConfirm} isLoading={isLoading}>
                        {isEnabled ? 'Désactiver' : 'Activer'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const EmergencyButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: config } = useQuery({
        queryKey: ['config'],
        queryFn: getConfig,
    });

    const isProtectionEnabled = config?.protectionEnabled ?? true;

    const mutation = useMutation({
        mutationFn: (newStatus) => updateConfig({ protectionEnabled: newStatus }),
        onSuccess: (_, newStatus) => {
            alert(newStatus
                ? 'La protection a été activée avec succès.'
                : 'La protection a été désactivée temporairement.'
            );
            queryClient.invalidateQueries({ queryKey: ['config'] });
            queryClient.invalidateQueries({ queryKey: ['proxyStatus'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            setIsModalOpen(false);
        },
        onError: (error) => {
            alert(`Erreur: ${error.message}`);
            setIsModalOpen(false);
        }
    });

    const handleConfirm = () => {
        mutation.mutate(!isProtectionEnabled);
    };

    return (
        <>
            <Button
                variant={isProtectionEnabled ? "danger" : "primary"}
                onClick={() => setIsModalOpen(true)}
                aria-label={isProtectionEnabled ? "Désactiver la protection temporairement" : "Activer la protection"}
            >
                {isProtectionEnabled ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Désactiver la protection
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Activer la protection
                    </>
                )}
            </Button>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirm}
                isLoading={mutation.isPending}
                isEnabled={isProtectionEnabled}
            />
        </>
    );
};
