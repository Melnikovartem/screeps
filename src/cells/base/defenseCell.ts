import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";
import type { Order } from "../../order";
import { profile } from "../../profiler/decorator";
import { makeId } from "../../abstract/utils";

@profile
export class defenseCell extends Cell {
  towers: { [id: string]: StructureTower } = {};
  nukes: RoomPosition[] = [];
  nukesDefenseMap = {};

  constructor(hive: Hive) {
    super(hive, "DefenseCell_" + hive.room.name);
  }

  update() {
    super.update(["towers"]);

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
      if (!roomInfo.safePlace) {
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
            if ((enemy instanceof Creep && enemy.owner.username === "Invader")
              || enemy instanceof StructureInvaderCore)
              this.createDefFlag(enemy.pos);
            else if (enemy instanceof Creep)
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
            if (closest && (closest.pos.getRangeTo(tower) < 15 || closest.pos.getRangeTo(this.hive.pos) < 5
              || (closest instanceof Creep && closest.owner.username === "Invader")))
              tower.attack(closest);
          });
        }
      }
    }
  }
}
