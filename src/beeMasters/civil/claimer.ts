import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { hiveStates, roomStates, signText } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class ClaimerMaster extends SwarmMaster<undefined> {
  // #region Properties (1)

  public movePriority = 3 as const;

  // #endregion Properties (1)

  // #region Public Accessors (2)

  public get maxSpawns() {
    return 5;
  }

  public override get targetBeeCount(): number {
    return 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (3)

  public override defaultInfo(): undefined {
    return undefined;
  }

  public run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.pos.roomName !== this.pos.roomName) {
        bee.goTo(this.pos, { useFindRoute: true, ignoreRoads: true });
      } else {
        const controller = Game.rooms[this.pos.roomName].controller;
        if (controller) {
          if (!bee.pos.isNearTo(controller))
            bee.goTo(controller, { ignoreRoads: true });
          else if (
            (controller.owner &&
              controller.owner.username !== Apiary.username) ||
            (controller.reservation &&
              controller.reservation.username !== Apiary.username)
          )
            bee.attackController(controller);
          else {
            if (!controller.owner)
              if (bee.claimController(controller) !== OK) return;
              else Apiary.reset(); // create new hive
            bee.creep.signController(controller, signText.my);
            this.parent.delete();
          }
        } else this.parent.delete();
        if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
          bee.heal(bee);
      }
      this.checkFlee(bee, undefined, { useFindRoute: true }, false);
    });
  }

  public override update() {
    super.update();

    if (
      this.checkBees(
        this.hive.state <= hiveStates.battle,
        CREEP_CLAIM_LIFE_TIME
      )
    ) {
      const setup = setups.claimer.copy();
      if (this.pos.getRoomRangeTo(this.hive, "path") >= 4)
        setup.fixed = [TOUGH, TOUGH, HEAL, HEAL];
      const roomInfo = Apiary.intel.getInfo(this.pos.roomName, 20);
      if (roomInfo.roomState >= roomStates.reservedByInvader)
        setup.patternLimit = 5;
      this.wish({
        setup,
        priority: 2,
      });
    }
  }

  // #endregion Public Methods (3)
}
