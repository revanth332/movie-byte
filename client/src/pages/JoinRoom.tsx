// src/pages/JoinRoom.tsx
import React, { useState } from 'react'; // Removed useEffect
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext'; // Import the hook

// Remove: let socket: Socket;
// Remove: interface User { ... } // Not used here

const JoinRoom: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('1234');
  const [username, setUsername] = useState<string>('Revanth');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket(); // Use the context hook

  // Remove the useEffect hook that managed the local socket connection

  const handleRoomIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRoomId(event.target.value);
    setError(null);
  };

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
    setError(null);
  };

  const handleJoinClick = () => {
    setError(null); // Clear previous error
    if (!roomId.trim() || !username.trim()) {
      setError('Room ID and Username are required.');
      return;
    }

    if (!socket) {
      setError('Connection not established. Please wait or refresh.');
      console.error('Socket not available from context!');
      return;
    }

    if (!isConnected) {
        setError('Not connected to the server. Please wait or refresh.');
        console.error('Socket is not connected.');
        return;
    }

    // Emit the 'joinRoom' event using the shared socket
    socket.emit('joinRoom', { roomId, username }, (response: { success: boolean; message?: string }) => {
      if (response.success) {
        // Store username for WatchMovie page to retrieve
        localStorage.setItem("username", username);
        console.log(`Joining room: ${roomId} with username: ${username}`);
        // Navigate to the watch room page
        navigate(`/watch/${roomId}`);
      } else {
        setError(response.message || 'Failed to join room.');
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 h-[100%]">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 animate-fade-in">
        <h2 className="text-2xl font-bold mb-6 text-gray-800"> {/* Removed bounce */}
          Join a Room
        </h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 animate-shake" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <div className="mb-4">
          <label
            htmlFor="roomId"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Room ID:
          </label>
          <input
            type="text"
            id="roomId"
            value={roomId}
            onChange={handleRoomIdChange}
            placeholder="Enter Room ID"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-6">
          <label
            htmlFor="username"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Username:
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={handleUsernameChange}
            placeholder="Enter Username"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <button
          onClick={handleJoinClick}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50" // Added w-full and disabled state
          disabled={!isConnected} // Disable button if not connected
        >
          {isConnected ? 'Join Room' : 'Connecting...'} {/* Indicate connection status */}
        </button>
      </div>
    </div>
  );
};

export default JoinRoom;
