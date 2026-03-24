import mongoose from "mongoose";
import { createLead } from "./src/services/leadService";

async function run() {
  await mongoose.connect("mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/postcard_crm?retryWrites=true&w=majority&appName=Cluster0");
  const lead = await createLead({
    guestContact: { name: "Test Lead", phone: "9999999999" },
    budget: 700000,
    bookingWindow: "Within 5 hrs",
    source: "BRAND_WEBSITE" as any,
    leadType: "STAY" as any,
  });
  console.log("Created Lead:", lead._id);
  console.log("Score:", lead.score);
  console.log("HeatLevel:", lead.heatLevel);
  console.log("AssignedTo:", lead.assignedToUserId);
  console.log("Budget:", lead.budget);
  
  // Wait to let Followup rules generate tasks
  await new Promise(r => setTimeout(r, 2000));
  const { TaskModel } = await import("./src/models/task");
  const dbtasks = await TaskModel.countDocuments({ leadId: lead._id });
  console.log("Tasks:", dbtasks);
  process.exit(0);
}
run();
