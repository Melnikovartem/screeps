import type { Hive } from "hive/hive";
import { roomStates } from "static/enums";

import { RoomPlanner } from "./hivePlanner/roomPlanner";

export class ColonyBrianModule {
  // #region Properties (1)

  public planner = new RoomPlanner();

  // #endregion Properties (1)

  // #region Public Methods (2)

  public run() {}

  public update() {
    this.planner.update();
    _.forEach(Apiary.hives, (hive) => this.updateHive(hive));
  }

  // #endregion Public Methods (2)

  // #region Private Methods (3)

  private addNextDoorAnnex(hive: Hive) {
    _.forEach(Game.map.describeExits(hive.roomName), (exit) => {
      if (Apiary.intel.getRoomState(exit) === roomStates.noOwner)
        hive.cells.annex.addAnnex(exit);
    });
  }

  private checkBuildings(hive: Hive) {
    if (!this.planner.canStartNewPlan) return;
    if (!hive.roomPlanner()) {
      if (
        hive.phase === 0 ||
        (hive.phase === 1 &&
          _.filter(Apiary.hives, (h) => h.phase === 2).length)
      )
        // do not destroy if hive is setup for lategame
        this.planner.createPlan(hive.roomName, hive.annexNames);
      else {
        // current to active ?
      }
      return;
    }
    if (!hive.cells.annex.allResourcesRoads) this.planner.createRoads(hive);
  }

  private updateHive(hive: Hive) {
    if (Object.keys(Apiary.hives).length === 1) this.addNextDoorAnnex(hive);
    if (Apiary.intTime % 1000 === 20) this.checkBuildings(hive);
  }

  // #endregion Private Methods (3)
}
