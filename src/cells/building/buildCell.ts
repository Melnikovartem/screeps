// import { BuilderMaster } from "beeMasters/economy/builder";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { WALLS_START, ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { prefix } from "static/enums";

import { Cell } from "../_Cell";
import { getBuildTarget, updateStructures } from "./hive-building";
// import { updateStructures } from "./hive-building";

// Define the BuildProject interface for construction projects
export interface BuildProject {
  // #region Properties (5)

  energyCost: number;
  pos: RoomPosition;
  sType: StructureConstant;
  targetHits: number;
  type: "repair" | "construction";

  // #endregion Properties (5)
}

// Constants for update intervals
const UPDATE_STRUCTURES_BATTLE = 100;
const UPDATE_STRUCTURES_NORMAL = 1500;

@profile
export class BuildCell extends Cell {
  // #region Properties (6)

  private updateStructures = updateStructures;

  /** sum of construction cost */
  public buildingCosts = _.cloneDeep(ZERO_COSTS_BUILDING_HIVE);
  public forceCheck: "" | "mainroom" | "annex" = "";
  public getBuildTarget = getBuildTarget;
  public structuresConst: BuildProject[] = [];
  /** current minium wall health */
  public wallTargetHealth: number = WALLS_START;

  // #endregion Properties (6)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.buildingCell);
    // this.master = new BuilderMaster(this);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public get sumCost() {
    return (
      this.buildingCosts.hive.build +
      this.buildingCosts.hive.repair +
      this.buildingCosts.annex.build +
      this.buildingCosts.annex.repair
    );
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (2)

  public run() {}

  public update() {
    if (
      Apiary.intTime % UPDATE_STRUCTURES_NORMAL === 0 ||
      (!this.structuresConst.length && this.sumCost) ||
      (this.hive.isBattle && Game.time % UPDATE_STRUCTURES_BATTLE === 0) ||
      this.forceCheck
    ) {
      Apiary.wrap(
        () => this.updateStructures(this.forceCheck === "annex"),
        "structures_" + this.hiveName,
        "update"
      );
      this.forceCheck = "";
    }
  }

  // #endregion Public Methods (2)
}
