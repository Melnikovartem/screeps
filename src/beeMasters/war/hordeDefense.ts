import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class HordeDefenseMaster extends HordeMaster {
  maxSpawns: number = 2;

  update() {
    SwarmMaster.prototype.update.call(this);

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (roomInfo.safePlace && !this.beesAmount) {
      this.order.delete();
      return;
    }

    if (this.checkBees() && (Game.time >= roomInfo.safeModeEndTime - 250) && !roomInfo.safePlace) {
      let order = {
        setup: setups.defender.normal,
        amount: this.targetBeeCount - this.beesAmount,
        priority: <1 | 7>1,
      }

      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

      if (roomInfo.dangerlvlmax < 4) {
        order.priority = 7;
        if (roomInfo.dangerlvlmax === 3)
          order.setup = setups.defender.destroyer;
        else
          order.setup.fixed = [];
      }

      this.wish(order);
    }
  }
}
