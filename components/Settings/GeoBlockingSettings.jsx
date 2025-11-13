import React, { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { ToggleSwitch } from '../ui/ToggleSwitch.jsx';

// Liste complète des codes pays ISO 3166-1 alpha-2
const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albanie' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'AS', name: 'Samoa américaines' },
  { code: 'AD', name: 'Andorre' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua-et-Barbuda' },
  { code: 'AR', name: 'Argentine' },
  { code: 'AM', name: 'Arménie' },
  { code: 'AU', name: 'Australie' },
  { code: 'AT', name: 'Autriche' },
  { code: 'AZ', name: 'Azerbaïdjan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahreïn' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbade' },
  { code: 'BY', name: 'Biélorussie' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'BT', name: 'Bhoutan' },
  { code: 'BO', name: 'Bolivie' },
  { code: 'BA', name: 'Bosnie-Herzégovine' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brésil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodge' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cap-Vert' },
  { code: 'CF', name: 'République centrafricaine' },
  { code: 'TD', name: 'Tchad' },
  { code: 'CL', name: 'Chili' },
  { code: 'CN', name: 'Chine' },
  { code: 'CO', name: 'Colombie' },
  { code: 'KM', name: 'Comores' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (RDC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Côte d\'Ivoire' },
  { code: 'HR', name: 'Croatie' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Chypre' },
  { code: 'CZ', name: 'République tchèque' },
  { code: 'DK', name: 'Danemark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominique' },
  { code: 'DO', name: 'République dominicaine' },
  { code: 'EC', name: 'Équateur' },
  { code: 'EG', name: 'Égypte' },
  { code: 'SV', name: 'Salvador' },
  { code: 'GQ', name: 'Guinée équatoriale' },
  { code: 'ER', name: 'Érythrée' },
  { code: 'EE', name: 'Estonie' },
  { code: 'ET', name: 'Éthiopie' },
  { code: 'FJ', name: 'Fidji' },
  { code: 'FI', name: 'Finlande' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambie' },
  { code: 'GE', name: 'Géorgie' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Grèce' },
  { code: 'GD', name: 'Grenade' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinée' },
  { code: 'GW', name: 'Guinée-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haïti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IS', name: 'Islande' },
  { code: 'IN', name: 'Inde' },
  { code: 'ID', name: 'Indonésie' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Irak' },
  { code: 'IE', name: 'Irlande' },
  { code: 'IL', name: 'Israël' },
  { code: 'IT', name: 'Italie' },
  { code: 'JM', name: 'Jamaïque' },
  { code: 'JP', name: 'Japon' },
  { code: 'JO', name: 'Jordanie' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'Corée du Nord' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'KW', name: 'Koweït' },
  { code: 'KG', name: 'Kirghizistan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LB', name: 'Liban' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Libéria' },
  { code: 'LY', name: 'Libye' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MK', name: 'Macédoine du Nord' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaisie' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malte' },
  { code: 'MH', name: 'Îles Marshall' },
  { code: 'MR', name: 'Mauritanie' },
  { code: 'MU', name: 'Maurice' },
  { code: 'MX', name: 'Mexique' },
  { code: 'FM', name: 'Micronésie' },
  { code: 'MD', name: 'Moldavie' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolie' },
  { code: 'ME', name: 'Monténégro' },
  { code: 'MA', name: 'Maroc' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibie' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Népal' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigéria' },
  { code: 'NO', name: 'Norvège' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palaos' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papouasie-Nouvelle-Guinée' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Pérou' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'RU', name: 'Russie' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint-Kitts-et-Nevis' },
  { code: 'LC', name: 'Sainte-Lucie' },
  { code: 'VC', name: 'Saint-Vincent-et-les-Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'Saint-Marin' },
  { code: 'ST', name: 'Sao Tomé-et-Principe' },
  { code: 'SA', name: 'Arabie saoudite' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'RS', name: 'Serbie' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapour' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SB', name: 'Îles Salomon' },
  { code: 'SO', name: 'Somalie' },
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'SS', name: 'Soudan du Sud' },
  { code: 'ES', name: 'Espagne' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Soudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'SE', name: 'Suède' },
  { code: 'CH', name: 'Suisse' },
  { code: 'SY', name: 'Syrie' },
  { code: 'TW', name: 'Taïwan' },
  { code: 'TJ', name: 'Tadjikistan' },
  { code: 'TZ', name: 'Tanzanie' },
  { code: 'TH', name: 'Thaïlande' },
  { code: 'TL', name: 'Timor oriental' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinité-et-Tobago' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'TR', name: 'Turquie' },
  { code: 'TM', name: 'Turkménistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Ouganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'US', name: 'États-Unis' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Ouzbékistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yémen' },
  { code: 'ZM', name: 'Zambie' },
  { code: 'ZW', name: 'Zimbabwe' },
];

export const GeoBlockingSettings = ({ formState, handleToggleChange, setFormState }) => {
  const [selectedCountry, setSelectedCountry] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const blockedCountries = formState.geoBlockedCountries || [];
  const isGeoBlockingEnabled = formState.enableGeoBlocking ?? false;

  // Filtrer les pays déjà bloqués de la liste de sélection
  const availableCountries = COUNTRIES.filter(
    (country) => !blockedCountries.includes(country.code)
  );

  // Filtrer les pays en fonction de la recherche
  const filteredCountries = availableCountries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCountry = () => {
    if (selectedCountry && !blockedCountries.includes(selectedCountry)) {
      setFormState((prev) => ({
        ...prev,
        geoBlockedCountries: [...blockedCountries, selectedCountry].sort(),
      }));
      setSelectedCountry('');
      setSearchTerm('');
    }
  };

  const handleRemoveCountry = (countryCode) => {
    setFormState((prev) => ({
      ...prev,
      geoBlockedCountries: blockedCountries.filter((code) => code !== countryCode),
    }));
  };

  const getCountryName = (code) => {
    const country = COUNTRIES.find((c) => c.code === code);
    return country ? country.name : code;
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Géo-Blocking (Filtrage géographique)</h2>
      <p className="text-text-subtle mb-4">
        Bloquez les connexions en provenance de pays spécifiques. Les IPs locales (127.x.x.x, 192.168.x.x) ne sont jamais bloquées.
      </p>

      <ToggleSwitch
        id="enableGeoBlocking"
        label="Activer le Géo-Blocking"
        checked={isGeoBlockingEnabled}
        onChange={(checked) => handleToggleChange('enableGeoBlocking', checked)}
      />
      <p className="text-sm text-text-subtle mb-6 ml-4">
        Active le filtrage géographique avec cache 24h (hit rate &gt; 90%).
      </p>

      {isGeoBlockingEnabled && (
        <div className="space-y-4">
          {/* Sélection de pays */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="font-semibold mb-3">Ajouter un pays</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Rechercher un pays..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searchTerm && filteredCountries.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-border-subtle rounded-lg bg-bg-card">
                    {filteredCountries.slice(0, 10).map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country.code);
                          setSearchTerm(country.name);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-bg-hover transition-colors"
                      >
                        <span className="font-mono text-xs text-text-subtle mr-2">{country.code}</span>
                        <span>{country.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={handleAddCountry}
                disabled={!selectedCountry}
                className="px-4 py-2"
              >
                Ajouter
              </Button>
            </div>
          </div>

          {/* Liste des pays bloqués */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="font-semibold mb-3">
              Pays bloqués ({blockedCountries.length})
            </h3>
            {blockedCountries.length === 0 ? (
              <p className="text-text-subtle text-sm italic">
                Aucun pays bloqué. Ajoutez des pays pour activer le filtrage géographique.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {blockedCountries.map((code) => (
                  <div
                    key={code}
                    className="flex items-center justify-between p-3 border border-border-subtle rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-text-subtle bg-bg-subtle px-2 py-1 rounded">
                        {code}
                      </span>
                      <span className="font-medium">{getCountryName(code)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(code)}
                      className="text-danger hover:text-danger-dark transition-colors px-2 py-1"
                      title="Retirer ce pays"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statistiques */}
          {blockedCountries.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>ℹ Info:</strong> Le Géo-Blocking utilise un cache de 24h pour optimiser les performances.
                Les statistiques de blocage sont visibles dans le Dashboard Enterprise.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
