import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "https://lw38q7hc-5173.inc1.devtunnels.ms";

// In-memory store for room details
// Structure: { roomId: { movieUrl: string, users: [{ userId: string, userName: string }] } }
const rooms = {};

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

// --- Helper Functions ---

// Function to remove an empty room
const removeEmptyRoom = (roomId) => {
  if (rooms[roomId] && rooms[roomId].users.length === 0) {
    delete rooms[roomId];
    console.log(`Removed empty room: ${roomId}`);
  }
};

// Function to find room and user details by socketId
// Returns { roomId: string, userId: string, userName: string } | null
const findUserAndRoomBySocketId = (socketId) => {
  for (const roomId in rooms) {
    const user = rooms[roomId].users.find((user) => user.userId === socketId);
    if (user) {
      return { roomId, userId: user.userId, userName: user.userName };
    }
  }
  return null;
};

// --- Socket.IO Event Handlers ---

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- Room Creation ---
  socket.on("createRoom", (roomData, callback) => {
    const { roomId, movieLink, durationSeconds } = roomData; // Expect movieLink during creation
    console.log(`Attempting to create room: ${roomId}`);

    if (!roomId || !movieLink) {
      console.error(
        "Create room failed: Missing roomId or movieLink",
        roomData
      );
      return callback({
        success: false,
        message: "Room ID and Movie URL are required.",
      });
    }

    // Add validation for durationSeconds
    if (typeof durationSeconds !== "number" || durationSeconds <= 0) {
      console.error(
        "Create room failed: Invalid or missing durationSeconds",
        roomData
      );
      return callback({
        success: false,
        message: "A valid timer duration (greater than 0 seconds) is required.",
      });
    }

    if (rooms[roomId]) {
      console.warn(`Create room failed: Room ${roomId} already exists.`);
      return callback({ success: false, message: "Room ID already exists." });
    }

    // Store room with movieLink and an empty user list
    rooms[roomId] = { movieLink, durationSeconds, users: [] };
    console.log(`Room ${roomId} created successfully.`);
    console.log("Current rooms:", rooms);
    callback({ success: true });
  });

  // --- Room Joining ---
  socket.on("joinRoom", (joinData, callback) => {
    const { roomId, username } = joinData; // Frontend sends username
    const userId = socket.id; // Use socket.id as the unique userId

    console.log(
      `User ${username} (${userId}) attempting to join room: ${roomId}`
    );

    const room = rooms[roomId];

    if (!room) {
      console.warn(`Join room failed: Room ${roomId} not found.`);
      return callback({ success: false, message: "Room not found." });
    }

    // Check if username already exists in this specific room
    const userNameExists = room.users.some(
      (user) => user.userName === username
    );
    if (userNameExists) {
      console.warn(
        `Join room failed: Username "${username}" already exists in room ${roomId}.`
      );
      return callback({
        success: false,
        message: `Username "${username}" is already taken in this room.`,
      });
    }

    // Add user to the room
    const newUser = { userId, userName: username }; // Store both id and name
    room.users.push(newUser);

    // Have the socket join the Socket.IO room
    socket.join(roomId);
    console.log(
      `User ${username} (${userId}) successfully joined room ${roomId}.`
    );
    console.log(
      `Users in room ${roomId}:`,
      room.users.map((u) => u.userName)
    );

    // Notify *other* users in the room that a new user joined
    // Pass the newUser object ({ userId, userName })
    socket.to(roomId).emit("userJoined", newUser);

    // Send confirmation and initial room state back to the joining user
    callback({
      success: true,
      roomInfo: {
        users: room.users, // Send the current list of users
        movieUrl: room.movieUrl, // Send the movie URL for this room
      },
    });
  });

  socket.on("timerStopped", (data) => {
    io.to(data?.roomId).emit("timerStopped");
  });

  socket.on("connect-peer", (data, callback) => {
    const room = rooms[data.roomId];
    console.log(room, data, "peer");
    if (!room) {
      console.warn(`Join room failed: Room ${data.roomId} not found.`);
      callback({
        success: false,
        message: "Room not found",
      });
      return;
    }

    const neWusers = room?.users?.map((user) =>
      user.userName === data.username ? { ...user, peerId: data.id } : user
    );
    console.log(neWusers);
    io.to(data.roomId).emit("peerJoined", neWusers);
    room.users = neWusers;
    callback({
      success: true,
      usersInfo: neWusers,
    });
  });

  socket.on("video-stream", ({ imageDataURL, roomId, username }) => {
    console.log(imageDataURL?.length, roomId);
    io.to(roomId).emit("video-stream", { imageDataURL, roomId, username });
  });

  socket.on("startTimer", ({ roomId, durationSeconds }) => {
    // Basic validation
    if (
      !roomId ||
      typeof durationSeconds !== "number" ||
      durationSeconds <= 0
    ) {
      console.warn(`Invalid startTimer request received from ${socket.id}:`, {
        roomId,
        durationSeconds,
      });
      // Optionally send an error back to the sender via callback if needed
      return;
    }

    const room = rooms[roomId];
    if (!room) {
      console.warn(
        `startTimer failed: Room ${roomId} not found for user ${socket.id}.`
      );
      return;
    }

    // Check if user is actually in the room (optional but good practice)
    const userInRoom = room.users.some((user) => user.userId === socket.id);
    if (!userInRoom) {
      console.warn(
        `startTimer failed: User ${socket.id} is not in room ${roomId}.`
      );
      return;
    }

    console.log(
      `User ${socket.id} started timer in room ${roomId} for ${durationSeconds} seconds.`
    );

    // Broadcast to everyone in the room (including the sender)
    // that the timer has started with the specified duration.
    io.to(roomId).emit("timerStarted", { durationSeconds });
  });

  socket.on("sliderChange", (data) => {
    io.to(data?.roomId).emit("sliderChange", data.value);
  });

  socket.on("roomstate", (roomId, callback) => {
    const room = rooms[roomId];

    if (!room) {
      console.warn(`Join room failed: Room ${roomId} not found.`);
      return callback({ success: false, message: "Room not found." });
    }

    callback({
      success: true,
      roomInfo: {
        users: room.users, // Send the current list of users
        movieUrl: room.movieLink, // Send the movie URL for this room
        duration: room.durationSeconds,
      },
    });

    console.log(`Sent initialRoomState to room ${roomId}`);
  });

  // --- Disconnection ---
  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id}. Reason: ${reason}`);

    // Find which room the user was in
    const userInfo = findUserAndRoomBySocketId(socket.id);

    if (userInfo) {
      const { roomId, userId, userName } = userInfo;
      console.log(`User ${userName} (${userId}) is leaving room ${roomId}`);

      const room = rooms[roomId];
      if (room) {
        // Remove the user from the users array
        room.users = room.users.filter((user) => user.userId !== userId);

        // Notify remaining users in the room that this user left
        // Send the userId of the user who left
        console.log(roomId);
        io.to(roomId).emit("userLeft", userId); // Use io.to to include sender if needed, or socket.to(roomId)

        console.log(
          `User ${userName} removed from room ${roomId}. Remaining users: ${room.users.length}`
        );

        // Check if the room is now empty and remove it
        // if (room.users.length === 0) {
        //   removeEmptyRoom(roomId);
        // } else {
        //     console.log(`Users remaining in room ${roomId}:`, room.users.map(u => u.userName));
        // }
      }
    } else {
      console.log(
        `Disconnected user ${socket.id} was not found in any active room.`
      );
    }
  });

  // Optional: Handle explicit leave room event if needed
  // socket.on('leaveRoom', (roomId, callback) => { ... });
});

// Optional: Periodic cleanup for any potentially orphaned empty rooms
// (Disconnect should handle most cases, but this can be a fallback)
// setInterval(() => {
//   console.log("Running periodic empty room cleanup...");
//   Object.keys(rooms).forEach((roomId) => {
//     if (rooms[roomId].users.length === 0) {
//       removeEmptyRoom(roomId);
//     }
//   });
// }, 5 * 60 * 1000); // Every 5 minutes

server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`🔌 Allowing connections from: ${CLIENT_ORIGIN}`);
});
