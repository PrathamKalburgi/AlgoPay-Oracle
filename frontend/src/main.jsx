import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';


/**
 * AlgoPay Oracle Frontend Entry Point
 * * We use BrowserRouter to wrap the application, allowing for a seamless
 * transition between the Landing Page, Demo, and Dashboard.
 * * Note for 7200 RPM HDD Users: Vite's HMR (Hot Module Replacement) is 
 * extremely efficient. If you experience stutters during development, 
 * ensure your 'node_modules' are excluded from Windows Defender scans.
 */

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element. Ensure index.html has <div id='root'></div>");
}

createRoot(rootElement).render(
  <StrictMode>
        <App />
  </StrictMode>
);