import { RoomPlanner } from "./hivePlanner/roomPlanner";

export class ColonyBrianModule {
  // #region Properties (1)

  public planner = new RoomPlanner();

  // #endregion Properties (1)

  // #region Public Methods (1)

  private test = true;
  public run() {
    if (this.test) this.planner.createPlan(Object.keys(Apiary.hives)[0]);
    this.test = false;
  }

  // #endregion Public Methods (1)
}
