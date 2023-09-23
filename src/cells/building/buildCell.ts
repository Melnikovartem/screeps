import { BuilderMaster } from "beeMasters/economy/builder";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { prefix } from "static/enums";

import { Cell } from "../_Cell";
import { UPDATE_STRUCTURES, WALLS_HEALTH } from "./_building-constants";
import { getBuildTarget, updateStructures } from "./hive-building";

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

@profile
export class BuildCell extends Cell {
  // #region Properties (7)

  private updateStructures = updateStructures;

  protected forceCheck: "" | "mainroom" | "annex" = "annex";

  /** sum of construction cost */
  public buildingCosts = _.cloneDeep(ZERO_COSTS_BUILDING_HIVE);
  public getBuildTarget = getBuildTarget;
  public override master: BuilderMaster;
  public structuresConst: BuildProject[] = [];
  /** current minium wall health */
  public wallTargetHealth: number = WALLS_HEALTH.start;

  // #endregion Properties (7)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.buildingCell);
    this.master = new BuilderMaster(this);
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

  // #region Public Methods (4)

  public checkAll() {
    this.forceCheck = "annex";
  }

  /** interface to recheck buildings */
  public checkRoom() {
    if (this.forceCheck === "") this.forceCheck = "mainroom";
  }

  public run() {}

  public update() {
    if (!this.structuresConst.length && this.sumCost)
      this.forceCheck = "mainroom";
    if (Apiary.intTime % UPDATE_STRUCTURES.normal === 0)
      this.forceCheck = "annex";
    if (this.hive.isBattle && Apiary.intTime % UPDATE_STRUCTURES.battle === 0)
      this.forceCheck = "mainroom";

    if (this.forceCheck) {
      this.updateStructures(this.forceCheck === "annex");
      this.forceCheck = "";
    }
  }

  // #endregion Public Methods (4)
}
