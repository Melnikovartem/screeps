import { roomStates } from "static/enums";

import type { Intel } from "./intel";
import {
  emptyRoomBattleIntel,
  type RoomInfoBattle,
  type RoomInfoBoosts,
  type RoomInfoEconomy,
  type RoomIntelDeep,
} from "./intel-deep";
import { roomStateNatural } from "./intel-utils";

enum INTEL_CACHE {
  lastUpdatedDeep = 1,
  state = 4,
  owner = 5,
  sign = 6,
  economy_sources = 10,
  economy_mineral = 11,
  battle_safemodeend = 51,
  battle_energy = 52,
  battle_level = 53,
  battle_mintowerdmg = 54,
  boosts_attack = 61,
  boosts_ranged = 62,
  boosts_heal = 63,
  boosts_damage = 64,
  boosts_build = 65,
}

export interface RoomIntelCacheMap {
  [INTEL_CACHE.lastUpdatedDeep]: RoomIntelDeep["lastUpdatedDeep"];
  [INTEL_CACHE.state]?: RoomIntelDeep["state"];
  [INTEL_CACHE.owner]?: RoomIntelDeep["owner"];
  [INTEL_CACHE.sign]?: RoomIntelDeep["sign"];
  [INTEL_CACHE.economy_sources]?: RoomInfoEconomy["sources"];
  [INTEL_CACHE.economy_mineral]?: RoomInfoEconomy["mineral"];
  [INTEL_CACHE.battle_safemodeend]?: RoomInfoBattle["safeModeEndTime"];
  [INTEL_CACHE.battle_energy]?: RoomInfoBattle["storedEnergy"];
  [INTEL_CACHE.battle_level]?: RoomInfoBattle["level"];
  [INTEL_CACHE.battle_mintowerdmg]?: RoomInfoBattle["minTowerDmg"];
  [INTEL_CACHE.boosts_attack]?: RoomInfoBoosts["attack"];
  [INTEL_CACHE.boosts_ranged]?: RoomInfoBoosts["rangedAttack"];
  [INTEL_CACHE.boosts_heal]?: RoomInfoBoosts["heal"];
  [INTEL_CACHE.boosts_damage]?: RoomInfoBoosts["damage"];
  [INTEL_CACHE.boosts_build]?: RoomInfoBoosts["build"];
}

export function intelFromCache(roomName: string): RoomIntelDeep {
  const cacheMap = Memory.cache.intel[roomName] as
    | RoomIntelCacheMap
    | undefined;

  if (!cacheMap)
    return {
      lastUpdatedDeep: -1,
    };

  const roomIntelDeep: RoomIntelDeep = {
    lastUpdatedDeep: cacheMap[INTEL_CACHE.lastUpdatedDeep],
  };

  // add base info
  roomIntelDeep.state = cacheMap[INTEL_CACHE.state];
  roomIntelDeep.owner = cacheMap[INTEL_CACHE.owner];
  roomIntelDeep.sign = cacheMap[INTEL_CACHE.sign];

  // Add economy info about any non corridor room (has permanent resources)
  if (
    cacheMap[INTEL_CACHE.economy_sources] ||
    cacheMap[INTEL_CACHE.economy_mineral]
  ) {
    roomIntelDeep.economy = {
      sources: cacheMap[INTEL_CACHE.economy_sources],
      mineral: cacheMap[INTEL_CACHE.economy_mineral],
    };
  }

  // Add battle info about any owned room
  if (cacheMap[INTEL_CACHE.battle_level]) {
    roomIntelDeep.battle = emptyRoomBattleIntel();
    roomIntelDeep.battle.safeModeEndTime =
      cacheMap[INTEL_CACHE.battle_safemodeend];
    // Add other battle stats from cacheMap
    roomIntelDeep.battle.level = cacheMap[INTEL_CACHE.battle_level];
    roomIntelDeep.battle.storedEnergy =
      cacheMap[INTEL_CACHE.battle_energy] || 0;
    roomIntelDeep.battle.minTowerDmg =
      cacheMap[INTEL_CACHE.battle_mintowerdmg] || 0;
    roomIntelDeep.battle.boosts = {
      attack: cacheMap[INTEL_CACHE.boosts_attack] || 0,
      rangedAttack: cacheMap[INTEL_CACHE.boosts_ranged] || 0,
      heal: cacheMap[INTEL_CACHE.boosts_heal] || 0,
      damage: cacheMap[INTEL_CACHE.boosts_damage] || 0,
      build: cacheMap[INTEL_CACHE.boosts_build] || 0,
    };
  }

  return roomIntelDeep;
}

