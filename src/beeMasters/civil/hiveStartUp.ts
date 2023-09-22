import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import type { Boosts, MovePriority } from "../_Master";
import { SwarmMaster } from "../_SwarmMaster";

@profile
export class HelpUpgradeMaster extends SwarmMaster<number> {
  // #region Properties (1)

  public override movePriority: MovePriority = 4;

  // #endregion Properties (1)

  private builder: Bee | undefined;
  private upgrader: Bee | undefined;
  private haulers: [Bee | undefined, Bee | undefined, Bee | undefined] = [
    undefined,
    undefined,
    undefined,
  ];

  // #region Public Accessors (3)

  public override get boosts(): Boosts {
    return [
      { type: "build", lvl: 2 },
      { type: "capacity", lvl: 2 },
      { type: "upgrade", lvl: 2 },
      { type: "fatigue", lvl: 2 },
    ];
  }

  public override get maxSpawns(): number {
    return 5;
  }

  public get targetBeeCount() {
    return 5;
  }

  // #endregion Public Accessors (3)

  // #region Public Methods (3)

  public override defaultInfo(): number {
    return 3;
  }

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
            Apiary.logger.reportResourceUsage(
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
        let storage = hiveToUpg.cells.storage.storage;
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
      }
    });
  }

  public override update() {
    super.update();
    if (!this.checkBees()) return;
    this.secureBoostsHive();
  }

  // #endregion Public Methods (3)
}
