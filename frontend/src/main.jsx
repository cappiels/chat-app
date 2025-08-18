import { logAbsoluteTiming, logTiming } from './utils/timing.js';

const scriptStart = performance.now();
logAbsoluteTiming('🎬', 'main.jsx: Script started');

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

logAbsoluteTiming('📦', 'main.jsx: React imports completed');

const cssStart = performance.now();
import './index.css'
logTiming('🎨', 'main.jsx: CSS imported', cssStart);

const appImportStart = performance.now();
import App from './App.jsx'
logTiming('📱', 'main.jsx: App component imported', appImportStart);

const rootStart = performance.now();
logAbsoluteTiming('🌳', 'main.jsx: Creating React root');

const root = createRoot(document.getElementById('root'));
logTiming('⚡', 'main.jsx: React root created', rootStart);

const renderStart = performance.now();
logAbsoluteTiming('🎭', 'main.jsx: Starting render');

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

logAbsoluteTiming('✅', 'main.jsx: Render call completed');
logTiming('⏱️', 'main.jsx: Total time from script start', scriptStart);
