import type { WorkflowRepository } from '@flowmind/application';
import {
  DestinationKind,
  Provider,
  StepType,
  Workflow,
  WorkflowId,
  WorkflowStep,
  WorkflowStepId,
  WorkspaceId,
} from '@flowmind/domain';
import { Prisma, type PrismaClient } from '@prisma/client';

interface StoredStep {
  id: string;
  type: string;
  config: unknown;
}

/**
 * The only place in the codebase allowed to import @prisma/client for
 * Workflow persistence — Application and Engine never see it.
 */
export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The workspace is part of the WHERE clause, not a check applied to the
   * loaded row: a workflow belonging to another workspace is simply not
   * selected, so it is indistinguishable from a nonexistent id (ADR-0004).
   */
  async findById(id: WorkflowId, workspaceId: WorkspaceId): Promise<Workflow | null> {
    const row = await this.prisma.workflow.findFirst({
      where: { id: id.value, workspaceId: workspaceId.value },
    });
    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  /** Only ever returns rows belonging to `workspaceId`. */
  async listByWorkspace(workspaceId: WorkspaceId): Promise<Workflow[]> {
    const rows = await this.prisma.workflow.findMany({
      where: { workspaceId: workspaceId.value },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    name: string;
    steps: unknown;
    workspaceId: string;
  }): Workflow {
    const storedSteps = row.steps as unknown as StoredStep[];
    const steps = storedSteps.map((stored) => this.toDomainStep(stored));

    return Workflow.create({
      id: WorkflowId.create(row.id),
      name: row.name,
      steps,
      workspaceId: WorkspaceId.create(row.workspaceId),
    });
  }

  async save(workflow: Workflow): Promise<void> {
    const steps = workflow.steps.map((step) =>
      this.toStoredStep(step),
    ) as unknown as Prisma.InputJsonValue;

    // workspaceId is written on create only, never on update: a workflow can
    // never be moved between tenants by a save.
    await this.prisma.workflow.upsert({
      where: { id: workflow.id.value },
      create: {
        id: workflow.id.value,
        name: workflow.name,
        steps,
        workspaceId: workflow.workspaceId.value,
      },
      update: { name: workflow.name, steps },
    });
  }

  private toStoredStep(step: WorkflowStep): StoredStep {
    return { id: step.id.value, type: step.type, config: step.config };
  }

  private toDomainStep(stored: StoredStep): WorkflowStep {
    const id = WorkflowStepId.create(stored.id);

    switch (stored.type) {
      case StepType.TRIGGER: {
        const config = stored.config as { kind: 'webhook' };
        return WorkflowStep.trigger({ id, kind: config.kind });
      }
      case StepType.AI: {
        const config = stored.config as { provider: Provider; instruction: string };
        return WorkflowStep.ai({ id, provider: config.provider, instruction: config.instruction });
      }
      case StepType.DESTINATION: {
        const config = stored.config as { destination: DestinationKind; target: string };
        return WorkflowStep.destination({
          id,
          destination: config.destination,
          target: config.target,
        });
      }
      default:
        throw new Error(`Unknown stored step type "${stored.type}".`);
    }
  }
}
