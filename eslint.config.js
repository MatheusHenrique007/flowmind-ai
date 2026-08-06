// Root ESLint config: re-exports @flowmind/eslint-config so root-level files
// (this file, other loose config scripts) are covered by the same rules that
// each package/app also applies to itself via its own eslint.config.js.
import base from '@flowmind/eslint-config';

export default [
  ...base,
  {
    ignores: ['apps/**', 'packages/**'],
  },
];
