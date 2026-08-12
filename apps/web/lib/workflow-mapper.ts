import type { Edge } from 'reactflow';

import type {
  AIFlowNode,
  DestinationFlowNode,
  TriggerFlowNode,
  WorkflowFlowNode,
} from './node-types';
import type { WorkflowDto, WorkflowInputDto, WorkflowStepDto } from './workflow-dto';

export type MapWorkflowResult =
  { ok: true; input: WorkflowInputDto } | { ok: false; error: string };

/**
 * The only place that converts the visual model (Nodes/Edges) into the
 * DTO shape the API expects. React Flow's canvas state never leaves this
 * function in any other form — no component POSTs a Node directly.
 *
 * Mirrors the same structural rules Workflow.create() enforces server-side
 * (at least one of each type, Trigger first) so the editor can reject an
 * invalid graph before ever calling the API — but the API still re-validates
 * independently; this is a UX shortcut, not the source of truth.
 */
export function mapFlowToWorkflowInput(
  name: string,
  nodes: readonly WorkflowFlowNode[],
  edges: readonly Edge[],
): MapWorkflowResult {
  if (name.trim().length === 0) {
    return { ok: false, error: 'Workflow name is required.' };
  }

  const triggers = nodes.filter((node): node is TriggerFlowNode => node.type === 'trigger');
  const aiNodes = nodes.filter((node): node is AIFlowNode => node.type === 'ai');
  const destinations = nodes.filter(
    (node): node is DestinationFlowNode => node.type === 'destination',
  );

  if (triggers.length !== 1) {
    return { ok: false, error: 'Add exactly one Trigger node.' };
  }
  if (aiNodes.length !== 1) {
    return { ok: false, error: 'Add exactly one AI node.' };
  }
  if (destinations.length !== 1) {
    return { ok: false, error: 'Add exactly one Destination node.' };
  }

  const trigger = triggers[0]!;
  const ai = aiNodes[0]!;
  const destination = destinations[0]!;

  const triggerToAi = edges.some((edge) => edge.source === trigger.id && edge.target === ai.id);
  const aiToDestination = edges.some(
    (edge) => edge.source === ai.id && edge.target === destination.id,
  );

  if (!triggerToAi || !aiToDestination) {
    return {
      ok: false,
      error: 'Connect the nodes in order: Trigger → AI → Destination.',
    };
  }

  if (ai.data.instruction.trim().length === 0) {
    return { ok: false, error: 'The AI node needs an instruction.' };
  }
  if (destination.data.target.trim().length === 0) {
    return { ok: false, error: 'The Destination node needs a target (e.g. a Slack channel).' };
  }

  const steps: WorkflowStepDto[] = [
    { type: 'TRIGGER', kind: trigger.data.kind },
    { type: 'AI', provider: ai.data.provider, instruction: ai.data.instruction },
    {
      type: 'DESTINATION',
      destination: destination.data.destination,
      target: destination.data.target,
    },
  ];

  return { ok: true, input: { name, steps } };
}

/**
 * Inverse of mapFlowToWorkflowInput: reconstructs the 3 React Flow nodes
 * (Trigger/AI/Destination, per Workflow.create()'s fixed shape) and the 2
 * edges connecting them, from a workflow fetched via GET /workflows/:id.
 *
 * Node positions were never persisted (PrismaWorkflowRepository only ever
 * stored {id, type, config}), so this always lays the graph out the same
 * deterministic way INITIAL_NODES does in flow-editor.tsx — it never tries to
 * restore where the user last dragged a node.
 */
export function mapWorkflowToFlow(workflow: WorkflowDto): {
  nodes: WorkflowFlowNode[];
  edges: Edge[];
} {
  const steps = workflow.steps ?? [];
  const trigger = steps.find(
    (step): step is Extract<WorkflowStepDto, { type: 'TRIGGER' }> => step.type === 'TRIGGER',
  );
  const ai = steps.find(
    (step): step is Extract<WorkflowStepDto, { type: 'AI' }> => step.type === 'AI',
  );
  const destination = steps.find(
    (step): step is Extract<WorkflowStepDto, { type: 'DESTINATION' }> =>
      step.type === 'DESTINATION',
  );

  if (!trigger || !ai || !destination) {
    throw new Error('Workflow is missing one of its required Trigger/AI/Destination steps.');
  }

  const nodes: WorkflowFlowNode[] = [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 250, y: 0 },
      data: { kind: trigger.kind },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 200, y: 140 },
      data: { provider: ai.provider, instruction: ai.instruction },
    },
    {
      id: 'destination-1',
      type: 'destination',
      position: { x: 200, y: 340 },
      data: { destination: destination.destination, target: destination.target },
    },
  ];

  const edges: Edge[] = [
    { id: 'trigger-1-ai-1', source: 'trigger-1', target: 'ai-1' },
    { id: 'ai-1-destination-1', source: 'ai-1', target: 'destination-1' },
  ];

  return { nodes, edges };
}
