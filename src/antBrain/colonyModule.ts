import type { Hive } from "hive/hive";
import { roomStates } from "static/enums";

import { RoomPlanner } from "./hivePlanner/roomPlanner";

export class ColonyBrianModule {
  // #region Properties (2)

  private test = false;

  public planner = new RoomPlanner();

  // #endregion Properties (2)

  // #region Public Methods (2)

  public run() {
    if (this.test) this.planner.createPlan(Object.keys(Apiary.hives)[0]);
    this.test = false;
  }

  public update() {
    _.forEach(Apiary.hives, (hive) => this.updateHive(hive));
  }

  // #endregion Public Methods (2)

  // #region Private Methods (3)

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

  private updateHive(hive: Hive) {
    if (Object.keys(Apiary.hives).length === 1) this.addNextDoorAnnex(hive);
  }

  // #endregion Private Methods (3)
}
