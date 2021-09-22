import { HordeMaster } from "./horde";

import { setups } from "../../bees/creepsetups";
import { roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class DestroyerMaster extends HordeMaster {
  update() {
    super.update();

    if (this.checkBees(true)) {
      let order = {
        setup: setups.destroyer,
        amount: this.targetBeeCount - this.beesAmount,
        priority: <7>7,
      };

      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

      if (roomInfo.roomState != roomStates.ownedByEnemy && roomInfo.dangerlvlmax < 3)
        order.setup.patternLimit = 1;

      this.wish(order);
    }
  }
}
