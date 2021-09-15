// manages colony untill storage lvl
import type { developmentCell } from "../../cells/stage0/developmentCell";

import { Setups } from "../../bees/creepSetups";
import { Master, states } from "../_Master";
import type { Bee } from "../../bees/Bee";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

type workTypes = "upgrade" | "repair" | "build" | "mining" | "working" | "refill";


@profile
export class bootstrapMaster extends Master {
  cell: developmentCell;
  sourceTargeting: { [id: string]: { max: number, current: number } } = {};
  handAddedResources: RoomPosition[] = [];

  constructor(developmentCell: developmentCell) {
    super(developmentCell.hive, developmentCell.ref);

    this.cell = developmentCell;
    this.recalculateTargetBee();

    /* if (this.hive.roomName === "E13S56")
      this.handAddedResources = [this.roomPos(22, 15), this.roomPos(15, 22, "E13S55")] */
  }

  roomPos(x: number, y: number, r?: string) {
    return new RoomPosition(x, y, r ? r : this.hive.roomName);
  }

  recalculateTargetBee() {
    this.targetBeeCount = 0;
    let workBodyParts = Math.floor(this.hive.room.energyCapacityAvailable / 200);
    if (this.hive.bassboost)
      workBodyParts = Math.floor(this.hive.bassboost.room.energyCapacityAvailable / 200)
    if (Setups.bootstrap.patternLimit)
      workBodyParts = Math.min(Setups.bootstrap.patternLimit, workBodyParts);

    // theoretically i should count road from minerals to controller, but this is good enough
    let magicNumber = [0.5, 0.666];
    if (workBodyParts > 3)
      magicNumber = [0.35, 0.45]; // more upgrading less mining
    _.forEach(this.cell.sources, (source) => {
      let walkablePositions = source.pos.getOpenPositions(true).length;
      // 3000/300 /(workBodyParts * 2) / kk , where kk - how much of life will be wasted on harvesting (aka magic number)
      // how many creeps the source can support at a time: Math.min(walkablePositions, 10 / (workBodyParts * 2))
      if (source.room.name === this.hive.roomName)
        this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / magicNumber[0];
      else
        this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / magicNumber[1]; // they need to walk more;

      if (!this.sourceTargeting[source.id])
        this.sourceTargeting[source.id] = {
          max: walkablePositions,
          current: 0,
        };
    });
    this.targetBeeCount = Math.ceil(this.targetBeeCount);
    if (this.hive.bassboost)
      this.targetBeeCount = Math.min(this.targetBeeCount, 10);
  }

  newBee(bee: Bee): void {
    super.newBee(bee);
    bee.reusePath = 1;
  }

  update() {
    super.update();

    if (this.cell.shouldRecalc)
      this.recalculateTargetBee(); // just to check if expansions are done

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);
    if (this.checkBees() && this.hive.stage === 0 && roomInfo.safePlace) {
      let order: SpawnOrder = {
        setup: Setups.bootstrap,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 9,
      };

      if (this.beesAmount < this.targetBeeCount * 0.2) {
        order.priority = 2;
        order.amount = Math.ceil(this.targetBeeCount * 0.2 - this.beesAmount);
      }

      this.wish(order);
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
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case states.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
            bee.state = states.refill;
          break;
        case states.refill:
          if (bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            bee.target = null;
            bee.state = states.work;
          }
          break;
        case states.chill:
          if (bee.pos.roomName === this.hive.roomName)
            bee.state = states.refill;
      }

      switch (bee.state) {
        case states.refill:
          let source: Source | null;
          if (this.handAddedResources.length) {
            let pos = this.handAddedResources[0];
            if (bee.pos.roomName !== pos.roomName)
              bee.goTo(pos);
            else {
              let target: Tombstone | Ruin | Resource | StructureStorage | undefined;
              target = pos.lookFor(LOOK_RUINS).filter((r) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
              if (!target)
                target = pos.lookFor(LOOK_TOMBSTONES).filter((r) => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
              if (!target)
                target = pos.lookFor(LOOK_RESOURCES).filter((r) => r.resourceType === RESOURCE_ENERGY && r.amount > 0)[0];
              if (!target)
                target = <StructureStorage>pos.lookFor(LOOK_STRUCTURES)
                  .filter((s) => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0)[0];
              if (target) {
                if (target instanceof Resource)
                  bee.pickup(target)
                else
                  bee.withdraw(target, RESOURCE_ENERGY);
              } else
                this.handAddedResources.shift();
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
            if (source.energy === 0)
              bee.target = null;
            else {
              bee.harvest(source, { ignoreCreeps: true, ignoreRoads: true });
              sourceTargetingCurrent[source.id] += 1;
            }
          } else {
            bee.state = states.chill;
            bee.target = null;
          }
          break;
        case states.work:
          let target: Structure | ConstructionSite | null = null;
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
                && (<StructureSpawn | StructureExtension | StructureTower>target).store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                workType = "refill"; // also can be StructureStorage, but if i cast that it will be sad (different type of <Store>)
              else if (target.hits < target.hitsMax)
                workType = "repair";
              else
                target = null;
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

          if (!target && this.cell.controller.ticksToDowngrade <= 2000 && count["upgrade"] === 0) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          if (!target) {
            let targets: (StructureSpawn | StructureExtension)[] = _.map(this.hive.cells.spawn.spawns);
            targets = _.filter(targets.concat(_.map(this.hive.cells.spawn.extensions)),
              (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }

          if (!target && this.hive.room.storage) {
            target = this.hive.room.storage;
            workType = "refill";
          }

          if (!target && count["build"] + count["repair"] <= Math.ceil(this.targetBeeCount * 0.75)) {
            let pos = bee.pos.findClosest(this.hive.structuresConst);
            while (pos && !target) {
              target = pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
              if (!target)
                target = _.filter(pos.lookFor(LOOK_STRUCTURES), (s) => s.hits < s.hitsMax)[0];
              else
                workType = "build";
              if (!target) {
                for (let k = 0; k < this.hive.structuresConst.length; ++k)
                  if (this.hive.structuresConst[k].x == pos.x && this.hive.structuresConst[k].y == pos.y) {
                    this.hive.structuresConst.splice(k, 1);
                    break;
                  }
                pos = bee.pos.findClosest(this.hive.structuresConst);
              } else
                workType = "repair";
            }
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
        case states.chill:
          bee.goRest(this.hive.pos);
      }
    });

    for (const sourceId in sourceTargetingCurrent)
      this.sourceTargeting[sourceId].current = sourceTargetingCurrent[sourceId];
  }
}
