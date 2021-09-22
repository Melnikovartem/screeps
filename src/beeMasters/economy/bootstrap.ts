import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DevelopmentCell } from "../../cells/stage0/developmentCell";
import type { Bee } from "../../bees/Bee";

type workTypes = "upgrade" | "repair" | "build" | "mining" | "working" | "refill";
type extraTarget = Tombstone | Ruin | Resource | StructureStorage;

@profile
export class BootstrapMaster extends Master {
  cell: DevelopmentCell;
  sourceTargeting: { [id: string]: { max: number, current: number } } = {};
  patternCount = 1;

  constructor(developmentCell: DevelopmentCell) {
    super(developmentCell.hive, developmentCell.ref);

    this.cell = developmentCell;
    this.recalculateTargetBee();
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

    // theoretically i should count road from minerals to controller, but this is good enough
    let magicNumber = [0.5, 0.666];
    if (this.patternCount > 3)
      magicNumber = [0.35, 0.45]; // more upgrading less mining
    _.forEach(this.cell.sources, (source) => {
      let walkablePositions = source.pos.getOpenPositions(true).length;
      if (this.hive.phase > 0 && source.pos.roomName === this.hive.roomName && this.hive.state !== hiveStates.nospawn)
        --walkablePositions;
      // 3000/300 /(workBodyParts * 2) / kk , where kk - how much of life will be wasted on harvesting (aka magic number)
      // how many creeps the source can support at a time: Math.min(walkablePositions, 10 / (workBodyParts * 2))
      if (source.room.name === this.hive.roomName)
        this.targetBeeCount += Math.min(walkablePositions, 10 / (this.patternCount * 2)) / magicNumber[0];
      else
        this.targetBeeCount += Math.min(walkablePositions, 10 / (this.patternCount * 2)) / magicNumber[1]; // they need to walk more;

      if (!this.sourceTargeting[source.id])
        this.sourceTargeting[source.id] = {
          max: walkablePositions,
          current: 0,
        };
    });
    this.targetBeeCount = Math.ceil(this.targetBeeCount);
    if (this.hive.bassboost)
      this.targetBeeCount = Math.min(this.targetBeeCount, 6);
    else if (Game.shard.name === "shard3")
      this.targetBeeCount = Math.min(this.targetBeeCount, 10);
    this.cell.shouldRecalc = false;
  }

  newBee(bee: Bee): void {
    super.newBee(bee);
    bee.reusePath = 1;
  }

  update() {
    super.update();

    if (this.cell.shouldRecalc)
      this.recalculateTargetBee(); // just to check if expansions are done

    if (this.checkBees(false) && (this.hive.phase === 0 || this.hive.state > hiveStates.economy)) {
      this.wish({
        setup: setups.bootstrap,
        amount: this.targetBeeCount - this.beesAmount,
        priority: this.hive.bassboost ? 9 : (this.beesAmount < this.targetBeeCount * 0.2 ? 0 : 5),
      });
    }
  }

  run() {
    let count: { [id: string]: number } = {
      upgrade: 0,
      repair: 0,
      build: 0,
      refill: 0,
    };

    let sourceTargetingCurrent: { [id: string]: number } = {};

    _.forEach(this.cell.sources, (source) => {
      sourceTargetingCurrent[source.id] = 0;
    });

    let handTargets: extraTarget[] = [];
    for (let i = 0; i < this.cell.handAddedResources.length; ++i) {
      let target: extraTarget | undefined;
      let pos = this.cell.handAddedResources[i];
      target = pos.lookFor(LOOK_RUINS).filter((r) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
      if (!target)
        target = pos.lookFor(LOOK_TOMBSTONES).filter((r) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
      if (!target)
        target = pos.lookFor(LOOK_RESOURCES).filter((r) => r.resourceType === RESOURCE_ENERGY && r.amount > 0)[0];
      if (!target) {
        let structures = <StructureStorage[]>pos.lookFor(LOOK_STRUCTURES)
          .filter((s) => (<StructureStorage>s).store && (!this.hive.room.storage || s.id !== this.hive.room.storage.id));
        if (!structures.length) {
          this.cell.handAddedResources.splice(i, 1);
          --i;
        } else
          target = structures.filter((s) => s.store.getUsedCapacity(RESOURCE_ENERGY) >= this.patternCount * 50)[0];
      }
      if (target)
        handTargets.push(target);
    }

    _.forEach(this.activeBees, (bee) => {
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
            return;
          }

          if (!bee.target) {
            // next lvl caching would be to calculate all the remaining time to fill up and route to source and check on that
            // but that is too much for too little
            source = <Source>bee.pos.findClosest(_.filter(this.cell.sources,
              (source) => this.sourceTargeting[source.id].current < this.sourceTargeting[source.id].max
                && (source.pos.getOpenPositions().length || bee.pos.isNearTo(source)) && source.energy > 0));
            if (source) {
              this.sourceTargeting[source.id].current += 1;
              bee.target = source.id;
            }
          } else
            source = Game.getObjectById(bee.target);

          if (source instanceof Source) {
            if (source.energy === 0 || !source.pos.getOpenPositions())
              delete bee.target;
            else {
              if (bee.pos.isNearTo(source))
                bee.harvest(source);
              else {
                let pos = source.pos.getOpenPositions()[0];
                if (pos)
                  bee.goTo(pos, { ignoreRoads: true });
                else
                  bee.goTo(source.pos, { ignoreRoads: true, range: 3 })
              }
              sourceTargetingCurrent[source.id] += 1;
            }
          } else {
            bee.state = beeStates.chill;
            delete bee.target;
          }
          if (source)
            break;
        case beeStates.chill:
          bee.goRest(this.hive.pos);
        case beeStates.work:
          let target: Structure | ConstructionSite | undefined | null;
          let workType: workTypes = "working";

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
              else if (target.hits < target.hitsMax)
                workType = "repair";
              else
                target = undefined;
            }
            if (!target && !this.hive.structuresConst.length && this.hive.shouldRecalc < 2)
              this.hive.shouldRecalc = 2;
          }

          if (!target) {
            let targets: (StructureTower)[] = _.filter(this.hive.cells.defense.towers,
              (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }

          if (!target && this.cell.controller.ticksToDowngrade <= 6000 && count["upgrade"] === 0) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          if (!target && count["refill"] < 2) {
            let targets: (StructureSpawn | StructureExtension)[] = _.map(this.hive.cells.spawn.spawns);
            targets = _.filter(targets.concat(_.map(this.hive.cells.spawn.extensions)),
              (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }

          if (!target && count["build"] + count["repair"] <= Math.ceil(this.targetBeeCount * 0.75)) {
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
          if (ans === ERR_NOT_IN_RANGE)
            bee.repair(_.filter(bee.pos.lookFor(LOOK_STRUCTURES), (s) => s.hits < s.hitsMax)[0]);

          count[workType] += 1;
          bee.target = target.id;
          break;
      }
    });

    for (const sourceId in sourceTargetingCurrent)
      this.sourceTargeting[sourceId].current = sourceTargetingCurrent[sourceId];
  }
}
