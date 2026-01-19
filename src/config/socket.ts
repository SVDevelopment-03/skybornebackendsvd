// src/config/socket.ts
import { Server as HTTPServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";

// Store user socket connections
export const userSocketMap = new Map<string, string>(); // userId -> socketId

export function initializeSocket(httpServer: HTTPServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      // For mobile apps, allow all origins or specific app schemes
      origin: true, // Accept connections from any origin (mobile apps)
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Optimize for mobile connections
    transports: ["websocket", "polling"], // Polling fallback for unstable connections
    pingInterval: 25000, // Keep-alive heartbeat
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6, // 1MB max message size
  });

  io.on("connection", (socket: Socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    console.log(`📊 Total connected users: ${io.engine.clientsCount}`);

    // Register user socket on connection
    socket.on("register-user", (userId: string) => {
      if (!userId) {
        console.warn("⚠️ User registration without userId");
        socket.emit("error", { message: "userId is required" });
        return;
      }

      // Remove previous socket if user reconnects
      const existingSocketId = userSocketMap.get(userId);
      if (existingSocketId && existingSocketId !== socket.id) {
        io.to(existingSocketId).emit("session-replaced", {
          message: "Your session was connected from another device",
        });
      }

      userSocketMap.set(userId, socket.id);
      socket.join(`user-${userId}`); // Join room specific to user
      
      console.log(`📱 User ${userId} registered with socket ${socket.id}`);
      socket.emit("registration-success", { 
        message: "You are now connected",
        socketId: socket.id 
      });
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`❌ User disconnected: ${socket.id} (Reason: ${reason})`);
      
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(`🚪 User ${userId} removed from socket map`);
          break;
        }
      }
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Handle namespace errors
  io.on("error", (error) => {
    console.error("❌ Socket.io server error:", error);
  });

  return io;
}

// Export function to get socket instance globally
let ioInstance: SocketServer;

export function setIOInstance(io: SocketServer) {
  ioInstance = io;
  console.log("✅ Socket.io instance set globally");
}

export function getIO() {
  if (!ioInstance) {
    console.warn("⚠️ Socket.io not initialized - getIO() called before setIOInstance()");
    return null;
  }
  return ioInstance;
}

export function getUserSocketId(userId: string): string | undefined {
  return userSocketMap.get(userId);
}

export function isUserConnected(userId: string): boolean {
  return userSocketMap.has(userId);
}