import type { Node } from 'reactflow';

import type { AIProviderName, DestinationName } from './workflow-dto';

/**
 * Data carried by each React Flow node. These are UI-only shapes — React
 * Flow (and this file) never imports @flowmind/domain; workflow-mapper.ts is
 * the one place that translates this into the API's WorkflowInputDto.
 */
export type FlowNodeKind = 'trigger' | 'ai' | 'destination';

export interface TriggerNodeData {
  kind: 'webhook';
}

export interface AINodeData {
  provider: AIProviderName;
  instruction: string;
}

export interface DestinationNodeData {
  destination: DestinationName;
  target: string;
}

export type TriggerFlowNode = Node<TriggerNodeData, 'trigger'>;
export type AIFlowNode = Node<AINodeData, 'ai'>;
export type DestinationFlowNode = Node<DestinationNodeData, 'destination'>;

export type WorkflowFlowNode = TriggerFlowNode | AIFlowNode | DestinationFlowNode;
