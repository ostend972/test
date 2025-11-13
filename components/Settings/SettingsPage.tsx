import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, updateConfig, getSystemIntegrityStatus, repairSystem } from '../../services/api';
import { Config, SystemIntegrityStatus } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ToggleSwitch } from '../ui/ToggleSwitch';

const SystemStatusIcon: React.FC<{ status: 'active' | 'inactive' | 'configured' | 'error' }> = ({ status }) => {
    const statusMap = {
        active: { color: 'text-success', icon: 'M9 12l2 2 4-4m6-3a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Actif' },
        configured: { color: 'text-success', icon: 'M9 12l2 2 4-4m6-3a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Configuré' },
        inactive: { color: 'text-warning', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Inactif' },
        error: { color: 'text-danger', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Erreur' },
    };
    const current = statusMap[status];
    return (
         <div className={`flex items-center space-x-2 ${current.color}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d={current.icon} clipRule="evenodd" />
            </svg>
            <span className="font-semibold">{current.text}</span>
        </div>
    );
};

const blocklistSourceNames: Record<string, string> = {
    'stevenBlack': 'StevenBlack/hosts (Malware, Ads)',
    'easylistFR': 'Easylist FR (Publicités Françaises)',
    'hageziUltimate': 'Hagezi Ultimate (Protection Maximale)',
    'redFlagDomains': 'Red Flag Domains (Domaines Dangereux)',
};

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<Partial<Config>>({});

  const { data: config, isLoading, isError, error } = useQuery<Config, Error>({
    queryKey: ['config'],
    queryFn: getConfig,
  });

  const { data: systemStatus, isLoading: isLoadingSystemStatus } = useQuery<SystemIntegrityStatus, Error>({
    queryKey: ['systemIntegrity'],
    queryFn: getSystemIntegrityStatus,
  });

  useEffect(() => {
    if (config) {
      setFormState(config);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(['config'], updatedConfig);
      alert('Configuration mise à jour avec succès !');
    },
    onError: (updateError: Error) => {
      alert(`Erreur de mise à jour: ${updateError.message}`);
    },
  });

  const repairMutation = useMutation({
    mutationFn: repairSystem,
    onSuccess: (result: any) => {
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
    onError: (repairError: Error) => {
      alert(`Erreur critique lors de la réparation:\n${repairError.message}`);
    },
  });

  const handleToggleChange = (key: keyof Config, value: boolean) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };
  
  const handleBlocklistSourceChange = (key: string, value: boolean) => {
      setFormState(prev => ({
          ...prev,
          blocklistSources: {
              ...prev.blocklistSources,
              [key]: value,
          }
      }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'proxyPort' || name === 'updateInterval' ? Number(value) : value }));
  };

  const validatePort = (port: number | undefined): string | null => {
    if (!port) {
      return 'Le port du proxy est requis';
    }

    // Vérifier que c'est un nombre valide
    if (isNaN(port) || !Number.isInteger(port)) {
      return 'Le port doit être un nombre entier';
    }

    // Ports réservés (0-1023) interdits
    if (port < 1024) {
      return 'Le port doit être supérieur à 1023 (ports réservés)';
    }

    // Port maximum
    if (port > 65535) {
      return 'Le port doit être inférieur à 65536';
    }

    // Ports communs à éviter (pour éviter les conflits)
    const commonPorts = [3000, 3306, 5432, 5000, 8000, 8888, 9000];
    if (commonPorts.includes(port)) {
      return `Le port ${port} est couramment utilisé. Recommandé : 8080 ou 8081`;
    }

    return null; // Validation OK
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Valider le port avant soumission
    const portError = validatePort(formState.proxyPort);
    if (portError) {
      alert(`Erreur de validation:\n${portError}`);
      return;
    }

    // Valider l'intervalle de mise à jour
    if (formState.updateInterval && (formState.updateInterval < 1 || formState.updateInterval > 168)) {
      alert('L\'intervalle de mise à jour doit être entre 1 et 168 heures');
      return;
    }

    mutation.mutate(formState);
  };

  if (isLoading) return <Card><p>Chargement de la configuration...</p></Card>;
  if (isError) return <Card className="text-danger"><p>Erreur: {error?.message}</p></Card>;

  return (
    <div className="space-y-8">
      <Card>
        <form onSubmit={handleSubmit}>
          <div className="space-y-8 max-w-3xl mx-auto">
            <div>
              <h2 className="text-xl font-bold">Configuration Générale</h2>
              <p className="text-text-subtle mt-1">Ajustez les paramètres principaux de la protection.</p>
            </div>

            <div className="space-y-4">
               <ToggleSwitch
                  id="protectionEnabled"
                  label="Activer la protection CalmWeb"
                  checked={formState.protectionEnabled ?? false}
                  onChange={(checked) => handleToggleChange('protectionEnabled', checked)}
                />
                 <p className="text-sm text-text-subtle -mt-2 ml-4">Le commutateur principal pour toute l'activité du proxy.</p>
                <ToggleSwitch
                  id="blockDirectIPs"
                  label="Bloquer les adresses IP directes"
                  checked={formState.blockDirectIPs ?? false}
                  onChange={(checked) => handleToggleChange('blockDirectIPs', checked)}
                />
                <p className="text-sm text-text-subtle -mt-2 ml-4">Empêche l'accès via une adresse numérique (ex: 1.2.3.4) pour éviter les contournements.</p>
                 <ToggleSwitch
                  id="blockRemoteDesktop"
                  label="Bloquer TeamViewer / AnyDesk"
                  checked={formState.blockRemoteDesktop ?? false}
                  onChange={(checked) => handleToggleChange('blockRemoteDesktop', checked)}
                />
                <p className="text-sm text-text-subtle -mt-2 ml-4">Bloque les logiciels de prise de contrôle à distance pour prévenir les arnaques.</p>
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
              <Button type="submit" isLoading={mutation.isPending}>
                Enregistrer les modifications
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
    </div>
  );
};
