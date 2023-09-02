import { setups } from "bees/creepSetups";
import type { FlagOrder } from "orders/order";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import type { Boosts } from "../_Master";
import { SwarmMaster } from "../_SwarmMaster";

@profile
export class HelpUpgradeMaster extends SwarmMaster {
  // #region Constructors (1)

  public constructor(order: FlagOrder) {
    super(order);
    this.maxSpawns = 100;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (3)

  public get boosts(): Boosts {
    return [
      { type: "upgrade", lvl: 2 },
      { type: "fatigue", lvl: 2 },
    ];
  }

  public get targetBeeCount() {
    if (!this.order) return 0;
    if (!this.order.memory.extraInfo) this.order.memory.extraInfo = 3;
    return this.order.memory.extraInfo as number;
  }

  public set targetBeeCount(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo = value;
  }

  // #endregion Public Accessors (3)

  // #region Public Methods (2)

  public run() {
    this.preRunBoost();
    const hiveToUpg = Apiary.hives[this.pos.roomName];
    if (!hiveToUpg) return;

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;
      if (this.checkFlee(bee, hiveToUpg)) return;
      // remvoed some useless code for this master as nuke survivial/recyclyng
      if (
        bee.store.getUsedCapacity(RESOURCE_ENERGY) >
          Math.min(bee.workMax * 3, bee.store.getCapacity()) ||
        bee.ticksToLive < 15
      ) {
        if (
          hiveToUpg.controller &&
          bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        ) {
          const ans = bee.upgradeController(
            hiveToUpg.controller,
            hiveToUpg.opt
          );
          if (ans === OK)
            Apiary.logger.addResourceStat(
              hiveToUpg.roomName,
              "upgrade",
              -Math.min(
                bee.workMax,
                bee.store.getUsedCapacity(RESOURCE_ENERGY)
              ),
              RESOURCE_ENERGY
            );
        } else bee.goRest(this.pos, hiveToUpg.opt);
      } else {
        let storage: StructureStorage | StructureContainer | undefined =
          hiveToUpg.cells.storage?.storage;
        if (!storage) {
          // fast ref pos for this flag
          storage = this.pos
            .findInRange(FIND_STRUCTURES, 2)
            .filter(
              (s) =>
                s.structureType === STRUCTURE_CONTAINER &&
                s.store.getUsedCapacity(RESOURCE_ENERGY)
            )[0] as StructureContainer;
        }
        if (!storage) {
          storage = _.compact(
            _.map(hiveToUpg.cells.excavation.resourceCells, (r) =>
              r.pos.roomName === hiveToUpg.roomName ? r.container : undefined
            )
          )[0];
        }
        if (storage)
          bee.withdraw(storage, RESOURCE_ENERGY, undefined, hiveToUpg.opt);
        else bee.goRest(this.pos);
      } // else this.removeBee(bee);
    });
  }

  public update() {
    super.update();
    this.secureBoostsHive();

    const controller = Game.rooms[this.pos.roomName].controller;
    if (
      !controller ||
      !controller.my ||
      (controller.level === 8 && !this.beesAmount)
    ) {
      this.order.delete();
      return;
    }
    if (
      this.checkBees() &&
      Apiary.intel.getInfo(this.pos.roomName).safePlace &&
      this.hive.resState[RESOURCE_ENERGY] > 0 &&
      controller.level < 8
    ) {
      const setup = setups.upgrader.fast.copy();
      setup.patternLimit = Infinity;
      setup.moveMax = 10; // boosted
      setup.fixed = [CARRY, CARRY, CARRY, CARRY];
      this.wish({
        setup,
        priority: 8,
      });
    }
  }

  // #endregion Public Methods (2)
}
