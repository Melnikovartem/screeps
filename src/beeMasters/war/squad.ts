import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { SpawnOrder } from "../../Hive";
import type { Bee } from "../../bees/bee";

//first tandem btw
@profile
export class SquadMaster extends SwarmMaster {
  healers: Bee[] = [];
  knights: Bee[] = [];
  maxSpawns = 4;
  roadTime = 0;
  targetBeeCount = 4;

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL))
      this.healers.push(bee);
    else
      this.knights.push(bee);
  }

  update() {
    super.update();

    for (const key in this.knights)
      this.knights[key] = Apiary.bees[this.knights[key].ref];
    this.knights = _.compact(this.knights);
    for (const key in this.healers)
      this.healers[key] = Apiary.bees[this.healers[key].ref];
    this.healers = _.compact(this.healers);

    if (this.checkBees()) {
      // if ever automated, then make priority 3
      if (this.healers.length < 2) {
        let healerOrder: SpawnOrder = {
          setup: setups.healer,
          amount: 2 - this.healers.length,
          priority: 1,
          master: this.ref,
        };
        this.wish(healerOrder, this.ref + "_healer");
      }
      if (this.knights.length < 2) {
        let tankOrder: SpawnOrder = {
          setup: setups.knight,
          amount: 2 - this.knights.length,
          priority: 1,
          master: this.ref,
        };
        this.wish(tankOrder, this.ref + "_knight");
      }
      if (this.knights.length !== 2 || this.healers.length !== 2)
        _.forEach(this.activeBees, bee => bee.state = beeStates.refill);
    }
  }

  run() {
    let knight1: Bee | undefined = this.knights[0];
    let knight2: Bee | undefined = this.knights[1];
    let healer1: Bee | undefined = this.healers[0];
    let healer2: Bee | undefined = this.healers[1];

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.refill)
        bee.goRest(this.hive.pos);
    });

    if (knight1 && knight2 && healer1 && healer2) {
      if (knight2.pos.isNearTo(knight1) && healer1.pos.isNearTo(knight1) && healer2.pos.isNearTo(knight2)) {
        knight1.state = beeStates.work;
        knight2.state = beeStates.work;
        healer1.state = beeStates.work;
        healer2.state = beeStates.work;
      } else {
        knight2.goTo(knight1.pos, { ignoreCreeps: false });
        healer1.goTo(knight1.pos, { ignoreCreeps: false });
        healer2.goTo(knight2.pos, { ignoreCreeps: false });
      }
    }

    _.forEach(this.activeBees, bee => {
      // if reconstructed while they all spawned, but not met yet or one was lost
      if (bee.state === beeStates.chill && this.beesAmount < 4)
        bee.state = beeStates.work;
    });

    let needsHealing: boolean | undefined;

    if (knight1 && knight1.state === beeStates.work && !this.waitingForBees) {
      let roomInfo = Apiary.intel.getInfo(knight1.pos.roomName);
      let enemies = _.map(_.filter(roomInfo.enemies, e => (e.dangerlvl > 3
        && (knight1!.pos.getRangeTo(e.object) < 4 || knight1!.pos.roomName === this.order.pos.roomName))), e => e.object);
      let target = knight1.pos.findClosest(enemies);
      let nextPos: TravelToReturnData = {};
      let newPos: RoomPosition | undefined;
      let ans1, ans2;

      needsHealing = knight1.hits < knight1.hitsMax || (knight2 && knight2.hits < knight2.hitsMax);
      if (!target)
        target = this.order.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_POWER_BANK)[0];

      if (target) {
        ans1 = knight1.attack(target, { returnData: nextPos, ignoreCreeps: false });
        if (knight2) {
          if (nextPos.nextPos)
            newPos = _.filter((<RoomPosition>nextPos.nextPos).getOpenPositions(), p => knight2!.pos.isNearTo(p)
              && (!healer1 || knight1!.pos !== p))[0];
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
            newPos = _.filter((<RoomPosition>nextPos.nextPos).getOpenPositions(),
              p => knight2!.pos.isNearTo(p) && (!healer1 || knight1!.pos !== p))[0];
          if (newPos) {
            ans2 = ERR_NOT_IN_RANGE;
            knight2.creep.move(knight2.pos.getDirectionTo(newPos));
          } else
            ans2 = knight2.goRest(this.order.pos);
        }
      }

      this.healerFollow(healer1, ans1, knight1.pos);
      this.healerFollow(healer2, knight2 ? ans2 : ans1, (knight2 ? knight2 : knight1).pos);
    }

    _.forEach(this.healers, healer => {
      let healed = false;
      _.forEach(this.healers.concat(this.knights), b => {
        if (!healed && b.hits < b.hitsMax * 0.75)
          if (healer.pos.isNearTo(b!))
            healed = healer.heal(b) === OK;
          else
            healed = healer.rangedHeal(b) === OK;
      });
      if (!!healed)
        _.forEach(this.healers.concat(this.knights), b => {
          if (!healed && b.hits < b.hitsMax)
            if (healer.pos.isNearTo(b!))
              healed = healer.heal(b) === OK;
            else
              healed = healer.rangedHeal(b) === OK;
        });
      if (!healed) {
        let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, knight1 ? 3 : 10),
          bee => bee.hits < bee.hitsMax));
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

  healerFollow(healer: Bee | undefined, ans: number | undefined, pos: RoomPosition) {
    if (!healer)
      return;
    if (healer.pos.isNearTo(pos) && ans === ERR_NOT_IN_RANGE)
      healer.creep.move(healer.pos.getDirectionTo(pos));
    else if (!healer.pos.isNearTo(pos))
      healer.goTo(pos, { ignoreCreeps: false });
  }
}
