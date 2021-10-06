import { Cell } from "../_Cell";

import { makeId } from "../../abstract/utils";
import { prefix, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive, BuildProject } from "../../Hive";
import type { Order } from "../../order";

const TOWER_POWER_ATTACK_MY = TOWER_POWER_ATTACK / 16;

@profile
export class DefenseCell extends Cell {
  towers: { [id: string]: StructureTower } = {};
  nukes: RoomPosition[] = [];
  nukesDefenseMap = {};
  timeToLand: number = Infinity;
  nukeCoverReady: boolean = true;
  master: undefined;
  coefMap: number[][] = [];

  constructor(hive: Hive) {
    super(hive, prefix.defenseCell + hive.room.name);
    this.updateNukes();
    this.pos = this.hive.getPos("center");
  }

  bakeMap() {
    if (!Object.keys(this.towers).length)
      return;

    this.coefMap = [];
    for (let x = 0; x <= 49; ++x) {
      this.coefMap[x] = [];
      for (let y = 0; y <= 49; ++y)
        this.coefMap[x][y] = 0;
    }

    _.forEach(this.towers, t => {
      for (let x = 0; x <= 49; ++x)
        for (let y = 0; y <= 49; ++y) {
          let range = t.pos.getRangeTo(new RoomPosition(x, y, t.pos.roomName));
          if (range > TOWER_FALLOFF_RANGE)
            this.coefMap[x][y] += 4;
          else if (range <= TOWER_OPTIMAL_RANGE)
            this.coefMap[x][y] += 16;
          else
            this.coefMap[x][y] += TOWER_FALLOFF_RANGE - (range - TOWER_OPTIMAL_RANGE)
        }
    });
  }

  updateNukes() {
    this.nukes = [];
    _.forEach(this.hive.room.find(FIND_NUKES), n => {
      this.nukes.push(n.pos);
      if (this.timeToLand > n.timeToLand)
        this.timeToLand = n.timeToLand;
    });
    if (!this.nukes.length)
      this.timeToLand = Infinity;
    this.getNukeDefMap();
  }

  // mini roomPlanner
  getNukeDefMap() {
    this.nukeCoverReady = true;
    if (!this.nukes.length)
      return [];
    let map: { [id: number]: { [id: number]: number } } = {};
    _.forEach(this.nukes, pp => {
      let poss = pp.getPositionsInRange(2);
      _.forEach(poss, p => {
        if (!map[p.x])
          map[p.x] = {};
        if (!map[p.x][p.y])
          map[p.x][p.y] = 10000;
        map[p.x][p.y] += 5000000;
      });
      map[pp.x][pp.y] += 10000000;
    });

    let ans: BuildProject[] = [];
    // todo?? save some of the extensions / not all spawns
    for (let x in map)
      for (let y in map[x]) {
        let pos = new RoomPosition(+x, +y, this.hive.roomName);
        let structures = pos.lookFor(LOOK_STRUCTURES)
        if (structures.filter(s => CONSTRUCTION_COST[<BuildableStructureConstant>s.structureType] >= 15000).length) {
          let rampart = structures.filter(s => s.structureType === STRUCTURE_RAMPART)[0];
          let energy;
          if (rampart)
            energy = Math.max(map[x][y] - rampart.hits, 0) / 100;
          else {
            energy = map[x][y] / 100;
            if (!pos.lookFor(LOOK_CONSTRUCTION_SITES).length)
              pos.createConstructionSite(STRUCTURE_RAMPART);
          }
          ans.push({
            pos: pos,
            sType: STRUCTURE_RAMPART,
            targetHits: map[x][y],
            energyCost: Math.ceil(energy),
          });
          if (energy > 0)
            this.nukeCoverReady = false;
        }
      }
    return ans;
  }

  update() {
    super.update(["towers"]);

    if (Game.time % 500 === 333 || this.timeToLand-- < 0 || (this.nukes.length && Game.time % 10 === 6 && this.nukeCoverReady))
      this.updateNukes();

    // cant't survive a nuke if your controller lvl is below 5
    this.hive.stateChange("nukealert", !!this.nukes.length && !this.nukeCoverReady && this.hive.room.controller!.level > 4);

    _.forEach(this.hive.annexNames, h => this.checkOrDefendSwarms(h));

    let storageCell = this.hive.cells.storage;
    if (!storageCell)
      return;
    if (this.hive.state === hiveStates.battle)
      storageCell.requestFromStorage(_.filter(this.towers, t => t.store.getFreeCapacity(RESOURCE_ENERGY) > TOWER_CAPACITY * 0.1), 1);
    else
      storageCell.requestFromStorage(Object.values(this.towers), 4, RESOURCE_ENERGY, TOWER_CAPACITY, true);
  }

