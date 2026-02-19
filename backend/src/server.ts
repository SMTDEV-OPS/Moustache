import "dotenv/config";
import { createServer } from "http";
import mongoose from "mongoose";
import { app } from "./app";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { initializeWebSocket } from "./websocket";
import "./jobs/scheduler";

// Global error handlers
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error("Unhandled promise rejection", {
    promise: promise.toString(),
  }, reason instanceof Error ? reason : new Error(String(reason)));
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception", {}, error);
  process.exit(1);
});

async function start() {
  try {
    // Set up mongoose connection event listeners
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error", {}, err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected", {});
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected", {});
    });

    await mongoose.connect(config.mongoUri);
    logger.info("Connected to MongoDB", { uri: config.mongoUri });

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket server
    initializeWebSocket(httpServer);

    httpServer.listen(config.port, () => {
      logger.info(`PostcardCRM API listening on port ${config.port}`);
      logger.info(`WebSocket server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server", {
      port: config.port,
      mongoUri: config.mongoUri,
    }, err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }
}

void start();
