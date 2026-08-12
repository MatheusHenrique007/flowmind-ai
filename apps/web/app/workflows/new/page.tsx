import { RequireAuth } from '../../../components/auth-provider';
import { FlowEditor } from '../../../components/flow-editor';
import { WorkspaceHeader } from '../../../components/workspace-header';

/** Editor with no workflowId: today's default hardcoded-new-workflow behavior. */
export default function NewWorkflowPage() {
  return (
    <RequireAuth>
      <div className="flex h-screen flex-col">
        <WorkspaceHeader />
        <div className="min-h-0 flex-1">
          <FlowEditor />
        </div>
      </div>
    </RequireAuth>
  );
}
