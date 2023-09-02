import { setups } from "bees/creepSetups";
import { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { hiveStates, roomStates, signText } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class ClaimerMaster extends SwarmMaster<SwarmOrder> {
  // #region Properties (1)

  public movePriority = 3 as const;

  // #endregion Properties (1)

  // #region Public Accessors (1)

  public get maxSpawns() {
    return 5;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (2)

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
              else Apiary.destroyTime = Game.time; // create new hive
            bee.creep.signController(controller, signText.my);
            this.order.delete();
          }
        } else this.order.delete();
        if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
          bee.heal(bee);
      }
      this.checkFlee(bee, undefined, { useFindRoute: true }, false);
    });
  }

  public update() {
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

  // #endregion Public Methods (2)
}
