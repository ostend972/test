import React, { useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getChartData } from '../../services/api';
import { Card } from '../ui/Card';
import { useWebSocket } from '../../hooks/useWebSocket';
import { RealtimeEvent, ChartDataPoint } from '../../types';

// Custom Tooltip Component for a modern look
interface TooltipProps {
    active?: boolean;
    payload?: Array<{ value?: number }>;
    label?: string;
}

const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length > 0 && payload[0]) {
        return (
            <div className="p-3 bg-gray-800 text-white rounded-lg shadow-lg border border-gray-700">
                <p className="label text-sm font-bold">{`${label}`}</p>
                <p className="intro text-xs">{`Blocages : ${payload[0].value || 0}`}</p>
            </div>
        );
    }
    return null;
};

// Skeleton Loader for the chart
const ChartSkeleton = () => (
    <div className="w-full h-full flex items-end p-4 animate-pulse">
        <div className="w-1/12 h-1/3 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/2 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-2/3 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/3 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-3/4 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/2 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-2/5 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/3 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/2 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/4 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-2/3 bg-gray-200 rounded-t-md mx-1"></div>
        <div className="w-1/12 h-1/2 bg-gray-200 rounded-t-md mx-1"></div>
    </div>
);


export const BlockChart: React.FC = () => {
    const queryClient = useQueryClient();
    const lastUpdateRef = useRef<number>(0);

    const { data, isLoading, isError, error } = useQuery<ChartDataPoint[], Error>({
        queryKey: ['blockChartData'],
        queryFn: getChartData,
        refetchInterval: 60000, // Rafraîchir toutes les 60 secondes
    });

    // Throttler les updates WebSocket (max 1 update par seconde)
    useEffect(() => {
        const unsubscribe = useWebSocket<RealtimeEvent>('stats_update', (event) => {
            if (event.type === 'blocked') {
                const now = Date.now();

                // Ne mettre à jour que si la dernière update date de plus d'1 seconde
                if (now - lastUpdateRef.current < 1000) {
                    return;
                }

                lastUpdateRef.current = now;

                queryClient.setQueryData<ChartDataPoint[] | undefined>(['blockChartData'], (prevData) => {
                    if (!prevData) return prevData;

                    const currentHour = new Date(event.timestamp).getHours();
                    const timeKey = `${String(currentHour).padStart(2, '0')}:00`;

                    const newData = [...prevData];
                    const pointIndex = newData.findIndex(p => p.time === timeKey);

                    if (pointIndex !== -1) {
                        newData[pointIndex] = { ...newData[pointIndex], blocks: newData[pointIndex].blocks + 1 };
                    }

                    return newData;
                });
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [queryClient]);

    return (
        <Card className="min-h-[420px] flex flex-col">
            <h3 className="text-lg font-bold mb-4">Blocages sur les 24 dernières heures</h3>
            <div className="flex-grow min-h-[350px]">
                {isLoading && <ChartSkeleton />}
                {isError && <div className="flex items-center justify-center h-full text-danger"><p>Erreur: {error instanceof Error ? error.message : 'Unknown error'}</p></div>}
                {Array.isArray(data) && data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="#9ca3af"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                interval={2}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="blocks"
                                stroke="#2563EB"
                                strokeWidth={2}
                                dot={{ fill: '#2563EB', r: 3 }}
                                activeDot={{ r: 6, fill: '#2563EB' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
};