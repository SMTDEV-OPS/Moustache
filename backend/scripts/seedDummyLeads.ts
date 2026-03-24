import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { LeadModel } from "../src/models/lead";
import { AccountModel } from "../src/models/account";
import { PropertyModel } from "../src/models/property";
import { UserModel } from "../src/models/user";
import { PipelineStageModel } from "../src/models/pipelineStage";
import { HeatLevel, LeadSource, LeadStatus, LeadType } from "../src/models/common";

type DummyLeadSeed = {
  leadNumber: string;
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  heatLevel: HeatLevel;
  score: number;
  budget: number;
  bookingWindow: string;
  customerType: string;
  status: LeadStatus;
  notes: string;
  tags: string[];
};

const DUMMY_LEADS: DummyLeadSeed[] = [
  {
    leadNumber: "DUMMY-LEAD-0001",
    name: "Aarav Mehta",
    phone: "+91 9876500001",
    email: "aarav.mehta@example.com",
    source: LeadSource.BRAND_WEBSITE,
    heatLevel: HeatLevel.HOT,
    score: 9,
    budget: 28000,
    bookingWindow: "Within 24 hrs",
    customerType: "B2C",
    status: LeadStatus.NEW,
    notes: "Weekend leisure stay, prefers lake-facing room.",
    tags: ["dummy", "weekend", "leisure"],
  },
  {
    leadNumber: "DUMMY-LEAD-0002",
    name: "Isha Kapoor",
    phone: "+91 9876500002",
    email: "isha.kapoor@example.com",
    source: LeadSource.WHATSAPP,
    heatLevel: HeatLevel.WARM,
    score: 6,
    budget: 18000,
    bookingWindow: "Yet to decide",
    customerType: "Corporate",
    status: LeadStatus.CONTACTED,
    notes: "Corporate offsite inquiry for 8 guests.",
    tags: ["dummy", "corporate"],
  },
  {
    leadNumber: "DUMMY-LEAD-0003",
    name: "Kabir Singh",
    phone: "+91 9876500003",
    email: "kabir.singh@example.com",
    source: LeadSource.IVR_LIVE,
    heatLevel: HeatLevel.HOT,
    score: 8,
    budget: 35000,
    bookingWindow: "Within 5 hrs",
    customerType: "HNI",
    status: LeadStatus.QUOTATION_SHARED,
    notes: "Anniversary booking; asked for private dining add-on.",
    tags: ["dummy", "anniversary"],
  },
  {
    leadNumber: "DUMMY-LEAD-0004",
    name: "Neha Bansal",
    phone: "+91 9876500004",
    email: "neha.bansal@example.com",
    source: LeadSource.EMAIL,
    heatLevel: HeatLevel.COLD,
    score: 3,
    budget: 12000,
    bookingWindow: "Yet to decide",
    customerType: "B2C",
    status: LeadStatus.NEW,
    notes: "Price sensitive; comparing multiple properties.",
    tags: ["dummy", "price-sensitive"],
  },
  {
    leadNumber: "DUMMY-LEAD-0005",
    name: "Rohan Verma",
    phone: "+91 9876500005",
    email: "rohan.verma@example.com",
    source: LeadSource.TRAVEL_AGENT,
    heatLevel: HeatLevel.WARM,
    score: 5,
    budget: 22000,
    bookingWindow: "Within 24 hrs",
    customerType: "B2B",
    status: LeadStatus.CONTACTED,
    notes: "Travel desk lead for long weekend group stay.",
    tags: ["dummy", "agent"],
  },
  {
    leadNumber: "DUMMY-LEAD-0006",
    name: "Sanya Arora",
    phone: "+91 9876500006",
    email: "sanya.arora@example.com",
    source: LeadSource.SOCIAL,
    heatLevel: HeatLevel.HOT,
    score: 7,
    budget: 26000,
    bookingWindow: "Within 24 hrs",
    customerType: "Influencer",
    status: LeadStatus.PAYMENT_PENDING,
    notes: "Requested barter + paid collaboration package details.",
    tags: ["dummy", "influencer"],
  },
  {
    leadNumber: "DUMMY-LEAD-0007",
    name: "Vikram Rao",
    phone: "+91 9876500007",
    email: "vikram.rao@example.com",
    source: LeadSource.REFERRAL,
    heatLevel: HeatLevel.WARM,
    score: 6,
    budget: 30000,
    bookingWindow: "Within 5 hrs",
    customerType: "Reference",
    status: LeadStatus.CONTACTED,
    notes: "Referred by existing guest, asks for airport pickup.",
    tags: ["dummy", "referral"],
  },
  {
    leadNumber: "DUMMY-LEAD-0008",
    name: "Meera Nair",
    phone: "+91 9876500008",
    email: "meera.nair@example.com",
    source: LeadSource.MANUAL,
    heatLevel: HeatLevel.COLD,
    score: 2,
    budget: 10000,
    bookingWindow: "Yet to decide",
    customerType: "B2C",
    status: LeadStatus.ON_HOLD,
    notes: "Need date flexibility; waiting on travel confirmation.",
    tags: ["dummy", "hold"],
  },
];

export async function seedDummyLeads() {
  const [property, account, user, stage] = await Promise.all([
    PropertyModel.findOne({ status: "ACTIVE" }).select("_id").lean(),
    AccountModel.findOne({ status: "ACTIVE" }).select("_id").lean(),
    UserModel.findOne({ status: "ACTIVE" }).select("_id").lean(),
    PipelineStageModel.findOne().sort({ order: 1 }).select("_id").lean(),
  ]);

  let created = 0;
  let updated = 0;

  for (const lead of DUMMY_LEADS) {
    const existing = await LeadModel.findOne({ leadNumber: lead.leadNumber }).select("_id").lean();

    await LeadModel.findOneAndUpdate(
      { leadNumber: lead.leadNumber },
      {
        $set: {
          source: lead.source,
          leadType: LeadType.STAY,
          status: lead.status,
          stageId: stage?._id,
          heatLevel: lead.heatLevel,
          score: lead.score,
          budget: lead.budget,
          bookingWindow: lead.bookingWindow,
          customerType: lead.customerType,
          isFirstTimeGuest: true,
          contactDetails: {
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
          },
          propertyId: property?._id,
          accountId: account?._id,
          assignedToUserId: user?._id,
          notes: lead.notes,
          tags: lead.tags,
        },
      },
      { upsert: true, new: true }
    );

    if (existing) updated++;
    else created++;
  }

  console.log("Dummy leads seeded:");
  console.log(`- Leads created: ${created}`);
  console.log(`- Leads updated: ${updated}`);
}

if (require.main === module) {
  mongoose
    .connect(config.mongoUri)
    .then(async () => {
      await seedDummyLeads();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Failed to seed dummy leads:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
