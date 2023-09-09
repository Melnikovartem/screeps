import { BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import { roomStates } from "static/enums";

export interface UserIntelCache {
  rooms: [];
  // can be imported by hand
  roomsAmount: number;
  glc?: number;
  gpl?: number;
}

/** deep info only for non corridor */
export interface RoomIntelDeep {
  lastUpdatedDeep: number;

  state?: roomStates; // if none then natural
  owner?: string; // if none === no owner / Invader
  sign?: string; // sign of the user
  battle?: RoomInfoBattle; // only for enemy rooms
  /** stable part of room */
  economy?: RoomInfoEconomy;
}

export interface RoomInfoEconomy {
  sources?: number;
  mineral?: MineralConstant;
}

export interface RoomInfoBattle {
  safeModeEndTime?: number;
  level: number;
  // terminal is assumed
  storedEnergy: number;
  minTowerDmg: number;
  boosts: RoomInfoBoosts;
}

export interface RoomInfoBoosts {
  attack?: number;
  rangedAttack?: number;
  heal?: number;
  damage?: number;
  build?: number;
}

export function roomStateNatural(roomName: string) {
  const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  if (!parsed) return roomStates.corridor; // failsafe
  const [x, y] = [+parsed[2] % 10, +parsed[4] % 10];
  if (x === 0 || y === 0) return roomStates.corridor;
  if (x === 5 && y === 5) return roomStates.SKcentral;
  // 4 <= x or y <= 6
  if (Math.abs(x - 5) <= 1 && Math.abs(y - 5) <= 1)
    return roomStates.SKfrontier;
  return roomStates.noOwner;
}

export function emptyRoomBattleIntel(): RoomInfoBattle {
  return {
    safeModeEndTime: undefined,
    minTowerDmg: 0,
    storedEnergy: 0,
    level: 1,
    boosts: {},
  };
}

export function stateShallow(
  intel: RoomIntelDeep,
  controller: StructureController
) {
  let state = roomStateNatural(controller.pos.roomName);
  let safeModeEndTime = 0;
  if (controller.safeMode) safeModeEndTime = Game.time + controller.safeMode;
  let owner = controller.owner && controller.owner.username;
  if (owner) {
    // update owner info
    if (owner === Apiary.username) state = roomStates.ownedByMe;
    else state = roomStates.ownedByEnemy;

    // info about rooms that have an owner
    if (!intel.battle) intel.battle = emptyRoomBattleIntel();
    intel.battle.safeModeEndTime = safeModeEndTime;
    intel.battle.level = controller.level;
  } else if (controller.reservation) {
    // update reserver info
    owner = controller.reservation.username;
    if (owner === Apiary.username) state = roomStates.reservedByMe;
    else if (owner === "Invader") state = roomStates.reservedByInvader;
    else state = roomStates.reservedByEnemy;
  }
  // who currently controls the room
  intel.state = state;
  intel.owner = owner;
  intel.sign = controller.sign?.username;
  // we only care about not OUR signs
  // how they dare!!!
  if (intel.sign === Apiary.username) intel.sign = undefined;
}

export function deepUpdate(
  intel: RoomIntelDeep,
  room: Room
): RoomIntelDeep | undefined {
  intel.state = roomStateNatural(room.name);
  if (intel.state === roomStates.corridor) return undefined;

  intel.lastUpdatedDeep = Game.time;

  /** maybe also check density? kinda useless stat ad changes a lot */
  if (!intel.economy)
    intel.economy = {
      sources: room.find(FIND_SOURCES).length || undefined,
      mineral:
        _.map(room.find(FIND_MINERALS), (m) => m.mineralType)[0] || undefined,
    };

  if (room.controller) {
    stateShallow(intel, room.controller);

    if (room.storage && intel.battle)
      addStatsFromStore(intel.battle, room.storage.store);

    if (room.terminal && intel.battle)
      addStatsFromStore(intel.battle, room.terminal.store);
  }

  return intel;
}

function addStatsFromStore(
  battle: RoomInfoBattle,
  store: Store<ResourceConstant, false>
) {
  battle.storedEnergy += store[RESOURCE_ENERGY];
  const addBoost = (type: keyof RoomInfoBoosts) => {
    const amount = store[BOOST_MINERAL[type][2]];

    // if we want to count other boosts do it here

    if (amount <= 0) return;
    if (!battle.boosts[type]) battle.boosts[type] = 0;
    battle.boosts[type]! += amount;
  };
  addBoost("attack");
  addBoost("rangedAttack");
  addBoost("heal");
  addBoost("damage");
  addBoost("build");
}
