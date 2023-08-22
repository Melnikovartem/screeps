import { makeId, towerCoef } from "../../abstract/utils";
import { HordeMaster } from "../../beeMasters/war/horde";
import { SiegeMaster } from "../../beeMasters/war/siegeDefender";
import type { Bee } from "../../bees/bee";
import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";
import { beeStates, hiveStates, prefix } from "../../enums";
import type { BuildProject, Hive } from "../../Hive";
import { FlagOrder } from "../../order";
import { profile } from "../../profiler/decorator";
import { Cell } from "../_Cell";

@profile
export class DefenseCell extends Cell {
  public towers: { [id: string]: StructureTower } = {};
  public nukes: { [id: string]: Nuke } = {};
  public nukesDefenseMap = {};
  public timeToLand: number = Infinity;
  public nukeCoverReady: boolean = true;
  public isBreached = false;
  public master: SiegeMaster;
  public dmgAtPos: { [id: string]: number } = {};

  public constructor(hive: Hive) {
    super(hive, prefix.defenseCell);
    this.updateNukes();
    this.master = new SiegeMaster(this);
    this.initCache("poss", { x: 25, y: 25 });
  }

  public get poss(): { x: number; y: number } {
    return this.fromCache("poss");
  }

  public set pos(pos) {
    this.toCache("poss", { x: pos.x, y: pos.y });
  }

  public get pos(): RoomPosition {
    const pos = this.fromCache("poss");
    return new RoomPosition(pos.x, pos.y, this.hive.roomName);
  }

  public get walls() {
    const ans: (StructureWall | StructureRampart)[] = [];
    const planner = Memory.cache.roomPlanner[this.hive.roomName];
    const walls =
      (planner.constructedWall && planner.constructedWall.pos) || [];
    const ramps = (planner.rampart && planner.rampart.pos) || [];
    _.forEach(walls, (p) => {
      const pos = new RoomPosition(p.x, p.y, this.hive.roomName);
      const s = pos
        .lookFor(LOOK_STRUCTURES)
        .filter((s) => s.structureType === STRUCTURE_WALL)[0];
      if (s) ans.push(s as StructureWall);
    });
    _.forEach(ramps, (p) => {
      const pos = new RoomPosition(p.x, p.y, this.hive.roomName);
      const s = pos
        .lookFor(LOOK_STRUCTURES)
        .filter((s) => s.structureType === STRUCTURE_RAMPART)[0];
      if (s) ans.push(s as StructureRampart);
    });
    return ans;
  }

  public updateNukes() {
    this.nukes = {};
    this.timeToLand = Infinity;
    _.forEach(this.hive.room.find(FIND_NUKES), (n) => {
      this.nukes[n.id] = n;
      if (this.timeToLand > n.timeToLand) this.timeToLand = n.timeToLand;
    });
    if (!Object.keys(this.nukes).length) this.timeToLand = Infinity;
    else this.getNukeDefMap();
  }

