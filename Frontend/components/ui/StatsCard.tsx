
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, description }) => {
  return (
    <div className="p-6 bg-subtle rounded-sm border border-transparent hover:bg-gray-100 transition-colors duration-300">
      <p className="text-sm text-secondary font-medium mb-4">{title}</p>
      <h3 className="text-4xl font-light text-black tracking-tight mb-2">{value}</h3>
      {description && (
        <p className="text-xs text-secondary">{description}</p>
      )}
    </div>
  );
};