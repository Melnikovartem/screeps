import { prefix } from "static/enums";

export interface CellCache {
  // #region Properties (1)

  poss: Pos;

  // #endregion Properties (1)
}

export type RoomSetup = {
  [key in BuildableStructureConstant]?: { x: number; y: number }[];
};

interface Module {
  // #region Properties (3)

  cellsCache: { [ref: string]: CellCache };
  setup: RoomSetup;

  // #endregion Properties (3)
}

export const STAMP_LABS: Module = {
  cellsCache: { [prefix.laboratoryCell]: { poss: { x: 25, y: 25 } } },
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

export const STAMP_FAST_REFILL: Module = {
  cellsCache: { [prefix.fastRefillCell]: { poss: { x: 25, y: 25 } } },
  setup: {
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

export const STAMP_EXTENSION_BLOCK: Module = {
  cellsCache: {},
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

export const STAMP_CORE: Module = {
  cellsCache: {
    [prefix.defenseCell]: { poss: { x: 25, y: 25 } },
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
