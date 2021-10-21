import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DevelopmentCell } from "../../cells/stage0/developmentCell";

type workTypes = "upgrade" | "repair" | "build" | "refill" | "chilling" | "mining" | "picking";
type extraTarget = Tombstone | Ruin | Resource | StructureStorage;

@profile
export class BootstrapMaster extends Master {
  cell: DevelopmentCell;
  count: { [key in workTypes]: number } = {
    upgrade: 0,
    repair: 0,
    build: 0,
    refill: 0,
    chilling: 0,
    mining: 0,
    picking: 0,
  };
  patternCount = 0;
  containerTargeting: { [id: string]: { current: number, max: number } } = {};

  constructor(developmentCell: DevelopmentCell) {
    super(developmentCell.hive, developmentCell.ref);

    this.cell = developmentCell;
  }

  roomPos(x: number, y: number, r?: string) {
    return new RoomPosition(x, y, r ? r : this.hive.roomName);
  }

  recalculateTargetBee() {
    this.targetBeeCount = 0;

    this.patternCount = Math.floor(this.hive.room.energyCapacityAvailable / 200);
    if (this.hive.bassboost)
      this.patternCount = Math.floor(this.hive.bassboost.room.energyCapacityAvailable / 200)
    if (setups.bootstrap.patternLimit)
      this.patternCount = Math.min(setups.bootstrap.patternLimit, this.patternCount);

    _.forEach(this.hive.cells.excavation.resourceCells, cell => {
      let source = cell.resource;
      if (cell.resourceType !== RESOURCE_ENERGY)
        return;

      let roadTime = source.pos.getTimeForPath(this.cell.pos) - 2;
      let cycleWithoutEnergy = roadTime * 2 + this.patternCount;
      // energy produce per tick / energy a bee takes
      let energyPerTick = 10;
      let roomInfo = Apiary.intel.getInfo(cell.pos.roomName, 10);
      if (roomInfo.currentOwner !== Apiary.username)
        energyPerTick = 5;
      let openPos = source.pos.getOpenPositions(true).length;

      if (cell.operational) {
        let miningPower = Math.min(Math.floor((this.hive.room.energyCapacityAvailable - 50) / 150), setups.miner.energy.patternLimit);
        this.targetBeeCount += Math.min(energyPerTick, miningPower * 2)
          / (this.patternCount * 50 / cycleWithoutEnergy);
        energyPerTick = Math.max(energyPerTick - miningPower * 2, 0);
        --openPos;
        if (!openPos)
          return;
      }

      let maxCycleByEnergy = energyPerTick / (2 * this.patternCount * openPos * 25 / (cycleWithoutEnergy + 25))
        * (cell.pos.roomName === this.hive.pos.roomName ? 1.5 : 0.5); // much higher chance to mine in same room then in faraway
      // amount of positions * bees can 1 position support
      let maxcycleByPos = openPos * (1 + Math.round(cycleWithoutEnergy / (25 + roadTime * 0.5)));
      this.targetBeeCount += Math.min(maxCycleByEnergy, maxcycleByPos);
    });

    this.targetBeeCount = Math.max(1, Math.ceil(this.targetBeeCount));
    if (this.hive.phase > 0)
      this.targetBeeCount = Math.min(this.targetBeeCount, 2);
    /*
      if (this.hive.bassboost)
        this.targetBeeCount = Math.min(this.targetBeeCount, 6);
      else if (Game.shard.name === "shard3")
        this.targetBeeCount = Math.min(this.targetBeeCount, 10);
    */
    this.cell.shouldRecalc = false;
  }

  checkBeesWithRecalc() {
    if (this.count.chilling || (this.hive.phase > 0 && this.hive.state === hiveStates.economy))
      return false;
    let check = () => this.checkBees(true);
    if (!check() && !this.targetBeeCount)
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();

    if (this.cell.shouldRecalc)
      this.recalculateTargetBee();

    //if (this.hive.cells.storage)
    //  this.hive.cells.storage.master.targetBeeCount = 1;

    if (this.checkBeesWithRecalc()) {
      this.wish({
        setup: setups.bootstrap,
        priority: <0 | 5 | 8>(this.beesAmount < this.targetBeeCount * 0.35 ? 0 : (this.beesAmount > 10 ? 8 : 5)),
      });
    }
  }

