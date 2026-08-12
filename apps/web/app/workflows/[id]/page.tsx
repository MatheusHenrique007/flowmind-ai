import { RequireAuth } from '../../../components/auth-provider';
import { FlowEditor } from '../../../components/flow-editor';
import { WorkspaceHeader } from '../../../components/workspace-header';

/** Opens an existing workflow into the editor for viewing/editing. */
export default async function EditWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <div className="flex h-screen flex-col">
        <WorkspaceHeader />
        <div className="min-h-0 flex-1">
          <FlowEditor workflowId={id} />
        </div>
      </div>
    </RequireAuth>
  );
}
