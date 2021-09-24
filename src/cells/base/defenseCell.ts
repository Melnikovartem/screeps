import { Cell } from "../_Cell";

import { makeId } from "../../abstract/utils";
import { prefix } from "../../enums";

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

  constructor(hive: Hive) {
    super(hive, prefix.defenseCell + hive.room.name);
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
    this.getNukeDefMap();
  }

  // mini roomPlanner
  getNukeDefMap() {
    this.nukeCoverReady = true;
    if (!this.nukes.length)
      return [];
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
    // todo?? save some of the extensions / not all spawns
    for (let x in map)
      for (let y in map[x]) {
        let pos = new RoomPosition(+x, +y, this.hive.roomName);
        let structures = pos.lookFor(LOOK_STRUCTURES)
        if (structures.filter((s) => CONSTRUCTION_COST[<BuildableStructureConstant>s.structureType] >= 15000).length) {
          let rampart = structures.filter((s) => s.structureType === STRUCTURE_RAMPART)[0];
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
      if (roomInfo.dangerlvlmax > 1) {
        let enemy = roomInfo.enemies[0].object;
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
    if (pos.getEnteranceToRoom())
      pos = pos.getOpenPositions(true).reduce((prev, curr) => curr.getEnteranceToRoom() ? prev : curr);
    if (powerfull)
      ans = pos.createFlag(prefix.def + "D_" + makeId(4), COLOR_RED, COLOR_RED);
    else
      ans = pos.createFlag(prefix.def + makeId(4), COLOR_RED, COLOR_BLUE);
    if (typeof ans === "string")
      Game.flags[ans].memory = { hive: this.hive.roomName };
  }

  notDef(roomName: string) {
    return !Apiary.defenseSwarms[roomName] && !_.filter(Game.rooms[roomName].find(FIND_FLAGS), (f) => f.color === COLOR_RED).length;
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    this.hive.stateChange("battle", roomInfo.dangerlvlmax > 5);
    if (roomInfo.enemies.length) {
      roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      if (roomInfo.enemies.length > 0) {
        // for now i will just sit back ...
        if (roomInfo.dangerlvlmax === 5 && this.notDef(this.hive.roomName))
          this.createDefFlag(roomInfo.enemies[0].object.pos, true);

        if (!_.filter(this.towers, (t) => t.store.getUsedCapacity(RESOURCE_ENERGY) >= 10).length) {
          if (roomInfo.dangerlvlmax < 5
            || _.filter(Game.rooms[this.hive.roomName].find(FIND_FLAGS), (f) => f.color === COLOR_RED && f.secondaryColor === COLOR_WHITE).length)
            this.checkOrDefendSwarms(this.hive.roomName);
          else
            this.hive.room.controller!.activateSafeMode(); // red button
        } else {
          _.forEach(this.towers, (tower) => {
            let closest = Apiary.intel.getEnemy(tower)!;
            if (roomInfo.dangerlvlmax < 6) {
              if (closest.pos.getRangeTo(tower) < 10 || closest.pos.getRangeTo(this.hive.pos) < 5
                || closest instanceof Creep && closest.owner.username === "Invader")
                tower.attack(closest);
            } else {
              let target = <Structure | undefined>this.hive.findProject(closest, "constructions");
              if (target)
                tower.repair(target);
            }
          });
        }
      }
    }
  }
}
