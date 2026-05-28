import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadAllocationRules } from "./LeadAllocationRules";
import { LeadAllocationCapacity } from "./LeadAllocationCapacity";
import { LeadAllocationWorkload } from "./LeadAllocationWorkload";
import { LeadAllocationTest } from "./LeadAllocationTest";

export function LeadAllocationPage() {
  const [activeTab, setActiveTab] = useState("rules");

  return (
    <div className="space-y-6 p-6 max-w-6xl">
      <div>
        <h1 className="text-lg font-semibold">Lead Allocation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure V2 assignment rules, capacity, and test how leads are assigned
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="rules">Assignment Rules</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="workload">Agent Workload</TabsTrigger>
          <TabsTrigger value="test">Test Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <LeadAllocationRules />
        </TabsContent>

        <TabsContent value="capacity" className="mt-6">
          <LeadAllocationCapacity />
        </TabsContent>

        <TabsContent value="workload" className="mt-6">
          <LeadAllocationWorkload />
        </TabsContent>

        <TabsContent value="test" className="mt-6">
          <LeadAllocationTest />
        </TabsContent>
      </Tabs>
    </div>
  );
}
