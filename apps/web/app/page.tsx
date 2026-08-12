import { RequireAuth } from '../components/auth-provider';
import { FlowEditor } from '../components/flow-editor';
import { WorkspaceHeader } from '../components/workspace-header';

/**
 * The editor is unchanged — it is only wrapped: RequireAuth redirects anyone
 * without a session to /login, and WorkspaceHeader shows who is signed in plus
 * the logout action.
 */
export default function HomePage() {
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
