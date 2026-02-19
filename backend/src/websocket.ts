import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "./config/env";
import { logger } from "./config/logger";

let io: Server | null = null;

interface AuthPayload {
  sub: string;
  email: string;
  roleId?: string;
}

/**
 * Initialize Socket.IO server
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      logger.warn("WebSocket authentication failed: missing token", {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token as string, config.jwtSecret) as AuthPayload;
      socket.data.userId = decoded.sub;
      socket.data.email = decoded.email;
      next();
    } catch (err) {
      logger.warn("WebSocket authentication failed: invalid token", {
        socketId: socket.id,
        ip: socket.handshake.address,
        error: err instanceof Error ? err.message : String(err),
      });
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`WebSocket connected: user ${userId}`);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      logger.info(`WebSocket disconnected: user ${userId}`);
    });

    // Handle ping for keepalive
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  logger.info("WebSocket server initialized");

  return io;
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit an event to a specific user
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Emit an event to all connected clients
 */
export function emitToAll(event: string, data: unknown): void {
  if (io) {
    io.emit(event, data);
  }
}

