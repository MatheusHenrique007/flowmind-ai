import type { Edge } from 'reactflow';

import type {
  AIFlowNode,
  DestinationFlowNode,
  TriggerFlowNode,
  WorkflowFlowNode,
} from './node-types';
import type { WorkflowInputDto, WorkflowStepDto } from './workflow-dto';

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
