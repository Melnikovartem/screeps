// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

import { profile } from "../profiler/decorator";
import { enemyTypes, roomStates } from "../static/enums";
import { towerCoef } from "../static/utils";

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
type DangerLvl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const PEACE_PACTS: string[] = [
  "Hi_Melnikov",
  // "Digital",
  // "Lapitz",
  // "Bestia",
]; // "buger"
export const NON_AGRESSION_PACKS: string[] = ["TgDgNU", "6g3y", "YoRHa"];

export interface Enemy {
  object: Creep | PowerCreep | Structure;
  dangerlvl: DangerLvl;
  type: enemyTypes;
}

interface RoomInfo {
  enemies: Enemy[];
  dangerlvlmax: DangerLvl;
  towers: StructureTower[];

  lastUpdated: number;
  roomState: roomStates;
  currentOwner: string | undefined;
  safePlace: boolean;
  safeModeEndTime: number;
}

export interface CreepBattleInfo {
  dmgClose: number; // in natral hits
  dmgRange: number; // in natral hits
  dism: number; // in natral hits
  heal: number; // in natral hits
  hits: number; // in natral hits
  resist: number; // in natral hits
  move: number; // pertick on plain
}

export interface CreepAllBattleInfo {
  max: CreepBattleInfo;
  current: CreepBattleInfo;
}

@profile
export class Intel {
  private roomInfo: { [id: string]: RoomInfo } = {};
  private stats: { [id: string]: CreepAllBattleInfo } = {};

  public update() {
    this.stats = {};
    if (Game.time % 50 === 0) this.toCache();
  }

  public getEnemyStructure(pos: ProtoPos, lag?: number) {
    return this.getEnemy(pos, lag, (es, ri) =>
      es.filter(
        (e) =>
          (![7, 9].includes(ri.dangerlvlmax) ||
            e.dangerlvl === ri.dangerlvlmax) &&
          e.object instanceof Structure
      )
    ) as Structure | undefined;
  }

  public getEnemyCreep(pos: ProtoPos, lag?: number) {
    return this.getEnemy(pos, lag, (es) =>
      es.filter((e) => e.object instanceof Creep)
    ) as Creep | undefined;
  }

  public getEnemy(
    pos: ProtoPos,
    lag?: number,
    filter: (
      enemies: Enemy[],
      roomInfo: RoomInfo,
      pos: RoomPosition
    ) => Enemy[] = (es, ri, posInterest) =>
      es.filter(
        (e) =>
          e.dangerlvl === ri.dangerlvlmax ||
          (e.dangerlvl >= 4 && posInterest.getRangeTo(e.object) <= 5)
      )
  ) {
    if (!(pos instanceof RoomPosition)) pos = pos.pos;

    const roomInfo = this.getInfo(pos.roomName, lag);
    const enemies = filter(roomInfo.enemies, roomInfo, pos);
    if (!enemies.length) return;

    return enemies.reduce((prev, curr) => {
      let ans =
        (pos as RoomPosition).getRangeTo(curr.object) -
        (pos as RoomPosition).getRangeTo(prev.object);
      if (ans === 0) ans = prev.dangerlvl - curr.dangerlvl;
      return ans < 0 ? curr : prev;
    }).object;
  }

  public getTowerAttack(pos: RoomPosition, lag?: number) {
    const roomInfo = this.getInfo(pos.roomName, lag);
    let ans = 0;
    _.forEach(roomInfo.towers, (t) => {
      // 20 cause 1 shot (10) doesn't do shit
      if (
        (t.isActive() && t.store.getUsedCapacity(RESOURCE_ENERGY) >= 20) ||
        t.owner.username === "Invader"
      )
        ans += towerCoef(t, pos) * TOWER_POWER_ATTACK;
    });
    return ans;
  }

