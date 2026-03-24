import { ContractApprovalRuleModel } from "../models/contractApprovalRule";
import { UserModel } from "../models/user";

export interface ResolvedApprovalStep {
  step: number;
  approverUserId: string;
  approverName: string;
  label?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export async function buildApprovalChain(
  contractData: {
    propertyIds: string[];
    channel: string;
    accountType?: string;
    organisationType?: string;
  },
  submitterId: string
): Promise<ResolvedApprovalStep[]> {
  const rules = await ContractApprovalRuleModel.find({ is_active: true }).sort({ priority: 1 }).lean();

  let matchedRule: any = null;

  for (const rule of rules) {
    if (rule.applyToAll) {
      matchedRule = rule;
      break;
    }

    const contractValue = getFieldValue(contractData, rule.condition_field);
    if (evaluateCondition(contractValue, rule.condition_operator, rule.condition_value as any)) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    return buildFallbackChain(submitterId);
  }

  const resolved: ResolvedApprovalStep[] = [];
  const sortedSteps = [...(matchedRule.approvalSteps ?? [])].sort((a, b) => a.step - b.step);
  for (const stepDef of sortedSteps) {
    let userId: string | null = null;
    let userName = "Unknown";

    if (stepDef.approverType === "specific_user" && stepDef.approverUserId) {
      const user = await UserModel.findById(stepDef.approverUserId).select("name").lean();
      if (user) {
        userId = user._id.toString();
        userName = user.name;
      }
    } else if (stepDef.approverType === "role" && stepDef.approverRoleId) {
      const user = await UserModel.findOne({
        roleId: stepDef.approverRoleId,
        status: "ACTIVE",
      })
        .select("name")
        .lean();
      if (user) {
        userId = user._id.toString();
        userName = user.name;
      }
    } else if (stepDef.approverType === "reports_to_submitter") {
      const submitter = await UserModel.findById(submitterId).select("reportsTo").lean();
      if (submitter?.reportsTo) {
        const manager = await UserModel.findById(submitter.reportsTo).select("name").lean();
        if (manager) {
          userId = manager._id.toString();
          userName = manager.name;
        }
      }
    }

    if (userId) {
      resolved.push({
        step: stepDef.step,
        approverUserId: userId,
        approverName: userName,
        label: stepDef.label,
        status: "PENDING",
      });
    }
  }

  return resolved;
}

async function buildFallbackChain(submitterId: string): Promise<ResolvedApprovalStep[]> {
  const submitter = await UserModel.findById(submitterId).select("reportsTo").lean();
  if (!submitter?.reportsTo) return [];

  const manager = await UserModel.findById(submitter.reportsTo).select("name").lean();
  if (!manager) return [];

  return [
    {
      step: 1,
      approverUserId: manager._id.toString(),
      approverName: manager.name,
      label: "Manager Approval",
      status: "PENDING",
    },
  ];
}

function getFieldValue(contractData: any, field: string): string {
  switch (field) {
    case "propertyId":
      return contractData.propertyIds?.[0] ?? "";
    case "channel":
      return contractData.channel ?? "";
    case "accountType":
      return contractData.accountType ?? "";
    case "organisationType":
      return contractData.organisationType ?? "";
    default:
      return "";
  }
}

function evaluateCondition(value: string, operator: string, ruleValue: string | string[]): boolean {
  const arr = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
  switch (operator) {
    case "eq":
      return value === arr[0];
    case "neq":
      return value !== arr[0];
    case "in":
      return arr.includes(value);
    case "not_in":
      return !arr.includes(value);
    default:
      return false;
  }
}
