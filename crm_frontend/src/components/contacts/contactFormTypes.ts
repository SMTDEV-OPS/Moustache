import type { ClientStatus, Contact, KeyPersonnelRole } from "@/services/contacts";

export const emptyContactForm: Partial<Contact> = {
  name: "",
  title: "Mr.",
  designation: "",
  isKeyPersonnel: false,
  keyPersonnelRole: undefined,
  email: "",
  mobileNumber1: "",
  mobileNumber2: "",
  boardNumber: "",
  officeNumber: "",
  clientStatus: "NEUTRAL",
  isLoyaltyMember: false,
  loyaltyProgramName: "",
  loyaltyNumber: "",
  dateOfBirth: "",
  weddingAnniversary: "",
};

export const CONTACT_ROLES: { value: KeyPersonnelRole; label: string }[] = [
  { value: "ADMIN_HEAD", label: "Admin Head" },
  { value: "FINANCE_HEAD", label: "Finance Head" },
  { value: "SALES_HEAD", label: "Sales Head" },
  { value: "MARKETING_HEAD", label: "Marketing Head" },
  { value: "COUNTRY_CITY_HEAD", label: "Country/City Head" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "HR_HEAD", label: "HR Head" },
  { value: "TRAINING_HEAD", label: "Training Head" },
];

export const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "PROMOTER", label: "Promoter (High Support)" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "DETRACTOR", label: "Detractor (Risk)" },
];

export function cleanContactPayload(data: Partial<Contact>): Partial<Contact> {
  const cleaned = { ...data };
  if (!cleaned.email) delete cleaned.email;
  if (!cleaned.mobileNumber1) delete cleaned.mobileNumber1;
  if (!cleaned.mobileNumber2) delete cleaned.mobileNumber2;
  if (!cleaned.boardNumber) delete cleaned.boardNumber;
  if (!cleaned.officeNumber) delete cleaned.officeNumber;
  if (!cleaned.dateOfBirth) delete cleaned.dateOfBirth;
  if (!cleaned.weddingAnniversary) delete cleaned.weddingAnniversary;
  if (!cleaned.loyaltyProgramName) delete cleaned.loyaltyProgramName;
  if (!cleaned.loyaltyNumber) delete cleaned.loyaltyNumber;
  if (!cleaned.designation) delete cleaned.designation;
  if (!cleaned.isKeyPersonnel) delete cleaned.keyPersonnelRole;
  return cleaned;
}
