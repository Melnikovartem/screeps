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
    if (bee.creep.getBodyParts(HEAL))
      this.healers.push(bee);
    else
      this.knights.push(bee);
    this.order.destroyTime = Math.max(this.order.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME + 150);
    if (bee.creep.ticksToLive && bee.creep.ticksToLive < 1000)
      this.spawned = true;
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
      if (this.knights.length < 2) {
        let tankOrder: SpawnOrder = {
          setup: Setups.knight,
          amount: 2 - this.knights.length,
          priority: 4,
          master: this.ref,
        };
        this.wish(tankOrder, this.ref + "_knight");
      }

      if (this.healers.length < 2) {
        let healerOrder: SpawnOrder = {
          setup: Setups.healer,
          amount: 2 - this.healers.length,
          priority: 4,
          master: this.ref,
        };
        this.wish(healerOrder, this.ref + "_healer");
      }
    }

    if (!this.waitingForBees && this.beesAmount == 0)
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

    _.forEach(this.bees, (bee) => {
      if (bee.state == states.chill)
        bee.goRest(this.meetingPoint);
    });


    if (knight1 && knight2 && healer1 && healer2) {
      if (knight2.pos.isNearTo(knight1) && healer1.pos.isNearTo(knight1) && healer2.pos.isNearTo(knight2)) {
        knight1.state = states.work;
        knight2.state = states.work;
        healer1.state = states.work;
        healer2.state = states.work;
      } else {
        knight2.goTo(knight1.pos);
        healer1.goTo(knight2.pos);
        healer2.goTo(knight2.pos);
      }
    }

    if (knight1 && knight1.state == states.work && !this.waitingForBees) {
      // try to fix formation if broken
      if (healer2 && healer1 && !healer2.pos.isNearTo(healer1))
        healer2.goTo(healer1.pos, { movingTarget: true });

      let roomInfo = Apiary.intel.getInfo(knight1.pos.roomName);
      let target: Structure | Creep = <Structure | Creep>knight1.pos.findClosest(roomInfo.enemies);
      let nextPos: any = {};
      let newPos: RoomPosition | undefined;
      let ans1, ans2;
      let needsHealing = knight1.creep.hits < knight1.creep.hitsMax || (knight2 && knight2.creep.hits < knight2.creep.hitsMax);
      if (target) {
        ans1 = knight1.attack(target);
        if (knight2) {
          if (nextPos.nextPos)
            newPos = _.filter((<RoomPosition>nextPos.nextPos).getOpenPositions(), (p) => knight2!.pos.isNearTo(p))[0];
          if (newPos) {
            ans2 = ERR_NOT_IN_RANGE;
            knight2.creep.move(knight2.pos.getDirectionTo(newPos));
          }
          if (knight2.pos.isNearTo(target) || !newPos)
            ans2 = knight2.attack(target, { returnData: nextPos });
        }
      } else if (!needsHealing) {
        ans1 = knight1.goRest(this.order.pos, { returnData: nextPos });
        if (knight2) {
          if (nextPos.nextPos)
            newPos = _.filter((<RoomPosition>nextPos.nextPos).getOpenPositions(), (p) => knight2!.pos.isNearTo(p))[0];
          if (newPos) {
            ans2 = ERR_NOT_IN_RANGE;
            knight2.creep.move(knight2.pos.getDirectionTo(newPos));
          } else
            ans2 = knight2.goRest(this.order.pos);
        }
      }

      if (healer1 && ans1 == ERR_NOT_IN_RANGE)
        healer1.creep.move(healer1.pos.getDirectionTo(knight1.pos));
      if (healer2 && (ans2 == ERR_NOT_IN_RANGE || (ans2 == undefined && ans1 == ERR_NOT_IN_RANGE)))
        healer2.creep.move(healer2.pos.getDirectionTo(knight2 ? knight2.pos : knight1));

      if (needsHealing) {
        if (knight1.creep.hits < knight1.creep.hitsMax * 0.50) {
          _.forEach(this.healers, (healer) => {
            if (healer.pos.isNearTo(knight1!))
              healer.heal(knight1);
            else
              healer.rangedHeal(knight1);
          });
        } else if (knight2.creep.hits < knight2.creep.hitsMax * 0.50) {
          _.forEach(this.healers, (healer) => {
            if (healer.pos.isNearTo(knight2!))
              healer.heal(knight2);
            else
              healer.rangedHeal(knight2);
          });
        } else if (knight1.creep.hits < knight1.creep.hitsMax) {
          _.forEach(this.healers, (healer) => {
            if (healer.pos.isNearTo(knight1!))
              healer.heal(knight1);
            else
              healer.rangedHeal(knight1);
          });
        } else if (knight2.creep.hits < knight2.creep.hitsMax) {
          _.forEach(this.healers, (healer) => {
            if (healer.pos.isNearTo(knight2!))
              healer.heal(knight2);
            else
              healer.rangedHeal(knight2);
          });
        }
      } else
        _.forEach(this.healers, (healer) => {
          let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, 1),
            (creep) => creep.hits < creep.hitsMax));
          if (healingTarget)
            healer.heal(healingTarget);
        });
    }
  }
}
