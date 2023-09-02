import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { FULL_CAPACITY } from "bugSmuggling/terminalNetwork";
import type { ResourceCell } from "cells/base/resourceCell";
import { profile } from "profiler/decorator";
import { beeStates, roomStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import { Master } from "../_Master";

/** stop production if backlog too big  */
const STOP_MINERAL_PROD = FULL_CAPACITY;

@profile
export class MinerMaster extends Master<ResourceCell> {
  // #region Properties (2)

  public movePriority = 4 as const;
  public override newBee = (bee: Bee) => {
    super.newBee(bee);
    this.parent.parentCell.shouldRecalc = true;
  };

  // #endregion Properties (2)

  // #region Public Accessors (4)

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

  public get construction() {
    if (this.resourceType !== RESOURCE_ENERGY) return undefined;
    if (
      this.parent.container &&
      (this.pos.roomName !== this.hiveName || this.parent.link)
    )
      return undefined;
    if (!(this.pos.roomName in Game.rooms)) return undefined;

    let construction = this.parent.resource.pos
      .findInRange(FIND_CONSTRUCTION_SITES, 3)
      .filter((c) => c.structureType === STRUCTURE_ROAD)[0];
    if (construction) return construction;

    if (this.pos.roomName === this.hiveName) {
      construction = this.parent.resource.pos
        .findInRange(FIND_CONSTRUCTION_SITES, 2)
        .filter((c) => c.structureType === STRUCTURE_LINK)[0];
      if (construction) return construction;
    }
    return this.parent.resource.pos
      .findInRange(FIND_CONSTRUCTION_SITES, 1)
      .filter((c) => c.structureType === STRUCTURE_CONTAINER)[0];
  }

  public get ratePT() {
    return Math.min(this.beeRate, this.parent.ratePT);
  }

  public get targetBeeCount() {
    return 1;
  }

  // #endregion Public Accessors (4)

  // #region Private Accessors (1)

  private get resourceType() {
    return this.parent.resourceType;
  }

  // #endregion Private Accessors (1)

  // #region Public Methods (2)

  public run() {
    // check if we need to run
    const lairSoonSpawn =
      this.parent.lair &&
      (this.parent.lair.ticksToSpawn || 0) <=
        (this.parent.fleeLairTime !== Infinity ? this.parent.fleeLairTime : 5) *
          (this.resourceType === RESOURCE_ENERGY ? 1 : 2); // mineral miners run 2x times slower

    // check if we need to work
    let sourceOff: boolean | undefined = !this.parent.operational;
    if (this.pos.roomName in Game.rooms) {
      const roomState = Apiary.intel.getRoomState(this.pos);
      sourceOff =
        (sourceOff && !this.construction) ||
        (this.parent.resource instanceof Source &&
          this.parent.resource.energy === 0) ||
        (this.parent.extractor && this.parent.extractor.cooldown > 0) ||
        (this.parent.container &&
          !this.parent.link &&
          !this.parent.container.store.getFreeCapacity(this.resourceType)) ||
        (this.parent.link &&
          !this.parent.link.store.getFreeCapacity(this.resourceType)) ||
        roomState === roomStates.reservedByEnemy ||
        roomState === roomStates.ownedByEnemy ||
        (this.parent.container &&
          !this.parent.link &&
          this.parent.container.hits < this.parent.container.hitsMax * 0.2 &&
          this.parent.container.store.getUsedCapacity(RESOURCE_ENERGY) > 25 &&
          this.resourceType === RESOURCE_ENERGY);
    }

    _.forEach(this.activeBees, (bee) => {
      if (bee.state !== beeStates.chill) return;

      // mine, repair/chill, build/flee
      let mode: "mine" | "chill" | "busy" = sourceOff ? "chill" : "mine";

      if (lairSoonSpawn) {
        // fleeing from SK
        const diff =
          bee.pos.getRangeTo(this.parent.lair!) -
          Math.max(4, this.pos.getRangeTo(this.parent.lair!));
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
        this.parent.link &&
        bee.store.getFreeCapacity(this.resourceType) < bee.workMax * 4 &&
        this.parent.link?.store.getFreeCapacity(this.resourceType)
      )
        bee.transfer(this.parent.link, this.resourceType);

      // for container transfer we just stand on it

      // if we don't have container to stand on we create one
      if (
        !this.parent.container &&
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
        if (bee.pos.isNearTo(this.parent.resource) && mode === "mine")
          bee.harvest(this.parent.resource, this.hive.opt);
        bee.goTo(this.pos, this.hive.opt);
      } else if (mode === "mine") {
        bee.harvest(this.parent.resource, this.hive.opt);
      } else if (
        mode === "chill" &&
        bee.goTo(this.pos) === OK &&
        this.resourceType === RESOURCE_ENERGY
      ) {
        // repair container if nothing to do
        const target = this.parent.container;
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

  public override update() {
    super.update();

    const roomState = Apiary.intel.getRoomState(this.pos);
    let shouldSpawn =
      roomState === roomStates.ownedByMe ||
      (!this.hive.annexInDanger.includes(this.pos.roomName) &&
        (roomState === roomStates.reservedByMe ||
          roomState === roomStates.noOwner ||
          roomState === roomStates.SKcentral ||
          roomState === roomStates.SKfrontier));

    if (shouldSpawn)
      shouldSpawn =
        this.parent.operational ||
        (this.resourceType === RESOURCE_ENERGY &&
          this.pos.roomName in Game.rooms &&
          !!this.construction);

    if (
      shouldSpawn &&
      this.checkBees(
        this.resourceType === RESOURCE_ENERGY,
        CREEP_LIFE_TIME - this.parent.roadTime - 10
      )
    ) {
      const order = {
        setup: setups.miner.minerals,
        priority: 2 as 2 | 5 | 6,
      };

      if (this.resourceType === RESOURCE_ENERGY) {
        if (this.pos.roomName !== this.hiveName) order.priority = 5;
        order.setup = setups.miner.energy.copy();
        order.setup.patternLimit = Math.round(this.parent.ratePT / 2) + 1;
        if (this.parent.link) order.setup.fixed = [CARRY, CARRY, CARRY, CARRY];
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

  // #endregion Public Methods (2)

  // #region Private Methods (1)

  private logBuilding(
    ans: ScreepsReturnCode,
    bee: Bee,
    target: ConstructionSite<BuildableStructureConstant> | StructureContainer
  ) {
    if (ans !== OK) return;
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
      this.hiveName,
      this.parent.loggerRef,
      spend,
      RESOURCE_ENERGY
    );
    Apiary.logger.addResourceStat(
      this.hiveName,
      this.parent.loggerUpkeepRef,
      -spend,
      RESOURCE_ENERGY
    );
  }

  // #endregion Private Methods (1)
}
