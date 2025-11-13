import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getChartData } from '../../services/api.js';
import { Card } from '../ui/Card.jsx';
import { useWebSocket } from '../../hooks/useWebSocket.js';

// Custom Tooltip Component for a modern look
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-gray-800 text-white rounded-lg shadow-lg border border-gray-700">
                <p className="label text-sm font-bold">{`${label}`}</p>
                <p className="intro text-xs">{`Blocages : ${payload[0].value}`}</p>
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


export const BlockChart = () => {
    const queryClient = useQueryClient();
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['blockChartData'],
        queryFn: getChartData,
    });

    useWebSocket('stats_update', (event) => {
        if (event.type === 'blocked') {
            queryClient.setQueryData(['blockChartData'], (prevData) => {
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

    return (
        <Card className="flex flex-col">
            <h3 className="text-lg font-bold mb-4">Blocages sur les 24 dernières heures</h3>
            <div className="w-full h-[350px]">
                {isLoading && <ChartSkeleton />}
                {isError && <div className="flex items-center justify-center h-full text-danger"><p>Erreur: {error instanceof Error ? error.message : 'Unknown error'}</p></div>}
                {data && (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorBlocks" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ stroke: '#2563EB', strokeWidth: 1, strokeDasharray: '3 3' }}
                                content={<CustomTooltip />}
                            />
                            <Area
                                type="monotone"
                                dataKey="blocks"
                                stroke="#2563EB"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorBlocks)"
                                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2, fill: '#2563EB' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
};
