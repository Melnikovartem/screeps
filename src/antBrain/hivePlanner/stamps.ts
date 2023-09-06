import { prefix } from "static/enums";

import type { ActivePlan } from "./planner-active";

export interface Stamp {
  // #region Properties (2)

  posCell: ActivePlan["posCell"];
  setup: {
    [key in BuildableStructureConstant | "null"]?: { x: number; y: number }[];
  };

  // #endregion Properties (2)
}

export const STAMP_LABS: Stamp = {
  posCell: { [prefix.laboratoryCell]: [25, 25] },
  setup: {
    road: [
      { x: 24, y: 24 },
      { x: 25, y: 25 },
      { x: 26, y: 26 },
      { x: 27, y: 27 },
    ],
    lab: [
      { x: 25, y: 24 },
      { x: 26, y: 24 },
      { x: 26, y: 25 },
      { x: 27, y: 25 },
      { x: 27, y: 26 },
      { x: 24, y: 25 },
      { x: 24, y: 26 },
      { x: 25, y: 26 },
      { x: 25, y: 27 },
      { x: 26, y: 27 },
    ],
  },
};

export const STAMP_FAST_REFILL: Stamp = {
  posCell: { [prefix.fastRefillCell]: [25, 25] },
  setup: {
    null: [
      { x: 26, y: 26 },
      { x: 26, y: 24 },
      { x: 24, y: 26 },
      { x: 24, y: 24 },
    ],
    link: [{ x: 25, y: 25 }],
    spawn: [
      { x: 23, y: 24 },
      { x: 27, y: 24 },
      { x: 25, y: 27 },
    ],
    container: [
      { x: 27, y: 25 },
      { x: 23, y: 25 },
    ],
    extension: [
      { x: 23, y: 26 },
      { x: 23, y: 27 },
      { x: 24, y: 27 },
      { x: 23, y: 23 },
      { x: 24, y: 23 },
      { x: 24, y: 25 },
      { x: 25, y: 23 },
      { x: 26, y: 23 },
      { x: 27, y: 23 },
      { x: 26, y: 25 },
      { x: 27, y: 27 },
      { x: 26, y: 27 },
      { x: 27, y: 26 },
      { x: 25, y: 26 },
      { x: 25, y: 24 },
    ],
    road: [
      { x: 22, y: 27 },
      { x: 23, y: 28 },
      { x: 24, y: 28 },
      { x: 25, y: 28 },
      { x: 26, y: 28 },
      { x: 27, y: 28 },
      { x: 28, y: 27 },
      { x: 28, y: 26 },
      { x: 28, y: 25 },
      { x: 22, y: 25 },
      { x: 22, y: 26 },
      { x: 22, y: 24 },
      { x: 22, y: 23 },
      { x: 23, y: 22 },
      { x: 24, y: 22 },
      { x: 25, y: 22 },
      { x: 26, y: 22 },
      { x: 27, y: 22 },
      { x: 28, y: 24 },
      { x: 28, y: 23 },
    ],
  },
};

export const STAMP_EXTENSION_BLOCK: Stamp = {
  posCell: {},
  setup: {
    road: [
      { x: 25, y: 23 },
      { x: 25, y: 27 },
      { x: 24, y: 26 },
      { x: 23, y: 25 },
      { x: 24, y: 24 },
      { x: 26, y: 24 },
      { x: 27, y: 25 },
      { x: 26, y: 26 },
    ],
    extension: [
      { x: 25, y: 24 },
      { x: 25, y: 25 },
      { x: 25, y: 26 },
      { x: 26, y: 25 },
      { x: 24, y: 25 },
    ],
  },
};

export const STAMP_POWER: Stamp = {
  posCell: {
    [prefix.powerCell]: [25, 25],
  },
  setup: {
    powerSpawn: [{ x: 25, y: 25 }],
  },
};

export const STAMP_OBSERVE: Stamp = {
  posCell: {},
  setup: {
    observer: [{ x: 25, y: 25 }],
  },
};

export const STAMP_CORE: Stamp = {
  posCell: {
    [prefix.defenseCell]: [25, 25],
  },
  setup: {
    road: [
      { x: 25, y: 24 },
      { x: 24, y: 25 },
      { x: 25, y: 25 },
      { x: 24, y: 23 },
      { x: 23, y: 24 },
      { x: 26, y: 26 },
    ],
    storage: [{ x: 24, y: 24 }],
    factory: [{ x: 24, y: 26 }],
    terminal: [{ x: 26, y: 24 }],
    link: [{ x: 25, y: 26 }],
    nuker: [{ x: 26, y: 25 }],
  },
};
