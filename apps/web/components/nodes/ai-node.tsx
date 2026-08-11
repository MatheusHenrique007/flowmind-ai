'use client';

import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';

import type { AINodeData } from '../../lib/node-types';

export function AINode({ id, data }: NodeProps<AINodeData>) {
  const { setNodes } = useReactFlow();

  function update(patch: Partial<AINodeData>) {
    setNodes((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
    );
  }

  return (
    <div className="w-64 rounded-md border-2 border-indigo-500 bg-indigo-50 px-4 py-3 text-sm shadow">
      <Handle type="target" position={Position.Top} className="!bg-indigo-600" />
      <div className="font-semibold text-indigo-800">AI Step</div>
      <label className="mt-2 block text-xs text-indigo-700">
        Provider
        <select
          value={data.provider}
          onChange={(event) => update({ provider: event.target.value as AINodeData['provider'] })}
          className="mt-1 w-full rounded border border-indigo-300 bg-white px-2 py-1"
        >
          <option value="CLAUDE">Claude</option>
          <option value="OPENAI">OpenAI</option>
          <option value="GEMINI">Gemini</option>
        </select>
      </label>
      <label className="mt-2 block text-xs text-indigo-700">
        Instruction
        <textarea
          value={data.instruction}
          onChange={(event) => update({ instruction: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded border border-indigo-300 bg-white px-2 py-1"
          placeholder="Summarize the incoming message in two sentences."
        />
      </label>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-600" />
    </div>
  );
}