  public getComplexStats(
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

  public getComplexMyStats(pos: ProtoPos, range = 3, closePadding = 0) {
    return this.getComplexStats(pos, range, closePadding, FIND_MY_CREEPS);
  }

  public getInfo(roomName: string, lag: number = 0): RoomInfo {
    let roomInfo = this.roomInfo[roomName];
    if (!roomInfo) {
      const cache = Memory.cache.intellegence[roomName];
      if (cache)
        roomInfo = {
          enemies: [],
          dangerlvlmax: 0,
          towers: [],
          lastUpdated: -1,

          roomState: cache.roomState,
          currentOwner: cache.currentOwner,
          safePlace: cache.safePlace,
          safeModeEndTime: cache.safeModeEndTime,
        };
      else {
        roomInfo = {
          enemies: [],
          dangerlvlmax: 0,
          towers: [],
          lastUpdated: -1,

          roomState: roomStates.noOwner,
          currentOwner: undefined,
          safePlace: true,
          safeModeEndTime: -1,
        };

        const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
        if (parsed) {
          const [x, y] = [+parsed[2] % 10, +parsed[4] % 10];
          if (x === 0 || y === 0) roomInfo.roomState = roomStates.corridor;
          else if (4 <= x && x <= 6 && 4 <= y && y <= 6)
            if (x === 5 && y === 5) roomInfo.roomState = roomStates.SKcentral;
            else roomInfo.roomState = roomStates.SKfrontier;
        }
      }
      if (lag === Infinity) return roomInfo;
      this.roomInfo[roomName] = roomInfo;
    }

    // it is cached after first check
    if (!Apiary.useBucket && lag >= 5) lag *= 2;

    let returnLag = roomInfo.lastUpdated + lag >= Game.time;
    const visibleRoom = roomName in Game.rooms;
    if (!returnLag && !visibleRoom) {
      Apiary.requestSight(roomName);
      returnLag = true;
    }

    if (returnLag) {
      if (roomInfo.lastUpdated < Game.time) {
        roomInfo.enemies = _.compact(
          roomInfo.enemies.map((e) => {
            const copy = Game.getObjectById(e.object.id) as
              | Enemy["object"]
              | null
              | undefined;
            if (!copy || copy.pos.roomName !== roomName) return null;
            e.object = copy;
            return e;
          })
        ) as Enemy[];
        if (
          Game.time > roomInfo.lastUpdated + CREEP_LIFE_TIME &&
          !roomInfo.safePlace &&
          roomInfo.roomState < roomStates.ownedByEnemy
        ) {
          roomInfo.safePlace = true;
          roomInfo.dangerlvlmax = 0;
        }
        if (visibleRoom && roomInfo.enemies.length)
          this.updateDangerLvl(roomInfo);
      }
      return roomInfo;
    }

    const room = Game.rooms[roomName];

    roomInfo.currentOwner = undefined;
    if (room.controller) {
      roomInfo.roomState = roomStates.noOwner;
      if (room.controller.safeMode)
        this.roomInfo[room.name].safeModeEndTime =
          Game.time + room.controller.safeMode;
      let owner = room.controller.owner && room.controller.owner.username;
      if (owner) {
        if (owner === Apiary.username)
          roomInfo.roomState = roomStates.ownedByMe;
        else roomInfo.roomState = roomStates.ownedByEnemy;
      } else if (room.controller.reservation) {
        owner = room.controller.reservation.username;
        if (owner === Apiary.username)
          roomInfo.roomState = roomStates.reservedByMe;
        else if (owner === "Invader")
          roomInfo.roomState = roomStates.reservedByInvader;
        else roomInfo.roomState = roomStates.reservedByEnemy;
      }
      /** sign here
       * if (
        !owner &&
        (!room.controller.sign ||
          room.controller.sign.username !== Apiary.username)
      )
        Apiary.unsignedRoom(roomName); **/
      roomInfo.currentOwner = owner;
    }

    this.updateEnemiesInRoom(room);

    return this.roomInfo[roomName];
  }

  // will *soon* remove in favor for lib
  private toCache() {
    for (const roomName in this.roomInfo) {
      const roomInfo = this.roomInfo[roomName];
      if (
        roomInfo.roomState <= roomStates.reservedByMe ||
        roomInfo.roomState >= roomStates.reservedByEnemy
      )
        Memory.cache.intellegence[roomName] = {
          roomState: roomInfo.roomState,
          currentOwner: roomInfo.currentOwner,
          safePlace: roomInfo.safePlace,
          safeModeEndTime: roomInfo.safeModeEndTime,
        };
      else delete Memory.cache.intellegence[roomName];
    }
  }

  private updateEnemiesInRoom(room: Room) {
    const roomInfo = this.roomInfo[room.name];
    roomInfo.lastUpdated = Game.time;
    roomInfo.enemies = [];
    roomInfo.towers = [];

    _.forEach(room.find(FIND_HOSTILE_CREEPS), (c) => {
      let dangerlvl: DangerLvl = 3;
      const info = this.getStats(c).max;
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
            (roomInfo.roomState === roomStates.SKfrontier ||
              roomInfo.roomState === roomStates.SKcentral)
          )
            dangerlvl = 5;
          else if (dangerlvl > 4) dangerlvl = 4;
          break;
        default:
          // TODO better pacts system
          if (Apiary.logger) Apiary.logger.reportEnemy(c);
          if (PEACE_PACTS.includes(c.owner.username)) {
            if (roomInfo.roomState !== roomStates.ownedByMe) {
              dangerlvl = 0;
              return;
            }
          } else if (
            NON_AGRESSION_PACKS.includes(c.owner.username) &&
            !Apiary.hives[room.name]
          )
            dangerlvl = 2;
      }
      roomInfo.enemies.push({
        object: c,
        dangerlvl,
        type: enemyTypes.moving,
      });
    });

