import { enemyTypes, roomStates } from "static/enums";

import type { Intel } from "./intel";
import { intelToCacheDeepInfo } from "./intel-cache";
import { deepUpdate, type RoomIntelDeep } from "./intel-deep";

const DEEP_LAG = 10000;

/** Trying to asses danger lvl of threat
 *
 * 0 peace pacts ?? in rooms not owned by me OR invulnerable InvaderCore OR any structure that i don't like (enemy walls/old stuff in my room)
 *
 * 1 storage/terminal in enemy room or containers/roads in enemy reserved rooms
 *
 * 2 source keeper (ignore defender of sources) OR non agression pacts in non hives (rooms not owned by me) OR spawn/extension  in enemy room
 *
 * 3 just hostile OR invaderCore in normal rooms OR invaderCore structures in normal rooms marked by Red_Grey flag
 *
 * 4 hostile that can bite (range >= 0 || melee >= 0) OR any powerlvl of Invader
 *
 * 5 healer can outheal tower (heal >= 300) OR dismantler OR Invader raid on source rooms
 *
 * 6 healer (heal >= 300) OR powerful combatant (range >= 250 || melee >= 750)
 *
 * 7 enemy powercreeps (so that we smash any attacking ones) OR enemy TOWER
 *
 * 8 boosted combatant (ranged >= 900 || melee >= 2700)
 *
 * 9 invaderCore in source roooms OR invaderCore structures in source roooms marked by Red_Grey flag
 */
export type DangerLvl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Enemy {
  // #region Properties (3)

  dangerlvl: DangerLvl;
  object: Creep | PowerCreep | Structure;
  type: enemyTypes;

  // #endregion Properties (3)
}

const PEACE_PACTS: string[] = [
  "Hi_Melnikov",
  // "Digital",
  // "Lapitz",
]; // "buger"
const NON_AGRESSION_PACKS: string[] = ["TgDgNU", "6g3y", "YoRHa", "Bestia"];

/** shallow info */
export interface RoomIntelRuntime extends RoomIntelDeep {
  // #region Properties (6)

  dangerlvlmax: DangerLvl;
  enemies: Enemy[];
  lastUpdatedShallow: number;
  /** if we lost vision at some point and removed unseen objects */
  lostVision: boolean;
  state: roomStates;
  towers: StructureTower[];

  // #endregion Properties (6)
  // easier if it is here
}

export function getIntel(
  this: Intel,
  roomName: string,
  lag: number = 0
): RoomIntelRuntime {
  const roomIntel = this.dudInfo(roomName);
  // freshest stuff
  if (roomIntel.lastUpdatedShallow >= Game.time) return roomIntel;

  // it is cached after first check
  if (!Apiary.useBucket && lag >= 5) lag *= 2;

  const room = Game.rooms[roomName];

  let returnLag = roomIntel.lastUpdatedShallow + lag >= Game.time;
  if (!returnLag && !room) {
    Apiary.oracle.requestSight(roomName);
    returnLag = true;
  }
  if (returnLag) {
    // we ok with not fresh

    // fresh up enemy objects
    roomIntel.enemies = _.compact(
      roomIntel.enemies.map((e) => {
        const copy = Game.getObjectById(e.object.id) as
          | Enemy["object"]
          | null
          | undefined;
        if (!copy || copy.pos.roomName !== roomName) return null;
        e.object = copy;
        return e;
      })
    ) as Enemy[];

    // we see the room so we removed all enemies that needed removal
    if (room && !roomIntel.lostVision) updateDangerLvl(roomIntel);
    // lost vision and until we get fresh stuff don't update dangerlvl
    else roomIntel.lostVision = true;

    // if haven't seen room in a long time we remove the danger
    // kinda bs with SK Invader strongholds but good when bunkering in a small room
    if (
      roomIntel.lostVision &&
      Game.time > roomIntel.lastUpdatedShallow + CREEP_LIFE_TIME * 1.5 &&
      roomIntel.dangerlvlmax > 4 &&
      roomIntel.state !== roomStates.ownedByEnemy
    )
      roomIntel.dangerlvlmax = 0;

    return roomIntel;
  }

  // need to fresh up inttel
  if (roomIntel.lastUpdatedDeep < Game.time + DEEP_LAG) {
    deepUpdate(roomIntel, room);
    intelToCacheDeepInfo(room.name, roomIntel);
  }

  updateEnemiesInRoom(roomIntel, room, this);

  return roomIntel;
}

function updateDangerLvl(roomInfo: RoomIntelRuntime) {
  if (!roomInfo.enemies.length) {
    roomInfo.dangerlvlmax = 0;
    return;
  }
  roomInfo.dangerlvlmax = roomInfo.enemies.reduce((prev, curr) =>
    prev.dangerlvl < curr.dangerlvl ? curr : prev
  ).dangerlvl;
}

