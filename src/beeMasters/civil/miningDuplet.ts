import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { Bee } from "../../bees/bee";

import { states } from "../_Master";
import { makeId } from "../../abstract/utils";
import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class dupletMaster extends SwarmMaster {
  healer: Bee | undefined;
  knight: Bee | undefined;
  maxSpawns = 2;
  targetBeeCount = 2;
  roadTime = 0;

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL))
      this.healer = bee;
    else
      this.knight = bee;
  }

  update() {
    super.update();

    if (this.knight && !Apiary.bees[this.knight.ref])
      delete this.knight;

    if (this.healer && !Apiary.bees[this.healer.ref])
      delete this.healer;

    if (this.checkBees()) {
      if (!this.healer)
        this.wish({
          setup: Setups.healer,
          amount: 1,
          priority: 4,
          master: this.ref,
        }, this.ref + "_healer");

      if (!this.knight)
        this.wish({
          setup: Setups.tank,
          amount: 1,
          priority: 4,
          master: this.ref,
        }, this.ref + "_knight");

      _.forEach(this.activeBees, (bee) => bee.state = states.refill);
    }
  }

  healerFollow(healer: Bee | undefined, ans: number | undefined, pos: RoomPosition) {
    if (!healer)
      return;
    if (healer.pos.isNearTo(pos) && ans === ERR_NOT_IN_RANGE && healer.pos.roomName == pos.roomName)
      healer.creep.move(healer.pos.getDirectionTo(pos));
    else if (!healer.pos.isNearTo(pos))
      healer.goTo(pos, { ignoreCreeps: false });
  }

  callPickUp(power: number) {
    if (this.order.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_GREY).length)
      this.order.pos.createFlag(Math.ceil(power / (Setups.pickup.patternLimit * 100)) + "_pickup_" + makeId(4), COLOR_GREY, COLOR_GREEN);
  }

  run() {
    let knight = this.knight;
    let healer = this.healer;
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === states.refill)
        bee.goRest(this.hive.pos);
    });


    if (knight && healer) {
      knight.state = states.work;
      healer.state = states.work;
    }

    if (knight && knight.state === states.work) {
      let roomInfo = Apiary.intel.getInfo(knight.pos.roomName);
      let enemies = _.filter(roomInfo.enemies, (e) => (e.pos.getRangeTo(knight!) < 3 || (knight!.pos.roomName === this.order.pos.roomName)
        && !(e instanceof Creep && e.owner.username === "Source Keeper")))
      if (knight.pos.roomName === this.order.pos.roomName) {
        enemies = enemies.concat(this.order.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType === STRUCTURE_POWER_BANK));
        if (!enemies.length) {
          let res = this.order.pos.lookFor(LOOK_RESOURCES)[0]
          if (res)
            this.callPickUp(res.amount);
        }
      }
      let target = knight.pos.findClosest(enemies);

      let ans;
      if (target) {
        if (target instanceof StructurePowerBank) {
          if (!this.roadTime)
            this.roadTime = target!.pos.getTimeForPath(this.hive.pos);
          let attack = knight.getBodyParts(ATTACK);
          if (this.roadTime + (Setups.pickup.pattern.length * Setups.pickup.patternLimit + Setups.pickup.fixed.length) * 3 >= target.hits / attack)
            this.callPickUp(target.power)
          if (knight.hits > knight.hitsMax * 0.5)
            ans = knight.attack(target);
        } else
          ans = knight.attack(target);
      } else if (knight.hits === knight.hitsMax)
        ans = knight.goRest(this.order.pos, { preferHighway: true });

      this.healerFollow(this.healer, ans, knight.pos);
    }

    if (healer && healer.state === states.work) {
      if (healer.hits < healer.hitsMax) {
        healer.heal(healer);
      } if (knight && knight.hits < knight.hitsMax) {
        if (healer.pos.isNearTo(knight))
          healer.heal(knight);
        else
          healer.rangedHeal(knight);
      } else {
        let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, knight ? 3 : 10),
          (bee) => bee.hits < bee.hitsMax));
        if (healingTarget) {
          if (healer.pos.isNearTo(healingTarget))
            healer.heal(healingTarget);
          else
            healer.rangedHeal(healingTarget);
        } else if (!knight)
          healer.goTo(this.order.pos);
      }
    }
  }
}
