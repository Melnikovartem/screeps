import { Cell } from "../_Cell";
import { SiegeMaster } from "../../beeMasters/war/siegeDefender";

import { makeId, towerCoef } from "../../abstract/utils";
import { prefix, hiveStates } from "../../enums";
import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { Hive, BuildProject } from "../../Hive";
import type { FlagOrder } from "../../order";
import type { Bee } from "../../bees/bee";

@profile
export class DefenseCell extends Cell {
  towers: { [id: string]: StructureTower } = {};
  nukes: { [id: string]: Nuke } = {};
  nukesDefenseMap = {};
  timeToLand: number = Infinity;
  nukeCoverReady: boolean = true;
  isBreached = false;
  master: SiegeMaster;
  dmgAtPos: { [id: string]: number } = {}

  constructor(hive: Hive) {
    super(hive, prefix.defenseCell + hive.room.name);
    this.updateNukes();
    this.master = new SiegeMaster(this);
  }

  updateNukes() {
    this.nukes = {};
    _.forEach(this.hive.room.find(FIND_NUKES), n => {
      this.nukes[n.id] = n;
      if (this.timeToLand > n.timeToLand)
        this.timeToLand = n.timeToLand;
    });
    if (!Object.keys(this.nukes).length)
      this.timeToLand = Infinity;
  }

