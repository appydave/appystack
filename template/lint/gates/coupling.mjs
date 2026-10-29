#!/usr/bin/env node
/**
 * G14 + G15: coupling, hubs and stability, with the thresholds calibrated on AppyRig. archlint's
 * `high_coupling` (CBO: files a file imports plus files that import it), `hub_module` and `sdp_violation`
 * (the Stable Dependencies Principle: instability = imports / (imports + importers)).
 */
import { ARCHLINT_EXCLUDES, WORKSPACES, metric, runArchlintGate } from './archlint.mjs';

const MAX_CBO = 20;
const HUB_FAN_IN = 8;
const HUB_FAN_OUT = 8;
const HUB_MAX_COMPLEXITY = 5;
const SDP_MIN_FAN_TOTAL = 2;
const SDP_MIN_INSTABILITY_GAP = 0.1;

const ADVICE = {
  HighCoupling: (smell) =>
    `touches ${metric(smell, 'cbo')} other files (limit ${MAX_CBO}). Move the work it does with a group of them into a module of its own.`,
  HubModule: () =>
    `is a hub (${HUB_FAN_IN}+ importers, ${HUB_FAN_OUT}+ imports, little logic). Let the importers import what they use directly.`,
  sdp_violation: (smell) =>
    `depends on a less stable file: ${smell.locations?.[0]?.description ?? ''}. Move what it uses into a module both import, or pass it in.`,
};

const adviceFor = (smell) =>
  Object.entries(ADVICE).find(([type]) => smell.type.startsWith(type))?.[1](smell) ?? smell.type;

runArchlintGate({
  gate: 'coupling',
  workspaces: WORKSPACES,
  rules: {
    high_coupling: { severity: 'high', max_cbo: MAX_CBO, exclude: ARCHLINT_EXCLUDES },
    hub_module: {
      severity: 'high',
      min_fan_in: HUB_FAN_IN,
      min_fan_out: HUB_FAN_OUT,
      max_complexity: HUB_MAX_COMPLEXITY,
      exclude: ARCHLINT_EXCLUDES,
    },
    sdp_violation: {
      severity: 'high',
      min_fan_total: SDP_MIN_FAN_TOTAL,
      instability_diff: SDP_MIN_INSTABILITY_GAP,
      exclude: ARCHLINT_EXCLUDES,
    },
  },
  messageFor: (smell) => `${smell.files[0]} ${adviceFor(smell)}`,
});
