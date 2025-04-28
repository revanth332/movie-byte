// src/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Define the shape of the context value
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

// Create the context with a default value
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

// Custom hook to use the socket context
export const useSocket = () => {
  return useContext(SocketContext);
};

// Define props for the provider component
interface SocketProviderProps {
  children: ReactNode;
}

// Socket Provider component
export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Establish connection only once when the provider mounts
    // Ensure you replace 'http://localhost:3001' with your actual server URL
    const newSocket = io('https://lw38q7hc-3001.inc1.devtunnels.ms', {
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      // Important: Prevents immediate connection if not needed yet
      // autoConnect: false, // You might enable this if you always need the socket
    });

    setSocket(newSocket);

    // Event listeners for connection status
    newSocket.on('connect', () => {
      console.log('Socket connected via Context:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('Socket disconnected via Context:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
        console.error('Socket connection error via Context:', err.message);
        setIsConnected(false); // Ensure state reflects error
    });

    // Cleanup function: Disconnect the socket when the provider unmounts
    // This happens when the entire app closes or the provider is removed from the tree
    return () => {
      console.log('Disconnecting socket via Context cleanup...');
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, []); // Empty dependency array ensures this runs only once

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