  run() {
    let countCurrent: { [key in workTypes]: number } = {
      upgrade: 0,
      repair: 0,
      build: 0,
      refill: 0,
      chilling: 0,
      mining: 0,
      picking: 0,
    };

    let soruces = (<Source[]>_.compact(_.map(this.hive.cells.excavation.resourceCells,
      cell => (!cell.master.beesAmount || this.hive.room.energyCapacityAvailable <= 750) && cell.resourceType === RESOURCE_ENERGY ? cell.resource : undefined)))
      .filter(s => s.pos.getOpenPositions().length && (s.energy > this.patternCount * 50 || s.ticksToRegeneration < 20));

    let targets: extraTarget[] = []
    let containerTargetingCur: { [id: string]: { current: number, max: number } } = {};

    for (let i = 0; i < this.cell.handAddedResources.length; ++i) {
      let pos = this.cell.handAddedResources[i];
      if (!(pos.roomName in Game.rooms))
        continue;
      let amount = 0;
      let target: extraTarget | undefined = pos.lookFor(LOOK_RESOURCES)
        .filter(r => r.resourceType === RESOURCE_ENERGY && r.amount >= 25)[0];
      if (target)
        amount = target.amount;
      if (!target)
        target = pos.lookFor(LOOK_TOMBSTONES).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) >= 25)[0];
      if (!target)
        target = pos.lookFor(LOOK_RUINS).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) >= 25)[0];
      if (!target) {
        let structures = <StructureStorage[]>pos.lookFor(LOOK_STRUCTURES)
          .filter(s => (<StructureStorage>s).store);
        if (!structures.length) {
          this.cell.handAddedResources.splice(i, 1);
          --i;
        } else
          target = structures.filter(s => s.store.getUsedCapacity(RESOURCE_ENERGY) >= 50
            && (!this.hive.room.storage || s.id !== this.hive.room.storage.id || this.hive.state === hiveStates.battle || this.hive.state === hiveStates.nospawn))[0];
      }

      if (target) {
        if (!amount && !(target instanceof Resource))
          amount = target.store.getUsedCapacity(RESOURCE_ENERGY);
        containerTargetingCur[target.id] = { current: 0, max: Math.ceil(amount / (this.patternCount * 50)) };
        if (!this.containerTargeting[target.id])
          this.containerTargeting[target.id] = containerTargetingCur[target.id];
        if (this.containerTargeting[target.id].current < this.containerTargeting[target.id].max)
          targets.push(target);
      }
    }

    let refillTargets: (StructureSpawn | StructureExtension)[] = _.map(this.hive.cells.spawn.spawns);
    refillTargets = _.filter(refillTargets.concat(_.map(this.hive.cells.spawn.extensions)),
      structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.work:
          if (!bee.creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
            bee.state = beeStates.refill;
            bee.target = undefined;
          }
          break;
        case beeStates.refill:
          if (!bee.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
            if (Apiary.logger)
              Apiary.logger.addResourceStat(this.hive.roomName, "larva", bee.creep.store.getUsedCapacity(RESOURCE_ENERGY));
            bee.state = beeStates.work;
            bee.target = undefined;
          }
          break;
        case beeStates.chill:
          if (bee.pos.roomName === this.hive.roomName)
            bee.state = beeStates.refill;
          break;
      }

      switch (bee.state) {
        case beeStates.refill:
          let source: Source | null | undefined | extraTarget;
          if (!bee.target) {
            source = bee.pos.findClosest(soruces);
            if (source)
              bee.target = source.id;
          } else
            source = Game.getObjectById(bee.target);

          if (!source || source instanceof Source) {
            let pickupTarget = bee.pos.findClosest(targets);
            if (pickupTarget && this.containerTargeting[pickupTarget.id].current < this.containerTargeting[pickupTarget.id].max
              && (!source || bee.pos.getRangeApprox(pickupTarget) < bee.pos.getRangeApprox(source) + 50)) {
              source = pickupTarget;
              bee.target = source.id;
              ++this.containerTargeting[source.id].current;
            }
          }

          if (source instanceof Source) {
            if (source.energy === 0 && source.ticksToRegeneration > 20)
              bee.target = undefined;
            else {
              if (bee.pos.isNearTo(source))
                bee.harvest(source);
              else {
                let pos = source.pos.getOpenPositions()[0];
                if (pos)
                  bee.goTo(pos, { ignoreRoads: bee.store.getUsedCapacity() === 0 });
                else if (bee.pos.getRangeTo(source) > 4)
                  bee.target = undefined;
              }
            }
            ++countCurrent.mining;
            break;
          } else if (source) {
            bee.target = source.id;
            if (!containerTargetingCur[source.id])
              bee.target = undefined;
            else if (this.containerTargeting[source.id].current > this.containerTargeting[source.id].max) {
              --this.containerTargeting[source.id].current;
              bee.target = undefined;
            }

            if (bee.target) {
              if (containerTargetingCur[source.id])
                containerTargetingCur[source.id].current += 1;
              if (source instanceof Resource)
                bee.pickup(source);
              else
                bee.withdraw(source, RESOURCE_ENERGY);
            }
            ++countCurrent.picking;
            break;
          } else {
            bee.state = beeStates.chill;
            bee.target = undefined;
          }
        case beeStates.chill:
          ++countCurrent.chilling;
          bee.goRest(this.hive.rest);
          break;
        case beeStates.work:
          let target: Structure | ConstructionSite | undefined | null;
          let workType: workTypes = "chilling";
          let oldTarget: workTypes = "chilling";

          if (bee.target) {
            target = Game.getObjectById(bee.target);
            if (target instanceof ConstructionSite)
              workType = "build";
            else if (target instanceof Structure) {
              if (target.structureType === STRUCTURE_CONTROLLER)
                workType = "upgrade";
              else if ((target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION
                || target.structureType === STRUCTURE_STORAGE || target.structureType === STRUCTURE_TOWER)
                && (<StructureStorage>target).store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                workType = "refill"; // also can be different types of <Store>, so just storage for easy check
              else if (target.hits < Apiary.planner.getCase(target).heal)
                workType = "repair";
            }
            if (workType === "chilling")
              target = undefined;

            if (target)
              oldTarget = workType;
            else if (!this.hive.structuresConst.length && this.hive.shouldRecalc < 2)
              this.hive.shouldRecalc = 2;
          }

          if (!target) {
            let tt: (StructureTower)[] = _.filter(this.hive.cells.defense.towers,
              structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            target = bee.pos.findClosest(tt);
            workType = "refill";
          }

          if (!target && this.cell.controller.ticksToDowngrade <= 6000 && this.count.upgrade === 0) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          if (!target && bee.pos.roomName !== this.hive.roomName) {
            target = this.hive.getBuildTarget(bee, "ignoreRepair");
            if (target && target.pos.roomName !== bee.pos.roomName)
              target = null;
            if (target)
              if (target instanceof Structure)
                workType = "repair";
              else
                workType = "build";
          }

          let refillTarget = bee.pos.findClosest(refillTargets);
          if (refillTarget && (!this.hive.cells.storage || !this.hive.cells.storage.master.activeBees.length)
            && (refillTarget.pos.getRangeTo(bee) < 10 && !this.count.refill || !target)) {
            target = refillTarget;
            workType = "refill";
          }

          if (!target && this.hive.room.storage && this.hive.room.storage.isActive() && this.hive.state !== hiveStates.battle && this.hive.state !== hiveStates.nospawn) {
            target = this.hive.room.storage;
            workType = "refill";
          }

          if (!target) {
            target = this.hive.getBuildTarget(bee);
            if (target)
              if (target instanceof Structure)
                workType = "repair";
              else
                workType = "build";
          }

          if (!target) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          let ans;
          if (workType === "repair") {
            ans = bee.repair(<Structure>target);
            if (ans === OK && Apiary.logger)
              Apiary.logger.addResourceStat(this.hive.roomName, "build", -1);
          } else if (workType === "build") {
            ans = bee.build(<ConstructionSite>target);
            if (ans === OK && Apiary.logger)
              Apiary.logger.addResourceStat(this.hive.roomName, "build", -1);
          } else if (workType === "refill")
            ans = bee.transfer(<Structure>target, RESOURCE_ENERGY);
          else if (workType === "upgrade") {
            if (ans === OK && Apiary.logger)
              Apiary.logger.addResourceStat(this.hive.roomName, "upgrade", -bee.getActiveBodyParts(WORK));
            ans = bee.upgradeController(<StructureController>target);
          }
          bee.repairRoadOnMove(ans);

          if (oldTarget !== workType)
            ++this.count[workType];
          ++countCurrent[workType];
          bee.target = target.id;
          break;
      }
    });
    this.count = countCurrent;
    this.containerTargeting = containerTargetingCur;
  }
}
