import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";

export async function ensureDefaultPipeline() {
  const existing = await PipelineModel.findOne({ 
    module: 'leads', isDefault: true 
  });
  if (existing) {
    const stageCount = await PipelineStageModel.countDocuments({ 
      pipelineId: existing._id 
    });
    if (stageCount > 0) {
      console.log('Default pipeline already seeded.');
      return;
    }
  }

  const pipeline = existing || await PipelineModel.create({
    name: 'Sales Pipeline',
    module: 'leads',
    isDefault: true,
    isActive: true
  });

  const stages = [
    { name: 'New Lead',        order: 1, isTerminal: false, color: '#6366f1' },
    { name: '1st Connect',     order: 2, isTerminal: false, color: '#3b82f6' },
    { name: 'Discussion',      order: 3, isTerminal: false, color: '#f59e0b' },
    { name: 'Payment Request', order: 4, isTerminal: false, color: '#8b5cf6' },
    { name: 'Booked',          order: 5, isTerminal: true,  terminalType: 'WON',  color: '#22c55e' },
    { name: 'Lost',            order: 6, isTerminal: true,  terminalType: 'LOST', color: '#ef4444' },
  ];

  await PipelineStageModel.insertMany(
    stages.map(s => ({ ...s, pipelineId: pipeline._id }))
  );

  console.log('Default pipeline seeded with 6 stages.');
}
