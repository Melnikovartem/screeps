import { Bee } from "../../bee";
import { Setups } from "../../creepSetups";
import type { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { SwarmMaster } from "../_SwarmMaster";
import { states } from "../_Master";

import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class dismantlerMaster extends SwarmMaster {
  dismantler: Bee | undefined;

  // for last stage
  meetingPoint: RoomPosition;
  exit: RoomPosition | undefined;
  spawned: boolean = false;

  constructor(order: Order) {
    super(order.hive, order);

    this.meetingPoint = order.pos;
    this.order.destroyTime = Game.time + CREEP_LIFE_TIME;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(WORK)) {
      this.spawned = true;
      this.dismantler = bee;
    }
    this.order.destroyTime = Math.max(this.order.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME + 150);
  }

  update() {
    super.update();

    if (this.dismantler && !Apiary.bees[this.dismantler.ref])
      delete this.dismantler;

    if (this.dismantler && (this.meetingPoint.x !== this.order.pos.x || this.meetingPoint.y !== this.order.pos.y))
      this.dismantler.state = states.chill;

    if (!this.dismantler && !this.spawned) {
      this.spawned = true;
      let dismantlerOrder: SpawnOrder = {
        setup: Setups.dismantler,
        amount: 1,
        priority: 4,
        master: this.ref,
      };
      this.wish(dismantlerOrder, this.ref + "_dismantler");
    }

    if (!this.waitingForBees && this.beesAmount === 0)
      this.order.destroyTime = Game.time;
  }

  run() {
    let dismantler = this.dismantler;

    _.forEach(this.bees, (bee) => {
      if (bee.state === states.chill)
        bee.goRest(this.meetingPoint);
    });

    if (dismantler && dismantler.state === states.chill && dismantler.pos.isNearTo(this.meetingPoint)) {
      dismantler.state = states.work;
      this.exit = <RoomPosition>dismantler.pos.findClosest(dismantler.creep.room.find(FIND_EXIT));
    }

    if (dismantler && (dismantler.state === states.refill
      || (dismantler.state === states.work && dismantler.hits <= dismantler.hitsMax * 0.6))) {
      dismantler.state = states.refill;
      if (dismantler.hits === dismantler.hitsMax)
        dismantler.state = states.work;
      dismantler.goRest(this.order.pos);
    }

    if (dismantler && dismantler.state === states.work && dismantler.pos.roomName !== this.order.pos.roomName) {
      let roomInfo = Apiary.intel.getInfo(dismantler.pos.roomName);
      let target = dismantler.pos.findClosest(roomInfo.enemies);

      // not sure what to do if there will be smart towers
      if (target instanceof Structure && !(target instanceof StructureTower && target.store.getUsedCapacity(RESOURCE_ENERGY) > 0))
        dismantler.dismantle(target);
      else if (dismantler.pos.x === 0 || dismantler.pos.x === 49 || dismantler.pos.y === 0 || dismantler.pos.y === 49)
        dismantler.goToRoom(dismantler.pos.roomName);
    }

    if (dismantler && dismantler.state === states.work && dismantler.creep.room.name === this.order.pos.roomName) {
      if (!this.exit) // failsafe
        this.exit = <RoomPosition>dismantler.pos.findClosest(dismantler.creep.room.find(FIND_EXIT));
      dismantler.goTo(this.exit);
    }
  }
}
