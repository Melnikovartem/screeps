import type { Bee } from "../../bees/bee";
import { setups } from "../../bees/creepSetups";
import { FREE_CAPACITY } from "../../bugSmuggling/terminalNetwork";
import type { ResourceCell } from "../../cells/base/resourceCell";
import { profile } from "../../profiler/decorator";
import { beeStates } from "../../static/enums";
import { findOptimalResource } from "../../static/utils";
import { Master } from "../_Master";

const STOP_MINERAL_PROD = FREE_CAPACITY * 0.25;

@profile
export class MinerMaster extends Master {
  private cell: ResourceCell;
  public movePriority = 4 as const;

  public constructor(resourceCell: ResourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
    // idea low lvl harvest boost cause they be cheap af
  }

  public get pos() {
    return this.cell.pos;
  }

  public newBee = (bee: Bee) => {
    super.newBee(bee);
    this.cell.parentCell.shouldRecalc = true;
  };

  public get beeRate() {
    const beeRates = _.map(this.activeBees, (bee) => {
      if (bee.pos.getRangeTo(this.pos) > 10) return 0;
      let work = 0;
      work += bee.workMax;
      return work;
    });
    let beeRate = Math.max(0, ...beeRates);
    if (this.resourceType === RESOURCE_ENERGY) beeRate *= 2;
    else beeRate /= 5;
    return beeRate;
  }

  public get ratePT() {
    return Math.min(this.beeRate, this.cell.ratePT);
  }

  private get resourceType() {
    return this.cell.resourceType;
  }

  public update() {
    super.update();

    const roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    let shouldSpawn =
      !this.hive.annexInDanger.includes(this.pos.roomName) &&
      (roomInfo.currentOwner === Apiary.username || !roomInfo.currentOwner);

    if (shouldSpawn)
      shouldSpawn =
        this.cell.operational ||
        (this.resourceType === RESOURCE_ENERGY &&
          this.pos.roomName in Game.rooms &&
          !!this.construction);

    if (
      shouldSpawn &&
      this.checkBees(
        this.resourceType === RESOURCE_ENERGY,
        CREEP_LIFE_TIME - this.cell.roadTime - 10
      )
    ) {
      const order = {
        setup: setups.miner.minerals,
        priority: 2 as 2 | 5 | 6,
      };

      if (this.resourceType === RESOURCE_ENERGY) {
        if (this.pos.roomName !== this.roomName) order.priority = 5;
        order.setup = setups.miner.energy.copy();
        order.setup.patternLimit = Math.round(this.cell.ratePT / 2) + 1;
        if (this.cell.link) order.setup.fixed = [CARRY, CARRY, CARRY, CARRY];
      } else {
        // stop producting minerals
        if (
          (this.hive.cells.storage &&
            this.hive.cells.storage.storage.store.getFreeCapacity() <=
              STOP_MINERAL_PROD) ||
          this.hive.resState[RESOURCE_ENERGY] < 0
        )
          return;
        order.priority = 6;
      }

      this.wish(order);
    }
  }

  public get construction() {
    if (this.resourceType !== RESOURCE_ENERGY) return undefined;
    if (
      this.cell.container &&
      (this.pos.roomName !== this.roomName || this.cell.link)
    )
      return undefined;

    let construction = this.cell.resource.pos
      .findInRange(FIND_CONSTRUCTION_SITES, 3)
      .filter((c) => c.structureType === STRUCTURE_ROAD)[0];
    if (construction) return construction;

    if (this.pos.roomName === this.roomName) {
      construction = this.cell.resource.pos
        .findInRange(FIND_CONSTRUCTION_SITES, 2)
        .filter((c) => c.structureType === STRUCTURE_LINK)[0];
      if (construction) return construction;
    }
    return this.cell.resource.pos
      .findInRange(FIND_CONSTRUCTION_SITES, 1)
      .filter((c) => c.structureType === STRUCTURE_CONTAINER)[0];
  }

