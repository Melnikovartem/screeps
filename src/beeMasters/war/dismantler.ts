import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { SpawnOrder } from "../../Hive";
import { states } from "../_Master";
import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class dismantlerMaster extends SwarmMaster {
  // for last stage
  exit: RoomPosition | undefined;

  update() {
    super.update();

    if (this.checkBees()) {
      let beeOrder: SpawnOrder = {
        setup: Setups.dismantler,
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
    _.forEach(this.bees, (bee) => {

      if (bee.state === states.chill && bee.pos.isNearTo(this.order.pos)) {
        bee.state = states.work;
        this.exit = <RoomPosition>bee.pos.findClosest(bee.creep.room.find(FIND_EXIT));
      }

      if (bee.state === states.refill
        || (bee.state === states.work && bee.hits <= bee.hitsMax * 0.6)) {
        bee.state = states.refill;
        if (bee.hits === bee.hitsMax)
          bee.state = states.work;
        bee.goRest(this.order.pos);
      }

      if (bee.state === states.work && bee.pos.roomName !== this.order.pos.roomName) {
        let roomInfo = Apiary.intel.getInfo(bee.pos.roomName);
        let target = bee.pos.findClosest(roomInfo.enemies);

        // not sure what to do if there will be smart towers
        if (target instanceof Structure && !(target instanceof StructureTower && target.store.getUsedCapacity(RESOURCE_ENERGY) > 0))
          bee.dismantle(target);
        else if (bee.pos.x === 0 || bee.pos.x === 49 || bee.pos.y === 0 || bee.pos.y === 49)
          bee.goToRoom(bee.pos.roomName);
      }

      if (bee.state === states.work && bee.creep.room.name === this.order.pos.roomName) {
        if (!this.exit) // failsafe
          this.exit = <RoomPosition>bee.pos.findClosest(bee.creep.room.find(FIND_EXIT));
        bee.goTo(this.exit);
      }

      if (bee.state === states.chill)
        bee.goRest(this.order.pos);
    });
  }
}
