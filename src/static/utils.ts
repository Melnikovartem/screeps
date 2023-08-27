import type { ResTarget } from "hive/hive";

import { DEVELOPING, LOGGING_CYCLE, SAFE_DEV } from "../settings";

export function makeId(length: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// wrap run or update functions
// not to get colony wide blackout cause i missed something in some master
export function safeWrap(cycle: () => void, context: string): void {
  if (SAFE_DEV) {
    try {
      cycle();
    } catch (e) {
      if (LOGGING_CYCLE) {
        if (!Memory.reportEvents.crashes) Memory.reportEvents.crashes = {};
        const regex = /"([^"]+)"/.exec(context);
        if (DEVELOPING) console.log((e as Error).stack);
        Memory.reportEvents.crashes[regex ? regex[1] : context] = {
          time: Game.time,
          context,
          message: (e as Error).message,
          stack: (e as Error).stack,
        };
      }
    }
  } else cycle();
}

export function findOptimalResource(
  store: Store<ResourceConstant, false>,
  mode: -1 | 1 = 1
): ResourceConstant {
  // 1 for max stored
  // -1 for min stored
  let ans: ResourceConstant = RESOURCE_ENERGY;
  let amount = 0;
  for (const resourceConstant in store) {
    const res = resourceConstant as ResourceConstant;
    if (!amount || (store.getUsedCapacity(res) - amount) * mode > 0) {
      ans = res;
      amount = store.getUsedCapacity(res);
    }
  }
  return ans;
}

export function towerCoef(
  tower: StructureTower,
  pos: ProtoPos,
  ignoreBuff = false
) {
  if (!(pos instanceof RoomPosition)) pos = pos.pos;
  let coef = 1;
  if (tower.effects && !ignoreBuff) {
    const powerup = tower.effects.filter(
      (e) => e.effect === PWR_OPERATE_TOWER
    )[0] as PowerEffect;
    if (powerup) coef += powerup.level * 0.1;
    const powerdown = tower.effects.filter(
      (e) => e.effect === PWR_DISRUPT_TOWER
    )[0] as PowerEffect;
    if (powerdown) coef -= powerdown.level * 0.1;
  }
  const range = pos.getRangeTo(tower.pos);
  if (range >= TOWER_FALLOFF_RANGE) return coef * (1 - TOWER_FALLOFF);
  else if (range <= TOWER_OPTIMAL_RANGE) return coef;
  return (
    ((coef * (TOWER_OPTIMAL_RANGE - range + TOWER_FALLOFF_RANGE)) /
      (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE)) *
    TOWER_FALLOFF
  );
}

export function getRoomCoorinates(
  roomName: string,
  plane = true
): [number, number, string, string] {
  const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  let x = 0;
  let y = 0;
  if (parsed) {
    x = +parsed[2] * (!plane && parsed[1] === "W" ? -1 : 1);
    y = +parsed[4] * (!plane && parsed[3] === "S" ? -1 : 1);
    return [x, y, parsed[1], parsed[3]];
  }
  return [0, 0, "E", "S"];
}

export function getEnterances(roomName: string): RoomPosition[] {
  const terrain = Game.map.getRoomTerrain(roomName);
  const enterances = [];
  for (const y in { 0: 1, 49: 1 }) {
    let start = -1;
    let end = -1;
    for (let x = 0; x <= 49; ++x)
      if (terrain.get(x, +y) !== TERRAIN_MASK_WALL) {
        if (start === -1) start = x;
        end = x;
      } else if (start !== -1) {
        const pos = new RoomPosition(
          start + Math.round((end - start) / 2),
          +y,
          roomName
        );
        enterances.push(pos);
        start = -1;
      }
  }
  for (const x in { 0: 1, 49: 1 }) {
    let start = -1;
    let end = -1;
    for (let y = 0; y <= 49; ++y)
      if (terrain.get(+x, y) !== TERRAIN_MASK_WALL) {
        if (start === -1) start = y;
        end = y;
      } else if (start !== -1) {
        const pos = new RoomPosition(
          +x,
          start + Math.round((end - start) / 2),
          roomName
        );
        enterances.push(pos);
        start = -1;
      }
  }
  return enterances;
}

export function addResDict(
  dict: ResTarget,
  res: string,
  amount: number | undefined
) {
  if (!dict[res as ResourceConstant]) dict[res as ResourceConstant] = 0;
  dict[res as ResourceConstant]! += amount || 0;
}

/** gets how many structures should build and up to what health heal them */
export function getCase(
  structure:
    | Structure
    | ConstructionSite
    | {
        structureType: StructureConstant;
        pos: { roomName: string };
        hitsMax: number;
      },
  wallsHealth = 10_000
) {
  let controller: StructureController | { level: number } | undefined =
    Game.rooms[structure.pos.roomName] &&
    Game.rooms[structure.pos.roomName].controller;
  if (!controller) controller = { level: 0 };
  let hitsMax =
    structure instanceof ConstructionSite
      ? structure.progressTotal
      : structure.hitsMax;
  const perType =
    CONTROLLER_STRUCTURES[
      structure.structureType as BuildableStructureConstant
    ];
  if (!perType) return { amount: 0, heal: 0 };
  let amount = perType[controller.level];
  switch (structure.structureType) {
    case STRUCTURE_RAMPART:
    case STRUCTURE_WALL:
      hitsMax = wallsHealth;
      if (controller.level < 4) amount = 0;
      break;
    case STRUCTURE_ROAD:
    case STRUCTURE_CONTAINER:
      if (controller.level > 0 && controller.level < 3) amount = 0;
      break;
    default:
  }

  return { amount: amount || 0, heal: hitsMax };
}