import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";
import { makeId } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { FlagOrder } from "../../order";
import type { PullerMaster } from "./puller";

//first tandem btw
@profile
export class PowerMaster extends SwarmMaster {
  duplets: [Bee | undefined, Bee | undefined][] = [];
  healers: Bee[] = [];
  knights: Bee[] = [];
  target: StructurePowerBank | undefined;
  movePriority = <1>1;
  positions: { pos: RoomPosition }[];
  operational: boolean = false;

  parent: PullerMaster;

  constructor(order: FlagOrder, parent: PullerMaster) {
    super(order);
    this.order.memory.extraInfo = 0;

    parent.powerSites.push(this);
    this.parent = parent;

    this.positions = this.pos.getOpenPositions(true).map(p => { return { pos: p } });
    this.targetBeeCount = this.positions.length * 2;
    this.maxSpawns = Infinity;

    if (!this.order.memory.extraInfo)
      this.order.memory.extraInfo = {
        roadTime: this.pos.getTimeForPath(this.hive),
        hits: 0,
        decay: Game.time,
        power: 0,
      };

    if (this.pos.roomName in Game.rooms)
      this.updateTarget();
  }

  get roadTime() {
    return <number>this.order.memory.extraInfo.roadTime;
  }

  set roadTime(value) {
    this.order.memory.extraInfo.roadTime = value;
  }

  get power() {
    return <number>this.order.memory.extraInfo.power;
  }

  set power(value) {
    this.order.memory.extraInfo.power = value;
  }

  get hits() {
    return <number>this.order.memory.extraInfo.hits;
  }

  set hits(value) {
    this.order.memory.extraInfo.hits = value;
  }

  get decay() {
    return <number>this.order.memory.extraInfo.decay - Game.time;
  }

  set decay(value) {
    this.order.memory.extraInfo.decay = Game.time + value;
  }

  get pickupTime() {
    // spawn time (halfed + roadTime)
    return Math.ceil(this.power / (MAX_CREEP_SIZE * CARRY_CAPACITY / 2) * 0.5) * MAX_CREEP_SIZE * CREEP_SPAWN_TIME + this.roadTime;
  }

