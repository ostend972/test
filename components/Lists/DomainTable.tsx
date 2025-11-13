import React, { useState, useMemo } from 'react';
import { Domain } from '../../types';
import { Button } from '../ui/Button';

interface DomainTableProps {
  domains: Domain[];
  onDelete: (domain: string) => void;
  isLoading: boolean;
  isDeleting: (domain: string) => boolean;
}

const timeSince = (date: string | null): string => {
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


export const DomainTable: React.FC<DomainTableProps> = ({ domains, onDelete, isLoading, isDeleting }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredDomains = useMemo(() =>
    domains.filter(d =>
      d.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
    ), [domains, searchTerm]);

  // Calcul de la pagination
  const totalItems = filteredDomains.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDomains = filteredDomains.slice(startIndex, endIndex);

  // Réinitialiser à la page 1 quand la recherche change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
              {paginatedDomains.map((d) => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-border-color pt-4" role="navigation" aria-label="Pagination des domaines">
              <div className="text-sm text-text-subtle">
                Affichage de {startIndex + 1} à {Math.min(endIndex, totalItems)} sur {totalItems} domaines
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
      )}
    </div>
  );
};