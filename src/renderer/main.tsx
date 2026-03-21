import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CaptureRegionView from './components/CaptureRegionView';
import OverlaySolutionView from './components/OverlaySolutionView';
import './styles/index.css';

function routeFromHash(): string {
    const h = window.location.hash.replace(/^#/, '') || '/';
    return h.startsWith('/') ? h : `/${h}`;
}

const Root: React.FC = () => {
    const [route, setRoute] = useState(routeFromHash);

    useEffect(() => {
        const onHashChange = () => setRoute(routeFromHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    if (route.startsWith('/capture')) {
        return <CaptureRegionView />;
    }
    if (route.startsWith('/overlay')) {
        return <OverlaySolutionView />;
    }
    return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
);
