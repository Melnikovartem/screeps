import { Cell } from "../_Cell";
import { SiegeMaster } from "../../beeMasters/war/siegeDefender";

import { makeId, towerCoef } from "../../abstract/utils";
import { prefix, hiveStates } from "../../enums";
import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { Hive, BuildProject } from "../../Hive";
import type { Order } from "../../order";


const PADDING_NUKES_RAMPS = 20000;

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
  dmgAtPos: { [id: string]: number } = {}

  constructor(hive: Hive) {
    super(hive, prefix.defenseCell + hive.room.name);
    this.updateNukes();
    this.master = new SiegeMaster(this);
  }

  bakeMap() {
    if (!Object.keys(this.towers).length)
      return;
    if (this.coefMap.length)
      return // remove with caching
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
    if (Game.time !== this.time)
      this.getNukeDefMap();
    else if (this.nukes.length)
      this.nukeCoverReady = false;
    if (Game.flags[prefix.nukes + this.hive.roomName])
      this.nukeCoverReady = true;
  }

  // mini roomPlanner
  getNukeDefMap(oneAtATime = false) {
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
          map[p.x][p.y] = 0;
        map[p.x][p.y] += 5000000;
      });
      map[pp.x][pp.y] += 10000000;
    });

    let ans: BuildProject[] = [];
    // todo?? save some of the extensions / not all spawns
    let extraCovers: string[] = [];
    let leaveOne = (ss: { [id: string]: Structure }) => {
      let underStrike = _.filter(ss, s => map[s.pos.x] && map[s.pos.x][s.pos.y])
      if (underStrike.length !== Object.keys(ss).length)
        return;
      let cover = underStrike.reduce((prev, curr) => map[curr.pos.x][curr.pos.y] < map[prev.pos.x][prev.pos.y] ? curr : prev);
      extraCovers.push(cover.pos.x + "_" + cover.pos.y)
    }

    let coef = 1;
    let storage = this.hive.cells.storage;
    if (storage) {
      let checkMineralLvl = (lvl: 0 | 1 | 2) => storage!.getUsedCapacity(BOOST_MINERAL.build[lvl]) >= 1000;
      if (checkMineralLvl(2))
        coef = 2;
      else if (checkMineralLvl(1))
        coef = 1.8;
      else if (checkMineralLvl(0))
        coef = 1.5;
    }

    leaveOne(this.hive.cells.spawn.spawns);
    if (this.hive.cells.lab)
      leaveOne(this.hive.cells.lab.laboratories);

    for (let x in map)
      for (let y in map[x]) {
        let pos = new RoomPosition(+x, +y, this.hive.roomName);
        let structures = pos.lookFor(LOOK_STRUCTURES)
        if (structures.filter(s => {
          if (extraCovers.includes(s.pos.x + "_" + s.pos.y))
            return true;
          let cost = CONSTRUCTION_COST[<BuildableStructureConstant>s.structureType];
          let rampart = s.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART)[0];
          let toDo = map[x][y];
          if (rampart)
            toDo -= rampart.hits;
          return cost * 1.5 >= toDo / (100 * coef);
        }).length) {
          let rampart = structures.filter(s => s.structureType === STRUCTURE_RAMPART)[0];
          let energy;
          let heal = map[x][y] + PADDING_NUKES_RAMPS;
          if (rampart)
            energy = Math.max(heal - rampart.hits, 0) / 100;
          else {
            energy = map[x][y] / 100;
            if (!pos.lookFor(LOOK_CONSTRUCTION_SITES).length)
              pos.createConstructionSite(STRUCTURE_RAMPART);
            ans.push({
              pos: pos,
              sType: STRUCTURE_RAMPART,
              targetHits: heal,
              energyCost: 1,
              type: "construction",
            });
          }
          if (energy >= PADDING_NUKES_RAMPS / 100 / 2) {
            ans.push({
              pos: pos,
              sType: STRUCTURE_RAMPART,
              targetHits: heal,
              energyCost: Math.ceil(energy),
              type: "repair",
            });
            this.nukeCoverReady = false;
          }
        }
      }
    if (oneAtATime) {
      let theOne = ans.reduce((prev, curr) => {
        let ans = prev.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_TERMINAL).length -
          curr.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_TERMINAL).length;
        if (ans === 0)
          ans = map[curr.pos.x][curr.pos.y] - map[prev.pos.x][prev.pos.y]
        return ans < 0 ? curr : prev;
      });
      return [theOne];
    }
    return ans;
  }

  update() {
    super.update(["towers"]);
    this.dmgAtPos = {};
    if (Game.time % 500 === 333 || (this.timeToLand--) < 2 || (this.nukes.length && Game.time % 10 === 6 && this.nukeCoverReady))
      this.updateNukes();

    // cant't survive a nuke if your controller lvl is below 5
    this.hive.stateChange("nukealert", !!this.nukes.length && !this.nukeCoverReady
      && (!this.hive.cells.storage || this.hive.cells.storage.getUsedCapacity(RESOURCE_ENERGY) > this.hive.resTarget[RESOURCE_ENERGY] / 8));


    let contr = this.hive.room.controller!;
    if (this.hive.state !== hiveStates.battle || Game.time % 10 === 0) {
      let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
      this.hive.stateChange("battle", roomInfo.dangerlvlmax >= 4 && (!contr.safeMode || contr.safeMode < 600));
    }

    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      if (this.hive.state === hiveStates.battle)
        storageCell.requestFromStorage(_.filter(this.towers, t => t.store.getFreeCapacity(RESOURCE_ENERGY) > TOWER_CAPACITY * 0.1), 2);
      else
        storageCell.requestFromStorage(Object.values(this.towers), 4, RESOURCE_ENERGY, TOWER_CAPACITY, true);
    }


    if (this.hive.state === hiveStates.battle) {
      let roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      if (Game.time % 5 === 0) {
        this.isBreached = false;
        _.some(roomInfo.enemies, enemy => {
          if (this.wasBreached(enemy.object.pos))
            this.isBreached = true;
          return this.isBreached;
        });
      }
    } else
      this.isBreached = false;

    _.forEach(this.hive.annexNames, h => this.checkOrDefendSwarms(h));
  }

  reposessFlag(pos: RoomPosition, dangerlvl: number) {
    let freeSwarms: Order[] = [];
    for (const roomDefName in Apiary.defenseSwarms) {
      let roomInfoDef = Apiary.intel.getInfo(roomDefName, Infinity);
      if (roomInfoDef.dangerlvlmax < 3) {
        let order = Apiary.defenseSwarms[roomDefName];
        if (order.master && (dangerlvl === 3 || _.filter(order.master.bees, bee => bee.getActiveBodyParts(HEAL)).length))
          freeSwarms.push(order);
      }
    }
    if (freeSwarms.length) {
      let swarm = freeSwarms.reduce((prev, curr) => pos.getRoomRangeTo(curr) < pos.getRoomRangeTo(prev) ? curr : prev);
      let ans;
      if (swarm.pos.getRoomRangeTo(Game.rooms[pos.roomName], true) < 6)
        ans = this.setDefFlag(pos, swarm.flag);
      //console.log(ans, swarm.pos.roomName, "->", roomName);
      if (ans === OK) {
        swarm.hive = this.hive;
        swarm.flag.memory.hive = this.hive.roomName;
        Apiary.defenseSwarms[pos.roomName] = swarm;
        delete Apiary.defenseSwarms[swarm.pos.roomName];
        return OK;
      }
    }
    return ERR_NOT_FOUND
  }

  checkOrDefendSwarms(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 25);
      if (roomInfo.dangerlvlmax >= 3 && roomInfo.dangerlvlmax <= 5 && roomInfo.enemies.length && Game.time >= roomInfo.safeModeEndTime - 250) {
        let enemy = roomInfo.enemies[0].object;
        if (!this.notDef(roomName))
          return;
        let pos = enemy.pos.getOpenPositions(true).filter(p => !p.getEnteranceToRoom())[0];
        if (!pos)
          pos = enemy.pos;

        // console.log("?", roomName, ":\n", Object.keys(Apiary.defenseSwarms).map(rn => rn + " " + Apiary.intel.getInfo(rn, Infinity).dangerlvlmax + " "
        // + (Apiary.defenseSwarms[rn].master ? Apiary.defenseSwarms[rn].master!.print : "no master")).join("\n"));

        if (this.reposessFlag(enemy.pos, roomInfo.dangerlvlmax) !== OK)
          this.setDefFlag(enemy.pos);
      }
    }
  }

  wasBreached(pos: RoomPosition) {
    let path = pos.findPathTo(this, {
      maxRooms: 1,
      costCallback: (roomName, matrix) => {
        if (!(roomName in Game.rooms))
          return matrix;
        matrix = new PathFinder.CostMatrix();
        let terrain = Game.map.getRoomTerrain(roomName);
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y)
            if (terrain.get(x, y) === TERRAIN_MASK_WALL)
              matrix.set(x, y, 0xff);
        let obstacles = Game.rooms[roomName].find(FIND_STRUCTURES).filter(s => s.hits > 5000
          && (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART));
        _.forEach(obstacles, s => matrix.set(s.pos.x, s.pos.y, 0xff));
        return matrix;
      }
    });
    let lastStep = path.pop();
    if (!lastStep)
      return pos.isNearTo(this);
    let endOfPath = new RoomPosition(lastStep.x, lastStep.y, pos.roomName);
    return endOfPath.isNearTo(this);
  }

  setDefFlag(pos: RoomPosition, flag?: Flag) {
    let ans: string | ERR_NAME_EXISTS | ERR_INVALID_ARGS = ERR_INVALID_ARGS;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    let centerPoss = new RoomPosition(25, 25, pos.roomName).getOpenPositions(true, 3);
    if (centerPoss.length) {
      for (let i = 0; i < centerPoss.length; ++i)
        if (terrain.get(centerPoss[i].x, centerPoss[i].y) !== TERRAIN_MASK_SWAMP) {
          pos = centerPoss[i];
          break;
        }
      if (!pos)
        pos = centerPoss[0];
    } else if (pos.getEnteranceToRoom())
      pos = pos.getOpenPositions(true).reduce((prev, curr) => prev.getEnteranceToRoom() ? curr : prev);

    if (flag) {
      return flag.setPosition(pos);
    } else
      ans = pos.createFlag(prefix.def + makeId(4), COLOR_RED, COLOR_BLUE);
    if (typeof ans === "string")
      Game.flags[ans].memory = { hive: this.hive.roomName };
    return ans;
  }

  notDef(roomName: string) {
    return !Apiary.defenseSwarms[roomName] && !_.filter(Game.rooms[roomName].find(FIND_FLAGS), f => f.color === COLOR_RED).length;
  }

  getDmgAtPos(pos: RoomPosition) {
    let str = pos.to_str;
    if (this.dmgAtPos[str])
      return this.dmgAtPos[str];
    if (this.coefMap[pos.x] === undefined || this.coefMap[pos.x][pos.y] === undefined)
      return 0;
    let myStats = Apiary.intel.getComplexMyStats(pos); // my stats toward a point
    this.dmgAtPos[str] = TOWER_POWER_ATTACK * this.coefMap[pos.x][pos.y] + myStats.current.dmgClose;
    return this.dmgAtPos[str];
  }

  getEnemy() {
    let enemy = Apiary.intel.getEnemy(this)!;
    if (!enemy)
      return;

    let roomInfo = Apiary.intel.getInfo(this.hive.roomName);
    _.forEach(roomInfo.enemies, e => {
      let statsE = Apiary.intel.getComplexStats(e.object).current;
      let statsEnemy = Apiary.intel.getComplexStats(enemy).current;
      if (this.getDmgAtPos(e.object.pos) - statsE.heal - statsE.resist > this.getDmgAtPos(enemy.pos) - statsEnemy.heal - statsEnemy.resist)
        enemy = e.object;
    });
    return enemy;
  }


  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    if (roomInfo.enemies.length && Game.time > roomInfo.safeModeEndTime) {
      if (this.isBreached && this.hive.room.controller!.level >= 4) {
        let contr = this.hive.room.controller!;
        if (contr.safeModeAvailable && !contr.safeModeCooldown && !contr.safeMode)
          contr.activateSafeMode(); // red button
      }

      let enemy = this.getEnemy()!;
      if (!enemy)
        return;

      let shouldAttack = false;
      let stats = Apiary.intel.getComplexStats(enemy).current;
      let attackPower = this.getDmgAtPos(enemy.pos);
      if (stats.heal + stats.resist < attackPower || !stats.heal
        || (stats.resist && stats.resist < attackPower) || stats.hits <= attackPower)
        shouldAttack = true;
      /*let healer: undefined | Creep;
       let fisrtTower = _.filter(this.towers, t => t.store.getCapacity(RESOURCE_ENERGY) >= 10)[0];
      if (shouldAttack && stats.hits + stats.heal - attackPower * 2 > 0 && fisrtTower
        && stats.heal + stats.resist < attackPower - ATTACK_POWER * towerCoef(fisrtTower, enemy))
        healer = enemy.pos.findInRange(FIND_HOSTILE_CREEPS, 1).filter(c => {
          let stats = Apiary.intel.getStats(c).current;
          return stats.dmgClose + stats.dmgRange < stats.heal;
        })[0]; */

      let workingTower = false;
      _.forEach(this.towers, tower => {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10)
          return;
        workingTower = true;
        if (shouldAttack) {
          // let toAttack = healer ? healer : enemy;
          // healer = undefined;
          if (tower.attack(enemy) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
          let healTargets = this.master.activeBees.filter(b => b.hits < b.hitsMax).map(b => b.creep);
          if (!healTargets.length)
            healTargets = enemy.pos.findInRange(FIND_MY_CREEPS, 4).filter(c => c.hits < c.hitsMax);
          if (healTargets.length) {
            let healTarget = healTargets.reduce((prev, curr) => {
              return curr.hitsMax - curr.hits > prev.hitsMax - prev.hits ? curr : prev;
            });
            if (tower.heal(healTarget) === OK && Apiary.logger)
              Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
            return;
          }
          if ((this.hive.builder && this.hive.builder.activeBees.filter(b => b.pos.roomName === this.hive.roomName).length) || tower.store.getUsedCapacity(RESOURCE_ENERGY) <= tower.store.getCapacity(RESOURCE_ENERGY) * 0.75)
            return;
          let repairTarget = <Structure | undefined>this.hive.getBuildTarget(enemy, "ignoreConst");
          if (repairTarget && tower.pos.getRangeTo(repairTarget) <= tower.pos.getRangeTo(enemy) && repairTarget.pos.findInRange(FIND_HOSTILE_CREEPS, 3).length && tower.repair(repairTarget) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        }
      });
      if (!workingTower && this.notDef(this.pos.roomName))
        this.setDefFlag(this.pos);
    } else {
      let healTargets = this.master.activeBees.filter(b => b.hits < b.hitsMax).map(b => b.creep);
      if (healTargets.length) {
        let healTarget = healTargets.reduce((prev, curr) => {
          return curr.hitsMax - curr.hits > prev.hitsMax - prev.hits ? curr : prev;
        });
        _.forEach(this.towers, tower => {
          if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < tower.store.getCapacity(RESOURCE_ENERGY) * 0.7)
            return;
          if (tower.heal(healTarget) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense", -10);
        });
      }
    }
  }
}
