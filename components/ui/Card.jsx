import React from 'react';

export const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-border-color ${className}`}>
      {children}
    </div>
  );
};
