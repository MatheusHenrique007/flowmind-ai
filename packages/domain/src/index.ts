// Domain layer: entities, value objects, and domain events.
// No dependencies on other layers or frameworks — enforced by eslint.config.js's
// no-restricted-imports rule (see ADR-0001 Decision 2, ADR-0002).
export * from './entities/index.js';
export * from './value-objects/index.js';
export * from './enums/index.js';
export * from './errors/index.js';
