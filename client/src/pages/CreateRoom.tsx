// src/pages/CreateRoom.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';

const CreateRoom = () => {
  // Keep existing state
  // const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('1234');
  const [movieLink, setMovieLink] = useState('https://drive.google.com/file/d/1uGq9lqCyLfODeKB7l5jLOnI9RHxqh0BR/preview');
  const [roomCreated, setRoomCreated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();

  // Duration State
  const [hours, setHours] = useState<string>('0');
  const [minutes, setMinutes] = useState<string>('25');
  const [seconds, setSeconds] = useState<string>('0');

  // Helper to handle numeric input changes for duration
  const handleDurationChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    max: number
  ) => {
    // Allow empty input for clearing, otherwise parse as integer
    if (value === '') {
      setter('');
      return;
    }
    const num = parseInt(value, 10);
    console.log(num)
    // Update only if it's a valid number within range 0 to max
    if (!isNaN(num) && num >= 0 && num <= max) {
      setter(num.toString());
    } else if (!isNaN(num) && num > max) {
        setter(max.toString());
    } else if (!isNaN(num) && num < 0) {
        setter('0');
    }
    // If input is not a number (e.g., 'e', '.'), don't update state
  };


  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setRoomCreated(false);

    if (!socket || !isConnected) {
      setError(isConnected ? 'Socket not available.' : 'Not connected to the server.');
      return;
    }

    // --- Calculate Total Duration in Seconds ---
    // Use || '0' to handle potentially empty strings if user clears the input
    const totalSeconds = (parseInt(hours || '0', 10) * 3600) +
                         (parseInt(minutes || '0', 10) * 60) +
                         (parseInt(seconds || '0', 10));

    // Basic validation for duration (optional, but good practice)
    if (totalSeconds <= 0) {
        setError("Please set a timer duration greater than 0 seconds.");
        return;
    }
    console.log("Calculated duration (seconds):", totalSeconds);
    // --- End Calculation ---


    // Include durationSeconds in the data sent to the server
    const roomData = {
        roomId,
        movieLink,
        durationSeconds: totalSeconds // Add the calculated duration
    };

    socket.emit('createRoom', roomData, (response: { success: boolean; message?: string }) => {
      if (response.success) {
        console.log('Room created successfully!');
        setRoomCreated(true);
        // Reset form
        // setName('');
        setRoomId('');
        setMovieLink('');
        // Reset duration fields as well
        setHours('0');
        setMinutes('25'); // Reset to default
        setSeconds('0');
      } else {
        console.error('Error creating room:', response.message);
        setError(response.message || 'Failed to create room.');
      }
    });
  };

  return (
    <motion.div
      className="flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 min-h-screen py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <motion.form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          Create a Watch Party Room
        </h2>

        {/* Display Success/Error Messages */}
        {roomCreated && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded">
                Room created successfully!
            </div>
        )}
        {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
                {error}
            </div>
        )}


        {/* Room ID Input */}
        <div className="mb-4">
          <label htmlFor="roomId" className="block text-gray-700 text-sm font-bold mb-2">
            Room ID
          </label>
          <input
            type="text"
            id="roomId"
            value={roomId}
            onChange={(e) => { setRoomId(e.target.value); setError(null); setRoomCreated(false); }}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Choose a unique Room ID"
            required
          />
        </div>

        {/* Movie Link Input */}
        <div className="mb-6">
          <label htmlFor="movieLink" className="block text-gray-700 text-sm font-bold mb-2">
            Movie Link (Google Drive)
          </label>
          <input
            type="url"
            id="movieLink"
            value={movieLink}
            onChange={(e) => { setMovieLink(e.target.value); setError(null); setRoomCreated(false); }}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="https://drive.google.com/..."
            required
          />
        </div>

        {/* Duration Input Fields */}
        <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
                Movie Duration
            </label>
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label htmlFor="hours" className="block text-xs text-gray-600 mb-1">Hours</label>
                    <input
                        type="number"
                        id="hours"
                        min="0"
                        max="23"
                        step="1"
                        value={hours}
                        onChange={(e) => handleDurationChange(e.target.value, setHours, 23)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-center"
                        placeholder="HH"
                    />
                </div>
                <div>
                    <label htmlFor="minutes" className="block text-xs text-gray-600 mb-1">Minutes</label>
                    <input
                        type="number"
                        id="minutes"
                        min="0"
                        max="59"
                        step="1"
                        value={minutes}
                        onChange={(e) => handleDurationChange(e.target.value, setMinutes, 59)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-center"
                        placeholder="MM"
                    />
                </div>
                <div>
                    <label htmlFor="seconds" className="block text-xs text-gray-600 mb-1">Seconds</label>
                    <input
                        type="number"
                        id="seconds"
                        min="0"
                        max="59"
                        step="1"
                        value={seconds}
                        onChange={(e) => handleDurationChange(e.target.value, setSeconds, 59)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-center"
                        placeholder="SS"
                    />
                </div>
            </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 text-lg"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          disabled={!isConnected || !roomId || !movieLink}
        >
          {isConnected ? 'Create Room' : 'Connecting...'}
        </motion.button>
      </motion.form>
    </motion.div>
  );
};

export default CreateRoom;
