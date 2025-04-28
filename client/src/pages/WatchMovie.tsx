// src/pages/WatchMovie.tsx
import React, { useState, useEffect,useRef,useCallback } from 'react'; // Removed useRef
import { useParams, useNavigate } from 'react-router-dom';
// Removed: import { io, Socket } from 'socket.io-client'; // No longer needed here
import { motion } from 'framer-motion';
import User from '../components/User';
import { UserProps } from '../components/User';
import { useSocket } from '../context/SocketContext'; // Import the hook
import { Socket } from 'socket.io-client';
import { Peer } from "peerjs";

interface RoomInfo {
  users: UserProps[];
  movieUrl: string;
  duration : number;
}

const WatchMovie: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProps[]>([]);
  const [movieUrl, setMovieUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Removed: const socketRef = useRef<Socket | null>(null);
  const { socket, isConnected } = useSocket(); // Use the context hook
  const [timerSeconds, setTimerSeconds] = useState<number>(0); // Remaining seconds
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [initialDuration, setInitialDuration] = useState<number>(0); // Store initial duration for display/reset
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to hold interval ID
  const [duration,setDuration] = useState<number>(0);
  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [stream,setStream] = useState<MediaStream | null>(null);
  const [peerId,setPeerId] = useState('');
  const peerInstance = useRef<Peer | null>(null);
  const [username,setUsername] = useState<string>("");

useEffect(() => {
  if(myVideoRef.current){
    myVideoRef.current.srcObject = stream;
  }
},[stream]);

useEffect(() => {
  const user = localStorage.getItem('username');

  if(user) setUsername(user);
},[]);

  useEffect(() => {
    console.log("----->",[socket, roomId, navigate, isConnected]);
    const username = localStorage.getItem('username');
    // Don't try to join if the socket isn't available or connected yet, or if roomId is missing
    if (!socket || !roomId) {
        // If socket exists but isn't connected, wait for the 'connect' event below
        // If socket doesn't exist yet (provider initializing), wait for it
        // If roomId is missing, show an error or redirect
        if (!roomId) {
            setError("Room ID is missing from the URL.");
            setIsLoading(false);
        } else if (!socket) {
            // This case might happen briefly during initial load
            console.log("Waiting for socket connection from context...");
            setIsLoading(true); // Keep loading until socket is ready
        }
        return; // Exit effect if prerequisites aren't met
    }

    async function startStream() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (mediaStream) {
          setStream(mediaStream);
          // console.log(mediaStream,"stream")
          // const intervalId = setInterval(() => {
            
          //   if(myVideoRef.current){
          //     const canvas = document.createElement('canvas');
          //     canvas.width = myVideoRef?.current?.videoWidth;
          //     canvas.height = myVideoRef?.current?.videoHeight;
          //     canvas?.getContext('2d')?.drawImage(myVideoRef.current, 0, 0, canvas.width, canvas.height);
    
          //     const imageDataURL = canvas.toDataURL('image/jpeg');
          //     if(socket) socket.emit('video-stream', {imageDataURL,roomId,username});
          //   }
            
          // }, 1000); // Adjust the interval as needed
    
          // return () => clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    }

    startStream();

    // const handleVideoStream = (data : {imageDataURL : string,roomId : string,username : string}) => {
    //   // console.log(data)
    //  if(data.roomId === roomId){
    //   // setImgSrc(data.imageDataURL);
    //   setUsers(prevUsers => prevUsers.map(user => user.userName === data.username ? {...user,videoSrc : data.imageDataURL} : user))
    //   // console.log(data.imageDataURL)
    //  }
    // }

    // --- Define event handlers ---
    
    const handlePeerConnection = () => {
      const peer = new Peer();

      peer.on("open",(id) => {
        console.log("peerId",id);
        setPeerId(id);
        socket.emit("connect-peer",{id,roomId,username},(response: { success: boolean; message?: string; usersInfo?: UserProps[] }) => {
          if (response.success && response.usersInfo) {
            console.log(response.usersInfo);
          setUsers(response.usersInfo.filter(user => user.userName !== username));
          }
        });
      })

      peer.on("call",async (call) => {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        call.answer(mediaStream);
      })

      peerInstance.current = peer;
    }

    handlePeerConnection();

    const handleConnect = () => {
      console.log('Socket connected:', socket.id);
      setError(null); // Clear previous errors on successful connect/reconnect

      if (!username) {
        console.error('Username is missing from localStorage.');
        setError('Could not join room: Your username is missing. Please join again.');
        setIsLoading(false);
        navigate('/join-room'); // Redirect if username is essential
        return;
      }

      console.log(`Attempting to join room "${roomId}" as "${username}"`);
      setIsLoading(true); // Show loading while joining
      socket.emit('roomstate', roomId , (response: { success: boolean; message?: string; roomInfo?: RoomInfo }) => {
        if (response.success && response.roomInfo) {
          console.log('Successfully joined room. Initial data:', response.roomInfo);
          setMovieUrl(response.roomInfo.movieUrl);
          setTimerSeconds(response.roomInfo.duration);
          setError(null);
        } else {
          console.error('Failed to join room:', response.message);
          setError(response.message || 'Failed to join room or retrieve room data.');
        }
        setIsLoading(false);
      });
    };

    const handleConnectError = (err: Error) => {
      console.error('Socket connection error:', err.message);
      setError(`Connection failed: ${err.message}. Please try refreshing.`);
      setIsLoading(false); // Stop loading on connection error
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.warn('Socket disconnected:', reason);
      // Only show reconnecting message if it's not a manual disconnect
      if (reason !== 'io client disconnect') {
          setError('Connection lost. Attempting to reconnect...');
          setIsLoading(true); // Show loading state while attempting reconnect
      }
      // Clear users and movie URL on disconnect? Optional, depends on desired UX
      // setUsers([]);
      // setMovieUrl('');
    };

    const handleUserJoined = (newUser: UserProps) => {
      console.log('User joined:', newUser);
      setUsers((prevUsers) => {
        if (!prevUsers.some(user => user.userId === newUser.userId)) {
          return [...prevUsers, newUser];
        }
        return prevUsers;
      });
    };

    const handleUserLeft = (userId: string) => {
      console.log('User left:', userId);
      setUsers((prevUsers) => prevUsers.filter((user) => user.userId !== userId));
    };

    // --- Register event listeners ---
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('timerStarted', handleTimerStarted);
    // socket.on('timerStarted', handlePeerConnection);
    // socket.on('video-stream', handleVideoStream);

    // Cleanup function')

    // --- Initial Join Attempt ---
    // If already connected when effect runs, attempt to join immediately
    if (isConnected) {
        handleConnect(); // Call the handler directly
    } else {
        // If not connected, set loading and wait for 'connect' event
        setIsLoading(true);
        setError("Connecting to server..."); // Inform user
    }


    // --- Cleanup Function ---
    // This runs when the component unmounts or when `socket` or `roomId` changes
    return () => {
      console.log('Cleaning up WatchMovie listeners...');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Remove only the listeners added in this effect
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
      socket.off('timerStarted', handleTimerStarted);
      // socket.off('video-stream', handleVideoStream);

      // **IMPORTANT**: Do NOT disconnect the socket here.
      // The SocketProvider manages the connection lifecycle.

      // Optional: Emit a 'leaveRoom' event if your backend needs explicit leave notification
      // This is often handled by the 'disconnect' event on the server anyway
      // if (socket && roomId) {
      //   console.log(`Emitting leaveRoom for room ${roomId}`);
      //   socket.emit('leaveRoom', roomId); // Make sure server handles 'leaveRoom'
      // }

      // Optional: Clear username on leaving the page?
      // localStorage.removeItem('username');
    };
    // Dependencies: Re-run effect if socket instance changes or roomId changes
  }, [socket, roomId, navigate, isConnected]); // Added isConnected

  const callPeer = async (id : string) => {
    if(!peerInstance.current || !stream) return;
    // var getUserMedia = navigator.mediaDevices.getUserMedia({video: true, audio: false})
      var call = peerInstance.current.call(id, stream);
      call.on('stream', (remoteStream) => {
        // setUsers(prev => prev.map(user => user.peerId === id ? {...user,videoSrc : remoteStream} : user))
        // if(remoteVideoRef.current){
        //   remoteVideoRef.current.srcObject = remoteStream;
        // }
        // Show stream in some video/canvas element.
      });
  }

  const handleStartTimerClick = () => {
    if(!socket || !roomId || isTimerRunning) return;
    console.log(timerSeconds)
    socket.emit('startTimer',{roomId,durationSeconds : timerSeconds})
  }

  const handleTimerStarted = useCallback(({ durationSeconds }: { durationSeconds: number }) => {
    console.log(`Received timerStarted event with duration: ${durationSeconds}`);
    // Clear any existing interval first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // setInitialDuration(durationSeconds);
    // setTimerSeconds(durationSeconds);
    setIsTimerRunning(true);

    // Start the countdown interval
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prevSeconds) => {
        if (prevSeconds <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          setIsTimerRunning(false);
          console.log("Timer finished!");
          // Optionally add a notification or sound effect here
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000); // Update every second
  }, []);

  // Helper function to format Google Drive URL (keep as is)
  const getEmbedUrl = (url: string): string => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname.includes('/file/d/')) {
        const fileId = urlObj.pathname.split('/d/')[1].split('/')[0];
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      if (urlObj.pathname.endsWith('/preview')) {
        return url;
      }
      // Handle /edit links as well
      if (urlObj.pathname.includes('/edit')) {
          const fileId = urlObj.pathname.split('/d/')[1].split('/')[0];
          return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    } catch (e) {
      console.error("Error parsing movie URL:", e);
    }
    // Improved fallback: try replacing /view and /edit, remove usp=sharing
    return url.replace('/view', '/preview').replace('/edit', '/preview').split('?')[0]; // Basic cleanup
  };

  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')} : ${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;
  };

  const remainDuration = formatTime(timerSeconds);
  const embedMovieUrl = getEmbedUrl(movieUrl);

  // --- Render Logic (mostly unchanged, added checks for embedMovieUrl) ---
  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-gray-800 text-white text-xl">Loading Room...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800 text-red-400 p-4">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-center mb-6">{error}</p>
        <div className="flex space-x-4"> {/* Group buttons */}
            <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
            Refresh Page
            </button>
            <button
            onClick={() => navigate('/join-room')}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
            Join Different Room
            </button>
        </div>
      </div>
    );
  }

  // Check if we have a valid embed URL after loading and no errors
  const hasValidMovieUrl = embedMovieUrl && embedMovieUrl.includes('/preview');

  return (
    <motion.div
      className="watch-movie-page lg:grid grid-cols-12 h-full bg-gradient-to-br from-gray-900 to-gray-700 text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Video Player Section */}
      <motion.div
        className="lg:h-full lg:col-span-10 bg-black"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring', damping: 15 }}
      >
        {hasValidMovieUrl ? (
          <div className='w-full lg:h-[87%]'>
              <iframe
              className="w-full h-full aspect-video shadow-lg p-2 rounded-xl"
              src={embedMovieUrl}
              title="Movie Player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
            <div className='px-3 flex justify-between'>
              {
                isTimerRunning
                ? <button onClick={() => setIsTimerRunning(false)} className='bg-red-800 p-2 rounded-lg'>Stop Timer</button>
                : <button onClick={() => handleStartTimerClick()} className='bg-gray-800 p-2 rounded-lg'>Start Timer</button>
              }
              
              <span className='inline-block'>{remainDuration}</span>
            </div>
          </div>
          
        ) : (
          <div className="text-yellow-400 font-semibold text-xl p-4 text-center">
            {movieUrl ? "Could not generate a valid preview link for the provided URL." : "Movie link not available for this room."}
          </div>
        )}
      </motion.div>
      {/* Users Section */}
      <motion.div
        className="users-section border lg:col-span-2 p-3 bg-gray-800 border-t-2 border-gray-600 overflow-y-auto"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
         <h3 className="text-lg font-semibold mb-3 text-center sticky top-0 bg-gray-800 py-1 z-10"> {/* Added z-index */}
            Users in Room ({users.length})
         </h3>
         
            <div className="flex flex-col "> {/* Added padding-bottom */}
                {/* <User key={"1234"} stream={stream} userId="1234" userName={username} peerId={peerId} ref={myVideoRef}/> */}
                {/* <video className='border' autoPlay id="remoteVideo"></video> */}
                {/* <img src={imgSrc} alt="remote video" /> */}
                <motion.div
                  className=" m-2 rounded-md overflow-hidden shadow-lg bg-white"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, type: 'spring', damping: 10 }}
                >
                  <motion.div
                    className="video-frame w-full h-32 bg-gray-800 flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                  >
                    {stream ? (
                      <video
                        ref={myVideoRef}
                        autoPlay
                        muted
                        loop
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm">
                        {username} - Video Feed 
                      </span>
                    )}
                  </motion.div>
                  <div className="p-2 bg-gray-700 text-white text-center text-sm">
                     {username} {peerId}
                  </div>
                </motion.div>

                <motion.div
                  className=" m-2 rounded-md overflow-hidden shadow-lg bg-white"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, type: 'spring', damping: 10 }}
                >
                  <motion.div
                    className="video-frame w-full h-32 bg-gray-800 flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                  >
                    {stream ? (
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        muted
                        loop
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm">
                        {username} - Video Feed 
                      </span>
                    )}
                  </motion.div>
                  <div className="p-2 bg-gray-700 text-white text-center text-sm">
                     remote {peerId}
                  </div>
                </motion.div>

                {users.length > 0
                ? users.map((user) => (
                  <User key={user.userId} userId={user.userId} userName={user.userName} peerId={user.peerId} videoSrc={user.videoSrc} callPeer={callPeer} />
               ))
                : <p className="text-center text-gray-400 mt-4">Waiting for others to join...</p>
              }
            </div>
      </motion.div>
    </motion.div>
  );
};

export default WatchMovie;
