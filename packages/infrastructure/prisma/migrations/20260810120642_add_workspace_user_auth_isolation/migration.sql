-- Adds Workspace/User/RefreshToken tables and workspace-scopes Workflow and
-- WorkflowRun. Hand-edited from Prisma's auto-generated diff: the generated
-- SQL added `workspaceId` as NOT NULL directly, which fails against this
-- release's existing rows (5 workflows, 6 workflow_runs at the time this was
-- written). This version adds the columns nullable, backfills every existing
-- row into one deterministic "legacy" Workspace, then tightens to NOT NULL —
-- see docs/adr/0004-workspace-isolation-and-migration-process.md. Runs in a
-- single transaction (Prisma's default for Postgres): any failure below
-- rolls back the entire migration, leaving the database exactly as it was.

-- CreateTable: new tables first, so the backfill below has something to
-- point existing rows at.
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

ALTER TABLE "users" ADD CONSTRAINT "users_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add nullable first — cannot be NOT NULL yet, existing rows
-- have no value.
ALTER TABLE "workflows" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "workflow_runs" ADD COLUMN "workspaceId" TEXT;

-- Bootstrap one deterministic "legacy" Workspace for every Workflow/
-- WorkflowRun that existed before Workspaces did (the seeded demo workflow,
-- anything created testing v0.3.0's editor). "ownerUserId" is a placeholder,
-- not a real user — Workspace.ownerUserId is intentionally not a foreign key
-- (see schema.prisma's comment), so this is safe and does not require a
-- matching row in "users". This id is fixed and deterministic so re-running
-- this block (e.g. a partial retry) is idempotent.
INSERT INTO "workspaces" ("id", "name", "ownerUserId", "createdAt")
VALUES ('legacy-workspace', 'Legacy Workspace (pre-authentication data)', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "workflows" SET "workspaceId" = 'legacy-workspace' WHERE "workspaceId" IS NULL;
UPDATE "workflow_runs" wr SET "workspaceId" = w."workspaceId"
  FROM "workflows" w
  WHERE w."id" = wr."workflowId" AND wr."workspaceId" IS NULL;

-- Now safe to tighten: every row has a value.
ALTER TABLE "workflows" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "workflow_runs" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
