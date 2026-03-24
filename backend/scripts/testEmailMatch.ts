import "dotenv/config";
import mongoose from "mongoose";
import { matchAndStore } from "../src/services/emailMatchingService";
import { config } from "../src/config/env";

async function run() {
  await mongoose.connect(config.mongoUri);

  const fakeParsedEmail = {
    messageId: "<test-001@mail.gmail.com>",
    threadId: "thread-abc",
    from: "testguest@gmail.com",
    subject: "Test inbound",
    bodyText: "Hello this is a test",
    bodyHtml: "<p>Hello this is a test</p>",
    receivedAt: new Date(),
    emailAccountId: "000000000000000000000000",
  };

  const result = await matchAndStore(fakeParsedEmail);
  // eslint-disable-next-line no-console
  console.log("Match result:", JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