  // mini roomPlanner
  getNukeDefMap(oneAtATime = false) {
    this.nukeCoverReady = true;
    if (!Object.keys(this.nukes).length || Game.flags[prefix.nukes + this.hive.roomName])
      return [];
    let map: { [id: number]: { [id: number]: number } } = {};
    let minLandTime = _.min(this.nukes, n => n.timeToLand).timeToLand;
    _.forEach(this.nukes, n => {
      if (n.timeToLand > minLandTime + NUKE_LAND_TIME / 2)
        return;
      let pp = n.pos;
      let poss = pp.getPositionsInRange(2);
      _.forEach(poss, p => {
        if (!map[p.x])
          map[p.x] = {};
        if (!map[p.x][p.y])
          map[p.x][p.y] = 0;
        map[p.x][p.y] += NUKE_DAMAGE[2];
      });
      map[pp.x][pp.y] += NUKE_DAMAGE[0] - NUKE_DAMAGE[2];
    });

    let maxLandTime = _.max(this.nukes, n => n.timeToLand).timeToLand;
    let rampPadding = Math.ceil(maxLandTime / RAMPART_DECAY_TIME + 100) * RAMPART_DECAY_AMOUNT;

    let ans: BuildProject[] = [];
    let extraCovers: string[] = [];
    let leaveOne = (ss: { [id: string]: Structure }) => {
      let underStrike = _.filter(ss, s => map[s.pos.x] && map[s.pos.x][s.pos.y])
      if (!underStrike.length || underStrike.length !== Object.keys(ss).length)
        return;
      let cover = underStrike.reduce((prev, curr) => map[curr.pos.x][curr.pos.y] < map[prev.pos.x][prev.pos.y] ? curr : prev);
      extraCovers.push(cover.pos.x + "_" + cover.pos.y);
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
          let workNotDone = map[x][y];
          if (s instanceof StructureStorage)
            workNotDone -= Math.max(0, s.store.getUsedCapacity() - TERMINAL_CAPACITY) * 100;
          if (rampart)
            workNotDone -= rampart.hits;
          return cost * 1.5 >= workNotDone / (100 * coef);
        }).length) {
          let rampart = structures.filter(s => s.structureType === STRUCTURE_RAMPART)[0];
          let energy;
          let heal = map[x][y] + rampPadding;
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
          if (energy > 0) {
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
    if (oneAtATime && ans.length) {
      let findType = (prev: { pos: RoomPosition }, curr: { pos: RoomPosition }, type: StructureConstant) =>
        prev.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === type).length -
        curr.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === type).length
      let theOne = ans.reduce((prev, curr) => {
        let ans = findType(prev, curr, STRUCTURE_STORAGE);
        if (ans === 0)
          ans = findType(prev, curr, STRUCTURE_TERMINAL);
        if (ans === 0)
          ans = findType(prev, curr, STRUCTURE_SPAWN);
        if (ans === 0)
          ans = map[curr.pos.x][curr.pos.y] - map[prev.pos.x][prev.pos.y];
        return ans < 0 ? curr : prev;
      });
      return [theOne];
    }
    return ans;
  }

  update() {
    super.update(["towers", "nukes"]);
    this.dmgAtPos = {};
    if (Game.time % 500 === 333 || (this.timeToLand--) < 2 || (Object.keys(this.nukes).length && Game.time % 10 === 6 && this.nukeCoverReady)) {
      this.updateNukes();
      this.getNukeDefMap();
    }

    // cant't survive a nuke if your controller lvl is below 5
    this.hive.stateChange("nukealert", !!Object.keys(this.nukes).length && !this.nukeCoverReady
      && (!this.hive.cells.storage || this.hive.cells.storage.getUsedCapacity(RESOURCE_ENERGY) > this.hive.resTarget[RESOURCE_ENERGY] / 8));

    let isWar = this.hive.state === hiveStates.battle;
    if (!isWar || Game.time % 10 === 0) {
      let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
      this.hive.stateChange("battle", roomInfo.dangerlvlmax >= 4 && (!this.hive.controller.safeMode || this.hive.controller.safeMode < 600));
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

    if (isWar && this.hive.state !== hiveStates.battle && this.hive.cells.storage)
      this.hive.cells.storage.pickupResources();

    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      if (this.hive.state === hiveStates.battle)
        storageCell.requestFromStorage(_.filter(this.towers, t => t.store.getFreeCapacity(RESOURCE_ENERGY) > TOWER_CAPACITY * 0.1), 2, RESOURCE_ENERGY);
      else
        storageCell.requestFromStorage(Object.values(this.towers), 4, RESOURCE_ENERGY, TOWER_CAPACITY, true);
    }

    _.forEach(this.hive.annexNames, h => this.checkAndDefend(h));
  }

  reposessFlag(pos: RoomPosition, enemy?: ProtoPos) {
    if (!enemy)
      return OK;
    let freeSwarms: FlagOrder[] = [];
    let enemyInfo = Apiary.intel.getComplexStats(enemy).current;
    for (const roomDefName in Apiary.defenseSwarms) {
      let roomInfoDef = Apiary.intel.getInfo(roomDefName, Infinity);
      if (roomInfoDef.dangerlvlmax < 3) {
        let order = Apiary.defenseSwarms[roomDefName];
        if (order.master && (_.filter(order.master.bees, bee => {
          let beeStats = Apiary.intel.getStats(bee.creep).current;
          let enemyTTK;
          let myTTK;
          if (beeStats.dmgClose && !beeStats.dmgRange && enemyInfo.dmgRange)
            myTTK = Infinity;
          else
            myTTK = enemyInfo.hits / (beeStats.dmgClose + beeStats.dmgRange - Math.min(enemyInfo.resist, enemyInfo.heal * 0.7 / 0.3) - enemyInfo.heal);
          if (beeStats.dmgRange && !enemyInfo.dmgRange)
            enemyTTK = Infinity;
          else
            enemyTTK = beeStats.hits / (enemyInfo.dmgClose + enemyInfo.dmgRange - Math.min(beeStats.resist, beeStats.heal * 0.7 / 0.3) - beeStats.heal);
          if (enemyTTK < 0)
            enemyTTK = Infinity;
          if (myTTK < 0)
            myTTK = Infinity;
          return !(myTTK === Infinity || enemyTTK < myTTK);
        }).length))
          freeSwarms.push(order);
      }
    }
    if (freeSwarms.length) {
      let swarm = freeSwarms.reduce((prev, curr) => pos.getRoomRangeTo(curr) < pos.getRoomRangeTo(prev) ? curr : prev);
      let ans;
      if (swarm.pos.getRoomRangeTo(Game.rooms[pos.roomName], true) <= 2)
        ans = this.setDefFlag(pos, swarm.flag);
      //console .log(ans, swarm.pos.roomName, "->", roomName);
      if (ans === OK) {
        swarm.hive = this.hive;
        swarm.flag.memory.hive = this.hive.roomName;
        Apiary.defenseSwarms[pos.roomName] = swarm;
        delete Apiary.defenseSwarms[swarm.pos.roomName];
        return OK;
      }
    }
    return ERR_NOT_FOUND;
  }

  checkAndDefend(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 25);
      if (roomInfo.dangerlvlmax >= 3 && roomInfo.dangerlvlmax <= 5 && roomInfo.enemies.length && Game.time >= roomInfo.safeModeEndTime - 250) {
        let enemy = roomInfo.enemies[0].object;
        if (!this.notDef(roomName))
          return;
        let pos = enemy.pos.getOpenPositions(true).filter(p => !p.getEnteranceToRoom())[0];
        if (!pos)
          pos = enemy.pos;
        // console .log("?", roomName, ":\n", Object.keys(Apiary.defenseSwarms).map(rn => rn + " " + Apiary.intel.getInfo(rn, Infinity).dangerlvlmax + " "
        // + (Apiary.defenseSwarms[rn].master ? Apiary.defenseSwarms[rn].master!.print : "no master")).join("\n"));

        if (this.reposessFlag(enemy.pos, enemy) !== OK)
          this.setDefFlag(enemy.pos);
      }
    }
  }

  get opts(): FindPathOpts {
    return {
      maxRooms: 1,
      ignoreRoads: true,
      ignoreCreeps: true,
      ignoreDestructibleStructures: true,
      swampCost: 1,
      plainCost: 1,
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
    }
  }

  wasBreached(pos: RoomPosition, defPos: RoomPosition = this.pos) {
    let path = pos.findPathTo(defPos, this.opts);
    let firstStep = path.shift();
    let lastStep = path.pop();
    if (!firstStep || !lastStep)
      return pos.isNearTo(defPos) && !pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 5000
        && (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART)).length;
    let endOfPath = new RoomPosition(lastStep.x, lastStep.y, pos.roomName);
    let startOfPath = new RoomPosition(firstStep.x, firstStep.y, pos.roomName);
    return startOfPath.isNearTo(pos) && endOfPath.isNearTo(defPos) && !endOfPath.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 5000
      && (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART)).length;
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
    } else if (pos.getEnteranceToRoom()) {
      let poss = pos.getOpenPositions(true);
      if (poss.length)
        pos = poss.reduce((prev, curr) => prev.getEnteranceToRoom() ? curr : prev);
    }

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
    let myStats = Apiary.intel.getComplexMyStats(pos); // my stats toward a point
    let towerDmg = 0;
    _.forEach(this.towers, tower => {
      towerDmg += towerCoef(tower, pos) * TOWER_POWER_ATTACK;
    });
    this.dmgAtPos[str] = towerDmg + myStats.current.dmgClose;
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

    let prepareHeal = (master: { activeBees: Bee[] } | undefined, nonclose = true) => {
      if (healTargets.length || !master)
        return;
      healTargets = master.activeBees.filter(b => b.hits < b.hitsMax && b.pos.roomName === this.hive.roomName && (nonclose || b.pos.getRangeTo(this) < 10)).map(b => b.creep)
    };

    let healTargets: Creep[] = [];
    prepareHeal(this.master);
    prepareHeal(this.hive.cells.storage && this.hive.cells.storage.master, this.hive.state === hiveStates.battle);
    prepareHeal(this.hive.builder);
    prepareHeal(this.hive.cells.excavation.master, this.hive.state === hiveStates.battle);
    prepareHeal(this.hive.cells.dev && this.hive.cells.dev.master, this.hive.state === hiveStates.battle);

    let healTarget: Creep | undefined;
    let toHeal = 0;
    if (healTargets.length) {
      healTarget = healTargets.reduce((prev, curr) => (curr.hitsMax - curr.hits > prev.hitsMax - prev.hits ? curr : prev));
      toHeal = healTarget.hitsMax - healTarget.hits;
    }

    if (roomInfo.enemies.length && Game.time > roomInfo.safeModeEndTime) {
      if (this.isBreached && (this.hive.controller.level >= 6 || _.filter(Apiary.hives, h => Object.keys(h.cells.spawn.spawns).length > 0).length <= 1)) {
        let contr = this.hive.controller;
        if (contr.safeModeAvailable && !contr.safeModeCooldown && !contr.safeMode)
          contr.activateSafeMode(); // red button
      }

      let enemy = this.getEnemy()!;
      if (!enemy)
        return;

      let shouldAttack = false;
      let stats = Apiary.intel.getComplexStats(enemy).current;
      let attackPower = this.getDmgAtPos(enemy.pos);
      if (
        (stats.heal + Math.min(stats.resist, stats.heal * (1 / 0.3 - 1)) < attackPower
          || !stats.heal
          || stats.hits <= attackPower) // || (stats.resist && stats.resist < attackPower
        && (roomInfo.dangerlvlmax < 8
          || (enemy.pos.x > 2 && enemy.pos.x < 47 && enemy.pos.y > 2 && enemy.pos.y < 47)
          || this.master.activeBees.filter(b => b.pos.getRangeTo(enemy) < 2).length
          || stats.hits <= attackPower
          || (!stats.heal && !enemy.pos.getEnteranceToRoom())))
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

      if (!healTarget) {
        healTarget = enemy.pos.findInRange(FIND_MY_CREEPS, 4).filter(c => c.hits < c.hitsMax)[0];
        if (healTarget)
          toHeal = healTarget.hitsMax - healTarget.hits;
      }
      if (healTarget) {
        let deadInfo = Apiary.intel.getComplexStats(healTarget).current;
        let healTargetStats = Apiary.intel.getStats(healTarget).current;
        if (deadInfo.dmgRange + deadInfo.dmgClose >= healTargetStats.hits) {
          healTarget = undefined;
          toHeal = 0;
        }
      }

      _.forEach(this.towers, tower => {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10)
          return;
        workingTower = true;
        if (shouldAttack) {
          // let toAttack = healer ? healer : enemy;
          // healer = undefined;
          if (tower.attack(enemy) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense_dmg", -10);
        } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
          if (healTarget && toHeal && tower.heal(healTarget) === OK) {
            toHeal -= towerCoef(tower, healTarget) * TOWER_POWER_HEAL;
            if (Apiary.logger)
              Apiary.logger.addResourceStat(this.hive.roomName, "defense_heal", -10);
          }
          if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= tower.store.getCapacity(RESOURCE_ENERGY) * 0.75)
            return;
          let repairTarget = <Structure | undefined>this.hive.getBuildTarget(tower, "ignoreConst");
          if (!repairTarget || (repairTarget.structureType !== STRUCTURE_WALL && repairTarget.structureType !== STRUCTURE_RAMPART))
            return;
          if (this.hive.builder && (this.hive.builder.activeBees.filter(b => b.pos.getRangeTo(repairTarget!) <= 8 && b.store.getUsedCapacity(RESOURCE_ENERGY)).length
            || this.hive.builder.activeBees.filter(b => b.pos.getRangeTo(repairTarget!) <= tower.pos.getRangeTo(repairTarget!)).length))
            return;
          if (repairTarget && tower.pos.getRangeTo(repairTarget) <= tower.pos.getRangeTo(enemy) && repairTarget.pos.findInRange(FIND_HOSTILE_CREEPS, 3).length && tower.repair(repairTarget) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense_repair", -10);
        }
      });
      if (!workingTower && this.notDef(this.pos.roomName))
        this.setDefFlag(this.pos);
    } else if (healTarget) {
      _.forEach(this.towers, tower => {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < tower.store.getCapacity(RESOURCE_ENERGY) * 0.7)
          return;
        if (healTarget && toHeal && tower.heal(healTarget) === OK) {
          toHeal -= towerCoef(tower, healTarget) * TOWER_POWER_HEAL;
          if (Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "defense_heal", -10);
        }
      });
    }
  }
}
