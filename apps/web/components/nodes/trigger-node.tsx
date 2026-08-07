'use client';

import { Handle, Position, type NodeProps } from 'reactflow';

import type { TriggerNodeData } from '../../lib/node-types';

export function TriggerNode({ data }: NodeProps<TriggerNodeData>) {
  return (
    <div className="rounded-md border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm shadow">
      <div className="font-semibold text-emerald-800">Trigger</div>
      <div className="mt-1 text-emerald-700">kind: {data.kind}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-600" />
    </div>
  );
}
