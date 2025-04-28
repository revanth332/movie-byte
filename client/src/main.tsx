// src/main.tsx
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { SocketProvider } from './context/SocketContext'; // Import the provider

createRoot(document.getElementById('root')!).render(
    <SocketProvider> {/* Wrap App with the provider */}
      <App />
    </SocketProvider>
);