  get shouldSpawn() {
    return this.operational && this.parent.sitesON.includes(this);
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL))
      this.healers.push(bee);
    else
      this.knights.push(bee);
  }

  deleteBee(ref: string) {
    super.deleteBee(ref);
    for (let i = 0; i < this.healers.length; ++i)
      if (this.healers[i].ref === ref) {
        this.healers.splice(i, 1);
        --i;
      }
    for (let i = 0; i < this.knights.length; ++i)
      if (this.knights[i].ref === ref) {
        this.knights.splice(i, 1);
        --i;
      }
  }

  updateTarget() {
    this.target = <StructurePowerBank | undefined>this.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_POWER_BANK)[0];
    if (this.target) {
      this.hits = this.target.hits;
      this.decay = this.target.ticksToDecay;
      this.power = this.target.power;

      let dmgCurrent = _.sum(this.duplets, dd => dd[0] && dd[0].pos.isNearTo(this) ? 1 : 0) * ATTACK_POWER * 20;
      if (this.hits / dmgCurrent <= this.pickupTime)
        this.callPickUp();
    } else {
      let res = this.pos.lookFor(LOOK_RESOURCES)[0];
      if (res) {
        this.power = res.amount;
        this.callPickUp();
      }
      this.maxSpawns = 0;
      this.hits = -1;
      if (!this.pos.isFree(true))
        this.order.flag.setPosition(Math.floor(Math.random() * 50), Math.floor(Math.random() * 50));
    }
  }

  checkBees() {
    return this.shouldSpawn && super.checkBees(true, CREEP_LIFE_TIME - this.roadTime - 30);
  }

  createDuplet(knight: Bee) {
    let goodHealers;
    if (knight.target)
      goodHealers = [this.bees[knight.target]];
    else
      goodHealers = this.healers.filter(h => Math.abs(h.ticksToLive - knight.ticksToLive) < Math.min(CREEP_LIFE_TIME / 2, this.roadTime * 3)
        && (!h.target || !this.bees[h.target]));
    let healer = <Bee | undefined>knight.pos.findClosest(goodHealers);
    if (healer || knight.ticksToLive < this.roadTime || knight.target) {
      knight.target = "None";
      if (healer) {
        healer.target = knight.ref;
        knight.target = healer.ref;
        let healerIndex = this.healers.indexOf(healer);
        this.healers.splice(healerIndex, 1);
      }
      let knightIndex = this.knights.indexOf(knight);
      this.knights.splice(knightIndex, 1);
      this.duplets.push([knight, healer]);
      return true;
    }
    return false
  }

  update() {
    super.update();

    for (let i = 0; i < this.knights.length; ++i)
      if (this.createDuplet(this.knights[i]))
        --i;

    for (let i = 0; i < this.duplets.length; ++i) {
      let [knight, healer] = this.duplets[i];
      if (knight)
        this.duplets[i][0] = this.bees[knight.ref];
      if (healer)
        this.duplets[i][1] = this.bees[healer.ref];
    }

    if (this.pos.roomName in Game.rooms)
      this.updateTarget();
    else {
      this.target = undefined;
      if (this.hits <= 0 && this.hive.cells.observe)
        Apiary.requestSight(this.pos.roomName);
    }

    if (this.decay < -100) {
      this.order.delete();
      return;
    }

    this.operational = this.hits > 0;
    if (this.operational) {
      let dmgFuture = ATTACK_POWER * 20 * _.sum(this.duplets, dd => !dd[0] ? 0 :
        Math.min(this.decay, dd[0].ticksToLive - (dd[0].pos.isNearTo(this) ? 0 : this.roadTime)));
      let dmgPerSecond = ATTACK_POWER * 20 * this.positions.length;
      this.operational = this.hits - dmgFuture > 0 && this.decay > this.roadTime + MAX_CREEP_SIZE * CREEP_SPAWN_TIME
        && this.hits / dmgPerSecond <= this.decay - (this.activeBees.length ? 0 : this.roadTime);
    }

    if (this.checkBees()) {
      let balance = this.healers.filter(b => b.ticksToLive > this.roadTime * 2).length - this.knights.filter(b => b.ticksToLive > this.roadTime * 2).length;
      if (balance <= 0)
        this.wish({
          setup: setups.miner.powerhealer,
          priority: 7,
        }, this.ref + "_healer");
      if (balance >= 0)
        this.wish({
          setup: setups.miner.power,
          priority: 7,
        }, this.ref + "_miner");
    }
  }

  callPickUp() {
    if (this.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_GREEN).length)
      return;
    let name = this.pos.createFlag(Math.ceil(this.power / (MAX_CREEP_SIZE * CARRY_CAPACITY / 2)) + "_pickup_" + makeId(4), COLOR_ORANGE, COLOR_GREEN);
    if (typeof name === "string")
      Game.flags[name].memory.hive = this.hive.roomName;
  }

  run() {
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.chill:
          if (!bee.target)
            bee.goRest(this.hive.rest);
          break;
      }
    });

    _.forEach(this.duplets, (couple => {
      let [knight, healer] = couple;

      if (knight && healer && (knight.state !== beeStates.work || healer.state !== beeStates.work)) {
        if ((knight.pos.isNearTo(healer) || (knight.pos.enteranceToRoom && knight.pos.enteranceToRoom.isNearTo(healer)))
          && !knight.creep.spawning && !healer.creep.spawning) {
          knight.state = beeStates.work;
          healer.state = beeStates.work;
        } else {
          knight.goTo(healer.pos, { range: 1 });
          healer.goTo(knight.pos, { range: 1 });
          return;
        }
      }

      let chill = false;
      if (knight && knight.state === beeStates.work) {
        let target: Creep | PowerCreep | Structure | undefined;
        if (knight.pos.roomName === this.pos.roomName && this.target)
          target = this.target;
        let enemy = Apiary.intel.getEnemy(knight.pos, 20);
        if (enemy && knight.pos.getRangeTo(enemy) < 3 || (knight.pos.roomName === this.pos.roomName && !target))
          target = enemy;
        if (target) {
          if (target instanceof StructurePowerBank) {
            if (!healer || healer.pos.isNearTo(knight) || knight.pos.x <= 1 || knight.pos.x >= 48 || knight.pos.y <= 1 || knight.pos.y >= 48)
              if (healer && !knight.pos.isNearTo(this)) {
                let pos = knight.pos.getRangeTo(this.pos) > 5 ? this.pos
                  : this.positions.filter(p => !this.activeBees.filter(b => b.pos.equal(p) && b.getActiveBodyParts(ATTACK)).length)[0];
                if (pos)
                  knight.goTo(pos, { useFindRoute: true, obstacles: this.positions.filter(p => !p.pos.equal(pos)) });
                else {
                  knight.goTo(this.pos, { range: 3 });
                  chill = true;
                }
              } else if (knight.hits > knight.hitsMax * 0.5)
                knight.attack(target);
              else if (!healer && !this.pos.getOpenPositions(false).length)
                if (knight.getActiveBodyParts(ATTACK))
                  knight.attack(target);
                else
                  knight.creep.suicide();
          } else
            knight.attack(target);
        } else if (knight.hits === knight.hitsMax)
          knight.goRest(this.pos, { useFindRoute: true });
      }

      if (healer && healer.state === beeStates.work) {
        if (healer.hits < healer.hitsMax)
          healer.heal(healer);
        if (knight) {
          if (knight.hits < knight.hitsMax || knight.pos.isNearTo(this))
            if (healer.pos.isNearTo(knight))
              healer.heal(knight);
            else
              healer.rangedHeal(knight);
        } else {
          let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, 3),
            bee => bee.hits < bee.hitsMax));
          if (healingTarget) {
            if (healer.pos.isNearTo(healingTarget))
              healer.heal(healingTarget);
            else
              healer.rangedHeal(healingTarget);
          }
        }
        if (!healer.targetPosition)
          if (knight) {
            if (!healer.pos.isNearTo(knight))
              healer.goTo(knight.pos, { movingTarget: true });
            else if (knight.pos.isNearTo(this)) {
              let poss;
              if (healer.pos.isNearTo(this))
                poss = knight.pos.getOpenPositions(true);
              if (poss && poss.length)
                healer.goTo(poss.reduce((prev, curr) => curr.getRangeTo(this) > prev.getRangeTo(this) ? curr : prev), { obstacles: this.positions });
              else
                healer.goRest(knight.pos);
            } else if (!chill)
              healer.goTo(knight.pos);
          } else
            healer.goRest(this.pos, { range: 3 });
      }
    }));
  }

  delete() {
    super.delete();
    if (this.hive.puller) {
      let index = this.hive.puller.powerSites.indexOf(this);
      if (index !== -1)
        this.hive.puller.powerSites.splice(index, 1);
    }
  }
}
