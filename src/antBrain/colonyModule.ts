import type { Hive } from "hive/hive";
import { roomStates } from "static/enums";

import { RoomPlanner } from "./hivePlanner/roomPlanner";

export class ColonyBrianModule {
  // #region Properties (1)

  public planner = new RoomPlanner();

  // #endregion Properties (1)

  // #region Public Methods (1)

  private test = false;
  public update() {
    _.forEach(Apiary.hives, (hive) => this.updateHive(hive));
  }

  private updateHive(hive: Hive) {
    if (Object.keys(Apiary.hives).length === 1) this.addNextDoorAnnex(hive);
  }

  private addNextDoorAnnex(hive: Hive) {
    _.forEach(Game.map.describeExits(hive.roomName), (exit) => {
      if (Apiary.intel.getRoomState(exit) === roomStates.noOwner)
        hive.cells.annex.addAnnex(exit);
    });
    if (Apiary.intTime % 1000 === 20) this.checkBuildings(hive);
  }

  private checkBuildings(hive: Hive) {
    if (!hive.roomPlanner()) this.planner.createPlan(hive.roomName);
    else if (!hive.cells.annex.allResourcesRoads)
      this.planner.createRoads(hive);
  }

  public run() {
    if (this.test) this.planner.createPlan(Object.keys(Apiary.hives)[0]);
    this.test = false;
  }

  // #endregion Public Methods (1)
}
