import { EmployeeGroupModel } from "../models/employeeGroup";

export async function ensureDefaultGroups() {
  const existingGroups = await EmployeeGroupModel.countDocuments();
  if (existingGroups > 0) return;

  await EmployeeGroupModel.create({
    name: "Sales Team",
    description: "Default sales team",
    memberUserIds: [],
    memberRoleIds: [],
    isActive: true,
  });

  console.log("[Groups] Created default Sales Team group");
}
