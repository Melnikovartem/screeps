import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DevelopmentCell } from "../../cells/stage0/developmentCell";

type workTypes = "upgrade" | "repair" | "build" | "refill" | "chilling" | "mining" | "stealing";
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
    stealing: 0,
  };

  constructor(developmentCell: DevelopmentCell) {
    super(developmentCell.hive, developmentCell.ref);

    this.cell = developmentCell;
  }

  roomPos(x: number, y: number, r?: string) {
    return new RoomPosition(x, y, r ? r : this.hive.roomName);
  }

  recalculateTargetBee() {
    this.targetBeeCount = 0;
    let patternCount = Math.floor(this.hive.room.energyCapacityAvailable / 200);
    if (this.hive.bassboost)
      patternCount = Math.floor(this.hive.bassboost.room.energyCapacityAvailable / 200)
    if (setups.bootstrap.patternLimit)
      patternCount = Math.min(setups.bootstrap.patternLimit, patternCount);

    _.forEach(this.cell.sources, source => {
      // harvestTime + roadTime + workTime(upgrade)
      let openPos = source.pos.getOpenPositions(true).length;
      if (this.hive.phase > 0 && source.pos.roomName === this.hive.roomName && this.hive.state !== hiveStates.nospawn)
        openPos--;
      let roadTime = source.pos.getTimeForPath(this.cell.pos) - 2;
      let cycleWithoutEnergy = roadTime * 2 + patternCount;
      // energy produce per tick / energy a bee takes
      let energyPerTick = 10;
      if (source.pos.roomName === this.hive.roomName && this.hive.room.energyCapacityAvailable < 650)
        energyPerTick = 5;
      let maxCycleByEnergy = Math.ceil(energyPerTick / (2 * patternCount * openPos * 25 / (cycleWithoutEnergy + 25) * 0.75));
      // amount of positions * bees can 1 position support
      let maxcycleByPos = openPos * (1 + Math.round(cycleWithoutEnergy / (25 + roadTime * 0.5)));
      // console.log(source.pos, "pos:", maxcycleByPos, "energy:", maxCycleByEnergy);
      this.targetBeeCount += Math.min(maxCycleByEnergy, maxcycleByPos);
    });

    this.targetBeeCount = Math.ceil(this.targetBeeCount);
    if (this.hive.bassboost)
      this.targetBeeCount = Math.min(this.targetBeeCount, 6);
    else if (Game.shard.name === "shard3")
      this.targetBeeCount = Math.min(this.targetBeeCount, 10);
    this.cell.shouldRecalc = false;

    return this.checkBees(false);
  }

  update() {
    super.update();

    if (this.cell.shouldRecalc)
      this.recalculateTargetBee();

    if (this.checkBees(false) && (this.hive.phase === 0 || this.hive.state > hiveStates.economy)
      && !this.count.chilling && this.recalculateTargetBee()) {
      let order = {
        setup: setups.bootstrap,
        amount: 1,
        priority: <0 | 5 | 9>(this.hive.bassboost ? 9 : (this.beesAmount < this.targetBeeCount * 0.35 ? 0 : 5)),
      }

      if (this.hive.bassboost && this.hive.pos.getRoomRangeTo(this.hive.bassboost) > 8) {
        order.setup.fixed = [TOUGH, TOUGH, TOUGH];
        order.setup.moveMax = 8 / 21 * 50;
      }

      this.wish(order);
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
      stealing: 0,
    };

    let handTargets: extraTarget[] = [];
    for (let i = 0; i < this.cell.handAddedResources.length; ++i) {
      let target: extraTarget | undefined;
      let pos = this.cell.handAddedResources[i];
      target = pos.lookFor(LOOK_RUINS).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
      if (!target)
        target = pos.lookFor(LOOK_TOMBSTONES).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
      if (!target)
        target = pos.lookFor(LOOK_RESOURCES).filter(r => r.resourceType === RESOURCE_ENERGY && r.amount > 0)[0];
      if (!target) {
        let structures = <StructureStorage[]>pos.lookFor(LOOK_STRUCTURES)
          .filter(s => (<StructureStorage>s).store && (!this.hive.room.storage || s.id !== this.hive.room.storage.id));
        if (!structures.length) {
          this.cell.handAddedResources.splice(i, 1);
          --i;
        } else
          target = structures.filter(s => s.store.getUsedCapacity(RESOURCE_ENERGY) >= 100)[0];
      }
      if (target)
        handTargets.push(target);
    }

    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.work:
          if (!bee.creep.store.getUsedCapacity(RESOURCE_ENERGY))
            bee.state = beeStates.refill;
          break;
        case beeStates.refill:
          if (!bee.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
            delete bee.target;
            bee.state = beeStates.work;
          }
          break;
        case beeStates.chill:
          if (bee.pos.roomName === this.hive.roomName)
            bee.state = beeStates.refill;
      }

      switch (bee.state) {
        case beeStates.refill:
          let source: Source | null;
          let extraTarget = bee.pos.findClosest(handTargets);
          if (extraTarget) {
            if (bee.pos.roomName !== extraTarget.pos.roomName)
              bee.goTo(extraTarget);
            else {
              if (extraTarget instanceof Resource)
                bee.pickup(extraTarget)
              else
                bee.withdraw(extraTarget, RESOURCE_ENERGY);
            }
            ++countCurrent.stealing;
            return;
          }

          if (!bee.target) {
            // next lvl caching would be to calculate all the remaining time to fill up and route to source and check on that
            // but that is too much for too little
            source = <Source>bee.pos.findClosest(_.filter(this.cell.sources,
              source => (source.pos.getOpenPositions().length || bee.pos.isNearTo(source))
                && (source.energy > bee.store.getFreeCapacity(RESOURCE_ENERGY) || source.ticksToRegeneration < 20)));
            if (source)
              bee.target = source.id;
          } else
            source = this.cell.sources[bee.target];

          if (source instanceof Source) {
            if (source.energy === 0 && source.ticksToRegeneration > 20)
              delete bee.target;
            else {
              if (bee.pos.isNearTo(source))
                bee.harvest(source);
              else {
                let pos = source.pos.getOpenPositions()[0];
                if (pos)
                  bee.goTo(pos, { ignoreRoads: true });
                else if (bee.pos.getRangeTo(source) > 6)
                  delete bee.target;
              }
            }
          } else {
            bee.state = beeStates.chill;
            delete bee.target;
          }

          if (bee.target) {
            ++countCurrent.mining;
            break;
          }
        case beeStates.chill:
          ++countCurrent.chilling;
          bee.goRest(this.hive.pos);
          break;
        case beeStates.work:
          let target: Structure | ConstructionSite | undefined | null;
          let workType: workTypes = "chilling";
          let oldTarget = false;

          if (bee.target) {
            target = Game.getObjectById(bee.target);
            if (target) {
              if (target instanceof ConstructionSite)
                workType = "build";
              else if (target.structureType === STRUCTURE_CONTROLLER)
                workType = "upgrade";
              else if ((target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION
                || target.structureType === STRUCTURE_STORAGE || target.structureType === STRUCTURE_TOWER)
                && (<StructureStorage>target).store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                workType = "refill"; // also can be different types of <Store>, so just storage for easy check
              else if (target.hits < Apiary.planner.getCase(target).heal) {
                workType = "repair";
              } else
                target = undefined;
            }
            if (target)
              oldTarget = true;
            else if (!this.hive.structuresConst.length && this.hive.shouldRecalc < 2)
              this.hive.shouldRecalc = 2;
          }

          if (!target) {
            let targets: (StructureTower)[] = _.filter(this.hive.cells.defense.towers,
              structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }

          if (!target && this.cell.controller.ticksToDowngrade <= 6000 && this.count.upgrade === 0) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          if (!target && bee.pos.roomName !== this.hive.roomName && this.count.build + this.count.repair <= Math.ceil(this.targetBeeCount * 0.75)) {
            target = this.hive.findProject(bee, "repairs");
            if (target)
              if (target instanceof Structure)
                workType = "repair";
              else
                workType = "build";
          }

          if (!target && (this.count.refill < Math.max(2, this.targetBeeCount * 0.2) || bee.pos.roomName === this.hive.roomName)) {
            let targets: (StructureSpawn | StructureExtension)[] = _.map(this.hive.cells.spawn.spawns);
            targets = _.filter(targets.concat(_.map(this.hive.cells.spawn.extensions)),
              structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }

          if (!target) {
            target = this.hive.findProject(bee);
            if (target)
              if (target instanceof Structure)
                workType = "repair";
              else
                workType = "build";
          }

          if (!target && this.hive.room.storage && this.hive.room.storage.isActive()) {
            target = this.hive.room.storage;
            workType = "refill";
          }

          if (!target) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          let ans;
          if (workType === "repair")
            ans = bee.repair(<Structure>target);
          else if (workType === "build")
            ans = bee.build(<ConstructionSite>target);
          else if (workType === "refill")
            ans = bee.transfer(<Structure>target, RESOURCE_ENERGY);
          else if (workType === "upgrade")
            ans = bee.upgradeController(<StructureController>target);
          bee.repairRoadOnMove(ans);

          if (!oldTarget)
            ++this.count[workType];
          ++countCurrent[workType];
          bee.target = target.id;
          break;
      }
    });
    this.count = countCurrent;
  }
}
