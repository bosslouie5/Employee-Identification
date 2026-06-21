import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Preview from './Preview';
import './styles.css';

const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
const pathname = url?.pathname || '/';
const hasId = url?.searchParams.has('id');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {pathname === '/preview' || hasId ? <Preview /> : <App />}
  </React.StrictMode>
);
