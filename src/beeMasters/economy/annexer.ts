import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";

import { SwarmMaster } from "../_SwarmMaster";

export interface AnnexerInfo {
  // #region Properties (1)

  timeLeft: number;

  // #endregion Properties (1)
}

@profile
export class AnnexMaster extends SwarmMaster<AnnexerInfo> {
  // #region Properties (1)

  // abstract implementation block
  public movePriority = 3 as const;

  // #endregion Properties (1)

  // #region Public Accessors (4)

  public get maxSpawns() {
    return Infinity;
  }

  // methods/attributes to help with logic
  public get reservationTime() {
    return this.parent.special.timeLeft;
  }

  public set reservationTime(value: number) {
    this.parent.special.timeLeft = value;
  }

  public get targetBeeCount() {
    if (!this.hive.cells.annex.canSpawnAnnexer(this.roomName)) return 0;
    if (
      this.hive.bassboost &&
      this.pos.getRoomRangeTo(this.hive.bassboost, "path") < 5
    )
      return 0;
    return 1;
  }

  // #endregion Public Accessors (4)

  // #region Public Methods (3)

  public defaultInfo() {
    return { timeLeft: 0 };
  }

  public override run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.pos.roomName !== this.roomName)
        bee.goTo(this.pos, { ignoreRoads: true });
      else {
        const controller = Game.rooms[this.roomName].controller;
        if (controller) {
          if (
            (controller.reservation &&
              controller.reservation.username !== Apiary.username) ||
            (controller.owner && controller.owner.username !== Apiary.username)
          )
            bee.attackController(controller, { ignoreRoads: true });
          else bee.reserveController(controller, { ignoreRoads: true });
        } else this.parent.delete();
      }
      this.checkFlee(bee, this.hive);
    });
  }

  // update - run
  public override update() {
    super.update();

    if (this.pos.roomName in Game.rooms) {
      const controller = Game.rooms[this.pos.roomName].controller;
      if (
        controller &&
        controller.reservation &&
        controller.reservation.username === Apiary.username
      )
        this.reservationTime = controller.reservation.ticksToEnd;
    } else this.reservationTime -= 1;

    if (this.reservationTime > 2000) return;

    if (this.checkBees(true, CREEP_CLAIM_LIFE_TIME - 10)) {
      const setup = setups.claimer.copy();
      setup.patternLimit =
        Math.floor((CONTROLLER_RESERVE_MAX - this.reservationTime) / 600) + 1;
      this.wish({
        setup,
        priority: 6, // first we secure our safe locations
      });
    }
  }

  // #endregion Public Methods (3)
}
