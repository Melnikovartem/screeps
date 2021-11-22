import { SwarmMaster } from "../_SwarmMaster";

import { hiveStates, roomStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class PuppetMaster extends SwarmMaster {
  movePriority = <5>5;

  update() {
    super.update();
    let shouldSpawn = this.maxSpawns !== Infinity || this.oldestSpawn + CREEP_LIFE_TIME <= Game.time;
    if (shouldSpawn && this.checkBees(hiveStates.battle !== this.hive.state) && !(this.pos.roomName in Game.rooms)) {
      this.wish({
        setup: setups.puppet,
        priority: 2, // well it is mostly cheap -_-
      });
    }
    if (this.maxSpawns === Infinity && this.order.color === COLOR_PURPLE && this.order.secondaryColor === COLOR_PURPLE) {
      let roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
      switch (roomInfo.roomState) {
        case roomStates.reservedByEnemy:
        case roomStates.reservedByInvader:
        case roomStates.noOwner:
        case roomStates.reservedByMe:
          if (this.hive.room.energyCapacityAvailable >= 650)
            this.order.acted = false;
          break;
        case roomStates.SKfrontier:
          if (this.hive.room.energyCapacityAvailable >= 5000)
            this.order.acted = false;
          break;
        default:
          this.order.delete();
      }
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      bee.goRest(this.pos, { offRoad: true });
      this.checkFlee(bee, this.pos);
    });
  }
}
