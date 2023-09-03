import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates, hiveStates } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";
import { HordeMaster } from "./horde";

const ticksToSpawn = (x: StructureKeeperLair) =>
  x.ticksToSpawn ? x.ticksToSpawn : 0;

@profile
export class SKMaster extends HordeMaster {
  // #region Properties (1)

  // failsafe
  private lairs: StructureKeeperLair[] = [];

  // #endregion Properties (1)

  // #region Public Accessors (2)

  public override get maxSpawns() {
    return Infinity;
  }

  public override get targetBeeCount() {
    return 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (3)

  public override init() {}

  public override run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;

      if (bee.pos.roomName !== this.pos.roomName && !bee.target) {
        let ans: number = OK;
        const enemy = Apiary.intel.getEnemy(bee.pos, 20);
        if (enemy && enemy.pos.getRangeTo(bee) <= 3)
          ans = this.beeAct(bee, enemy);
        if (ans === OK) bee.goTo(this.pos);
        return;
      }

      const target = (bee.target && Game.getObjectById(bee.target)) as
        | Creep
        | Structure
        | undefined;
      const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 20);
      if (roomInfo.dangerlvlmax >= 4) {
        const defSquad = Apiary.defenseSwarms[this.pos.roomName];
        const pos =
          defSquad &&
          defSquad.activeBees.filter(
            (b) => b.pos.roomName === this.pos.roomName
          )[0];
        const enemy = Apiary.intel.getEnemy((pos && pos.pos) || bee.pos);
        if (enemy) {
          // killer mode
          this.beeAct(bee, enemy);
          return;
        }
      }

      if (target instanceof Creep) {
        // update the enemies
        this.attackOrFleeSK(bee, target);
        return;
      }

      if (bee.hits < bee.hitsMax) bee.heal(bee);
      else if (bee.pos.roomName === this.pos.roomName) {
        const healingTarget = bee.pos.findClosest(
          bee.pos
            .findInRange(FIND_MY_CREEPS, 3)
            .filter((b) => b.hits < b.hitsMax)
        );
        if (healingTarget)
          if (bee.pos.isNearTo(healingTarget)) bee.heal(healingTarget);
          else bee.rangedHeal(healingTarget);
      }

      if (target instanceof StructureKeeperLair) {
        this.useLair(bee, target);
        return;
      } else bee.target = undefined;

      if (!this.lairs.length) return;

      const lair = this.lairs.reduce((prev, curr) => {
        let ans = ticksToSpawn(curr) - ticksToSpawn(prev);
        if (ans === 0)
          ans = curr.pos.getRangeTo(bee) - prev.pos.getRangeTo(bee);
        return ans < 0 ? curr : prev;
      });

      this.useLair(bee, lair);
    });
  }

  public override update() {
    SwarmMaster.prototype.update.call(this);

    if (this.pos.roomName in Game.rooms) {
      if (!this.lairs.length) {
        this.lairs = Game.rooms[this.pos.roomName].find(FIND_STRUCTURES, {
          filter: { structureType: STRUCTURE_KEEPER_LAIR },
        });
        /* if (!this.lairs.length)
          this.order.delete(); */
      }

      if (!this.info.maxPath && this.lairs.length) {
        let max = 0;
        _.forEach(this.lairs, (lair) => {
          const time = this.hive.pos.getTimeForPath(lair);
          if (max < time) max = time;
        });
        this.info.maxPath = max;
      }

      for (let i = 0; i < this.lairs.length; ++i)
        this.lairs[i] = Game.getObjectById(
          this.lairs[i].id
        ) as StructureKeeperLair;
    }

    if (this.hive.bassboost) return;

    if (
      !this.hive.annexInDanger.includes(this.pos.roomName) &&
      Apiary.intel.getInfo(this.pos.roomName, 100).dangerlvlmax < 8 &&
      this.checkBees(
        this.hive.state !== hiveStates.battle &&
          this.hive.state !== hiveStates.lowenergy,
        CREEP_LIFE_TIME - this.info.maxPath - 50
      )
    )
      this.wish({
        setup: setups.defender.sk,
        priority: 4,
      });
  }

  // #endregion Public Methods (3)

  // #region Private Methods (2)

  private attackOrFleeSK(bee: Bee, target: Creep) {
    // worse version of beeAct
    bee.target = target.id;
    if (bee.pos.getRangeTo(target) <= 4 || bee.hits < bee.hitsMax)
      bee.heal(bee);
    const shouldFlee =
      bee.pos.getRangeTo(target) < 3 ||
      (bee.pos.getRangeTo(target) <= 4 && bee.hits <= bee.hitsMax * 0.65);
    if (!shouldFlee || bee.pos.getRangeTo(target) <= 3)
      bee.rangedAttack(target, { movingTarget: true });
    if (shouldFlee)
      return bee.flee(new RoomPosition(25, 25, this.pos.roomName));
    return OK;
  }

  private useLair(bee: Bee, lair: StructureKeeperLair) {
    let enemy;
    if (ticksToSpawn(lair) < 1) {
      enemy = lair.pos.findClosest(
        lair.pos
          .findInRange(FIND_HOSTILE_CREEPS, 5)
          .filter((e) => e.owner.username === "Source Keeper")
      );
      if (enemy) {
        Apiary.intel.getInfo(bee.pos.roomName);
        this.attackOrFleeSK(bee, enemy);
        return;
      }
    }
    enemy = Apiary.intel.getEnemy(bee.pos, 10);
    let ans: number = OK;
    if (
      enemy instanceof Creep &&
      (enemy.pos.getRangeTo(lair) <= 5 || enemy.pos.getRangeTo(bee) <= 3)
    ) {
      ans = this.attackOrFleeSK(bee, enemy);
      Apiary.intel.getInfo(bee.pos.roomName);
    }
    if (ans === OK) bee.goTo(lair, { range: 2 });
    bee.target = lair.id;
  }

  // #endregion Private Methods (2)
}
