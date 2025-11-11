import React, { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { RealtimeEvent, BlockReason } from '../../types';
import { Card } from '../ui/Card';

const iconMap: Record<BlockReason, React.ReactNode> = {
    'Phishing': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>,
    'Malware': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>,
    'Adware': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>,
    'Scam': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
    'IP Block': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498A1 1 0 0117 15.72V19a2 2 0 01-2 2h-1C6.04 21 3 17.96 3 14V5z" /></svg>,
    'Remote Desktop': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
    'Port Block': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
};

const AllowedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);


export const RealtimeFeed: React.FC = () => {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const { isConnected } = useWebSocket<RealtimeEvent>('domain_event', (newEvent) => {
    setEvents(prevEvents => [newEvent, ...prevEvents].slice(0, 15));
  });

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Activité en direct</h3>
        <div className={`text-xs font-semibold px-2 py-1 rounded-full ${isConnected ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
          {isConnected ? 'Connecté' : 'Déconnecté'}
        </div>
      </div>
      <div className="space-y-3 h-96 overflow-y-auto pr-2">
        {events.length === 0 && <p className="text-text-subtle text-center pt-10">En attente d'activité...</p>}
        {events.map((event, index) => (
          <div key={index} className="flex items-start justify-between text-sm">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {event.type === 'blocked' ? (event.reason ? iconMap[event.reason] : iconMap['Malware']) : <AllowedIcon />}
              </div>
              <div className="flex-grow">
                <span className="font-mono text-text-main font-medium break-all">{event.domain}</span>
                {event.type === 'blocked' ? (
                     <span className={`block text-xs font-bold uppercase text-danger`}>
                        {event.reason || 'Bloqué'}
                        <span className="text-text-subtle font-normal normal-case"> ({event.source})</span>
                    </span>
                ) : (
                    <span className={`block text-xs font-bold uppercase text-success`}>Autorisé</span>
                )}
              </div>
            </div>
            <span className="text-text-subtle text-xs flex-shrink-0 ml-2 pt-0.5">
                {new Date(event.timestamp).toLocaleTimeString('fr-FR')}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
