import type { Intel } from "./intel";

export interface CreepBattleInfo {
  // #region Properties (7)

  // in natral hits
  dism: number;
  dmgClose: number;
  // in natral hits
  dmgRange: number;
  // in natral hits
  heal: number;
  // in natral hits
  hits: number;
  // in natral hits
  move: number;
  // in natral hits
  resist: number;

  // #endregion Properties (7)
  // pertick on plain
}

export interface CreepAllBattleInfo {
  // #region Properties (2)

  current: CreepBattleInfo;
  max: CreepBattleInfo;

  // #endregion Properties (2)
}

export function getComplexStats(
  this: Intel,
  pos: ProtoPos,
  range = 1,
  closePadding = 0,
  mode: FIND_HOSTILE_CREEPS | FIND_MY_CREEPS = FIND_HOSTILE_CREEPS
) {
  // i could filter enemies for creeps, but i belive that it would mean more iterations in case of seidge (but i guess in rest of cases it would mean better results...)
  if (!(pos instanceof RoomPosition)) pos = pos.pos;

  const ref = mode + "_" + range + "_" + closePadding + "_" + pos.to_str;
  if (this.stats[ref]) return this.stats[ref];

  const ans: CreepAllBattleInfo = {
    max: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    },
    current: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    },
  };

  _.forEach(pos.findInRange(mode, range), (creep) => {
    const stats = this.getStats(creep);
    for (const i in stats.max) {
      const key = i as keyof CreepBattleInfo;
      const max = stats.max[key];
      let current = stats.current[key];
      switch (key) {
        case "dmgClose":
        case "dism":
          if ((pos as RoomPosition).getRangeTo(creep) > 1 + closePadding)
            continue;
          break;
        case "resist":
        case "hits":
          if ((pos as RoomPosition).getRangeTo(creep) > 0) continue;
          break;
        case "heal":
          if ((pos as RoomPosition).getRangeTo(creep) > 1 + closePadding)
            current = (current * RANGED_HEAL_POWER) / HEAL_POWER;
      }
      ans.max[key] += max;
      ans.current[key] += current;
    }
  });
  this.stats[ref] = ans;
  return ans;
}

export function getStats(this: Intel, creep: Creep) {
  if (creep.id in this.stats) return this.stats[creep.id];
  const ans: CreepAllBattleInfo = {
    max: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    },
    current: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    },
  };

  if (!creep) return ans;

  ans.current.hits = creep.hits;
  ans.max.hits = creep.hitsMax;
  _.forEach(creep.body, (b) => {
    let stat: number;
    switch (b.type) {
      case RANGED_ATTACK:
        stat =
          RANGED_ATTACK_POWER *
          (b.boost ? BOOSTS.ranged_attack[b.boost].rangedAttack : 1);
        ans.max.dmgRange += stat;
        if (b.hits) ans.current.dmgRange += stat;
        break;
      case ATTACK:
        stat = ATTACK_POWER * (b.boost ? BOOSTS.attack[b.boost].attack : 1);
        ans.max.dmgClose += stat;
        if (b.hits) ans.current.dmgClose += stat;
        break;
      case HEAL:
        stat = HEAL_POWER * (b.boost ? BOOSTS.heal[b.boost].heal : 1);
        ans.max.heal += stat;
        if (b.hits) ans.current.heal += stat;
        break;
      case WORK: {
        const boost = b.boost && BOOSTS.work[b.boost];
        stat =
          DISMANTLE_POWER *
          (boost && "dismantle" in boost ? boost.dismantle : 1);
        ans.max.dism += stat;
        if (b.hits) ans.current.dism += stat;
        break;
      }
      case TOUGH:
        stat = 100 / (b.boost ? BOOSTS.tough[b.boost].damage : 1) - 100;
        ans.max.resist += stat;
        if (b.hits) ans.current.resist += stat;
        break;
      case MOVE:
    }
  });
  let rounding = (x: number) => Math.ceil(x);
  if (creep.my) rounding = (x: number) => Math.floor(x);

  ans.current.resist = rounding(ans.current.resist);
  ans.max.resist = rounding(ans.max.resist);

  ans.current.hits += ans.current.resist;
  ans.max.hits += ans.max.resist;

  this.stats[creep.id] = ans;
  return ans;
}
