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
    if (bee.creep.ticksToLive && bee.creep.ticksToLive < 800)
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
      // if ever automated, then make priority 3
      this.spawned = true;
      if (this.knights.length < 2) {
        let tankOrder: SpawnOrder = {
          setup: Setups.knight,
          amount: 2 - this.knights.length,
          priority: 1,
          master: this.ref,
        };
        this.wish(tankOrder, this.ref + "_knight");
      }

      if (this.healers.length < 2) {
        let healerOrder: SpawnOrder = {
          setup: Setups.healer,
          amount: 2 - this.healers.length,
          priority: 1,
          master: this.ref,
        };
        this.wish(healerOrder, this.ref + "_healer");
      }
      if (this.knights.length == 2 && this.healers.length == 2)
        _.forEach(this.bees, (bee) => bee.state = states.chill);
      else
        _.forEach(this.bees, (bee) => bee.state = states.refill);
    }

    if (!this.waitingForBees && this.beesAmount == 0)
      this.order.destroyTime = Game.time;
  }

  run() {
    let knight1: Bee | undefined = this.knights[0];
    let knight2: Bee | undefined = this.knights[1];
    let healer1: Bee | undefined = this.healers[0];
    let healer2: Bee | undefined = this.healers[1];

    _.forEach(this.bees, (bee) => {
      if (bee.state == states.refill)
        bee.goRest(this.hive.pos);
    });

    if (knight1 && knight2 && healer1 && healer2) {
      if (knight2.pos.isNearTo(knight1) && healer1.pos.isNearTo(knight1) && healer2.pos.isNearTo(knight2)) {
        knight1.state = states.work;
        knight2.state = states.work;
        healer1.state = states.work;
        healer2.state = states.work;
      } else {
        knight2.goTo(knight1.pos, { ignoreCreeps: false });
        healer1.goTo(knight1.pos, { ignoreCreeps: false });
        healer2.goTo(knight2.pos, { ignoreCreeps: false });
      }
    }

    _.forEach(this.bees, (bee) => {
      // if reconstructed while they all spawned, but not met yet or one was lost
      if (bee.state == states.chill && this.beesAmount < 4)
        bee.state = states.work;
    });

    let needsHealing: boolean | undefined;

    if (knight1 && knight1.state == states.work && !this.waitingForBees) {

      let roomInfo = Apiary.intel.getInfo(knight1.pos.roomName);
      let target: Structure | Creep | null = knight1.pos.findClosest(_.filter(roomInfo.enemies,
        (e) => (e.pos.getRangeTo(knight1!) < 4 || (knight1!.pos.roomName == this.order.pos.roomName
          && !(e instanceof Creep && e.owner.username == "Source Keeper")))));
      let nextPos: TravelToReturnData = {};
      let newPos: RoomPosition | undefined;
      let ans1, ans2;

      needsHealing = knight1.hits < knight1.hitsMax || (knight2 && knight2.hits < knight2.hitsMax);
      if (target) {
        ans1 = knight1.attack(target, { returnData: nextPos, ignoreCreeps: false });
        if (knight2) {
          if (nextPos.nextPos)
            newPos = _.filter((<RoomPosition>nextPos.nextPos).getOpenPositions(), (p) => knight2!.pos.isNearTo(p)
              && (!healer1 || knight1!.pos != p))[0];
          if (newPos) {
            ans2 = ERR_NOT_IN_RANGE;
            knight2.creep.move(knight2.pos.getDirectionTo(newPos));
          }
          if (knight2.pos.isNearTo(target) || !newPos)
            ans2 = knight2.attack(target, { ignoreCreeps: false });
        }
      } else if (!needsHealing) {
        ans1 = knight1.goRest(this.order.pos, { returnData: nextPos });
        if (knight2) {
          if (nextPos.nextPos)
            newPos = _.filter((<RoomPosition>nextPos.nextPos).getOpenPositions(), (p) => {
              if (knight1!.pos.x == p.x && knight1!.pos.y == p.y) console.log("F"); return knight2!.pos.isNearTo(p)
                && (!healer1 || knight1!.pos != p)
            })[0];
          if (newPos) {
            ans2 = ERR_NOT_IN_RANGE;
            knight2.creep.move(knight2.pos.getDirectionTo(newPos));
          } else
            ans2 = knight2.goRest(this.order.pos);
        }
      }

      if (healer1) {
        if (healer1.pos.isNearTo(knight1.pos) && ans1 == ERR_NOT_IN_RANGE)
          healer1.creep.move(healer1.pos.getDirectionTo(knight1.pos));
        else if (!healer1.pos.isNearTo(knight1.pos))
          healer1.goTo(knight1.pos, { ignoreCreeps: false });
      }
      let knightTarget2 = knight2 ? knight2 : knight1;
      if (healer2) {
        if (healer2.pos.isNearTo(knightTarget2) && (knight2 ? ans2 : ans1) == ERR_NOT_IN_RANGE)
          healer2.creep.move(healer2.pos.getDirectionTo(knightTarget2.pos));
        else if (!healer2.pos.isNearTo(knightTarget2))
          healer2.goTo(knight1.pos, { ignoreCreeps: false });
      }
    }
    _.forEach(this.healers, (healer) => {
      let healed = false;
      _.forEach(this.healers.concat(this.knights), (b) => {
        if (!healed && b.hits < b.hitsMax * 0.75)
          if (healer.pos.isNearTo(b!))
            healed = healer.heal(b) == OK;
          else
            healed = healer.rangedHeal(b) == OK;
      });
      if (!!healed)
        _.forEach(this.healers.concat(this.knights), (b) => {
          if (!healed && b.hits < b.hitsMax)
            if (healer.pos.isNearTo(b!))
              healed = healer.heal(b) == OK;
            else
              healed = healer.rangedHeal(b) == OK;
        });
      if (!healed) {
        let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, knight1 ? 3 : 10),
          (bee) => bee.hits < bee.hitsMax));
        if (healingTarget) {
          if (healer.pos.isNearTo(healingTarget))
            healer.heal(healingTarget);
          else
            healer.rangedHeal(healingTarget);
        } else if (!knight1)
          healer.goTo(this.order.pos);
      }
    });
  }
}