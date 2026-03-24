import "dotenv/config";
import { createServer } from "http";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { app } from "./app";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { initializeWebSocket } from "./websocket";
import { initializeImapListeners } from "./services/imapListener";
import { seedAllocationConfig } from "./services/allocationService";
import { PropertyModel } from "./models/property";
import { AccountModel } from "./models/account";
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

    const { ensureDefaultPipeline } = await import("./scripts/ensureDefaultPipeline");
    await ensureDefaultPipeline();
    
    const { ensureDefaultProfiles } = await import("./scripts/ensureDefaultProfiles");
    await ensureDefaultProfiles();

    const { ensureDefaultGroups } = await import("./scripts/ensureDefaultGroups");
    await ensureDefaultGroups();

    // Seed allocation config for default org
    const defaultOrgId = process.env.DEFAULT_ORG_ID;
    let orgId: string | null = null;
    if (defaultOrgId && Types.ObjectId.isValid(defaultOrgId)) {
      orgId = defaultOrgId;
    }
    if (!orgId) {
      const firstProperty = await PropertyModel.findOne().select("_id").lean();
      if (firstProperty) orgId = firstProperty._id.toString();
    }
    if (!orgId) {
      const firstAccount = await AccountModel.findOne().select("_id").lean();
      if (firstAccount) orgId = firstAccount._id.toString();
    }
    if (orgId) {
      seedAllocationConfig(orgId).catch((err) =>
        logger.error("Failed to seed allocation config", { orgId }, err instanceof Error ? err : new Error(String(err)))
      );
    } else {
      logger.warn("No default org for allocation config seeding (set DEFAULT_ORG_ID or add properties/accounts)");
    }

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket server
    initializeWebSocket(httpServer);

    httpServer.listen(config.port, () => {
      logger.info(`PostcardCRM API listening on port ${config.port}`);
      logger.info(`WebSocket server running on port ${config.port}`);

      // Boot up the IMAP push-listener for any configured email accounts
      initializeImapListeners().catch(logger.error);
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
