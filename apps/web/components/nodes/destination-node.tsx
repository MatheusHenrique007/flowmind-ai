'use client';

import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';

import type { DestinationNodeData } from '../../lib/node-types';

export function DestinationNode({ id, data }: NodeProps<DestinationNodeData>) {
  const { setNodes } = useReactFlow();

  function update(patch: Partial<DestinationNodeData>) {
    setNodes((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
    );
  }

  return (
    <div className="w-64 rounded-md border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm shadow">
      <Handle type="target" position={Position.Top} className="!bg-amber-600" />
      <div className="font-semibold text-amber-800">Destination</div>
      <label className="mt-2 block text-xs text-amber-700">
        Destination
        <select
          value={data.destination}
          onChange={(event) =>
            update({ destination: event.target.value as DestinationNodeData['destination'] })
          }
          className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1"
        >
          <option value="SLACK">Slack</option>
        </select>
      </label>
      <label className="mt-2 block text-xs text-amber-700">
        Target (channel)
        <input
          value={data.target}
          onChange={(event) => update({ target: event.target.value })}
          className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1"
          placeholder="#alerts"
        />
      </label>
    </div>
  );
}
