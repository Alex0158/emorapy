import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../frontend/src/index.css';
import '../../frontend/src/assets/styles/global.less';
import '../../frontend/src/assets/styles/print.less';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
