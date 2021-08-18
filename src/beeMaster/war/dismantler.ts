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
  healer: Bee | undefined;
  dismantler: Bee | undefined;

  // for last stage
  meetingPoint: RoomPosition;
  exit: RoomPosition | undefined;
  spawned: boolean = false;

  constructor(order: Order) {
    super(order.hive, order);

    this.meetingPoint = order.pos;
    this.order.destroyTime = Game.time + CREEP_LIFE_TIME;
    this.targetBeeCount = 2;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyparts(HEAL))
      this.healer = bee;
    else
      this.dismantler = bee;
    this.order.destroyTime = Math.max(this.order.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME + 150);
  }

  update() {
    super.update();

    if (this.dismantler && !Apiary.bees[this.dismantler.ref])
      delete this.dismantler;

    if (this.healer && !Apiary.bees[this.healer.ref])
      delete this.healer;

    if (!this.spawned) {
      this.spawned = true;
      if (!this.dismantler) {
        let dismantlerOrder: SpawnOrder = {
          setup: Setups.dismantler,
          amount: 1,
          priority: 4,
          master: this.ref,
        };
        this.wish(dismantlerOrder, this.ref + "_dismantler");
      }
      if (!this.healer) {
        let healerOrder: SpawnOrder = {
          setup: Setups.healer,
          amount: 1,
          priority: 4,
          master: this.ref,
        };
        this.wish(healerOrder, this.ref + "_healer");
      }
    }

    if (!this.waitingForBees && !this.dismantler && !this.healer)
      this.order.destroyTime = Game.time;
  }

  run() {
    let healer = this.healer;
    let dismantler = this.dismantler;

    _.forEach(this.bees, (bee) => {
      if (bee.state == states.chill)
        bee.goRest(this.meetingPoint);
    });

    if (dismantler && dismantler.state == states.chill
      && healer && healer.state == states.chill
      && dismantler.pos.isNearTo(this.meetingPoint) && healer.pos.isNearTo(this.meetingPoint)) {
      healer.state = states.work;
      dismantler.state = states.work;
      this.exit = <RoomPosition>dismantler.pos.findClosest(dismantler.creep.room.find(FIND_EXIT));
    }

    if (healer && healer.state == states.work) {
      healer.goRest(this.order.pos);
      let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, 3),
        (creep) => creep.hits < creep.hitsMax));
      if (healingTarget) {
        if (healer.pos.isNearTo(healingTarget))
          healer.heal(healingTarget);
        else
          healer.rangedHeal(healingTarget);
      }
    }

    if (dismantler && (dismantler.state == states.refill
      || (dismantler.state == states.work && dismantler.creep.hits <= dismantler.creep.hitsMax * 0.6))) {
      dismantler.state = states.refill;
      if (dismantler.creep.hits == dismantler.creep.hitsMax)
        dismantler.state = states.work;

      if (healer) {
        if (!dismantler.pos.isNearTo(healer))
          dismantler.goTo(healer.pos);
      } else dismantler.goRest(this.order.pos);
    }

    if (dismantler && dismantler.state == states.work && dismantler.pos.roomName != this.order.pos.roomName) {
      let roomInfo = Apiary.intel.getInfo(dismantler.pos.roomName);
      let target = dismantler.pos.findClosest(roomInfo.enemies);

      // not sure what to do if there will be smart towers
      if (target instanceof Structure && !(target instanceof StructureTower && target.store[RESOURCE_ENERGY] > 0))
        dismantler.dismantle(target);
      else if (dismantler.pos.x == 0 || dismantler.pos.x == 49 || dismantler.pos.y == 0 || dismantler.pos.y == 49)
        dismantler.goToRoom(dismantler.pos.roomName);
    }

    if (dismantler && dismantler.state == states.work && dismantler.creep.room.name == this.order.pos.roomName) {
      if (!this.exit) // failsafe
        this.exit = <RoomPosition>dismantler.pos.findClosest(dismantler.creep.room.find(FIND_EXIT));
      dismantler.goTo(this.exit);
    }
  }
}
