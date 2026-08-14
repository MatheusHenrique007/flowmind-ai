'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { createWorkflow, executeWorkflow, getWorkflow, updateWorkflow } from '../lib/api-client';
import type { WorkflowFlowNode } from '../lib/node-types';
import { pollForRunCompletion, snapshotRunIds, type PollHandle } from '../lib/run-polling';
import type { WorkflowRunDto } from '../lib/workflow-dto';
import { mapFlowToWorkflowInput, mapWorkflowToFlow } from '../lib/workflow-mapper';

import { AINode } from './nodes/ai-node';
import { DestinationNode } from './nodes/destination-node';
import { TriggerNode } from './nodes/trigger-node';
import { SchedulesPanel } from './schedules-panel';
import { WorkflowRunsPanel } from './workflow-runs-panel';

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
  | { status: 'running'; run?: WorkflowRunDto }
  | { status: 'done'; run: WorkflowRunDto }
  | { status: 'error'; message: string };

function FlowEditorInner({ workflowId }: { workflowId?: string }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode['data']>(
    workflowId ? [] : INITIAL_NODES,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflowId ? [] : INITIAL_EDGES);
  const [name, setName] = useState(workflowId ? '' : 'Webhook to Slack');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [payload, setPayload] = useState('Customer reported a checkout error and needs help.');
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0);
  const pollHandleRef = useRef<PollHandle | null>(null);

  useEffect(
    () => () => {
      // Cancel any in-flight polling if the editor unmounts (e.g. navigating away
      // mid-run) — the polling loop has no other way to know to stop.
      pollHandleRef.current?.cancel();
    },
    [],
  );

  useEffect(() => {
    if (!workflowId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const workflow = await getWorkflow(workflowId);
        if (cancelled) {
          return;
        }
        const { nodes: loadedNodes, edges: loadedEdges } = mapWorkflowToFlow(workflow);
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setName(workflow.name);
        setSaveState({ status: 'saved', workflowId: workflow.id, name: workflow.name });
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Failed to load the workflow.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-runs if a different workflow id is opened.
  }, [workflowId]);

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
      router.push('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save the workflow.');
    }
  }

  async function handleExecute() {
    if (saveState.status !== 'saved') {
      setError('Save the workflow before executing it.');
      return;
    }
    const workflowId = saveState.workflowId;
    setRunState({ status: 'running' });
    try {
      // Snapshot *before* executing so the run this click creates can be told
      // apart from any run that already existed (see lib/run-polling.ts).
      const knownRunIds = await snapshotRunIds(workflowId);
      await executeWorkflow(workflowId, { text: payload });

      pollHandleRef.current?.cancel();
      const handle = pollForRunCompletion(workflowId, knownRunIds, {
        onUpdate: (run) => setRunState({ status: 'running', run }),
      });
      pollHandleRef.current = handle;

      const run = await handle.promise;
      pollHandleRef.current = null;
      setRunState({ status: 'done', run });
      setHistoryRefreshSignal((signal) => signal + 1);
    } catch (cause) {
      pollHandleRef.current = null;
      setRunState({
        status: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to execute the workflow.',
      });
      // The run may still have started even if polling itself failed (e.g.
      // timed out) — refresh history so the panel can pick it up regardless.
      setHistoryRefreshSignal((signal) => signal + 1);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          &larr; My Workflows
        </button>
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
      {runState.status === 'running' && (
        <div className="bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {runState.run ? `Run is ${runState.run.status}…` : 'Starting the run…'}
        </div>
      )}
      {runState.status === 'done' && runState.run.status === 'SUCCEEDED' && (
        <div className="bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Run succeeded — see it in the run history below.
        </div>
      )}
      {runState.status === 'done' && runState.run.status !== 'SUCCEEDED' && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700">
          Run finished as {runState.run.status} — see it in the run history below.
        </div>
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

      {saveState.status === 'saved' && (
        <>
          <SchedulesPanel workflowId={saveState.workflowId} />
          <WorkflowRunsPanel
            workflowId={saveState.workflowId}
            refreshSignal={historyRefreshSignal}
          />
        </>
      )}
    </div>
  );
}

export function FlowEditor({ workflowId }: { workflowId?: string } = {}) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
