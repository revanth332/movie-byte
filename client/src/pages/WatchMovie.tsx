// src/pages/WatchMovie.tsx
import React, { useState, useEffect, useRef, useCallback } from "react"; // Removed useRef
import { useParams, useNavigate } from "react-router-dom";
// Removed: import { io, Socket } from 'socket.io-client'; // No longer needed here
import { motion } from "framer-motion";
import { UserProps } from "../components/User";
import { useSocket } from "../context/SocketContext"; // Import the hook
import { Socket } from "socket.io-client";
import { Peer } from "peerjs";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch"


interface RoomInfo {
  users: UserProps[];
  movieUrl: string;
  duration: number;
}

const WatchMovie: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProps[]>([]);
  const [movieUrl, setMovieUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Removed: const socketRef = useRef<Socket | null>(null);
  const { socket, isConnected } = useSocket(); // Use the context hook
  const [timerSeconds, setTimerSeconds] = useState<number>(0); // Remaining seconds
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [initialDuration, setInitialDuration] = useState<number>(0); // Store initial duration for display/reset
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to hold interval ID
  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  // const [peerId, setPeerId] = useState("");
  const peerInstance = useRef<Peer | null>(null);
  const [username, setUsername] = useState<string>("");
  const [callingPeer, setCallingPeer] = useState<string>("");
  const [showMovie,setShowMovie] = useState<boolean>(true);

  useEffect(() => {
    if (myVideoRef.current) {
      myVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const user = localStorage.getItem("username");

    if (user) setUsername(user);
  }, []);

  useEffect(() => {
    console.log("----->", [socket, roomId, navigate, isConnected]);
    const username = localStorage.getItem("username");
    // Don't try to join if the socket isn't available or connected yet, or if roomId is missing
    if (!socket || !roomId) {
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
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (mediaStream) {
          setStream(mediaStream);
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }

    startStream();

    const handlePeerConnection = () => {
      const peer = new Peer();

      peer.on("open", (id) => {
        console.log("peerId", id);
        // setPeerId(id);
        socket.emit(
          "connect-peer",
          { id, roomId, username },
          (response: {
            success: boolean;
            message?: string;
            usersInfo?: UserProps[];
          }) => {
            if (response.success && response.usersInfo) {
              console.log(response.usersInfo);
              console.log(users);
              setUsers(
                response.usersInfo.filter((user) => user.userName !== username)
              );
            }
          }
        );
      });

      peer.on("call", async (call) => {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        call.answer(mediaStream);
      });

      peerInstance.current = peer;
    };

    handlePeerConnection();

    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
      setError(null); // Clear previous errors on successful connect/reconnect

      if (!username) {
        console.error("Username is missing from localStorage.");
        setError(
          "Could not join room: Your username is missing. Please join again."
        );
        setIsLoading(false);
        navigate("/join-room"); // Redirect if username is essential
        return;
      }

      console.log(`Attempting to join room "${roomId}" as "${username}"`);
      setIsLoading(true); // Show loading while joining
      socket.emit(
        "roomstate",
        roomId,
        (response: {
          success: boolean;
          message?: string;
          roomInfo?: RoomInfo;
        }) => {
          if (response.success && response.roomInfo) {
            console.log(
              "Successfully joined room. Initial data:",
              response.roomInfo
            );
            setMovieUrl(response.roomInfo.movieUrl);
            setTimerSeconds(response.roomInfo.duration);
            setInitialDuration(response.roomInfo.duration);
            setError(null);
          } else {
            console.error("Failed to join room:", response.message);
            setError(
              response.message || "Failed to join room or retrieve room data."
            );
          }
          setIsLoading(false);
        }
      );
    };

    const handleConnectError = (err: Error) => {
      console.error("Socket connection error:", err.message);
      setError(`Connection failed: ${err.message}. Please try refreshing.`);
      setIsLoading(false); // Stop loading on connection error
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.warn("Socket disconnected:", reason);
      // Only show reconnecting message if it's not a manual disconnect
      if (reason !== "io client disconnect") {
        setError("Connection lost. Attempting to reconnect...");
        setIsLoading(true); // Show loading state while attempting reconnect
      }
    };

    const handleUserJoined = (newUser: UserProps) => {
      console.log("User joined:", newUser);
      setUsers((prevUsers) => {
        if (!prevUsers.some((user) => user.userId === newUser.userId)) {
          return [...prevUsers, newUser];
        }
        return prevUsers;
      });
    };

    const handleUserLeft = (userId: string) => {
      console.log("User left:", userId);
      setUsers((prevUsers) =>
        prevUsers.filter((user) => user.userId !== userId)
      );
    };

    const handlePeerJoined = (usersInfo: UserProps[]) => {
      console.log("Peer joined");
      setUsers(usersInfo.filter((user) => user.userName !== username));
    };

    const handleSlider = (value: number) => {
      console.log("recieved", value);
      setTimerSeconds(value);
    };

    const handleTimerStopped = () => {
      console.log("Timer stopped");
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        toast.info("Timer is stopped!", {
          description: "Please stop the movie!!!",
        });
      }
      setIsTimerRunning(false);
    };

    // --- Register event listeners ---
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("userJoined", handleUserJoined);
    socket.on("userLeft", handleUserLeft);
    socket.on("timerStarted", handleTimerStarted);
    socket.on("timerStopped", handleTimerStopped);
    socket.on("peerJoined", handlePeerJoined);
    socket.on("sliderChange", handleSlider);

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
      console.log("Cleaning up WatchMovie listeners...");
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (peerInstance.current) {
        peerInstance.current.destroy(); // Good practice to destroy the peer connection
        peerInstance.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Remove only the listeners added in this effect
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("userJoined", handleUserJoined);
      socket.off("userLeft", handleUserLeft);
      socket.off("timerStarted", handleTimerStarted);
      socket.off("timerStopped", handleTimerStopped);
      socket.off("peerJoined", handlePeerJoined);
      socket.off("sliderChange", handleSlider);
    };
    // Dependencies: Re-run effect if socket instance changes or roomId changes
  }, [socket, roomId, navigate, isConnected]); // Added isConnected

  const callPeer = async (id: string) => {
    if (!peerInstance.current || !stream) return;
    setCallingPeer(id);
    // var getUserMedia = navigator.mediaDevices.getUserMedia({video: true, audio: false})
    var call = peerInstance.current.call(id, stream);
    call.on("stream", (remoteStream) => {
      console.log(remoteStream, remoteVideoRef.current);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      // Show stream in some video/canvas element.
    });
  };

  const handleStartTimerClick = () => {
    if (!socket || !roomId || isTimerRunning) return;
    console.log(timerSeconds);
    socket.emit("startTimer", { roomId, durationSeconds: timerSeconds });
  };

  const endCall = () => {
    setCallingPeer("");
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleTimerStarted = useCallback(
    ({ durationSeconds }: { durationSeconds: number }) => {
      console.log(
        `Received timerStarted event with duration: ${durationSeconds}`
      );
      // Clear any existing interval first
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      setIsTimerRunning(true);
      toast.info("Timer is started!", {
        description: "Please start the movie!!!",
      });
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
    },
    []
  );

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTimerRunning(false);
    socket?.emit("timerStopped", { roomId });
  };

  const handleSliderChange = (value: number, type: string) => {
    console.log(value);
    setTimerSeconds(value);
    if (type === "commit") socket?.emit("sliderChange", { roomId, value });
  };

  // Helper function to format Google Drive URL (keep as is)
  const getEmbedUrl = (url: string): string => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname.includes("/file/d/")) {
        const fileId = urlObj.pathname.split("/d/")[1].split("/")[0];
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      if (urlObj.pathname.endsWith("/preview")) {
        return url;
      }
      // Handle /edit links as well
      if (urlObj.pathname.includes("/edit")) {
        const fileId = urlObj.pathname.split("/d/")[1].split("/")[0];
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    } catch (e) {
      console.error("Error parsing movie URL:", e);
    }
    // Improved fallback: try replacing /view and /edit, remove usp=sharing
    return url
      .replace("/view", "/preview")
      .replace("/edit", "/preview")
      .split("?")[0]; // Basic cleanup
  };

  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")} : ${minutes
      .toString()
      .padStart(2, "0")} : ${seconds.toString().padStart(2, "0")}`;
  };

  const remainDuration = formatTime(timerSeconds);
  const embedMovieUrl = getEmbedUrl(movieUrl);

  // --- Render Logic (mostly unchanged, added checks for embedMovieUrl) ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800 text-white text-xl">
        Loading Room...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800 text-red-400 p-4">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-center mb-6">{error}</p>
        <div className="flex space-x-4">
          {" "}
          {/* Group buttons */}
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Refresh Page
          </button>
          <button
            onClick={() => navigate("/join-room")}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Join Different Room
          </button>
        </div>
      </div>
    );
  }

  // Check if we have a valid embed URL after loading and no errors
  const hasValidMovieUrl = embedMovieUrl && embedMovieUrl.includes("/preview");

  return (
    <motion.div
      className={`watch-movie-page lg:grid grid-cols-12 h-full bg-gradient-to-br from-gray-900 to-gray-700 text-white overflow-auto`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Video Player Section */}
      {showMovie && <motion.div
        className="lg:h-full lg:col-span-10 bg-black"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", damping: 15 }}
      >
        {hasValidMovieUrl ? (
          <div className="w-full lg:h-[87%]">
            <iframe
              className="w-full h-full aspect-video shadow-lg p-2 rounded-xl"
              src={embedMovieUrl}
              title="Movie Player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
            <div className="px-3 py-2 flex justify-between items-center">
              {isTimerRunning ? (
                <button
                  onClick={stopTimer}
                  className="bg-red-800 p-2 rounded-lg"
                >
                  Stop Timer
                </button>
              ) : (
                <button
                  onClick={() => handleStartTimerClick()}
                  className="bg-gray-800 p-2 rounded-lg"
                >
                  Start Timer
                </button>
              )}
              <div className="flex items-center gap-3">
                <span className="bg-white w-full block">
                  <Slider
                    onValueChange={(value) =>
                      handleSliderChange(value[0], "change")
                    }
                    onValueCommit={(value) =>
                      handleSliderChange(value[0], "commit")
                    }
                    max={initialDuration}
                    step={1}
                    value={[timerSeconds]}
                  />
                </span>
                <span className="inline-block w-[170px]">{remainDuration}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-yellow-400 font-semibold text-xl p-4 text-center">
            {movieUrl
              ? "Could not generate a valid preview link for the provided URL."
              : "Movie link not available for this room."}
          </div>
        )}
      </motion.div>}
      {/* Users Section */}
      <motion.div
        className={`users-section border ${showMovie ? "lg:col-span-2" : "lg:col-span-full"} p-3 bg-gray-800 border-t-2 border-gray-600 overflow-y-auto`}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        <div className="flex flex-col mb-3">
          <h3 className="text-lg font-semibold  text-start sticky top-0 bg-gray-800 py-1 z-10">
          {" "}
          {/* Added z-index */}
          Users in Room ({users.length + 1})
        </h3>
        <div className="flex items-center gap-2">
          <Switch checked={showMovie} onCheckedChange={(value : boolean) => setShowMovie(value)} />
          Movie
        </div>
        </div>

        <div className={`flex ${showMovie && "md:flex-col"}`}>
          {" "}
          {/* Added padding-bottom */}
          <motion.div
            className=" m-2 rounded-md overflow-hidden shadow-lg"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", damping: 10 }}
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
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm">
                  {username} - Video Feed
                </span>
              )}
            </motion.div>
            
          </motion.div>
          {!showMovie && <div className="w-full">
                 {stream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      className="w-full h-full object-cover border"
                    />
                  ) : (
                    <span className="text-white text-sm">
                      Video Feed
                    </span>
                  )}
            </div>
          }
          {users.length > 0 ? (
            users.map((user) => (
              <motion.div
                className=" m-2 rounded-md overflow-hidden shadow-lg bg-white"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", damping: 10 }}
              >
                <motion.div
                  className="video-frame w-full h-32 bg-gray-800 flex items-center justify-center"
                  whileHover={{ scale: 1.05 }}
                >
                  {stream ? (
                    <video
                      ref={(callingPeer === user.peerId && showMovie) ? remoteVideoRef : null}
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-sm">
                      {user.userName} - Video Feed
                    </span>
                  )}
                </motion.div>
                <div className="bg-gray-800">
                  {callingPeer === "" ? (
                    <button
                      onClick={() => callPeer(user.peerId || "")}
                      className="bg-green-500 p-2 w-full"
                    >
                      call {user.userName}
                    </button>
                  ) : (
                    <button
                      onClick={() => endCall()}
                      className="bg-red-500 p-2 w-full"
                    >
                      End Call
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <p className="text-center text-gray-400 mt-4">
              Waiting for others to join...
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WatchMovie;
