import { Cell } from "../_Cell";

import { makeId } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Hive, BuildProject } from "../../Hive";
import type { Order } from "../../order";

@profile
export class DefenseCell extends Cell {
  towers: { [id: string]: StructureTower } = {};
  nukes: RoomPosition[] = [];
  nukesDefenseMap = {};
  timeToLand: number = Infinity;

  constructor(hive: Hive) {
    super(hive, "DefenseCell_" + hive.room.name);
    this.updateNukes();
  }

  updateNukes() {
    this.nukes = [];
    _.forEach(this.hive.room.find(FIND_NUKES), (n) => {
      this.nukes.push(n.pos);
      if (this.timeToLand > n.timeToLand)
        this.timeToLand = n.timeToLand;
    });
    if (!this.nukes.length)
      this.timeToLand = Infinity;
  }

  // mini roomPlanner
  getNukeDefMap() {
    if (!this.nukes.length)
      return { pos: [], sum: 0 };
    let map: { [id: number]: { [id: number]: number } } = {};
    _.forEach(this.nukes, (pp) => {
      let poss = pp.getPositionsInRange(2);
      _.forEach(poss, (p) => {
        if (!map[p.x])
          map[p.x] = {};
        if (!map[p.x][p.y])
          map[p.x][p.y] = 10000;
        map[p.x][p.y] += 5000000;
      });
      map[pp.x][pp.y] += 10000000;
    });

    let ans: BuildProject[] = [];
    let sum = 0;
    // todo?? save some of the extensions / not all spawns
    for (let x in map)
      for (let y in map[x]) {
        let pos = new RoomPosition(+x, +y, this.hive.roomName);
        let structures = pos.lookFor(LOOK_STRUCTURES)
        if (structures.filter((s) => CONSTRUCTION_COST[<BuildableStructureConstant>s.structureType] >= 15000).length) {
          ans.push({
            pos: pos,
            sType: STRUCTURE_RAMPART,
            targetHits: map[x][y],
          });
          let rampart = structures.filter((s) => s.structureType === STRUCTURE_RAMPART)[0];
          if (rampart)
            sum += Math.max(map[x][y] - rampart.hits, 0) / 100;
          else {
            sum += map[x][y] / 100;
            if (!pos.lookFor(LOOK_CONSTRUCTION_SITES).length)
              pos.createConstructionSite(STRUCTURE_RAMPART);
          }
        }
      }
    return { pos: ans, sum: sum };
  }

  update() {
    super.update(["towers"]);

    if (Game.time % 500 === 333)
      this.updateNukes();
    if (this.timeToLand-- < 0)
      this.updateNukes();
    this.hive.stateChange("nukealert", !!this.nukes.length);

    _.forEach(this.hive.annexNames, (h) => this.checkOrDefendSwarms(h));

    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      _.forEach(this.towers, (tower) => {
        if (tower.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= tower.store.getUsedCapacity(RESOURCE_ENERGY))
          storageCell!.requestFromStorage("tower_" + tower.id, tower, 1, RESOURCE_ENERGY, 1000);
        else if (tower.store.getCapacity(RESOURCE_ENERGY) > tower.store.getUsedCapacity(RESOURCE_ENERGY))
          storageCell!.requestFromStorage("tower_" + tower.id, tower, 3, RESOURCE_ENERGY, 1000);
      });
    }
  }

  checkOrDefendSwarms(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 25);
      if (roomInfo.dangerlvlmax > 2) {
        let enemy = roomInfo.enemies[0].object;
        let [x, y] = enemy.pos.getRoomCoorinates();
        if ((4 <= x && x <= 6 && 4 <= y && y <= 6) && enemy instanceof Creep && enemy.owner.username === "Source Keeper")
          return;
        if (enemy instanceof Creep && enemy.getBodyParts(ATTACK) + enemy.getBodyParts(RANGED_ATTACK) + enemy.getBodyParts(HEAL) === 0)
          return;
        if (this.notDef(roomName)) {
          let pos = enemy.pos.getOpenPositions(true).filter((p) => !p.getEnteranceToRoom())[0];
          if (!pos)
            pos = enemy.pos;
          let freeSwarms: Order[] = [];
          for (const roomDefName in Apiary.defenseSwarms) {
            let roomInfDef = Apiary.intel.getInfo(roomDefName, 10);
            if (roomInfDef.safePlace && Apiary.defenseSwarms[roomDefName].master
              && _.filter(Apiary.defenseSwarms[roomDefName].master!.bees, (bee) => bee.hits >= bee.hitsMax * 0.5).length > 0)
              freeSwarms.push(Apiary.defenseSwarms[roomDefName]);
          }
          let ans: number | string | undefined;
          if (freeSwarms.length) {
            let swarm = freeSwarms.reduce((prev, curr) =>
              prev.pos.getRoomRangeTo(Game.rooms[roomName]) > curr.pos.getRoomRangeTo(Game.rooms[roomName]) ? curr : prev);
            if (swarm.pos.getRoomRangeTo(Game.rooms[roomName], true) < 5) {
              ans = swarm.flag.setPosition(enemy.pos);
              if (ans === OK) {
                Apiary.defenseSwarms[roomName] = swarm;
                delete Apiary.defenseSwarms[swarm.pos.roomName];
              }
            }
          }
          if (ans !== OK) {
            if (roomInfo.dangerlvlmax < 6)
              this.createDefFlag(enemy.pos);
            else
              this.createDefFlag(enemy.pos, true);
          }
        }
      }
    }
  }

  createDefFlag(pos: RoomPosition, powerfull: boolean = false) {
    let ans;
    if (powerfull)
      ans = pos.createFlag("def_D_" + makeId(4), COLOR_RED, COLOR_RED);
    else
      ans = pos.createFlag("def_" + makeId(4), COLOR_RED, COLOR_BLUE);
    if (typeof ans === "string")
      Game.flags[ans].memory = { hive: this.hive.roomName };
  }

  notDef(roomName: string) {
    return !Apiary.defenseSwarms[roomName] && !_.filter(Game.rooms[roomName].find(FIND_FLAGS), (f) => f.color === COLOR_RED).length;
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    this.hive.stateChange("war", roomInfo.dangerlvlmax > 6);
    if (roomInfo.enemies.length) {
      roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      if (roomInfo.enemies.length > 0) {
        if (roomInfo.dangerlvlmax > 6 && this.notDef(this.hive.roomName))
          this.createDefFlag(roomInfo.enemies[0].object.pos, true);

        if (!_.filter(this.towers, (t) => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0).length) {
          if (this.hive.stage < 2)
            this.checkOrDefendSwarms(this.hive.roomName);
          else
            this.hive.room.controller!.activateSafeMode(); // red button
        } else {
          let enemies = _.map(roomInfo.enemies, (e) => e.object);
          _.forEach(this.towers, (tower) => {
            let closest = tower.pos.findClosestByRange(enemies);
            if (closest && (closest.pos.getRangeTo(tower) < 8 || closest.pos.getRangeTo(this.hive.pos) < 5
              || (closest instanceof Creep && closest.owner.username === "Invader")))
              tower.attack(closest);
          });
        }
      }
    }
  }
}
