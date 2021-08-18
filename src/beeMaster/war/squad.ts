import { Bee } from "../../bee";
import { Setups } from "../../creepSetups";
import type { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { SwarmMaster } from "../_SwarmMaster";
import { states } from "../_Master";

import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class squadMaster extends SwarmMaster {
  healers: Bee[] = [];
  knights: Bee[] = [];
  spawned: boolean = false;
  meetingPoint: RoomPosition;

  constructor(order: Order) {
    super(order.hive, order);
    // sad cause safeMode saves from this shit
    this.order.destroyTime = Game.time + CREEP_LIFE_TIME;
    this.targetBeeCount = 4;
    this.meetingPoint = this.hive.pos;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyparts(HEAL))
      this.healers.push(bee);
    else
      this.knights.push(bee);
    this.order.destroyTime = Math.max(this.order.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME + 150);
  }

  update() {
    super.update();

    for (const key in this.knights)
      this.knights[key] = Apiary.bees[this.knights[key].ref];
    this.knights = _.compact(this.knights);
    for (const key in this.healers)
      this.healers[key] = Apiary.bees[this.healers[key].ref];
    this.healers = _.compact(this.healers);

    if (!this.spawned) {
      this.spawned = true;
      if (this.knights.length == 0 || (this.knights.length == 1
        && (!this.knights[0].creep.ticksToLive || this.knights[0].creep.ticksToLive > 1000))) {
        let tankOrder: SpawnOrder = {
          setup: Setups.knight,
          amount: 2 - this.knights.length,
          priority: 4,
          master: this.ref,
        };
        this.wish(tankOrder, this.ref + "_knight");
        console.log(2 - this.knights.length);
      }
      if (this.healers.length == 0 || (this.healers.length == 1
        && (!this.healers[0].creep.ticksToLive || this.healers[0].creep.ticksToLive > 1000))) {
        let healerOrder: SpawnOrder = {
          setup: Setups.healer,
          amount: 2 - this.healers.length,
          priority: 4,
          master: this.ref,
        };
        this.wish(healerOrder, this.ref + "_healer");
      }

      if (this.waitingForBees + this.beesAmount < 4) {
        this.order.destroyTime = Game.time;
        this.delete();
      }
    }

    if (!this.waitingForBees && this.knights.length == 0)
      this.order.destroyTime = Game.time;
  }

  run() {
    let knight1: Bee | undefined = this.knights[0];
    let knight2: Bee | undefined = this.knights[1];
    let healer1: Bee | undefined = this.healers[0];
    let healer2: Bee | undefined = this.healers[1];

    if (!healer1)
      healer1 = healer2;
    if (!knight1)
      knight1 = knight2;

    if (knight1 && knight1.state == states.chill)
      knight1.goRest(this.meetingPoint);
    if (knight2 && knight2.state == states.chill)
      knight2.goRest(this.meetingPoint);
    if (healer1 && healer1.state == states.chill)
      healer1.goRest(this.meetingPoint);
    if (healer2 && healer2.state == states.chill)
      healer2.goRest(this.meetingPoint);


    if (knight1 && knight2 && healer1 && healer2) {
      knight1.state = states.work;
      knight2.state = states.work;
      healer1.state = states.work;
      healer2.state = states.work;
    }

    if (knight1 && knight1.state == states.work && !this.waitingForBees) {
      // try to fix formation if broken
      if (knight2 && !knight2.pos.isNearTo(knight1))
        knight2.goTo(knight1.pos, { movingTarget: true });
      if (healer1 && !healer1.pos.isNearTo(knight1))
        healer1.goTo(knight1.pos, { movingTarget: true });
      if (healer2 && !healer2.pos.isNearTo(knight2 ? knight2.pos : knight1))
        healer2.goTo(knight2 ? knight2.pos : knight1.pos, { movingTarget: true });
      else if (healer2 && healer1 && !healer2.pos.isNearTo(healer1))
        healer2.goTo(healer1.pos, { movingTarget: true });

      let roomInfo = Apiary.intel.getInfo(knight1.pos.roomName);
      let target: Structure | Creep = <Structure | Creep>knight1.pos.findClosest(roomInfo.enemies);
      let ans1, ans2;
      if (target) {
        ans1 = knight1.attack(target);
        if (knight2)
          ans2 = knight2.attack(target);
      } else {
        ans1 = knight1.goRest(this.order.pos);
        if (knight2)
          ans2 = knight2.goRest(this.order.pos);
      }

      if (ans1 == ERR_NOT_IN_RANGE && healer1)
        healer1.creep.move(healer1.pos.getDirectionTo(knight1.pos));
      if ((ans2 == ERR_NOT_IN_RANGE || (ans2 == undefined && ans1 == ERR_NOT_IN_RANGE)) && healer2)
        healer2.creep.move(healer2.pos.getDirectionTo(knight2 ? knight2.pos : knight1));

      if (knight1.creep.hits < knight1.creep.hitsMax * 0.50) {
        healer1.heal(knight1);
        healer2.heal(knight1);
      } else if (knight2.creep.hits < knight2.creep.hitsMax * 0.50) {
        healer1.heal(knight2);
        healer2.heal(knight2);
      } else if (knight1.creep.hits < knight1.creep.hitsMax) {
        healer1.heal(knight1);
        healer2.heal(knight1);
      } else if (knight2.creep.hits < knight2.creep.hitsMax) {
        healer1.heal(knight2);
        healer2.heal(knight2);
      }
    }
  }
}
