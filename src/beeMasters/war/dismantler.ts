import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { SpawnOrder } from "../../Hive";

//first tandem btw
@profile
export class DismantlerMaster extends SwarmMaster {
  // for last stage
  exit: RoomPosition | undefined;

  update() {
    super.update();

    if (this.checkBees()) {
      let beeOrder: SpawnOrder = {
        setup: setups.dismantler,
        amount: 1,
        priority: 4,
        master: this.ref,
      };
      this.wish(beeOrder, this.ref + "_bee");
    }

    if (!this.waitingForBees && this.beesAmount === 0)
      this.order.delete();
  }

  run() {
    _.forEach(this.activeBees, (bee) => {

      if (bee.state === beeStates.chill && bee.pos.isNearTo(this.order.pos)) {
        bee.state = beeStates.work;
        this.exit = <RoomPosition>bee.pos.findClosest(bee.creep.room.find(FIND_EXIT));
      }

      if (bee.state === beeStates.refill
        || (bee.state === beeStates.work && bee.hits <= bee.hitsMax * 0.6)) {
        bee.state = beeStates.refill;
        if (bee.hits === bee.hitsMax)
          bee.state = beeStates.work;
        bee.goRest(this.order.pos);
      }

      if (bee.state === beeStates.work && bee.pos.roomName !== this.order.pos.roomName) {
        let roomInfo = Apiary.intel.getInfo(bee.pos.roomName);
        let target = bee.pos.findClosest(roomInfo.enemies.map((e) => e.object));

        // not sure what to do if there will be smart towers
        if (target instanceof Structure && !(target instanceof StructureTower && target.store.getUsedCapacity(RESOURCE_ENERGY) > 0))
          bee.dismantle(target);
        else if (bee.pos.x === 0 || bee.pos.x === 49 || bee.pos.y === 0 || bee.pos.y === 49)
          bee.goToRoom(bee.pos.roomName);
      }

      if (bee.state === beeStates.work && bee.creep.room.name === this.order.pos.roomName) {
        if (!this.exit) // failsafe
          this.exit = <RoomPosition>bee.pos.findClosest(bee.creep.room.find(FIND_EXIT));
        bee.goTo(this.exit);
      }

      if (bee.state === beeStates.chill)
        bee.goRest(this.order.pos);
    });
  }
}