    let structures;
    switch (roomInfo.roomState) {
      case roomStates.ownedByEnemy:
        _.forEach(room.find(FIND_HOSTILE_POWER_CREEPS), (pc) => {
          roomInfo.enemies.push({
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
              roomInfo.roomState === roomStates.SKfrontier ||
              roomInfo.roomState === roomStates.SKcentral
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
            roomInfo.towers.push(s);
            break;
          case STRUCTURE_EXTENSION:
          case STRUCTURE_SPAWN:
            if (roomInfo.roomState >= roomStates.ownedByEnemy) dangerlvl = 2;
            break;
          case STRUCTURE_STORAGE:
          case STRUCTURE_TERMINAL:
            if (roomInfo.roomState >= roomStates.ownedByEnemy) dangerlvl = 1;
            break;
          case STRUCTURE_CONTAINER:
          case STRUCTURE_ROAD:
            if (
              roomInfo.roomState === roomStates.reservedByEnemy &&
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
            (roomInfo.roomState === roomStates.ownedByEnemy ||
              roomInfo.roomState === roomStates.SKfrontier) &&
            s.structureType !== STRUCTURE_ROAD
          )
            dangerlvl = 9;
          else if (dangerlvl < 3) dangerlvl = 3;

        if (
          dangerlvl > 0 ||
          (roomInfo.roomState === roomStates.ownedByEnemy && s.hits)
        )
          roomInfo.enemies.push({
            object: s,
            dangerlvl,
            type: enemyTypes.static,
          });
      });

    if (!roomInfo.enemies.length && structures && structures.length) {
      // start removing old ramparts / walls
      for (const s of structures)
        if (
          (s.structureType === STRUCTURE_RAMPART && !s.my) ||
          (s.structureType === STRUCTURE_WALL &&
            roomInfo.roomState === roomStates.ownedByEnemy)
        ) {
          roomInfo.enemies.push({
            object: s,
            dangerlvl: 0,
            type: enemyTypes.static,
          });
          break;
        }
    }
    this.updateDangerLvl(roomInfo);
  }

  private updateDangerLvl(roomInfo: RoomInfo) {
    if (roomInfo.enemies.length)
      roomInfo.dangerlvlmax = roomInfo.enemies.reduce((prev, curr) =>
        prev.dangerlvl < curr.dangerlvl ? curr : prev
      ).dangerlvl;
    else roomInfo.dangerlvlmax = 0;
    roomInfo.safePlace =
      roomInfo.dangerlvlmax < 4 ||
      (roomInfo.safeModeEndTime > Game.time &&
        roomInfo.roomState === roomStates.ownedByMe);
  }

  public getFleeDist(creep: Creep, padding = 0) {
    const info = this.getStats(creep).current;
    if (info.dmgRange > padding) return 4;
    else if (info.dmgClose > padding) return 2;
    else return 0;
  }

  public getStats(creep: Creep) {
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
}
