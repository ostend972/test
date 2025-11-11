
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { disableProtection } from '../../services/api';
import { Button } from '../ui/Button';

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; isLoading: boolean }> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg p-8 m-4 max-w-md w-full shadow-xl">
                <h2 className="text-xl font-bold mb-4">Confirmer la désactivation</h2>
                <p className="text-text-subtle mb-6">
                    Êtes-vous sûr de vouloir désactiver temporairement la protection ? Le système sera vulnérable aux menaces.
                </p>
                <div className="flex justify-end space-x-4">
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Annuler
                    </Button>
                    <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
                        Désactiver
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const EmergencyButton: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient();
    
    const mutation = useMutation({
        mutationFn: disableProtection,
        onSuccess: () => {
            alert('La protection a été désactivée temporairement.');
            queryClient.invalidateQueries({ queryKey: ['proxyStatus'] });
            setIsModalOpen(false);
        },
        onError: (error: Error) => {
            alert(`Erreur: ${error.message}`);
            setIsModalOpen(false);
        }
    });

    const handleConfirm = () => {
        mutation.mutate();
    };

    return (
        <>
            <Button
                variant="danger"
                onClick={() => setIsModalOpen(true)}
                aria-label="Désactiver la protection temporairement, bouton d'urgence"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Désactiver la protection
            </Button>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirm}
                isLoading={mutation.isPending}
            />
        </>
    );
};
