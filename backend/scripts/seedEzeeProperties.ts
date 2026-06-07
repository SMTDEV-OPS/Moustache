import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { seedEzeeProperties } from "../src/scripts/seedEzeeProperties";

mongoose
  .connect(config.mongoUri)
  .then(async () => {
    await seedEzeeProperties();
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