function updateEnemiesInRoom(
  intel: RoomIntelRuntime,
  room: Room,
  globalIntel: Intel
) {
  intel.lastUpdatedShallow = Game.time;
  intel.enemies = [];
  intel.towers = [];

  _.forEach(room.find(FIND_HOSTILE_CREEPS), (c) => {
    let dangerlvl: DangerLvl = 3;
    const info = globalIntel.getStats(c).max; // same as Apiary.intel, just within this module pass it down
    if (
      info.dmgRange >= RANGED_ATTACK_POWER * (MAX_CREEP_SIZE - 20) * 3 ||
      info.dmgClose >= ATTACK_POWER * (MAX_CREEP_SIZE - 20) * 3
    )
      dangerlvl = 8;
    else if (
      info.dmgRange > (RANGED_ATTACK_POWER * MAX_CREEP_SIZE) / 2 ||
      info.dmgClose > (ATTACK_POWER * MAX_CREEP_SIZE) / 2 ||
      info.heal > (HEAL_POWER * MAX_CREEP_SIZE) / 2
    )
      dangerlvl = 6;
    else if (
      info.heal >= TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF) * 2 ||
      info.dism >= DISMANTLE_POWER * (MAX_CREEP_SIZE - 20)
    )
      dangerlvl = 5;
    else if (info.dmgRange > 0 || info.dmgClose > 0) dangerlvl = 4;
    switch (c.owner.username) {
      case "Source Keeper":
        dangerlvl = 2;
        break;
      case "Invader":
        if (
          info.heal > 100 &&
          (intel.state === roomStates.SKfrontier ||
            intel.state === roomStates.SKcentral)
        )
          dangerlvl = 5;
        else if (dangerlvl > 4) dangerlvl = 4;
        break;
      default:
        // TODO better pacts system
        Apiary.logger.reportEnemy(c);
        if (PEACE_PACTS.includes(c.owner.username)) {
          if (intel.state !== roomStates.ownedByMe) {
            dangerlvl = 0;
            return;
          }
        } else if (
          NON_AGRESSION_PACKS.includes(c.owner.username) &&
          !Apiary.hives[room.name]
        )
          dangerlvl = 2;
    }
    intel.enemies.push({
      object: c,
      dangerlvl,
      type: enemyTypes.moving,
    });
  });

  let structures;
  switch (intel.state) {
    case roomStates.ownedByEnemy:
      _.forEach(room.find(FIND_HOSTILE_POWER_CREEPS), (pc) => {
        intel.enemies.push({
          object: pc,
          dangerlvl: 7,
          type: enemyTypes.moving,
        });
      });
    // fall through
    case roomStates.reservedByMe:
    case roomStates.reservedByEnemy:
      // removing old walls and cores (if only cores then set to 5 around controller)
      structures = room.find(FIND_STRUCTURES);
      break;
    case roomStates.SKfrontier:
    case roomStates.noOwner:
    case roomStates.reservedByInvader:
      structures = room.find(FIND_HOSTILE_STRUCTURES);
      break;
  }

  if (structures)
    _.forEach(structures, (s) => {
      let dangerlvl: DangerLvl = 0;
      switch (s.structureType) {
        case STRUCTURE_INVADER_CORE:
          if (
            intel.state === roomStates.SKfrontier ||
            intel.state === roomStates.SKcentral
          ) {
            if (
              s.effects &&
              s.effects.filter((e) => e.effect === EFFECT_INVULNERABILITY)[0]
            )
              dangerlvl = 0;
            else dangerlvl = 9;
          } else dangerlvl = 3;
          break;
        case STRUCTURE_TOWER:
          dangerlvl = 7;
          intel.towers.push(s);
          break;
        case STRUCTURE_EXTENSION:
        case STRUCTURE_SPAWN:
          if (intel.state >= roomStates.ownedByEnemy) dangerlvl = 2;
          break;
        case STRUCTURE_STORAGE:
        case STRUCTURE_TERMINAL:
          if (intel.state >= roomStates.ownedByEnemy) dangerlvl = 1;
          break;
        case STRUCTURE_CONTAINER:
        case STRUCTURE_ROAD:
          if (
            intel.state === roomStates.reservedByEnemy &&
            room.controller &&
            room.controller.reservation &&
            room.controller.reservation.username !== Apiary.username &&
            room.controller.reservation.ticksToEnd >=
              CONTROLLER_RESERVE_MAX * 0.4
          )
            dangerlvl = 1;
          break;
      }

      if (
        s.pos
          .lookFor(LOOK_FLAGS)
          .filter(
            (f) => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED
          ).length
      )
        if (
          dangerlvl < 7 &&
          (intel.state === roomStates.ownedByEnemy ||
            intel.state === roomStates.SKfrontier) &&
          s.structureType !== STRUCTURE_ROAD
        )
          dangerlvl = 9;
        else if (dangerlvl < 3) dangerlvl = 3;

      if (dangerlvl > 0 || (intel.state === roomStates.ownedByEnemy && s.hits))
        intel.enemies.push({
          object: s,
          dangerlvl,
          type: enemyTypes.static,
        });
    });

  if (!intel.enemies.length && structures && structures.length) {
    // start removing old ramparts / walls
    for (const s of structures)
      if (
        (s.structureType === STRUCTURE_RAMPART && !s.my) ||
        (s.structureType === STRUCTURE_WALL &&
          intel.state === roomStates.ownedByEnemy)
      ) {
        intel.enemies.push({
          object: s,
          dangerlvl: 0,
          type: enemyTypes.static,
        });
        break;
      }
  }

  updateDangerLvl(intel);
}
