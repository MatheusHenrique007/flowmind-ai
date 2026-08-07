import type { WorkflowRepository } from '@flowmind/application';
import {
  DestinationKind,
  Provider,
  StepType,
  Workflow,
  WorkflowId,
  WorkflowStep,
  WorkflowStepId,
} from '@flowmind/domain';
import type { PrismaClient } from '@prisma/client';

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

  async findById(id: WorkflowId): Promise<Workflow | null> {
    const row = await this.prisma.workflow.findUnique({ where: { id: id.value } });
    if (!row) {
      return null;
    }

    const storedSteps = row.steps as unknown as StoredStep[];
    const steps = storedSteps.map((stored) => this.toDomainStep(stored));

    return Workflow.create({ id: WorkflowId.create(row.id), name: row.name, steps });
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
