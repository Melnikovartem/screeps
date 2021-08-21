import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { Order } from "../../order";
import { profile } from "../../profiler/decorator";
import { makeId } from "../../utils";

@profile
export class defenseCell extends Cell {
  towers: { [id: string]: StructureTower } = {};

  constructor(hive: Hive) {
    super(hive, "DefenseCell_" + hive.room.name);
  }

  update() {
    super.update();

    _.forEach(this.hive.annexNames, (h) => this.checkOrDefendSwarms(h));

    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      _.forEach(this.towers, (tower) => {
        if (tower.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= tower.store[RESOURCE_ENERGY])
          storageCell!.requestFromStorage(tower.id, tower, 0);
        else if (tower.store.getCapacity(RESOURCE_ENERGY) > tower.store[RESOURCE_ENERGY])
          storageCell!.requestFromStorage(tower.id, tower, 4);
      });
    }
  }

  checkOrDefendSwarms(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 10);
      if (roomInfo.enemies.length > 0 && !Apiary.defenseSwarms[roomName]
        && _.filter(Game.rooms[roomName].find(FIND_FLAGS), (f) => f.color == COLOR_RED).length == 0) {
        let freeSwarms: Order[] = [];
        for (const roomDefName in Apiary.defenseSwarms) {
          let roomInfDef = Apiary.intel.getInfo(roomDefName, 10);
          if (roomInfDef.safePlace && Apiary.defenseSwarms[roomDefName].master)
            freeSwarms.push(Apiary.defenseSwarms[roomDefName])
        }
        let ans: number | string | undefined;
        if (freeSwarms.length) {
          freeSwarms.sort((a, b) => a.pos.getRoomRangeTo(Game.rooms[roomName]) - b.pos.getRoomRangeTo(Game.rooms[roomName]))
          if (freeSwarms[0].pos.getRoomRangeTo(Game.rooms[roomName]) < 5) {
            ans = freeSwarms[0].flag.setPosition(roomInfo.enemies[0].pos);
            if (ans == OK) {
              Apiary.defenseSwarms[roomName] = freeSwarms[0];
              delete Apiary.defenseSwarms[freeSwarms[0].pos.roomName];
            }
          }
        }
        if (ans != OK) {
          if (roomInfo.enemies[0] instanceof Creep && roomInfo.enemies[0].owner.username == "Invader")
            ans = roomInfo.enemies[0].pos.createFlag("def_" + makeId(4), COLOR_RED, COLOR_BLUE);
          else
            ans = roomInfo.enemies[0].pos.createFlag("def_D_" + makeId(4), COLOR_RED, COLOR_RED);
          if (typeof ans == "string")
            Game.flags[ans].memory = { hive: this.hive.roomName };
        }
      }
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    if (roomInfo.enemies.length) {
      roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      if (roomInfo.enemies.length > 0) {
        if (_.filter(this.towers, (t) => t.store[RESOURCE_ENERGY] > 0).length == 0) {
          if (this.hive.stage < 2)
            this.checkOrDefendSwarms(this.hive.roomName);
          else
            this.hive.room.controller!.activateSafeMode(); // red button
        } else
          _.forEach(this.towers, (tower) => {
            let closest = tower.pos.findClosestByRange(roomInfo!.enemies);
            if (closest && (closest.pos.getRangeTo(tower) < 15 || closest.pos.getRangeTo(this.hive.pos) < 5
              || (closest instanceof Creep && closest.owner.username == "Invader")))
              tower.attack(closest);
          });
      }
    }
  }
}
