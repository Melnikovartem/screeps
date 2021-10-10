import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class HordeDefenseMaster extends HordeMaster {
  maxSpawns: number = 2;
  boost = false;

  update() {
    SwarmMaster.prototype.update.call(this);

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (roomInfo.dangerlvlmax < 2 && !this.beesAmount) {
      this.order.delete();
      return;
    }

    if (this.checkBees(true) && (Game.time >= roomInfo.safeModeEndTime - 250) && roomInfo.dangerlvlmax > 1) {
      let order = {
        setup: setups.defender.normal,
        priority: <1 | 8>1,
      }

      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

      if (roomInfo.dangerlvlmax < 4) {
        order.priority = 8;
        if (roomInfo.dangerlvlmax === 3)
          order.setup = setups.defender.destroyer;
        else {
          order.setup = order.setup.copy();
          order.setup.fixed = [];
        }
      }

      if (this.hive.phase === 0) {
        order.setup = order.setup.copy();
        order.setup.fixed = [];
      }

      this.wish(order);
    }
  }
}
