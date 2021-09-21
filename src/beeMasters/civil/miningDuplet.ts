import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { Bee } from "../../bees/bee";

import { states } from "../_Master";
import { makeId } from "../../abstract/utils";
import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class dupletMaster extends SwarmMaster {
  calledOneMore = false;
  duplets: [Bee, Bee][] = [];
  healers: Bee[] = [];
  knights: Bee[] = [];
  target: StructurePowerBank | undefined;
  targetBeeCount = this.order.pos.getOpenPositions(true).length * 2;
  maxSpawns = this.order.pos.getOpenPositions(true).length * 2;
  roadTime = this.order.pos.getTimeForPath(this.hive);
  dmgPerDupl = (CREEP_LIFE_TIME - this.roadTime) * (30 * 20);
  pickupTime = Setups.pickup.patternLimit * 4.5 + this.roadTime;

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL))
      this.healers.push(bee);
    else
      this.knights.push(bee);
  }

  update() {
    super.update();

    if (this.knights.length && this.healers.length) {
      let knight = this.knights.shift()!;
      let healer = knight.pos.findClosest(this.healers)!;

      for (let i = 0; i < this.healers.length; ++i)
        if (this.healers[i].ref === healer.ref) {
          this.healers.splice(i, 1);
          break;
        }
      this.duplets.push([knight, healer]);
    }

    if (this.order.pos.roomName in Game.rooms) {
      this.target = <StructurePowerBank | undefined>this.order.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType === STRUCTURE_POWER_BANK)[0];
      if (!this.target) {
        let res = this.order.pos.lookFor(LOOK_RESOURCES)[0];
        if (res)
          this.callPickUp(res.amount);
        this.maxSpawns = 0;
        if (!this.order.pos.isFree())
          this.order.flag.setPosition(Math.floor(Math.random() * 50), Math.floor(Math.random() * 50));
      } else {
        this.maxSpawns = Math.ceil(this.target.hits / 600 / this.target.ticksToDecay) * 2;
        if (this.target.hits / (this.duplets.length * 600) <= this.pickupTime)
          this.callPickUp(this.target.power);
      }
    }

    let damageWillBeMax = 0;
    for (let i = 0; i < this.duplets.length; ++i) {
      let ticks = this.duplets[i][0].creep.ticksToLive;
      if (!ticks)
        ticks = CREEP_LIFE_TIME;
      damageWillBeMax += ticks * 600;
    }

    if (this.checkBees() && (!this.target || (this.target.hits - damageWillBeMax > 0 && this.target.ticksToDecay > this.roadTime))) {
      this.wish({
        setup: Setups.healer,
        amount: 1,
        priority: 4,
        master: this.ref,
      }, this.ref + "_healer");
      this.wish({
        setup: Setups.miner.power,
        amount: 1,
        priority: 4,
        master: this.ref,
      }, this.ref + "_miner");
    }
  }

  healerFollow(healer: Bee, ans: number | undefined, pos: RoomPosition) {
    if (!healer)
      return;
    if (healer.pos.isNearTo(pos) && ans === ERR_NOT_IN_RANGE && healer.pos.roomName == pos.roomName)
      healer.creep.move(healer.pos.getDirectionTo(pos));
    else if (!healer.pos.isNearTo(pos))
      healer.goTo(pos, { ignoreCreeps: false });
  }

  callPickUp(power: number) {
    if (this.order.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_GREEN).length)
      return;
    let name = this.order.pos.createFlag(Math.ceil(power / (Setups.pickup.patternLimit * 50)) + "_pickup_" + makeId(4), COLOR_ORANGE, COLOR_GREEN);
    if (typeof name === "string")
      Game.flags[name].memory.hive = this.hive.roomName;
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === states.chill)
        bee.goRest(this.hive.pos);
    });

    _.forEach(this.duplets, (couple => {
      let [knight, healer] = couple;

      if (knight && healer && !knight.creep.spawning && !healer.creep.spawning) {
        if (knight.pos.isNearTo(healer)) {
          knight.state = states.work;
          healer.state = states.work;
        } else {
          knight.goTo(healer.pos);
          healer.goTo(knight.pos);
        }
      }

      if (knight && knight.state === states.work) {
        let roomInfo = Apiary.intel.getInfo(knight.pos.roomName);
        let knightPos = knight.pos;
        let enemies = _.map(_.filter(roomInfo.enemies, (e) => (e.dangerlvl > 3
          && (knightPos.getRangeTo(e.object) < 3 || knightPos.roomName === this.order.pos.roomName))), (e) => e.object);
        if (knight.pos.roomName === this.order.pos.roomName && this.target && !enemies.filter((e) => e.pos.getRangeTo(this.order) < 6).length)
          enemies = enemies.concat(this.target);

        let target = knight.pos.findClosest(enemies);
        let ans;
        if (target) {
          if (target instanceof StructurePowerBank) {
            if (knight.hits > knight.hitsMax * 0.5)
              ans = knight.attack(target);
          } else
            ans = knight.attack(target);
        } else if (knight.hits === knight.hitsMax)
          ans = knight.goRest(this.order.pos, { preferHighway: true });

        this.healerFollow(healer, ans, knight.pos);
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
    }));
  }
}
