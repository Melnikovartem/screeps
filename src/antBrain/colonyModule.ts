import { RoomPlanner } from "./hivePlanner/roomPlanner";

export class ColonyBrianModule {
  // #region Properties (1)

  private planner = new RoomPlanner();

  // #endregion Properties (1)

  // #region Public Methods (1)

  public run() {
    this.planner.createPlan(Object.keys(Apiary.hives)[0]);
  }

  // #endregion Public Methods (1)
}
