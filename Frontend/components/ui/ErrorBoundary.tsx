import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Comprehensive error logging
        const timestamp = new Date().toISOString();
        console.error('========================================');
        console.error(`[Frontend] ✗ REACT ERROR BOUNDARY CAUGHT ERROR`);
        console.error(`[Frontend] Timestamp: ${timestamp}`);
        console.error(`[Frontend] Error name: ${error.name}`);
        console.error(`[Frontend] Error message: ${error.message}`);
        console.error('========================================');
        console.error('[Frontend] Stack trace:', error.stack);
        console.error('========================================');
        console.error('[Frontend] Component stack:', errorInfo.componentStack);
        console.error('========================================');

        // Log to backend for persistence (if needed)
        if (window.electronAPI?.logError) {
            window.electronAPI.logError({
                type: 'React Error Boundary',
                timestamp,
                name: error.name,
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack
            }).catch((err: any) => {
                console.error('[Frontend] Failed to log error to backend:', err);
            });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-white">
                    <div className="text-center p-8">
                        <h1 className="text-2xl font-bold mb-4 text-black">Something went wrong</h1>
                        <p className="text-gray-600 mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
