import type { CreepSetup } from "bees/creepSetups";
import type { DefenseCell } from "cells/base/defenseCell";
import type { ExcavationCell } from "cells/base/excavationCell";
import type { RespawnCell } from "cells/spawning/respawnCell";
import type { BuildCell } from "cells/building/buildCell";
import type { StorageCell } from "cells/management/storageCell";
import type { UpgradeCell } from "cells/management/upgradeCell";
import type { DevelopmentCell } from "cells/stage0/developmentCell";
import type { CorridorMiningCell } from "cells/stage2/corridorMining";
import type { FactoryCell } from "cells/stage1/factoryCell";
import type { LaboratoryCell } from "cells/stage1/laboratoryCell";
import type { ObserveCell } from "cells/stage2/observeCell";
import type { PowerCell } from "cells/stage2/powerCell";

// Define the SpawnOrder interface for creep spawning
export interface SpawnOrder {
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // Priority of the creep
  master: string;
  createTime: number;
}

// Define the HiveCells interface for different cell types within a hive
export interface HiveCells {
  storage: StorageCell;
  defense: DefenseCell;
  spawn: RespawnCell;
  build: BuildCell;
  upgrade?: UpgradeCell;
  excavation: ExcavationCell;
  dev?: DevelopmentCell;
  lab?: LaboratoryCell;
  factory?: FactoryCell;
  observe?: ObserveCell;
  corridorMining?: CorridorMiningCell;
  power?: PowerCell;
}

/** Define a target of amount for resource to keep in storage
 * Is not flushed tick to ticks
 */
export type ResTarget = { [key in ResourceConstant]?: number };