  checkOrDefendSwarms(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 25);
      if (roomInfo.dangerlvlmax > 1) {
        let enemy = roomInfo.enemies[0].object;
        if (this.notDef(roomName)) {
          let pos = enemy.pos.getOpenPositions(true).filter(p => !p.getEnteranceToRoom())[0];
          if (!pos)
            pos = enemy.pos;
          let freeSwarms: Order[] = [];
          for (const roomDefName in Apiary.defenseSwarms) {
            let roomInfDef = Apiary.intel.getInfo(roomDefName, 10);
            if (roomInfDef.safePlace && Apiary.defenseSwarms[roomDefName].master
              && _.filter(Apiary.defenseSwarms[roomDefName].master!.bees, bee => bee.hits >= bee.hitsMax * 0.5).length > 0)
              freeSwarms.push(Apiary.defenseSwarms[roomDefName]);
          }
          let ans: number | string | undefined;
          if (freeSwarms.length) {
            let swarm = freeSwarms.reduce((prev, curr) =>
              prev.pos.getRoomRangeTo(Game.rooms[roomName]) > curr.pos.getRoomRangeTo(Game.rooms[roomName]) ? curr : prev);
            if (swarm.pos.getRoomRangeTo(Game.rooms[roomName], true) < 5)
              ans = this.setDefFlag(enemy.pos);
            if (ans === OK) {
              delete Apiary.defenseSwarms[swarm.pos.roomName];
              return;
            }
          }

          if (ans !== OK) {
            if (roomInfo.dangerlvlmax < 6)
              this.setDefFlag(enemy.pos);
            else if (roomInfo.dangerlvlmax < 9)
              this.setDefFlag(enemy.pos, "power");
            else
              this.setDefFlag(enemy.pos, "surrender");
          }
        }
      }
    }
  }

  wasBreached(pos: RoomPosition) {
    let path = pos.findPathTo(this, {
      maxRooms: 1,
      swampCost: 1,
      plainCost: 1,
      ignoreDestructibleStructures: true,
      ignoreCreeps: true,
      ignoreRoads: true,
      costCallback: (roomName, matrix) => {
        if (!(roomName in Game.rooms))
          return matrix;
        let obstacles = Game.rooms[roomName].find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART);
        _.forEach(obstacles, s => {
          if (s.hits > 1000)
            matrix.set(s.pos.x, s.pos.y, 255)
        });
        return matrix;
      }
    });
    if (!path.length)
      return pos.x === this.pos.x && this.pos.y === pos.y;
    return path[path.length - 1].x === this.pos.x && path[path.length - 1].y === this.pos.y;
  }

  setDefFlag(pos: RoomPosition, info: "normal" | "power" | "surrender" | Flag = "normal") {
    let ans;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    let centerPoss = new RoomPosition(25, 25, pos.roomName).getOpenPositions(true, 8);
    if (centerPoss.length) {
      pos = centerPoss.filter(p => terrain.get(p.x, p.y) !== TERRAIN_MASK_SWAMP)[0];
      if (!pos)
        pos = centerPoss[0];
    } else if (pos.getEnteranceToRoom())
      pos = pos.getOpenPositions(true).reduce((prev, curr) => curr.getEnteranceToRoom() ? prev : curr);

    if (info instanceof Flag) {
      return info.setPosition(pos.x, pos.y)
    } else if (info === "surrender") {
      ans = pos.createFlag(prefix.surrender + pos.roomName, COLOR_RED, COLOR_WHITE);
    } else if (info === "power")
      ans = pos.createFlag(prefix.def + "D_" + makeId(4), COLOR_RED, COLOR_RED);
    else if (info === "normal")
      ans = pos.createFlag(prefix.def + makeId(4), COLOR_RED, COLOR_BLUE);
    if (typeof ans === "string")
      Game.flags[ans].memory = { hive: this.hive.roomName };
    return ans;
  }

  notDef(roomName: string) {
    return !Apiary.defenseSwarms[roomName] && !_.filter(Game.rooms[roomName].find(FIND_FLAGS), f => f.color === COLOR_RED).length;
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    this.hive.stateChange("battle", roomInfo.dangerlvlmax > 5);

    if (roomInfo.enemies.length) {
      roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      let enemy = Apiary.intel.getEnemy(this)!;
      if (!enemy)
        return;

      _.forEach(roomInfo.enemies, e => {
        if (this.coefMap[e.object.pos.x][e.object.pos.y] < this.coefMap[enemy.pos.x][enemy.pos.y])
          enemy = e.object;
      });

      let shouldAttack = false;
      let stats = Apiary.intel.getComplexStats(enemy);
      if (stats.current.heal < TOWER_POWER_ATTACK_MY * this.coefMap[enemy.pos.x][enemy.pos.y])
        shouldAttack = true;

      _.forEach(this.towers, tower => {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10)
          return;
        if (shouldAttack) {
          if (tower.attack(enemy) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        } else {
          let target = <Structure | undefined>this.hive.findProject(enemy, "ignore_constructions");
          if (target && tower.repair(target) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        }
      });

      if (roomInfo.dangerlvlmax > 5 && Game.time % 10 === 6) {
        let contr = this.hive.room.controller!;
        if (contr.safeModeAvailable && !contr.safeModeCooldown && !contr.safeMode)
          _.forEach(roomInfo.enemies, enemy => {
            if (!(enemy instanceof Creep))
              return;

            let info = Apiary.intel.getStats(enemy).current;
            if (info.dism < 100 && info.dmgClose < 100)
              return;

            if (this.wasBreached(enemy.pos))
              this.hive.room.controller!.activateSafeMode(); // red button
          });
      }
    }
  }
}
