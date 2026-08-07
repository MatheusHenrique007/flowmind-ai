'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { createWorkflow, executeWorkflow, updateWorkflow } from '../lib/api-client';
import type { WorkflowFlowNode } from '../lib/node-types';
import { mapFlowToWorkflowInput } from '../lib/workflow-mapper';

import { AINode } from './nodes/ai-node';
import { DestinationNode } from './nodes/destination-node';
import { TriggerNode } from './nodes/trigger-node';

const nodeTypes = { trigger: TriggerNode, ai: AINode, destination: DestinationNode };

const INITIAL_NODES: WorkflowFlowNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 0 },
    data: { kind: 'webhook' },
  },
  {
    id: 'ai-1',
    type: 'ai',
    position: { x: 200, y: 140 },
    data: { provider: 'CLAUDE', instruction: 'Summarize the incoming message in two sentences.' },
  },
  {
    id: 'destination-1',
    type: 'destination',
    position: { x: 200, y: 340 },
    data: { destination: 'SLACK', target: '#alerts' },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'trigger-1-ai-1', source: 'trigger-1', target: 'ai-1' },
  { id: 'ai-1-destination-1', source: 'ai-1', target: 'destination-1' },
];

type SaveState = { status: 'idle' } | { status: 'saved'; workflowId: string; name: string };
type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: string }
  | { status: 'error'; message: string };

function FlowEditorInner() {
  const [nodes, , onNodesChange] = useNodesState<WorkflowFlowNode['data']>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [name, setName] = useState('Webhook to Slack');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [payload, setPayload] = useState('Customer reported a checkout error and needs help.');

  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => addEdge(connection, current)),
    [setEdges],
  );

  const mapped = useMemo(
    () => mapFlowToWorkflowInput(name, nodes as WorkflowFlowNode[], edges),
    [name, nodes, edges],
  );

  async function handleSave() {
    setError(null);
    if (!mapped.ok) {
      setError(mapped.error);
      return;
    }
    try {
      const workflow =
        saveState.status === 'saved'
          ? await updateWorkflow(saveState.workflowId, mapped.input)
          : await createWorkflow(mapped.input);
      setSaveState({ status: 'saved', workflowId: workflow.id, name: workflow.name });
      setRunState({ status: 'idle' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save the workflow.');
    }
  }

  async function handleExecute() {
    if (saveState.status !== 'saved') {
      setError('Save the workflow before executing it.');
      return;
    }
    setRunState({ status: 'running' });
    try {
      await executeWorkflow(saveState.workflowId, { text: payload });
      setRunState({
        status: 'done',
        result: 'Queued — check /workflow-runs for the result once the Worker processes it.',
      });
    } catch (cause) {
      setRunState({
        status: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to execute the workflow.',
      });
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Workflow name"
        />
        <button
          onClick={handleSave}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save
        </button>
        <input
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Sample input text for the webhook"
        />
        <button
          onClick={handleExecute}
          disabled={saveState.status !== 'saved' || runState.status === 'running'}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Execute
        </button>
        {saveState.status === 'saved' && (
          <span className="text-xs text-slate-500">saved as {saveState.workflowId}</span>
        )}
      </header>

      {error && <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {runState.status === 'done' && (
        <div className="bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{runState.result}</div>
      )}
      {runState.status === 'error' && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{runState.message}</div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