export function intelToCacheShallowInfo(
  roomName: string,
  intel: RoomIntelDeep
) {
  let state: roomStates | undefined = intel.state || roomStateNatural(roomName);
  switch (state) {
    case roomStates.corridor:
      // do not save any cache for corridor
      return false;
    case roomStates.ownedByEnemy:
    case roomStates.reservedByMe:
    case roomStates.reservedByEnemy:
    case roomStates.ownedByMe:
      break;
    case roomStates.reservedByInvader:
      state = roomStates.noOwner;
      break;
    default:
      state = undefined;
      break;
  }
  if (!Memory.cache.intel[roomName])
    Memory.cache.intel[roomName] = {
      [INTEL_CACHE.lastUpdatedDeep]: intel.lastUpdatedDeep,
    };
  const cacheMap = Memory.cache.intel[roomName];
  cacheMap[INTEL_CACHE.state] = intel.state;
  cacheMap[INTEL_CACHE.owner] = intel.owner;
  cacheMap[INTEL_CACHE.sign] = intel.sign;
  return true;
}

export function intelToCacheDeepInfo(roomName: string, intel: RoomIntelDeep) {
  if (!intelToCacheShallowInfo(roomName, intel)) return;
  const cacheMap = Memory.cache.intel[roomName];
  cacheMap[INTEL_CACHE.lastUpdatedDeep] = intel.lastUpdatedDeep;

  if (intel.economy) {
    cacheMap[INTEL_CACHE.economy_sources] = intel.economy.sources;
    cacheMap[INTEL_CACHE.economy_mineral] = intel.economy.mineral;
  }

  if (intel.battle) {
    cacheMap[INTEL_CACHE.battle_safemodeend] = intel.battle.safeModeEndTime;
    cacheMap[INTEL_CACHE.battle_level] = intel.battle.level;
    cacheMap[INTEL_CACHE.battle_energy] = intel.battle.storedEnergy || 0; // Set default value if needed
    cacheMap[INTEL_CACHE.battle_mintowerdmg] = intel.battle.minTowerDmg || 0; // Set default value if needed
    cacheMap[INTEL_CACHE.boosts_attack] = intel.battle.boosts.attack || 0; // Set default value if needed
    cacheMap[INTEL_CACHE.boosts_ranged] = intel.battle.boosts.rangedAttack || 0; // Set default value if needed
    cacheMap[INTEL_CACHE.boosts_heal] = intel.battle.boosts.heal || 0; // Set default value if needed
    cacheMap[INTEL_CACHE.boosts_damage] = intel.battle.boosts.damage || 0; // Set default value if needed
    cacheMap[INTEL_CACHE.boosts_build] = intel.battle.boosts.build || 0; // Set default value if needed
  } else intelDeleteCacheDeepBattle(cacheMap);

  return cacheMap;
}

function intelDeleteCacheDeepBattle(cacheMap: RoomIntelCacheMap) {
  // Delete all battle related stats from cacheMap
  delete cacheMap[INTEL_CACHE.battle_safemodeend];
  delete cacheMap[INTEL_CACHE.battle_energy];
  delete cacheMap[INTEL_CACHE.battle_mintowerdmg];
  delete cacheMap[INTEL_CACHE.boosts_attack];
  delete cacheMap[INTEL_CACHE.boosts_ranged];
  delete cacheMap[INTEL_CACHE.boosts_heal];
  delete cacheMap[INTEL_CACHE.boosts_damage];
  delete cacheMap[INTEL_CACHE.boosts_build];
}

export function intelToCache(this: Intel) {
  if (Apiary.intTime % 1500 !== 70) return;

  for (const roomName in this.intelRoom) {
    const intel = this.intelRoom[roomName];
    intelToCacheShallowInfo(roomName, intel);
  }
}
