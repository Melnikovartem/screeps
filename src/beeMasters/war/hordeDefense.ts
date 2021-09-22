import { hordeMaster } from "./horde";
import { setups } from "../../bees/creepsetups";
import { SwarmMaster } from "../_SwarmMaster";
import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class hordeDefenseMaster extends hordeMaster {
  maxSpawns: number = 2;

  update() {
    SwarmMaster.prototype.update.call(this);

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (roomInfo.safePlace && !this.beesAmount && !this.waitingForBees) {
      this.order.delete();
      return;
    }

    if (this.checkBees() && (Game.time >= roomInfo.safeModeEndTime - 100) && !roomInfo.safePlace) {
      this.wish({
        setup: setups.defender.normal,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 1,
      });
    }
  }
}
