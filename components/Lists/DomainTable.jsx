import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button.jsx';

const timeSince = (date) => {
    if (!date) return 'Jamais';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `Il y a ${Math.floor(interval)} ans`;
    interval = seconds / 2592000;
    if (interval > 1) return `Il y a ${Math.floor(interval)} mois`;
    interval = seconds / 86400;
    if (interval > 1) return `Il y a ${Math.floor(interval)} jours`;
    interval = seconds / 3600;
    if (interval > 1) return `Il y a ${Math.floor(interval)} heures`;
    interval = seconds / 60;
    if (interval > 1) return `Il y a ${Math.floor(interval)} minutes`;
    return `À l'instant`;
};


export const DomainTable = ({ domains, onDelete, isLoading, isDeleting }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDomains = useMemo(() =>
    domains.filter(d =>
      d.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
    ), [domains, searchTerm]);

  if (isLoading) {
    return <div className="text-center p-8">Chargement de la liste...</div>;
  }

  return (
    <div>
      <div className="p-4 border-t border-border-color">
        <input
          type="text"
          placeholder="Rechercher un domaine ou une adresse IP..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-sm h-10 px-4 border border-border-color rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
          aria-label="Filtrer les domaines"
        />
      </div>

      {domains.length === 0 ? (
        <div className="text-center p-8 text-text-subtle">Aucun domaine dans cette liste.</div>
      ) : filteredDomains.length === 0 ? (
        <div className="text-center p-8 text-text-subtle">Aucun domaine ne correspond à votre recherche.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider w-1/3">
                  Domaine
                </th>
                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider w-1/3">
                  Adresse IP
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-subtle uppercase tracking-wider">
                  Activité
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {filteredDomains.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-main">{d.domain}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-subtle font-mono">{d.ipAddress}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-subtle">
                        <div className="font-semibold">{d.hits} consultations</div>
                        <div>Dernière: {timeSince(d.lastUsed)}</div>
                   </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="danger"
                      className="h-9 px-4 text-xs"
                      onClick={() => onDelete(d.domain)}
                      isLoading={isDeleting(d.domain)}
                      aria-label={`Supprimer le domaine ${d.domain}`}
                    >
                      Supprimer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
