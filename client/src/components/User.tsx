import { motion } from 'framer-motion';
import {forwardRef } from 'react';

export interface UserProps {
    userId: string;
    stream?  : MediaStream | undefined | null;
    userName: string;
    videoSrc?: string; // Optional video source for streaming
    peerId? : string;
    callPeer : (id : string) => void;
  }
  
  const User = forwardRef<HTMLVideoElement,UserProps>(({ userId, stream, userName, videoSrc,peerId,callPeer },ref) => {
    // const videoRef = useRef<HTMLVideoElement | null>(null);

    return (
      <motion.div
        className=" m-2 rounded-md overflow-hidden shadow-lg bg-white"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring', damping: 10 }}
        key={userId}
      >
        <motion.div
          className="video-frame w-full h-32 bg-gray-800 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
        >
          {stream ? (
            <video
              ref={ref}
              autoPlay
              muted
              loop
              className="w-full h-full object-cover"
            />
          ) : videoSrc ? (
            <video
              autoPlay
              muted
              loop
              src={videoSrc}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-sm">
              {userName} - Video Feed 
            </span>
          )}
        </motion.div>
        <div onClick={() => callPeer(peerId || "")} className="p-2 bg-gray-700 text-white text-center text-sm">
          call {userName} {peerId}
        </div>
      </motion.div>
    );
  });

  export default User;