import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";

@profile
export class AnnexMaster extends SwarmMaster {
  maxSpawns = Infinity;

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

    let checkAnnex = (roomInfo.roomState === roomStates.reservedByMe || roomInfo.roomState === roomStates.noOwner) && roomInfo.safePlace;

    if (checkAnnex && this.hive.bassboost)
      checkAnnex = this.order.pos.getRoomRangeTo(this.hive.bassboost.pos, true) < 5 && this.hive.bassboost.room.energyCapacityAvailable >= 650;

    if (this.checkBees(true, CREEP_CLAIM_LIFE_TIME) && checkAnnex && this.hive.room.energyCapacityAvailable >= 650) {
      let order = {
        setup: setups.claimer,
        amount: 1,
        priority: <6>6,
      };

      if (this.order.pos.roomName in Game.rooms) {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType === STRUCTURE_CONTROLLER)[0];

        // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
        if (controller && (!controller.reservation || controller.reservation.ticksToEnd < 4200))
          order.setup.patternLimit = 2;
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.pos.roomName !== this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType === STRUCTURE_CONTROLLER)[0];
        if (controller)
          bee.reserveController(controller);
        else
          this.order.delete();
      }
    });
  }
}
