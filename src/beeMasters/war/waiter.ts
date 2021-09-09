import { Bee } from "../../bee";
import { Setups } from "../../creepSetups";
import type { SpawnOrder } from "../../Hive";
import { SwarmMaster } from "../_SwarmMaster";
import { states } from "../_Master";

import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class waiterMaster extends SwarmMaster {
  healer: Bee | undefined;

  // for last stage
  meetingPoint: RoomPosition = this.order.pos;
  exit: RoomPosition | undefined;
  spawned: boolean = false;


  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL)) {
      this.spawned = true;
      this.healer = bee;
    }
  }

  update() {
    super.update();

    if (this.healer && !Apiary.bees[this.healer.ref])
      delete this.healer;

    if (this.meetingPoint.x !== this.order.pos.x || this.meetingPoint.y !== this.order.pos.y) {
      this.meetingPoint = this.order.pos;
      if (this.healer)
        this.healer.state = states.chill;
    }

    if (!this.spawned && !this.healer) {
      this.spawned = true;
      let healerOrder: SpawnOrder = {
        setup: Setups.healer,
        amount: 1,
        priority: 4,
        master: this.ref,
      };
      this.wish(healerOrder, this.ref + "_healer");
    }

    if (!this.waitingForBees && this.beesAmount === 0)
      this.order.delete();
  }

  run() {
    let healer = this.healer;

    _.forEach(this.bees, (bee) => {
      if (bee.state === states.chill)
        bee.goRest(this.meetingPoint);
    });

    if (healer && healer.state === states.chill && healer.pos.isNearTo(this.meetingPoint))
      healer.state = states.work;

    if (healer && healer.state === states.work) {
      healer.goRest(this.order.pos);
      let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, 3),
        (bee) => bee.hits < bee.hitsMax));
      if (healingTarget) {
        if (healer.pos.isNearTo(healingTarget))
          healer.heal(healingTarget);
        else
          healer.rangedHeal(healingTarget);
      }
    }
  }
}
