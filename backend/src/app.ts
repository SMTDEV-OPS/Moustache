import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { logger } from "./config/logger";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { guestsRouter } from "./routes/guests";
import { accountsRouter } from "./routes/accounts";
import { propertiesRouter } from "./routes/properties";
import { regionsRouter } from "./routes/regions";
import { leadsRouter } from "./routes/leads";
import { communicationsRouter } from "./routes/communications";
import { quotationsRouter } from "./routes/quotations";
import { paymentLinksRouter } from "./routes/paymentLinks";
import { reservationsRouter } from "./routes/reservations";
import { tasksRouter } from "./routes/tasks";
import { reportsRouter } from "./routes/reports";
import { availabilityRouter } from "./routes/availability";
import { buddiesRouter } from "./routes/buddies";
import { workflowsRouter } from "./routes/workflows";
import { rolesRouter } from "./routes/roles";
import { groupsRouter } from "./routes/groups";
import { assignmentRulesRouter } from "./routes/assignmentRules";
import assignmentRulesV2Router from "./routes/assignmentRulesV2";
import { notificationsRouter } from "./routes/notifications";
import { templatesRouter } from "./routes/templates";
import { leadWorkflowRouter } from "./routes/leadWorkflow";
import { emailRouter } from "./routes/email";
import { publicWebsiteLeadsRouter } from "./routes/public/websiteLeads";
import { publicIvrWebhooksRouter } from "./routes/public/ivrWebhooks";
import { publicWhatsappWebhooksRouter } from "./routes/public/whatsappWebhooks";
import { publicSocialWebhooksRouter } from "./routes/public/socialWebhooks";
import { publicEmailWebhooksRouter } from "./routes/public/emailWebhooks";
import { knowledgeBaseRouter } from "./routes/knowledgeBase";
import { ticketsRouter } from "./routes/tickets";
import { conglomeratesRouter } from "./routes/conglomerates";
import { contactsRouter } from "./routes/contacts";
import { accountPotentialsRouter } from "./routes/accountPotentials";
import { accountNotesRouter } from "./routes/accountNotes";
import { accountDocumentsRouter } from "./routes/accountDocuments";
import { dealsRouter } from "./routes/deals";
import { contractsRouter } from "./routes/contracts";
import { contractApprovalRulesRouter } from "./routes/contractApprovalRules";
import { contactActivitiesRouter } from "./routes/contactActivities";
import { hotelBrandsRouter } from "./routes/hotelBrands";
import { pmsRouter } from "./routes/pms";
import profilesRouter from "./routes/profiles";
import customFieldsRouter from "./routes/customFields";
import adminFieldsRouter from "./routes/adminFields";
// Eagerly register LeadItinerary model so virtual populate("itineraries") works
import "./models/leadItinerary";
import { pipelinesRouter } from "./routes/pipelines";
import { scoringRouter } from "./routes/scoringRules";
import { leadEmailRouter } from "./routes/leadEmail";

export const app = express();

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

// Request logging middleware (must be early to capture all requests)
app.use(requestLogger);