  // mini roomPlanner
  public getNukeDefMap(oneAtATime = false): [BuildProject[], number] {
    // i should think what to do if my defenses are under strike
    const prevState = this.nukeCoverReady;
    this.nukeCoverReady = true;
    if (!Object.keys(this.nukes).length)
      // || Game.flags[prefix.nukes + this.hive.roomName])
      return [[], 0];
    const map: { [id: number]: { [id: number]: number } } = {};
    const minLandTime = _.min(this.nukes, (n) => n.timeToLand).timeToLand;
    _.forEach(this.nukes, (n) => {
      if (n.timeToLand > minLandTime + NUKE_LAND_TIME * 0.8 && !prevState)
        return; // can handle multiple rounds
      const pp = n.pos;
      const poss = pp.getPositionsInRange(2);
      _.forEach(poss, (p) => {
        if (!map[p.x]) map[p.x] = {};
        if (!map[p.x][p.y]) map[p.x][p.y] = 0;
        map[p.x][p.y] += NUKE_DAMAGE[2];
      });
      map[pp.x][pp.y] += NUKE_DAMAGE[0] - NUKE_DAMAGE[2];
    });

    const maxLandTime = _.max(this.nukes, (n) => n.timeToLand).timeToLand;
    const rampPadding =
      Math.ceil(maxLandTime / RAMPART_DECAY_TIME + 100) * RAMPART_DECAY_AMOUNT;

    const ans: BuildProject[] = [];
    const extraCovers: string[] = [];
    const leaveOne = (ss: { [id: string]: Structure }) => {
      const underStrike = _.filter(
        ss,
        (s) => map[s.pos.x] && map[s.pos.x][s.pos.y]
      );
      if (!underStrike.length || underStrike.length !== Object.keys(ss).length)
        return;
      const cover = underStrike.reduce((prev, curr) =>
        map[curr.pos.x][curr.pos.y] < map[prev.pos.x][prev.pos.y] ? curr : prev
      );
      extraCovers.push(cover.pos.x + "_" + cover.pos.y);
    };

    let coef = 1;
    if (this.hive.cells) {
      const storage = this.hive.cells.storage;
      if (storage) {
        const checkMineralLvl = (lvl: 0 | 1 | 2) =>
          storage.getUsedCapacity(BOOST_MINERAL.build[lvl]) >= 1000;
        if (checkMineralLvl(2)) coef = 2;
        else if (checkMineralLvl(1)) coef = 1.8;
        else if (checkMineralLvl(0)) coef = 1.5;
      }

      leaveOne(this.hive.cells.spawn.spawns);
      if (this.hive.cells.lab) leaveOne(this.hive.cells.lab.laboratories);
    }

    let energyCost = 0;
    for (const x in map)
      for (const y in map[x]) {
        const pos = new RoomPosition(+x, +y, this.hive.roomName);
        const structures = pos.lookFor(LOOK_STRUCTURES);
        if (
          structures.filter((s) => {
            if (extraCovers.includes(s.pos.x + "_" + s.pos.y)) return true;
            const cost =
              CONSTRUCTION_COST[s.structureType as BuildableStructureConstant];
            const rampart = s.pos
              .lookFor(LOOK_STRUCTURES)
              .filter((s) => s.structureType === STRUCTURE_RAMPART)[0];
            let workNotDone = map[x][y];
            if (s instanceof StructureStorage)
              workNotDone -=
                Math.max(0, s.store.getUsedCapacity() - TERMINAL_CAPACITY) *
                100;
            if (rampart) workNotDone -= rampart.hits;
            let ss = 1.5;
            if (s.structureType === STRUCTURE_SPAWN) ss = 4.9;
            else if (s.structureType === STRUCTURE_LAB) ss = 3;
            return cost * ss >= workNotDone / (100 * coef);
          }).length
        ) {
          const rampart = structures.filter(
            (s) => s.structureType === STRUCTURE_RAMPART
          )[0];
          let energy;
          const heal = map[x][y] + rampPadding;
          if (rampart) energy = Math.max(heal - rampart.hits, 0) / 100;
          else {
            energy = map[x][y] / 100;
            if (!pos.lookFor(LOOK_CONSTRUCTION_SITES).length)
              pos.createConstructionSite(STRUCTURE_RAMPART);
            ans.push({
              pos,
              sType: STRUCTURE_RAMPART,
              targetHits: heal,
              energyCost: 1,
              type: "construction",
            });
          }
          if (energy > 0) {
            energyCost += Math.ceil(energy);
            ans.push({
              pos,
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
      const findType = (
        prev: { pos: RoomPosition },
        curr: { pos: RoomPosition },
        type: StructureConstant
      ) =>
        prev.pos
          .lookFor(LOOK_STRUCTURES)
          .filter((s) => s.structureType === type).length -
        curr.pos
          .lookFor(LOOK_STRUCTURES)
          .filter((s) => s.structureType === type).length;
      const theOne = ans.reduce((prev, curr) => {
        let ans = findType(prev, curr, STRUCTURE_STORAGE);
        if (ans === 0) ans = findType(prev, curr, STRUCTURE_TERMINAL);
        if (ans === 0) ans = findType(prev, curr, STRUCTURE_SPAWN);
        if (ans === 0)
          ans = map[curr.pos.x][curr.pos.y] - map[prev.pos.x][prev.pos.y];
        return ans < 0 ? curr : prev;
      });
      return [[theOne], energyCost];
    }
    return [ans, energyCost];
  }

  public update() {
    super.update(["towers", "nukes"]);
    this.dmgAtPos = {};
    if (
      Game.time % 500 === 333 ||
      this.timeToLand-- < 2 ||
      (Object.keys(this.nukes).length &&
        Game.time % 10 === 6 &&
        this.nukeCoverReady)
    ) {
      this.updateNukes();
      this.getNukeDefMap();
    }

    // cant't survive a nuke if your controller lvl is below 5
    this.hive.stateChange(
      "nukealert",
      !!Object.keys(this.nukes).length &&
        !this.nukeCoverReady &&
        (!this.hive.cells.storage ||
          this.hive.cells.storage.getUsedCapacity(RESOURCE_ENERGY) >
            this.hive.resTarget[RESOURCE_ENERGY] / 8)
    );

    const isWar = this.hive.state >= hiveStates.battle;
    if (!isWar || Game.time % 10 === 0) {
      const roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
      this.hive.stateChange(
        "battle",
        roomInfo.dangerlvlmax >= 5 &&
          (!this.hive.controller.safeMode ||
            this.hive.controller.safeMode < 600)
      );

      if (this.hive.state >= hiveStates.battle) {
        if (Game.time % 5 === 0) {
          this.isBreached = false;
          _.some(roomInfo.enemies, (enemy) => {
            if (this.wasBreached(enemy.object.pos)) this.isBreached = true;
            return this.isBreached;
          });
        }
      } else this.isBreached = false;
    }

    // No more battles. Collect resources
    if (
      isWar &&
      this.hive.state !== hiveStates.battle &&
      this.hive.cells.storage
    )
      this.hive.cells.storage.pickupResources();

    const storageCell = this.hive.cells.storage;
    if (storageCell) {
      if (this.hive.state >= hiveStates.battle)
        storageCell.requestFromStorage(
          _.filter(
            this.towers,
            (t) =>
              t.store.getFreeCapacity(RESOURCE_ENERGY) > TOWER_CAPACITY * 0.1
          ),
          2,
          RESOURCE_ENERGY
        );
      else
        storageCell.requestFromStorage(
          Object.values(this.towers),
          4,
          RESOURCE_ENERGY,
          TOWER_CAPACITY,
          true
        );
    }

    if (Game.time % 10 === 8 && this.hive.cells.observe) {
      _.some(this.hive.annexNames, (annexName) => {
        if (
          !(annexName in Game.rooms) &&
          !Apiary.intel.getInfo(annexName, 50).safePlace
        )
          Apiary.requestSight(annexName); // to set / reposessFlag i need sight}
      });
    }
    if (Game.time % 10 === 9 && this.timeToLand > 200) {
      _.some(this.hive.annexNames, (annexName) =>
        this.checkAndDefend(annexName)
      );
    }
  }

  public reposessFlag(pos: RoomPosition, enemy?: ProtoPos) {
    if (!enemy) return OK;
    if (!(pos.roomName in Game.rooms)) return ERR_BUSY;
    const freeSwarms: HordeMaster[] = [];
    let canWin = false;
    const enemyInfo = Apiary.intel.getComplexStats(enemy).current;
    for (const roomDefName in Apiary.defenseSwarms) {
      if (roomDefName === pos.roomName) continue;
      const master = Apiary.defenseSwarms[roomDefName];
      if (master.beesAmount && master.loosingBattle(enemyInfo) > 0) {
        canWin = true;
        const roomInfoDef = Apiary.intel.getInfo(roomDefName, Infinity);
        if (roomInfoDef.dangerlvlmax < 3) freeSwarms.push(master);
      }
    }
    if (freeSwarms.length) {
      const swarm = freeSwarms.reduce((prev, curr) =>
        pos.getRoomRangeTo(curr) < pos.getRoomRangeTo(prev) ? curr : prev
      );
      let ans;
      if (swarm.pos.getRoomRangeTo(pos.roomName, "path") <= 5)
        ans = this.setDefFlag(pos, swarm.order.flag);
      else canWin = false;
      if (ans === OK) {
        swarm.order.hive = this.hive;
        swarm.order.flag.memory.hive = this.hive.roomName;
        delete Apiary.defenseSwarms[swarm.pos.roomName];
        Apiary.defenseSwarms[pos.roomName] = swarm;
        return OK;
      }
    }
    return canWin ? ERR_TIRED : ERR_NOT_FOUND;
  }

  public checkAndDefend(roomName: string, lag = 20) {
    const roomInfo = Apiary.intel.getInfo(roomName, lag);
    // we can deal with 6 but it IS a problem
    // now we do not touch 6
    if (
      roomInfo.dangerlvlmax >= 3 &&
      roomInfo.dangerlvlmax <= 5 &&
      roomInfo.enemies.length &&
      Game.time >= roomInfo.safeModeEndTime - 200
    ) {
      const enemy = roomInfo.enemies[0].object;
      if (!this.notDef(roomName)) return;
      let pos = enemy.pos
        .getOpenPositions(true)
        .filter((p) => !p.enteranceToRoom)[0];
      if (!pos) pos = enemy.pos;
      if (
        this.reposessFlag(enemy.pos, enemy) === ERR_NOT_FOUND &&
        !_.filter(
          Apiary.defenseSwarms,
          (s) =>
            this.hive.pos.getRoomRangeTo(s.hive) <= 2 &&
            (!s.spawned ||
              s.waitingForBees ||
              _.filter(s.bees, (b) => b.state === beeStates.boosting).length)
        ).length
      ) {
        this.setDefFlag(enemy.pos);
        return true;
      }
    }
    return false;
  }

  public get opt(): FindPathOpts {
    return {
      maxRooms: 1,
      ignoreRoads: true,
      ignoreCreeps: true,
      ignoreDestructibleStructures: true,
      swampCost: 1,
      plainCost: 1,
      costCallback: (roomName, matrix) => {
        if (!(roomName in Game.rooms)) return matrix;
        matrix = new PathFinder.CostMatrix();
        const terrain = Game.map.getRoomTerrain(roomName);
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y)
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) matrix.set(x, y, 0xff);
        const obstacles = Game.rooms[roomName]
          .find(FIND_STRUCTURES)
          .filter(
            (s) =>
              s.hits > 5000 &&
              (s.structureType === STRUCTURE_WALL ||
                s.structureType === STRUCTURE_RAMPART)
          );
        _.forEach(obstacles, (s) => matrix.set(s.pos.x, s.pos.y, 0xff));
        return matrix;
      },
    };
  }

  public wasBreached(pos: RoomPosition, defPos: RoomPosition = this.pos) {
    const path = pos.findPathTo(defPos, this.opt);
    const firstStep = path.shift();
    const lastStep = path.pop();
    if (!firstStep || !lastStep)
      return (
        pos.isNearTo(defPos) &&
        !pos
          .lookFor(LOOK_STRUCTURES)
          .filter(
            (s) =>
              s.hits > 5000 &&
              (s.structureType === STRUCTURE_WALL ||
                s.structureType === STRUCTURE_RAMPART)
          ).length
      );
    const endOfPath = new RoomPosition(lastStep.x, lastStep.y, pos.roomName);
    const startOfPath = new RoomPosition(
      firstStep.x,
      firstStep.y,
      pos.roomName
    );
    return (
      startOfPath.isNearTo(pos) &&
      endOfPath.isNearTo(defPos) &&
      !endOfPath
        .lookFor(LOOK_STRUCTURES)
        .filter(
          (s) =>
            s.hits > 5000 &&
            (s.structureType === STRUCTURE_WALL ||
              s.structureType === STRUCTURE_RAMPART)
        ).length
    );
  }

  public setDefFlag(pos: RoomPosition, flag?: Flag) {
    let ans: string | ERR_NAME_EXISTS | ERR_INVALID_ARGS = ERR_INVALID_ARGS;
    const terrain = Game.map.getRoomTerrain(pos.roomName);
    const centerPoss = new RoomPosition(25, 25, pos.roomName).getOpenPositions(
      true,
      3
    );
    if (centerPoss.length) {
      for (let i = 0; i < centerPoss.length; ++i)
        if (
          terrain.get(centerPoss[i].x, centerPoss[i].y) !== TERRAIN_MASK_SWAMP
        ) {
          pos = centerPoss[i];
          break;
        }
      if (!pos) pos = centerPoss[0];
    } else if (pos.enteranceToRoom) {
      const poss = pos.getOpenPositions(true);
      if (poss.length)
        pos = poss.reduce((prev, curr) => (prev.enteranceToRoom ? curr : prev));
    }

    if (flag) {
      return flag.setPosition(pos);
    } else
      ans = pos.createFlag(prefix.defSwarm + makeId(4), COLOR_RED, COLOR_BLUE);
    if (typeof ans === "string") {
      if (this.hive.phase)
        Game.flags[ans].memory = {
          hive: (this.hive.bassboost || this.hive).roomName,
        };
      const order = new FlagOrder(Game.flags[ans]);
      order.update();
    }
    return ans;
  }

  public notDef(roomName: string) {
    return (
      !Apiary.defenseSwarms[roomName] &&
      !_.filter(
        Game.rooms[roomName].find(FIND_FLAGS),
        (f) => f.color === COLOR_RED
      ).length
    );
  }

  public getDmgAtPos(pos: RoomPosition) {
    const str = pos.to_str;
    if (this.dmgAtPos[str]) return this.dmgAtPos[str];
    const myStats = Apiary.intel.getComplexMyStats(pos); // my stats toward a point
    let towerDmg = 0;
    _.forEach(this.towers, (tower) => {
      towerDmg += towerCoef(tower, pos) * TOWER_POWER_ATTACK;
    });
    this.dmgAtPos[str] = towerDmg + myStats.current.dmgClose;
    return this.dmgAtPos[str];
  }

  public getEnemy() {
    let enemy = Apiary.intel.getEnemy(this)!;
    if (!enemy) return;

    const roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    _.forEach(roomInfo.enemies, (e) => {
      const statsE = Apiary.intel.getComplexStats(e.object).current;
      const statsEnemy = Apiary.intel.getComplexStats(enemy).current;
      if (
        this.getDmgAtPos(e.object.pos) - statsE.heal - statsE.resist >
        this.getDmgAtPos(enemy.pos) - statsEnemy.heal - statsEnemy.resist
      )
        enemy = e.object;
    });
    return enemy;
  }

  public run() {
    const roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);

    let healTargets: (Creep | PowerCreep)[] = [];
    const prepareHeal = (
      master: { activeBees: Bee[] } | undefined,
      nonclose = roomInfo.dangerlvlmax >= 4
    ) => {
      if (healTargets.length || !master) return;
      healTargets = master.activeBees
        .filter(
          (b) =>
            b.hits < b.hitsMax &&
            b.pos.roomName === this.hive.roomName &&
            (nonclose || b.pos.getRangeTo(this) < 10)
        )
        .map((b) => b.creep);
    };
    prepareHeal(this.master);
    if (this.hive.cells.power && !healTargets.length) {
      const powerManager = this.hive.cells.power.powerManagerBee;
      if (
        powerManager &&
        powerManager.hits < powerManager.hitsMax &&
        powerManager.pos.roomName === this.hive.roomName
      )
        healTargets = [powerManager.creep];
    }
    prepareHeal(this.hive.cells.storage && this.hive.cells.storage.master);
    prepareHeal(this.hive.builder, true);
    prepareHeal(this.hive.cells.excavation.master);
    prepareHeal(this.hive.cells.dev && this.hive.cells.dev.master);
    prepareHeal(this.hive.puller);

    let healTarget: Creep | PowerCreep | undefined;
    let toHeal = 0;
    if (healTargets.length) {
      healTarget = healTargets.reduce((prev, curr) =>
        curr.hitsMax - curr.hits > prev.hitsMax - prev.hits ? curr : prev
      );
      toHeal = healTarget.hitsMax - healTarget.hits;
    }

    if (roomInfo.enemies.length && Game.time > roomInfo.safeModeEndTime) {
      if (this.isBreached && Object.keys(this.hive.cells.spawn).length) {
        // (this.hive.controller.level >= 6   || (Object.keys(this.hive.cells.spawn).length && _.filter(Apiary.hives, h => Object.keys(h.cells.spawn.spawns).length).length <= 1))
        const contr = this.hive.controller;
        if (
          contr.safeModeAvailable &&
          !contr.safeModeCooldown &&
          !contr.safeMode
        )
          contr.activateSafeMode(); // red button
      }

      const enemy = this.getEnemy()!;
      if (!enemy) return;

      let shouldAttack = false;
      const stats = Apiary.intel.getComplexStats(enemy).current;
      const attackPower = this.getDmgAtPos(enemy.pos);
      if (
        (stats.heal + Math.min(stats.resist, stats.heal * (1 / 0.3 - 1)) <
          attackPower ||
          !stats.heal ||
          stats.hits <= attackPower) && // || (stats.resist && stats.resist < attackPower
        (roomInfo.dangerlvlmax < 8 ||
          (enemy.pos.x > 2 &&
            enemy.pos.x < 47 &&
            enemy.pos.y > 2 &&
            enemy.pos.y < 47) ||
          this.master.activeBees.filter((b) => b.pos.getRangeTo(enemy) < 2)
            .length ||
          stats.hits <= attackPower ||
          (!stats.heal && !enemy.pos.enteranceToRoom))
      )
        shouldAttack = true;

      let workingTower = false;

      if (!healTarget) {
        healTarget = enemy.pos
          .findInRange(FIND_MY_CREEPS, 4)
          .filter((c) => c.hits < c.hitsMax)[0];
        if (healTarget) toHeal = healTarget.hitsMax - healTarget.hits;
      }
      if (healTarget) {
        const deadInfo = Apiary.intel.getComplexStats(healTarget).current;
        if (
          deadInfo.dmgRange + deadInfo.dmgClose >=
          Math.max(
            healTarget.hits,
            HEAL_POWER * Object.keys(this.towers).length
          )
        ) {
          healTarget = undefined;
          toHeal = 0;
        }
      }

      _.forEach(this.towers, (tower) => {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10) return;
        workingTower = true;
        if (shouldAttack) {
          // let toAttack = healer ? healer : enemy;
          // healer = undefined;
          if (tower.attack(enemy) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              "defense_dmg",
              -10,
              RESOURCE_ENERGY
            );
        } else if (
          tower.store.getUsedCapacity(RESOURCE_ENERGY) >=
          tower.store.getCapacity(RESOURCE_ENERGY) * 0.7
        ) {
          if (healTarget && toHeal && tower.heal(healTarget) === OK) {
            toHeal -= towerCoef(tower, healTarget) * TOWER_POWER_HEAL;
            if (Apiary.logger)
              Apiary.logger.addResourceStat(
                this.hive.roomName,
                "defense_heal",
                -10,
                RESOURCE_ENERGY
              );
          }
          if (
            tower.store.getUsedCapacity(RESOURCE_ENERGY) <=
            tower.store.getCapacity(RESOURCE_ENERGY) * 0.75
          )
            return;
          const repairTarget = this.hive.getBuildTarget(
            tower,
            "ignoreConst"
          ) as Structure | undefined;
          if (
            !repairTarget ||
            (repairTarget.structureType !== STRUCTURE_WALL &&
              repairTarget.structureType !== STRUCTURE_RAMPART)
          )
            return;
          if (
            this.hive.builder &&
            (this.hive.builder.activeBees.filter(
              (b) =>
                b.pos.getRangeTo(repairTarget) <= 8 &&
                b.store.getUsedCapacity(RESOURCE_ENERGY)
            ).length ||
              this.hive.builder.activeBees.filter(
                (b) =>
                  b.pos.getRangeTo(repairTarget) <=
                  tower.pos.getRangeTo(repairTarget)
              ).length)
          )
            return;
          if (
            repairTarget &&
            tower.pos.getRangeTo(repairTarget) <= tower.pos.getRangeTo(enemy) &&
            repairTarget.pos.findInRange(FIND_HOSTILE_CREEPS, 3).length &&
            tower.repair(repairTarget) === OK &&
            Apiary.logger
          )
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              "defense_repair",
              -10,
              RESOURCE_ENERGY
            );
        }
      });
      if (!workingTower) this.checkAndDefend(this.pos.roomName);
    } else if (healTarget) {
      _.forEach(this.towers, (tower) => {
        if (
          tower.store.getUsedCapacity(RESOURCE_ENERGY) <
          tower.store.getCapacity(RESOURCE_ENERGY) * 0.7
        )
          return;
        if (healTarget && toHeal && tower.heal(healTarget) === OK) {
          toHeal -= towerCoef(tower, healTarget) * TOWER_POWER_HEAL;
          if (Apiary.logger)
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              "defense_heal",
              -10,
              RESOURCE_ENERGY
            );
        }
      });
    }
  }
}
