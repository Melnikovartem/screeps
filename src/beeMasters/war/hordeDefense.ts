import { setups } from "bees/creepSetups";
import { BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { hiveStates, roomStates } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";
import { HordeMaster } from "./horde";
// most basic of bitches a horde full of wasps

@profile
export class HordeDefenseMaster extends HordeMaster {
  // #region Public Accessors (1)

  public override get maxSpawns() {
    return this.targetBeeCount;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (3)

  public override delete() {
    super.delete();
    if (Apiary.defenseSwarms[this.pos.roomName] === this)
      delete Apiary.defenseSwarms[this.pos.roomName];
  }

  public override init() {
    const defSwarm = Apiary.defenseSwarms[this.pos.roomName];
    if (defSwarm && defSwarm.ref !== this.ref) this.parent.delete();
    else Apiary.defenseSwarms[this.pos.roomName] = this;
  }

  public override update() {
    SwarmMaster.prototype.update.call(this);

    const roomInfo = Apiary.intel.getInfo(this.pos.roomName, 20);
    const shouldSpawn =
      Game.time >= roomInfo.safeModeEndTime - 250 && roomInfo.dangerlvlmax > 2;

    this.secureBoostsHive();

    const isSKraid =
      (roomInfo.roomState === roomStates.SKfrontier ||
        roomInfo.roomState === roomStates.SKcentral) &&
      roomInfo.dangerlvlmax === 5;
    if (isSKraid)
      this.boosts = [
        { type: "rangedAttack", lvl: 2 },
        { type: "damage", lvl: 2 },
      ];

    if (
      !shouldSpawn &&
      !this.beesAmount &&
      Apiary.intel.somewhatFreshInfo(this.roomName)
    ) {
      this.parent.delete();
      return;
    }

    if (
      !this.checkBees(
        this.hive.state !== hiveStates.battle ||
          this.pos.roomName === this.hiveName,
        CREEP_LIFE_TIME / 2
      )
    )
      return;
    if (!(this.pos.roomName in Game.rooms)) {
      if (this.hive.cells.observe)
        Apiary.oracle.requestSight(this.pos.roomName);
      return;
    }
    const order = {
      setup: setups.defender.normal.copy(),
      priority: 1 as 1 | 4 | 7 | 8,
    };
    const enemy = Apiary.intel.getEnemy(this.pos, 20);
    if (isSKraid) {
      order.setup.scheme = 1;
      if (
        this.hive.cells.lab &&
        this.hive.getUsedCapacity(BOOST_MINERAL.damage[2]) >=
          LAB_BOOST_MINERAL * 2 &&
        this.hive.getUsedCapacity(BOOST_MINERAL.rangedAttack[2]) >=
          LAB_BOOST_MINERAL * 10
      ) {
        order.setup.patternLimit = 10;
        order.setup.fixed = [TOUGH, TOUGH, HEAL, HEAL, HEAL];
      } else {
        order.setup.patternLimit = Infinity;
        order.setup.fixed = Array(10).fill(HEAL) as BodyPartConstant[];
      }
    } else if (enemy instanceof Creep) {
      this.targetBeeCount = 1;
      order.setup.fixed = [];
      if (!enemy.ticksToLive || enemy.ticksToLive < 200) return;
      const enemyInfo = Apiary.intel.getComplexStats(enemy, 4, 2).max;
      let healNeeded = Math.ceil(enemyInfo.dmgRange / HEAL_POWER);
      let rangedNeeded = Math.ceil(
        (enemyInfo.heal / RANGED_ATTACK_POWER + 0.25) /
          (enemyInfo.resist ? 0.3 : 1)
      ); // we dont wanna play the 0 sum game
      let desiredTTK = 20; // desired time to kill
      const noFear =
        enemy.owner.username === "Invader" || roomInfo.dangerlvlmax < 4;
      if (enemy.owner.username === "Invader") desiredTTK = 10;

      let killFastRangeNeeded = Math.ceil(
        enemyInfo.hits / (RANGED_ATTACK_POWER * desiredTTK)
      );

      if (this.hive.cells.lab && roomInfo.dangerlvlmax >= 6) {
        this.boosts = [];
        if (healNeeded > 5) {
          healNeeded = Math.ceil((enemyInfo.dmgRange * 0.3) / HEAL_POWER / 4);
          order.setup.fixed = Array(
            Math.ceil((enemyInfo.dmgRange * 0.3) / 100)
          ).fill(TOUGH) as BodyPartConstant[];
          this.boosts.push(
            { type: "heal", lvl: 2 },
            { type: "damage", lvl: 2 }
          );
        }
        order.setup.fixed = order.setup.fixed.concat(
          Array(healNeeded).fill(HEAL)
        );
        let leftSpace = 25 - order.setup.fixed.length;
        if (leftSpace < 10) return; // more then 15 on healing and tought is too much i guess
        if (rangedNeeded / leftSpace > 2) {
          leftSpace = 40 - order.setup.fixed.length;
          this.boosts.unshift({ type: "fatigue", lvl: 2 });
        }
        if (rangedNeeded > leftSpace) {
          this.boosts.push({ type: "rangedAttack", lvl: 2 });
          killFastRangeNeeded = 0;
          rangedNeeded = Math.ceil(rangedNeeded / 4);
          this.targetBeeCount = Math.ceil(rangedNeeded / leftSpace);
          rangedNeeded = Math.ceil(rangedNeeded / this.targetBeeCount + 1);
        }
        if (this.targetBeeCount > 2) {
          this.boosts.pop();
          this.boosts.push({ type: "attack", lvl: 2 });
          rangedNeeded = Math.ceil(
            (enemyInfo.heal / ATTACK_POWER + 0.25) /
              (enemyInfo.resist ? 0.3 : 1) /
              4
          );
          this.targetBeeCount = Math.ceil(rangedNeeded / leftSpace);
          rangedNeeded = Math.ceil(rangedNeeded / this.targetBeeCount + 4);
          const toughtAmount = Math.ceil((enemyInfo.dmgRange * 0.3) / 100);
          order.setup.fixed = order.setup.fixed.concat(
            Array(
              Math.min(Math.max(leftSpace - rangedNeeded, 0), toughtAmount * 4)
            ).fill(TOUGH)
          );
          order.setup.pattern = [ATTACK];
          this.targetBeeCount = Math.min(this.targetBeeCount, 2);
        }
      } else if (healNeeded) {
        healNeeded = Math.max(healNeeded);
        const healCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
        const rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
        if (
          this.hive.room.energyCapacityAvailable >=
          healCost * healNeeded + rangedCost * 2
        )
          order.setup.fixed = order.setup.fixed.concat(
            Array(healNeeded).fill(HEAL)
          );
      }

      order.setup.patternLimit = Math.min(
        Math.max(killFastRangeNeeded, rangedNeeded),
        this.boosts.length ? Infinity : roomInfo.dangerlvlmax >= 4 ? 20 : 10
      ); // Math.max(rangedNeeded * 3, 6) -> 25

      if (!noFear) {
        let moveMax = 25;
        const beesToGo = Math.max(this.targetBeeCount - this.beesAmount, 1);
        const checkBoost = (
          type: "fatigue" | "rangedAttack" | "heal" | "damage" | "attack",
          partAmount: number
        ) =>
          this.boosts.filter((b) => b.type === type).length &&
          this.hive.cells.lab &&
          this.hive.getUsedCapacity(BOOST_MINERAL[type][2]) >=
            LAB_BOOST_MINERAL * partAmount * beesToGo;

        if (this.boosts.length && checkBoost("fatigue", 10)) moveMax = 10;
        const body = order.setup.getBody(
          (this.hive.bassboost &&
            this.hive.bassboost.room.energyCapacityAvailable) ||
            this.hive.room.energyCapacityAvailable,
          moveMax
        ).body;
        let rangedAttack =
          body.filter((b) => b === RANGED_ATTACK).length * RANGED_ATTACK_POWER;
        let closeAttack =
          body.filter((b) => b === ATTACK).length * ATTACK_POWER;
        let heal = body.filter((b) => b === HEAL).length * HEAL_POWER;

        if (checkBoost("rangedAttack", rangedAttack / RANGED_ATTACK_POWER))
          rangedAttack *= 4;
        if (checkBoost("attack", closeAttack / ATTACK_POWER)) closeAttack *= 4;
        if (checkBoost("heal", heal / HEAL_POWER)) heal *= 4;

        let tough = body.filter((b) => b === TOUGH).length * 100;
        if (
          checkBoost("damage", tough / 100) &&
          tough >= enemyInfo.dmgRange * 0.3
        )
          tough = (tough * 0.7) / 0.3;
        else tough = 0;

        rangedAttack *= this.targetBeeCount;
        closeAttack *= this.targetBeeCount;
        const loosingBattle = this.loosingBattle(enemyInfo, undefined, {
          dmgRange: rangedAttack,
          dmgClose: closeAttack,
          heal,
          resist: tough,
          move: 0,
          dism: 0,
          hits: 5000,
        });
        if (loosingBattle < 1) return;
        for (let i = 1; i < beesToGo; ++i) this.wish(order);
      }
    } else if (enemy instanceof Structure) {
      order.priority = 7;
      order.setup = setups.defender.destroyer.copy();
      order.setup.patternLimit = 10;
    } else return;
    if (
      this.hive.cells.defense.reposessFlag(this.pos, enemy) !== ERR_NOT_FOUND
    ) {
      this.parent.delete();
      return;
    }
    if (this.pos.roomName !== this.hiveName && !this.boosts.length)
      order.priority = Math.max(4, order.priority) as 4 | 7;
    this.wish(order);
  }

  // #endregion Public Methods (3)
}
