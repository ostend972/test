import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { checkForUpdates, downloadUpdate, installUpdate, getUpdateInfo } from '../../services/api.js';

/**
 * ═══════════════════════════════════════════════════════════════════
 * SECTION MISES À JOUR - CALMWEB
 * ═══════════════════════════════════════════════════════════════════
 *
 * Affiche les informations de mise à jour et permet de :
 * - Vérifier manuellement les mises à jour
 * - Télécharger une mise à jour disponible
 * - Installer une mise à jour téléchargée
 * - Suivre la progression du téléchargement
 */
export default function UpdateSection() {
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded, error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Écouter les événements de mise à jour
  useEffect(() => {
    // Mise à jour disponible
    const unsubscribeAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setUpdateStatus('available');
      setUpdateInfo(info);
      console.log('Mise à jour disponible:', info);
    });

    // Pas de mise à jour
    const unsubscribeNotAvailable = window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateStatus('idle');
      setUpdateInfo(null);
      console.log('Application à jour');
    });

    // Progression du téléchargement
    const unsubscribeProgress = window.electronAPI.onUpdateDownloadProgress((progress) => {
      setUpdateStatus('downloading');
      setDownloadProgress(progress.percent);
      console.log('Progression:', progress.percent);
    });

    // Mise à jour téléchargée
    const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateStatus('downloaded');
      setUpdateInfo(info);
      console.log('Mise à jour téléchargée:', info);
    });

    // Erreur
    const unsubscribeError = window.electronAPI.onUpdateError((error) => {
      setUpdateStatus('error');
      setErrorMessage(error.message);
      console.error('Erreur mise à jour:', error);
    });

    // Nettoyage
    return () => {
      unsubscribeAvailable();
      unsubscribeNotAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
      unsubscribeError();
    };
  }, []);

  // Mutation pour vérifier les mises à jour
  const checkMutation = useMutation({
    mutationFn: checkForUpdates,
    onMutate: () => {
      setUpdateStatus('checking');
      setErrorMessage('');
    },
    onError: (error) => {
      setUpdateStatus('error');
      setErrorMessage(error.message);
    }
  });

  // Mutation pour télécharger
  const downloadMutation = useMutation({
    mutationFn: downloadUpdate,
    onMutate: () => {
      setUpdateStatus('downloading');
      setDownloadProgress(0);
    },
    onError: (error) => {
      setUpdateStatus('error');
      setErrorMessage(error.message);
    }
  });

  // Mutation pour installer
  const installMutation = useMutation({
    mutationFn: installUpdate,
    onError: (error) => {
      setUpdateStatus('error');
      setErrorMessage(error.message);
    }
  });

  const handleCheckForUpdates = () => {
    checkMutation.mutate();
  };

  const handleDownload = () => {
    downloadMutation.mutate();
  };

  const handleInstall = () => {
    if (confirm('L\'application va redémarrer pour installer la mise à jour. Continuer ?')) {
      installMutation.mutate();
    }
  };

  return (
    <Card>
      <h3 className="text-xl font-semibold mb-4">Mises à jour</h3>

      {/* État actuel */}
      <div className="mb-4">
        {updateStatus === 'idle' && (
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-xl">✓</span>
            <span>Application à jour</span>
          </div>
        )}

        {updateStatus === 'checking' && (
          <div className="flex items-center gap-2 text-blue-600">
            <span className="animate-spin">⟳</span>
            <span>Vérification des mises à jour...</span>
          </div>
        )}

        {updateStatus === 'available' && updateInfo && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
              <span className="text-xl">🔔</span>
              <span>Nouvelle version disponible: {updateInfo.version}</span>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p>Date de sortie: {new Date(updateInfo.releaseDate).toLocaleDateString('fr-FR')}</p>
              <p>Taille: ~{(updateInfo.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {updateInfo.releaseNotes && (
              <div className="mb-3 text-sm">
                <p className="font-semibold mb-1">Notes de version:</p>
                <div className="text-gray-700 whitespace-pre-line">{updateInfo.releaseNotes}</div>
              </div>
            )}
            <Button variant="primary" onClick={handleDownload}>
              Télécharger maintenant
            </Button>
          </div>
        )}

        {updateStatus === 'downloading' && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
              <span className="animate-spin">⟳</span>
              <span>Téléchargement en cours...</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-600">
              {downloadProgress.toFixed(1)}% complété
            </div>
          </div>
        )}

        {updateStatus === 'downloaded' && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
              <span className="text-xl">✓</span>
              <span>Mise à jour téléchargée et prête à installer</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              L'application redémarrera pour appliquer la mise à jour.
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleInstall}>
                Installer maintenant
              </Button>
              <Button variant="secondary" onClick={() => setUpdateStatus('idle')}>
                Installer plus tard
              </Button>
            </div>
          </div>
        )}

        {updateStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
              <span className="text-xl">✗</span>
              <span>Erreur lors de la mise à jour</span>
            </div>
            <p className="text-sm text-gray-600">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Bouton de vérification manuelle */}
      {(updateStatus === 'idle' || updateStatus === 'error') && (
        <Button
          variant="secondary"
          onClick={handleCheckForUpdates}
          isLoading={updateStatus === 'checking'}
        >
          Vérifier les mises à jour
        </Button>
      )}

      {/* Informations */}
      <div className="mt-4 text-sm text-gray-500">
        <p>• Les mises à jour sont vérifiées automatiquement toutes les 24 heures</p>
        <p>• Utilise le système de mise à jour différentielle pour économiser la bande passante</p>
      </div>
    </Card>
  );
}
