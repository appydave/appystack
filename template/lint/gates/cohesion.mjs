#!/usr/bin/env node
/**
 * G13: module cohesion. A file's exports should belong together: archlint's `module_cohesion` over the
 * production code of client and server. `shared/` is the wire contract (schemas next to their types), so
 * it is not scanned here. Policy as calibrated on AppyRig: 5+ exports may fall into at most 2 groups.
 */
import { ARCHLINT_EXCLUDES, metric, runArchlintGate } from './archlint.mjs';

const MIN_EXPORTS = 5;
const MAX_COMPONENTS = 2;

runArchlintGate({
  gate: 'cohesion',
  workspaces: ['client', 'server'],
  rules: {
    module_cohesion: {
      severity: 'high',
      min_exports: MIN_EXPORTS,
      max_components: MAX_COMPONENTS,
      exclude: ARCHLINT_EXCLUDES,
    },
  },
  messageFor: (smell) =>
    `${smell.files[0]}: its exports fall into ${metric(smell, 'components')} unconnected groups (limit ${MAX_COMPONENTS} once a file has ${MIN_EXPORTS} exports). Split it by responsibility: move each group of exports that do not use each other into its own file.`,
});
