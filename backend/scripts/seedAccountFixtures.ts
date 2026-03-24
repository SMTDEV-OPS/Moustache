import mongoose from "mongoose";
import dotenv from "dotenv";
import { AccountModel } from "../src/models/account";
import { UserModel } from "../src/models/user";
import { PropertyModel } from "../src/models/property";
import { ConglomerateModel } from "../src/models/conglomerate";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/moustachecrm";

async function seedAccountFixtures() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const users = await UserModel.find({ status: "ACTIVE" }).limit(5).lean();
  const properties = await PropertyModel.find({ status: "ACTIVE" }).limit(3).lean();
  const conglomerate = await ConglomerateModel.findOne({ isActive: true }).lean();

  const pam = users[0];
  const sam1 = users[1];
  const sam2 = users[2];

  const propertyIds = properties.map((p) => p._id);

  const basePrimaryManager = pam
    ? { userId: pam._id, name: pam.name, city: properties[0]?.location?.city || "Mumbai" }
    : undefined;

  const baseSecondaryManagers = [
    sam1
      ? { userId: sam1._id, name: sam1.name, city: properties[1]?.location?.city || "Delhi" }
      : null,
    sam2
      ? { userId: sam2._id, name: sam2.name, city: properties[2]?.location?.city || "Bengaluru" }
      : null,
  ].filter(Boolean) as Array<{ userId: mongoose.Types.ObjectId; name: string; city: string }>;

  const master = await AccountModel.findOneAndUpdate(
    { name: "Acme Global Holdings Pvt Ltd" },
    {
      $set: {
        name: "Acme Global Holdings Pvt Ltd",
        organizationType: "CORPORATE",
        customOrganizationType: "",
        customOrganizationTypes: ["Startup Collective", "Strategic Alliance"],
        conglomerateId: conglomerate?._id || null,
        conglomerateName: conglomerate?.name,
        accountLevel: "MASTER",
        isHeadquarter: true,
        profileStatus: "ACTIVE",
        canChangeHeadquarter: true,
        headquarterName: "Acme Global HQ",
        hqAccountId: null,
        type: "CORPORATE",
        parentAccountId: null,
        addressLine1: "Level 12, Skyline Tower",
        addressLine2: "Business Bay",
        zip: "400001",
        city: "Mumbai",
        subCity: "South Mumbai",
        state: "Maharashtra",
        country: "India",
        zone: "WEST",
        locality: "Nariman Point",
        pmsProfileId: "PMS-ACME-001",
        email: "corp@acmeglobal.example",
        secondaryEmail: "sales.ops@acmeglobal.example",
        boardLine: "+91-22-4000-0000",
        fax: "+91-22-4000-0001",
        website: "https://acmeglobal.example",
        marketSegment: "Enterprise",
        gstin: "27ABCDE1234F1Z5",
        panNumber: "ABCDE1234F",
        accountClassification: "KEY_ACCOUNT",
        industry: "Technology & Digital",
        industryCategory: "Technology & Digital",
        industrySubCategory: "Software & SaaS",
        industrySize: "LARGE",
        industryStatus: "LARGE",
        officeStatus: "ACTIVE",
        travelAgentImplant: "NO",
        salesTeam: "National Enterprise",
        contractingType: "GLOBAL_RFP",
        pmsSource: "EZEE",
        contractingTypes: [
          { type: "GLOBAL_RFP", fromYear: 2026, toYear: 2027, fromMonth: 4, toMonth: 3 },
          { type: "ANNUAL_CONTRACT", year: 2026, fromMonth: 1, toMonth: 12 },
        ],
        accountType: "RETENTION",
        accountTypeOverride: false,
        businessPotentialCity: "Mumbai",
        primarySalesPerson: basePrimaryManager?.name || "Default PAM",
        secondarySalesPerson: baseSecondaryManagers[0]?.name || "Default SAM",
        primaryAccountManager: basePrimaryManager,
        secondaryAccountManagers: baseSecondaryManagers,
        customerBlacklist: false,
        creditAllowed: true,
        creditLimits: 2500000,
        creditDays: 45,
        billingInstruction: "Centralized invoicing. Monthly statement required.",
        loyaltyProgram: "Acme Elite",
        loyaltyNumber: "ACE-0001",
        loyaltyCreditPoint: 1250,
        hotel: "Moustache Mumbai",
        hotelCity: "Mumbai",
        starCategory: "5",
        office: "Corporate HQ",
        travelAgencyType: "Corporate Travel Desk",
        distance: 7,
        roomNight: 1200,
        rate: 6500,
        adr: 6900,
        remarks: "Flagship strategic account",
        propertyIds,
        marketArea: "South Zone",
        competitor: "Contoso Holdings",
        primaryContact: {
          name: "Ananya Rao",
          phone: "+91-9876543210",
          email: "ananya.rao@acmeglobal.example",
        },
        notes: "Top priority account for enterprise sales motion",
        tags: ["priority", "enterprise", "national"],
        status: "ACTIVE",
        systemSyncedFields: ["gstin", "panNumber", "pmsProfileId", "addressLine1", "city", "zip"],
        followUpDate: new Date(),
        followUpNote: "Quarterly business review planned",
      },
    },
    { upsert: true, new: true }
  );

  const parent = await AccountModel.findOneAndUpdate(
    { name: "Acme Corporate Travel - West" },
    {
      $set: {
        name: "Acme Corporate Travel - West",
        organizationType: "TRAVEL_AGENT",
        accountLevel: "PARENT",
        type: "TRAVEL_AGENT",
        parentAccountId: master._id,
        hqAccountId: master._id,
        isHeadquarter: false,
        profileStatus: "ACTIVE",
        country: "India",
        city: "Pune",
        state: "Maharashtra",
        zone: "WEST",
        addressLine1: "Plot 21, Senapati Bapat Road",
        zip: "411016",
        email: "west.travel@acmeglobal.example",
        boardLine: "+91-20-5555-1100",
        industry: "Hospitality, Travel & Leisure",
        industryCategory: "Hospitality, Travel & Leisure",
        industrySubCategory: "Travel & Tourism",
        industryStatus: "MEDIUM",
        accountType: "DEVELOPMENT",
        accountTypeOverride: false,
        primaryAccountManager: basePrimaryManager,
        secondaryAccountManagers: baseSecondaryManagers,
        propertyIds,
        contractingTypes: [{ type: "LOCAL_CONTRACTING", year: 2026, fromMonth: 4, toMonth: 3 }],
        tags: ["regional", "travel-agent"],
        status: "ACTIVE",
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        followUpNote: "Follow up on annual contracting",
      },
    },
    { upsert: true, new: true }
  );

  await AccountModel.findOneAndUpdate(
    { name: "Acme MICE Bangalore Branch" },
    {
      $set: {
        name: "Acme MICE Bangalore Branch",
        organizationType: "EVENT_ORGANISER",
        accountLevel: "BRANCH",
        type: "EVENT_PLANNER",
        parentAccountId: parent._id,
        hqAccountId: master._id,
        isHeadquarter: false,
        profileStatus: "ACTIVE",
        country: "India",
        city: "Bengaluru",
        state: "Karnataka",
        zone: "SOUTH",
        locality: "Koramangala",
        addressLine1: "7th Block, Koramangala",
        zip: "560095",
        email: "mice.blr@acmeglobal.example",
        website: "https://events.acmeglobal.example",
        industryCategory: "Hospitality, Travel & Leisure",
        industrySubCategory: "Event Management",
        industryStatus: "MEDIUM",
        accountType: "ACQUISITION",
        accountTypeOverride: true,
        primaryAccountManager: basePrimaryManager,
        secondaryAccountManagers: baseSecondaryManagers,
        creditAllowed: false,
        propertyIds,
        tags: ["mice", "branch"],
        status: "ACTIVE",
      },
    },
    { upsert: true, new: true }
  );

  await AccountModel.findOneAndUpdate(
    { name: "Acme PSU Hospitality Cell" },
    {
      $set: {
        name: "Acme PSU Hospitality Cell",
        organizationType: "PUBLIC_SECTOR_UNIT",
        accountLevel: "SUBSIDIARY",
        type: "GOVERNMENT",
        parentAccountId: master._id,
        hqAccountId: master._id,
        isHeadquarter: false,
        profileStatus: "NA",
        country: "India",
        city: "New Delhi",
        state: "Delhi",
        zone: "NORTH",
        addressLine1: "Sector Office Complex",
        zip: "110001",
        email: "psu.cell@acmeglobal.example",
        industryCategory: "Others / Niche",
        industrySubCategory: "Security Services",
        industryStatus: "SMALL",
        accountType: "RETENTION",
        accountTypeOverride: false,
        primaryAccountManager: basePrimaryManager,
        secondaryAccountManagers: baseSecondaryManagers,
        propertyIds: propertyIds.slice(0, 1),
        tags: ["government", "na-profile"],
        status: "NA",
      },
    },
    { upsert: true, new: true }
  );

  console.log("Account fixtures seeded successfully.");
}

seedAccountFixtures()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Failed to seed account fixtures:", err);
    await mongoose.disconnect();
    process.exit(1);
  });

