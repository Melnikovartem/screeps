import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { Order } from "../../order";
import { profile } from "../../profiler/decorator";
import { makeId } from "../../utils";

@profile
export class defenseCell extends Cell {
  towers: StructureTower[] = [];
  defenseSwarms: { [id: string]: string } = {};

  constructor(hive: Hive) {
    super(hive, "DefenseCell_" + hive.room.name);
  }

  update() {
    super.update();

    for (const key in this.defenseSwarms)
      if (!Apiary.orders[this.defenseSwarms[key]])
        delete this.defenseSwarms[key];

    if (this.time == Game.time) {
      _.forEach(_.filter(Apiary.orders, (o) => (/^defend_/.exec(o.ref) != null && o.hive == this.hive)), (o) => {
        this.defenseSwarms[o.pos.roomName] = o.ref;
      });
    }

    _.forEach(this.hive.annexNames, this.checkOrDefendSwarms);

    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      storageCell.requestFromStorage(this.ref,
        _.filter(this.towers, (tower) => tower.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= tower.store[RESOURCE_ENERGY]), 0);
      storageCell.requestFromStorage(this.ref,
        _.filter(this.towers, (tower) => tower.store.getCapacity(RESOURCE_ENERGY) > tower.store[RESOURCE_ENERGY]), 0);
    }
  };

  checkOrDefendSwarms(roomName: string) {
    if (roomName in Game.rooms) {
      let roomInfo = Apiary.intel.getInfo(roomName, 10);
      if (roomInfo.enemies.length > 0 && !this.defenseSwarms[roomName]
        && _.filter(Game.rooms[roomName].find(FIND_FLAGS), (f) => f.color == COLOR_RED).length == 0) {
        let freeSwarms: Order[] = [];
        for (const roomDefName in this.defenseSwarms) {
          let roomInfDef = Apiary.intel.getInfo(roomDefName, 10);
          if (roomInfDef.safePlace)
            freeSwarms.push(Apiary.orders[this.defenseSwarms[roomDefName]])
        }
        let ans: number | string | undefined;
        if (freeSwarms.length) {
          freeSwarms.sort((a, b) => a.pos.getRoomRangeTo(Game.rooms[roomName]) - b.pos.getRoomRangeTo(Game.rooms[roomName]))
          ans = freeSwarms[0].flag.setPosition(roomInfo.enemies[0].pos);
          if (ans == OK) {
            this.defenseSwarms[roomName] = freeSwarms[0].ref;
            delete this.defenseSwarms[freeSwarms[0].pos.roomName];
          }
        }
        if (ans != OK) {
          ans = roomInfo.enemies[0].pos.createFlag("defend_" + makeId(5), COLOR_RED, COLOR_BLUE);
          if (typeof ans == "string")
            this.defenseSwarms[roomName] = ans;
        }
      }
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    if (!roomInfo.safePlace) {
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
            if (closest && (tower.pos.getRangeTo(closest) < 15 || (closest instanceof Creep && closest.owner.username == "Invader")))
              tower.attack(closest);
          });
      }
    }
  };
}