  public run() {
    // check if we need to run
    const lairSoonSpawn =
      this.cell.lair &&
      (this.cell.lair.ticksToSpawn || 0) <=
        (this.cell.fleeLairTime !== Infinity ? this.cell.fleeLairTime : 5) *
          (this.resourceType === RESOURCE_ENERGY ? 1 : 2); // mineral miners run 2x times slower

    // check if we need to work
    let sourceOff: boolean | undefined = !this.cell.operational;
    if (this.pos.roomName in Game.rooms) {
      const roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
      sourceOff =
        (sourceOff && !this.construction) ||
        (this.cell.resource instanceof Source &&
          this.cell.resource.energy === 0) ||
        (this.cell.extractor && this.cell.extractor.cooldown > 0) ||
        (this.cell.container &&
          !this.cell.link &&
          !this.cell.container.store.getFreeCapacity(this.resourceType)) ||
        (this.cell.link &&
          !this.cell.link.store.getFreeCapacity(this.resourceType)) ||
        (roomInfo.currentOwner && roomInfo.currentOwner !== Apiary.username) ||
        (this.cell.container &&
          !this.cell.link &&
          this.cell.container.hits < this.cell.container.hitsMax * 0.2 &&
          this.cell.container.store.getUsedCapacity(RESOURCE_ENERGY) > 25 &&
          this.resourceType === RESOURCE_ENERGY);
    }

    _.forEach(this.activeBees, (bee) => {
      if (bee.state !== beeStates.chill) return;

      // mine, repair/chill, build/flee
      let mode: "mine" | "chill" | "busy" = sourceOff ? "chill" : "mine";

      if (lairSoonSpawn) {
        // fleeing from SK
        const diff =
          bee.pos.getRangeTo(this.cell.lair!) -
          Math.max(4, this.pos.getRangeTo(this.cell.lair!));
        if (diff <= 0) {
          bee.goTo(this.hive);
          mode = "busy";
        } else if (diff < 5) {
          bee.stop();
          mode = "busy";
        }
      }

      // transfer to link if valid
      if (
        this.cell.link &&
        bee.store.getFreeCapacity(this.resourceType) < bee.workMax * 4 &&
        this.cell.link?.store.getFreeCapacity(this.resourceType)
      )
        bee.transfer(this.cell.link, this.resourceType);

      // for container transfer we just stand on it

      // if we don't have container to stand on we create one
      if (
        !this.cell.container &&
        mode !== "busy" &&
        bee.store.getUsedCapacity(RESOURCE_ENERGY) >=
          Math.min(bee.workMax * 5, bee.store.getCapacity(RESOURCE_ENERGY))
      ) {
        const construction = this.construction;
        if (construction) {
          this.logBuilding(bee.build(construction), bee, construction);
          mode = "busy";
        }
      }

      if (!bee.pos.equal(this.pos) && mode !== "busy") {
        bee.goTo(this.pos, this.hive.opt);
        if (bee.pos.isNearTo(this.cell.resource) && mode === "mine")
          bee.harvest(this.cell.resource, this.hive.opt);
      }
      if (mode === "mine") {
        bee.harvest(this.cell.resource, this.hive.opt);
      } else if (
        mode === "chill" &&
        bee.goTo(this.pos) === OK &&
        this.resourceType === RESOURCE_ENERGY
      ) {
        // repair container if nothing to do
        const target = this.cell.container;
        if (target && target.hits < target.hitsMax) {
          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            this.logBuilding(bee.repair(target), bee, target);
          if (
            bee.store.getUsedCapacity(RESOURCE_ENERGY) < bee.workMax * 2 &&
            target.store.getUsedCapacity(RESOURCE_ENERGY) >= bee.workMax
          )
            bee.withdraw(target, RESOURCE_ENERGY, 25);
        }
      }

      // RUN as we need
      if (this.checkFlee(bee, this.hive) || lairSoonSpawn) {
        if (bee.targetPosition && bee.store.getUsedCapacity() > 0)
          bee.drop(findOptimalResource(bee.store));
      }
    });
  }

  private logBuilding(
    ans: ScreepsReturnCode,
    bee: Bee,
    target: ConstructionSite<BuildableStructureConstant> | StructureContainer
  ) {
    if (ans !== OK) return;
    if (!Apiary.logger) return;
    let spend;
    if (target instanceof StructureContainer) {
      spend = Math.min(
        bee.workMax,
        Math.floor((target.hitsMax - target.hits) / 100)
      );
    } else
      spend = Math.min(bee.workMax * 5, target.progressTotal - target.progress);
    spend = Math.min(bee.store.getUsedCapacity(RESOURCE_ENERGY));
    Apiary.logger.addResourceStat(
      this.roomName,
      this.cell.loggerRef,
      spend,
      RESOURCE_ENERGY
    );
    Apiary.logger.addResourceStat(
      this.roomName,
      this.cell.loggerUpkeepRef,
      -spend,
      RESOURCE_ENERGY
    );
  }
}
