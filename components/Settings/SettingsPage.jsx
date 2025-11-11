import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, updateConfig, getSystemIntegrityStatus, repairSystem, forceBlocklistUpdate } from '../../services/api.js';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { ToggleSwitch } from '../ui/ToggleSwitch.jsx';
import UpdateSection from './UpdateSection.jsx';

const SystemStatusIcon = ({ status }) => {
    const statusMap = {
        active: { color: 'text-success', icon: 'M9 12l2 2 4-4m6-3a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Actif' },
        configured: { color: 'text-success', icon: 'M9 12l2 2 4-4m6-3a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Configuré' },
        not_configured: { color: 'text-warning', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Non configuré' },
        other_proxy: { color: 'text-warning', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Autre proxy' },
        inactive: { color: 'text-warning', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Inactif' },
        error: { color: 'text-danger', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Erreur' },
        unknown: { color: 'text-text-subtle', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Inconnu' },
    };
    const current = statusMap[status] || statusMap.unknown;
    return (
         <div className={`flex items-center space-x-2 ${current.color}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d={current.icon} clipRule="evenodd" />
            </svg>
            <span className="font-semibold">{current.text}</span>
        </div>
    );
};

const blocklistSourceNames = {
    'urlhaus': 'URLhaus (Malware & Phishing - abuse.ch)',
    'urlhausRecent': 'URLhaus Recent (URLs Malveillantes Actives - CSV)',
    'phishingArmy': 'Phishing Army (Sites de Phishing)',
    'hageziUltimate': 'Hagezi Ultimate (Protection Maximale)',
    'stevenBlack': 'StevenBlack/hosts (Malware, Ads)',
    'easylistFR': 'Easylist FR (Publicités Françaises)',
};

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({});

  const { data: config, isLoading, isError, error } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  });

  const { data: systemStatus, isLoading: isLoadingSystemStatus } = useQuery({
    queryKey: ['systemIntegrity'],
    queryFn: getSystemIntegrityStatus,
  });

  useEffect(() => {
    if (config) {
      setFormState(config);
    }
  }, [config]);

  const [successMessage, setSuccessMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isUpdatingBlocklists, setIsUpdatingBlocklists] = React.useState(false);
  const [updateBlocklistMessage, setUpdateBlocklistMessage] = React.useState('');

  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(['config'], updatedConfig);
      setSuccessMessage('Configuration mise à jour avec succès !');
      setErrorMessage('');
      setSaveSuccess(true);
      setTimeout(() => {
        setSuccessMessage('');
        setSaveSuccess(false);
      }, 2000);
    },
    onError: (updateError) => {
      setErrorMessage(`Erreur de mise à jour: ${updateError.message}`);
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 5000);
    },
  });

  const repairMutation = useMutation({
    mutationFn: repairSystem,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['systemIntegrity'] });

      // Construire le message détaillé
      let message = '═══════ Résultat de la Réparation ═══════\n\n';

      if (result.success) {
        message += `✓ Réparation réussie !\n`;
        message += `${result.repairedCount} composant(s) réparé(s)\n\n`;
      } else {
        message += `⚠ Réparation partielle\n`;
        message += `${result.repairedCount} composant(s) réparé(s)\n`;
        message += `${result.errorCount} erreur(s) rencontrée(s)\n\n`;
      }

      // Détails par composant
      if (result.details) {
        message += 'Détails :\n';
        if (result.details.proxy) {
          if (result.details.proxy.repaired) {
            message += '  ✓ Proxy Système : Réparé\n';
          } else if (result.details.proxy.error) {
            message += `  ✗ Proxy Système : ${result.details.proxy.error}\n`;
          } else {
            message += '  ⊘ Proxy Système : Déjà configuré\n';
          }
        }

        if (result.details.firewall) {
          if (result.details.firewall.repaired) {
            message += '  ✓ Règle Pare-feu : Réparée\n';
          } else if (result.details.firewall.error) {
            message += `  ✗ Règle Pare-feu : ${result.details.firewall.error}\n`;
          } else {
            message += '  ⊘ Règle Pare-feu : Déjà active\n';
          }
        }

        if (result.details.startupTask) {
          if (result.details.startupTask.repaired) {
            message += '  ✓ Tâche Planifiée : Réparée\n';
          } else if (result.details.startupTask.error) {
            message += `  ✗ Tâche Planifiée : ${result.details.startupTask.error}\n`;
          } else {
            message += '  ⊘ Tâche Planifiée : Déjà active\n';
          }
        }
      }

      if (result.errorCount > 0) {
        message += '\n💡 Conseil : Exécutez CalmWeb en tant qu\'administrateur pour résoudre les erreurs.';
      }

      alert(message);
    },
    onError: (repairError) => {
      alert(`Erreur critique lors de la réparation:\n${repairError.message}`);
    },
  });

  const forceUpdateMutation = useMutation({
    mutationFn: forceBlocklistUpdate,
    onSuccess: (result) => {
      if (result.success) {
        setUpdateBlocklistMessage('✓ Blocklists mises à jour avec succès !');
      } else {
        setUpdateBlocklistMessage(`⚠ Erreur: ${result.message}`);
      }
      setTimeout(() => setUpdateBlocklistMessage(''), 5000);
    },
    onError: (error) => {
      setUpdateBlocklistMessage(`✗ Erreur: ${error.message}`);
      setTimeout(() => setUpdateBlocklistMessage(''), 5000);
    },
  });

  const handleToggleChange = (key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };
  
  const handleBlocklistSourceChange = (key, value) => {
      setFormState(prev => ({
          ...prev,
          blocklistSources: {
              ...prev.blocklistSources,
              [key]: value,
          }
      }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'proxyPort' || name === 'updateInterval' ? Number(value) : value }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formState);
  };

  if (isLoading) return <Card><p>Chargement de la configuration...</p></Card>;
  if (isError) return <Card className="text-danger"><p>Erreur: {error?.message}</p></Card>;

  return (
    <div className="space-y-8">
      <Card>
        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="space-y-8 max-w-3xl mx-auto">
            <div>
              <h2 className="text-xl font-bold">Configuration Générale</h2>
              <p className="text-text-subtle mt-1">Ajustez les paramètres principaux de la protection.</p>
            </div>

            <div className="space-y-4">
               <ToggleSwitch
                  id="blockNonStandardPorts"
                  label="Bloquer les ports non standard"
                  checked={formState.blockNonStandardPorts ?? false}
                  onChange={(checked) => handleToggleChange('blockNonStandardPorts', checked)}
                />
                 <p className="text-sm text-text-subtle -mt-2 ml-4">Bloque les connexions sur les ports non standard (autres que 80 et 443).</p>
                <ToggleSwitch
                  id="blockDirectIPs"
                  label="Bloquer les adresses IP directes"
                  checked={formState.blockDirectIPs ?? false}
                  onChange={(checked) => handleToggleChange('blockDirectIPs', checked)}
                />
                <p className="text-sm text-text-subtle -mt-2 ml-4">Empêche l'accès via une adresse numérique (ex: 1.2.3.4) pour éviter les contournements.</p>
                <ToggleSwitch
                  id="blockHTTPTraffic"
                  label="Forcer HTTPS (bloquer HTTP)"
                  checked={formState.blockHTTPTraffic ?? false}
                  onChange={(checked) => handleToggleChange('blockHTTPTraffic', checked)}
                />
                <p className="text-sm text-text-subtle -mt-2 ml-4">Force l'utilisation de connexions sécurisées HTTPS en bloquant le trafic HTTP non chiffré.</p>
                 <ToggleSwitch
                  id="blockRemoteDesktop"
                  label="Bloquer TeamViewer / AnyDesk + Community Blocklist"
                  checked={formState.blockRemoteDesktop ?? false}
                  onChange={(checked) => handleToggleChange('blockRemoteDesktop', checked)}
                />
                <p className="text-sm text-text-subtle -mt-2 ml-4">Bloque les logiciels de prise de contrôle à distance (TeamViewer, AnyDesk, LogMeIn, etc.) + charge la Community Blocklist (arnaques françaises et sites malveillants FR).</p>

                <div className="border-t border-border-color my-4"></div>
                <ToggleSwitch
                  id="enableUsefulDomains"
                  label="Activer liste 'Useful Domains' (Avancé)"
                  checked={formState.enableUsefulDomains ?? false}
                  onChange={(checked) => handleToggleChange('enableUsefulDomains', checked)}
                />
                <p className="text-sm text-text-subtle -mt-2 ml-4">Ajoute des domaines techniques utiles en liste blanche. Recommandé pour les utilisateurs avancés uniquement.</p>
            </div>
            
             <div className="border-t border-border-color my-6"></div>
             <div>
                <h3 className="text-lg font-bold">Sources de Protection</h3>
                <p className="text-text-subtle mt-1">Choisissez les listes de blocage externes à utiliser.</p>
            </div>
            <div className="space-y-2">
                {formState.blocklistSources && Object.entries(formState.blocklistSources).map(([key, value]) => (
                    <ToggleSwitch 
                        key={key}
                        id={`source-${key}`}
                        label={blocklistSourceNames[key] || key}
                        checked={value}
                        onChange={(checked) => handleBlocklistSourceChange(key, checked)}
                    />
                ))}
            </div>

            <div className="mt-4 flex items-center justify-between p-4 bg-surface-light rounded-lg border border-border-color">
              <div>
                <p className="text-sm font-medium text-text-main">Forcer la mise à jour des blocklists</p>
                <p className="text-xs text-text-subtle mt-1">Télécharge immédiatement toutes les sources de blocage activées</p>
              </div>
              <Button
                onClick={() => forceUpdateMutation.mutate()}
                isLoading={forceUpdateMutation.isPending}
                variant="secondary"
                className="ml-4"
              >
                {forceUpdateMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
              </Button>
            </div>
            {updateBlocklistMessage && (
              <p className={`text-sm mt-2 ${updateBlocklistMessage.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {updateBlocklistMessage}
              </p>
            )}

            <div className="border-t border-border-color my-6"></div>
             <div>
                  <h3 className="text-lg font-bold">Paramètres avancés</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label htmlFor="updateInterval" className="block text-sm font-medium text-text-main">
                          Intervalle de mise à jour des listes
                      </label>
                      <select
                          id="updateInterval"
                          name="updateInterval"
                          value={formState.updateInterval ?? 24}
                          onChange={handleInputChange}
                          className="mt-1 block w-full h-12 px-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                          <option value={1}>Toutes les heures</option>
                          <option value={6}>Toutes les 6 heures</option>
                          <option value={12}>Toutes les 12 heures</option>
                          <option value={24}>Toutes les 24 heures</option>
                      </select>
                  </div>
                  <div>
                      <label htmlFor="proxyPort" className="block text-sm font-medium text-text-main">
                          Port du proxy
                      </label>
                      <input
                          type="number"
                          id="proxyPort"
                          name="proxyPort"
                          value={formState.proxyPort ?? 8080}
                          onChange={handleInputChange}
                          className="mt-1 block w-full h-12 px-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                          min="1024"
                          max="65535"
                      />
                  </div>
              </div>
            
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                isLoading={mutation.isPending}
                className={saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {saveSuccess ? 'Enregistré !' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-bold mb-4">Intégrité du Système</h3>
        <p className="text-text-subtle mb-6">Vérification des composants système essentiels au bon fonctionnement de CalmWeb.</p>
         {isLoadingSystemStatus && <p>Vérification en cours...</p>}
         {systemStatus && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p>Proxy Système</p>
                    <SystemStatusIcon status={systemStatus.proxy} />
                </div>
                 <div className="flex justify-between items-center">
                    <p>Règle Pare-feu Windows</p>
                    <SystemStatusIcon status={systemStatus.firewall} />
                </div>
                 <div className="flex justify-between items-center">
                    <p>Tâche planifiée au démarrage</p>
                    <SystemStatusIcon status={systemStatus.startupTask} />
                </div>
            </div>
         )}
         <div className="mt-6 text-center">
            <Button
              variant="secondary"
              onClick={() => repairMutation.mutate()}
              isLoading={repairMutation.isPending}
            >
              Tenter une réparation
            </Button>
         </div>
      </Card>

      {/* Section Mises à jour */}
      <UpdateSection />
    </div>
  );
};
