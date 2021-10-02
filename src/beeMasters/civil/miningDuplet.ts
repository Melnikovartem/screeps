import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";
import { makeId } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";

//first tandem btw
@profile
export class DupletMaster extends SwarmMaster {
  calledOneMore = false;
  duplets: [Bee, Bee][] = [];
  healers: Bee[] = [];
  knights: Bee[] = [];
  target: StructurePowerBank | undefined;
  targetBeeCount = this.order.pos.getOpenPositions(true).length * 2;
  maxSpawns = this.order.pos.getOpenPositions(true).length * 2;
  roadTime = this.order.pos.getTimeForPath(this.hive);
  dmgPerDupl = (CREEP_LIFE_TIME - this.roadTime) * (30 * 20);
  pickupTime = setups.pickup.patternLimit * 4.5 + this.roadTime;
  movePriority = <1>1;

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
      this.target = <StructurePowerBank | undefined>this.order.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_POWER_BANK)[0];
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
        setup: setups.healer,
        amount: 1,
        priority: 7,
        master: this.ref,
      }, this.ref + "_healer");
      this.wish({
        setup: setups.miner.power,
        amount: 1,
        priority: 7,
        master: this.ref,
      }, this.ref + "_miner");
    }
  }

  callPickUp(power: number) {
    if (this.order.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_GREEN).length)
      return;
    let name = this.order.pos.createFlag(Math.ceil(power / (setups.pickup.patternLimit * 50)) + "_pickup_" + makeId(4), COLOR_ORANGE, COLOR_GREEN);
    if (typeof name === "string")
      Game.flags[name].memory.hive = this.hive.roomName;
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.chill)
        bee.goRest(this.hive.pos);
    });

    _.forEach(this.duplets, (couple => {
      let [knight, healer] = couple;

      if (knight && healer && !knight.creep.spawning && !healer.creep.spawning) {
        if (knight.pos.isNearTo(healer)) {
          knight.state = beeStates.work;
          healer.state = beeStates.work;
        } else {
          knight.goTo(healer.pos);
          healer.goTo(knight.pos);
        }
      }

      if (knight && knight.state === beeStates.work) {
        let roomInfo = Apiary.intel.getInfo(knight.pos.roomName);
        let knightPos = knight.pos;
        let enemies = _.map(_.filter(roomInfo.enemies, e => (e.dangerlvl > 3
          && (knightPos.getRangeTo(e.object) < 3 || knightPos.roomName === this.order.pos.roomName))), e => e.object);
        if (knight.pos.roomName === this.order.pos.roomName && this.target && !enemies.filter(e => e.pos.getRangeTo(this.order) < 6).length)
          enemies = enemies.concat(this.target);

        let target = knight.pos.findClosest(enemies);
        if (target) {
          if (target instanceof StructurePowerBank) {
            if (knight.hits > knight.hitsMax * 0.5)
              knight.attack(target);
          } else
            knight.attack(target);
        } else if (knight.hits === knight.hitsMax)
          knight.goRest(this.order.pos);

        if (healer)
          healer.goTo(knight.pos, { ignoreCreeps: false, movingTarget: true });
      }

      if (healer && healer.state === beeStates.work) {
        if (healer.hits < healer.hitsMax) {
          healer.heal(healer);
        } if (knight && knight.hits < knight.hitsMax) {
          if (healer.pos.isNearTo(knight))
            healer.heal(knight);
          else
            healer.rangedHeal(knight);
        } else {
          let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, knight ? 3 : 10),
            bee => bee.hits < bee.hitsMax));
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
