import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { migrateLegacy } from './lib/storage';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './styles/app.css';
import './styles/pages.css';
import './styles/main.css';

migrateLegacy();   // bring over data saved by the original single-page Simplex app (simplex-tutor:*)

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <ErrorBoundary>
            <HashRouter>
                <App />
            </HashRouter>
        </ErrorBoundary>
    </StrictMode>
);
