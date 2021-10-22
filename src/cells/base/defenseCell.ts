import { Cell } from "../_Cell";
import { SiegeMaster } from "../../beeMasters/war/siegeDefender";

import { makeId, towerCoef } from "../../abstract/utils";
import { prefix, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive, BuildProject } from "../../Hive";
import type { Order } from "../../order";

@profile
export class DefenseCell extends Cell {
  towers: { [id: string]: StructureTower } = {};
  nukes: RoomPosition[] = [];
  nukesDefenseMap = {};
  timeToLand: number = Infinity;
  nukeCoverReady: boolean = true;
  coefMap: number[][] = [];
  isBreached = false;
  master: SiegeMaster;

  constructor(hive: Hive) {
    super(hive, prefix.defenseCell + hive.room.name);
    this.updateNukes();
    this.pos = this.hive.getPos("center");
    this.master = new SiegeMaster(this);
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
        for (let y = 0; y <= 49; ++y)
          this.coefMap[x][y] += towerCoef(t, new RoomPosition(x, y, t.pos.roomName));
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

    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 5);
    this.isBreached = false;
    let contr = this.hive.room.controller!;
    this.hive.stateChange("battle", roomInfo.dangerlvlmax > 4 && (!contr.safeMode || contr.safeMode < 600));
    if (this.hive.state === hiveStates.battle) {
      let roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      _.forEach(roomInfo.enemies, enemy => {
        if (!(enemy instanceof Creep))
          return;
        // let info = Apiary.intel.getStats(enemy).current;
        // if (info.dism < 100 && info.dmgClose < 100 && info.dmgRange < 100)
        //  return;

        if (this.wasBreached(enemy.pos))
          this.isBreached = true;
      });
    }

    let storageCell = this.hive.cells.storage;
    if (!storageCell)
      return;
    if (this.hive.state === hiveStates.battle)
      storageCell.requestFromStorage(_.filter(this.towers, t => t.store.getFreeCapacity(RESOURCE_ENERGY) > TOWER_CAPACITY * 0.1), 2);
    else
      storageCell.requestFromStorage(Object.values(this.towers), 4, RESOURCE_ENERGY, TOWER_CAPACITY, true);
  }

  checkOrDefendSwarms(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 25);
      if (roomInfo.dangerlvlmax > 3) {

        let enemy = roomInfo.enemies[0].object;
        if (!this.notDef(roomName))
          return;

        let pos = enemy.pos.getOpenPositions(true).filter(p => !p.getEnteranceToRoom())[0];
        if (!pos)
          pos = enemy.pos;
        let freeSwarms: Order[] = [];
        for (const roomDefName in Apiary.defenseSwarms) {
          let roomInfoDef = Apiary.intel.getInfo(roomDefName, Infinity);
          if (roomInfoDef.dangerlvlmax < 3) {
            let order = Apiary.defenseSwarms[roomDefName];
            if (order.master && _.filter(order.master.bees, bee => bee.getActiveBodyParts(HEAL)).length)
              freeSwarms.push(order);
          }
        }
        let ans: number | string | undefined;
        if (freeSwarms.length) {
          let swarm = freeSwarms.reduce((prev, curr) => curr.pos.getRoomRangeTo(roomName) < prev.pos.getRoomRangeTo(roomName) ? curr : prev);
          if (swarm.pos.getRoomRangeTo(Game.rooms[roomName], true) < 6)
            ans = this.setDefFlag(enemy.pos, swarm.flag);
          //console.log(ans, swarm.pos.roomName, "->", roomName);
          if (ans === OK) {
            swarm.hive = this.hive;
            swarm.flag.memory.hive = this.hive.roomName;
            Apiary.defenseSwarms[roomName] = swarm;
            delete Apiary.defenseSwarms[swarm.pos.roomName];
            return;
          }
        }
        // console.log("?", roomName, ":\n", Object.keys(Apiary.defenseSwarms).map(rn => rn + " " + Apiary.intel.getInfo(rn, Infinity).dangerlvlmax + " "
        // + (Apiary.defenseSwarms[rn].master ? Apiary.defenseSwarms[rn].master!.print : "no master")).join("\n"));

        if (ans !== OK) {
          if (roomInfo.dangerlvlmax < 9)
            this.setDefFlag(enemy.pos);
          else
            this.setDefFlag(enemy.pos, "surrender");
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
    let ans: string | ERR_NAME_EXISTS | ERR_INVALID_ARGS = ERR_INVALID_ARGS;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    let centerPoss = new RoomPosition(25, 25, pos.roomName).getOpenPositions(true, 8);
    if (centerPoss.length) {
      pos = centerPoss.filter(p => terrain.get(p.x, p.y) !== TERRAIN_MASK_SWAMP)[0];
      if (!pos)
        pos = centerPoss[0];
    } else if (pos.getEnteranceToRoom())
      pos = pos.getOpenPositions(true).reduce((prev, curr) => prev.getEnteranceToRoom() ? curr : prev);

    if (info instanceof Flag) {
      return info.setPosition(pos);
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
    if (roomInfo.enemies.length) {
      let enemy = Apiary.intel.getEnemy(this)!;
      if (!enemy)
        return;

      _.forEach(roomInfo.enemies, e => {
        if (this.coefMap[e.object.pos.x][e.object.pos.y] < this.coefMap[enemy.pos.x][enemy.pos.y])
          enemy = e.object;
      });

      let shouldAttack = false;
      let stats = Apiary.intel.getComplexStats(enemy);
      let myStats = Apiary.intel.getComplexMyStats(enemy); // my stats toward a point
      let attackPower = TOWER_POWER_ATTACK * this.coefMap[enemy.pos.x][enemy.pos.y] + myStats.current.dmgClose;
      if (stats.current.heal < attackPower || enemy.hits < attackPower)
        shouldAttack = true;

      _.forEach(this.towers, tower => {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10)
          return;
        if (shouldAttack) {
          if (tower.attack(enemy) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
          let target = <Structure | undefined>this.hive.getBuildTarget(enemy, "ignoreConst");
          if (target && target.pos.findInRange(FIND_HOSTILE_CREEPS, 1).length && tower.repair(target) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        }
      });

      if (this.isBreached) {
        let contr = this.hive.room.controller!;
        if (contr.safeModeAvailable && !contr.safeModeCooldown && !contr.safeMode)
          contr.activateSafeMode(); // red button
      }
    }
  }
}