app.get("/", (_req, res) => {
  res.json({
    message: `${process.env.VITE_HOTEL_BRAND || "Moustache"} CRM API`,
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      auth: "/auth",
      api: "/api"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/guests", guestsRouter);
app.use("/accounts", accountsRouter);
app.use("/properties", propertiesRouter);
app.use("/regions", regionsRouter);
app.use("/leads", leadsRouter);
app.use("/leads", communicationsRouter);
app.use("/leads", quotationsRouter);
app.use("/leads", paymentLinksRouter);
app.use("/leads", leadEmailRouter);
app.use("/reservations", reservationsRouter);
app.use("/tasks", tasksRouter);
app.use("/reports", reportsRouter);
app.use("/availability-reports", availabilityRouter);
app.use("/buddies", buddiesRouter);
app.use("/workflows", workflowsRouter);
app.use("/templates", templatesRouter);
app.use("/leads", leadWorkflowRouter);
app.use("/email", emailRouter);
import { dataSharingRouter } from "./routes/dataSharing";

app.use("/roles", rolesRouter);
app.use("/groups", groupsRouter);
app.use("/data-sharing", dataSharingRouter);
app.use("/assignment-rules", assignmentRulesRouter);
app.use("/assignment-rules-v2-api", assignmentRulesV2Router);
app.use("/notifications", notificationsRouter);
app.use("/knowledge-base", knowledgeBaseRouter);
app.use("/tickets", ticketsRouter);
app.use("/conglomerates", conglomeratesRouter);
app.use("/contacts", contactsRouter);
app.use("/account-potentials", accountPotentialsRouter);
app.use("/account-notes", accountNotesRouter);
app.use("/account-documents", accountDocumentsRouter);
app.use("/deals", dealsRouter);
app.use("/contracts", contractsRouter);
app.use("/contract-approval-rules", contractApprovalRulesRouter);
app.use("/contact-activities", contactActivitiesRouter);
app.use("/hotel-brands", hotelBrandsRouter);
app.use("/pms", pmsRouter);
app.use("/profiles", profilesRouter);
app.use("/custom-fields", customFieldsRouter);
app.use("/api/admin/fields", adminFieldsRouter);
import { scoringThresholdsRouter } from "./routes/scoringThresholds";
import { callQualityDimensionsRouter } from "./routes/callQualityDimensions";

app.use("/pipelines", pipelinesRouter);
app.use("/scoring-rules", scoringRouter);
app.use("/api/admin/scoring/thresholds", scoringThresholdsRouter);
app.use("/api/admin/call-quality/dimensions", callQualityDimensionsRouter);
import { adminFollowupRulesRouter } from "./routes/adminFollowupRules";
import { adminWorkflowsRouter } from "./routes/adminWorkflows";
import { filtersRouter } from "./routes/filters";
import { adminAuditLogRouter } from "./routes/adminAuditLog";
import { webhookIntakeRouter } from "./routes/webhookIntake";
import { adminIntegrationsRouter } from "./routes/adminIntegrations";
import { dashboardRouter } from "./routes/dashboard";
import { searchRouter } from "./routes/search";
import { accountsDashboardRouter } from "./routes/accountsDashboard";
import { salesTargetsRouter } from "./routes/salesTargets";
import { holidaysRouter } from "./routes/holidays";
import { allocationRouter } from "./routes/allocation";
import allocationRoutingRulesRouter from "./routes/allocationRoutingRules";

app.use("/api/filters", filtersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/search", searchRouter);
app.use("/api/accounts-dashboard", accountsDashboardRouter);
app.use("/api/sales-targets", salesTargetsRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/webhook/intake", webhookIntakeRouter);
app.use("/api/admin/audit-log", adminAuditLogRouter);
app.use("/api/admin/integrations", adminIntegrationsRouter);
app.use("/api/admin/allocation", allocationRouter);
app.use("/api/admin/allocation/routing-rules", allocationRoutingRulesRouter);
app.use("/api/admin/followup-rules", adminFollowupRulesRouter);
app.use("/api/admin/workflows", adminWorkflowsRouter);

// Public endpoints (no authentication required)
app.use("/api/public/website-leads", publicWebsiteLeadsRouter);
app.use("/api/public/ivr-webhook", publicIvrWebhooksRouter);
app.use("/api/public/whatsapp-webhook", publicWhatsappWebhooksRouter);
app.use("/api/public/social-webhook", publicSocialWebhooksRouter);
app.use("/api/public/email-webhook", publicEmailWebhooksRouter);
import { knowledgePublicRouter } from "./routes/public/knowledgePublic";
app.use("/api/public/knowledge", knowledgePublicRouter);

app.use(errorHandler);

import { FollowupService } from "./services/followupService";
import { initializeWorkflowEngine } from "./services/workflowEngine";

FollowupService.initialize();
initializeWorkflowEngine();

logger.info("Express app initialized");


