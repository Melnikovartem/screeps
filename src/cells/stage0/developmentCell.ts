import { Cell } from "../_Cell";
import { BootstrapMaster } from "../../beeMasters/economy/bootstrap";
import { Traveler } from "Traveler/TravelerModified";

import { hiveStates } from "../../enums";
import { prefix } from "../../enums";
import { makeId } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class DevelopmentCell extends Cell {
  controller: StructureController;
  master: BootstrapMaster;
  shouldRecalc: boolean = true;
  handAddedResources: RoomPosition[] = [];
  addedRooms: string[] = [];
  constructor(hive: Hive) {
    super(hive, prefix.developmentCell + "_" + hive.room.name);
    this.controller = this.hive.controller;
    this.master = new BootstrapMaster(this);
  }

  get pos() {
    return this.hive.controller.pos;
  }

  addResources() {
    this.handAddedResources = [];
    _.forEach([this.hive.roomName].concat(this.hive.annexNames), miningRoom => {
      let room = Game.rooms[miningRoom];
      if (!room)
        return;

      _.forEach(room.find(FIND_DROPPED_RESOURCES), r => {
        if (r.resourceType === RESOURCE_ENERGY)
          this.handAddedResources.push(r.pos);
      });

      _.forEach(room.find(FIND_STRUCTURES), s => {
        if (s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_TERMINAL)
          this.handAddedResources.push(s.pos);
      });
    })
    _.forEach(this.hive.cells.excavation.resourceCells, cell => {
      if (cell.container)
        this.handAddedResources.push(cell.container.pos);
    });
  }

  update() {
    super.update();
    if (this.hive.room.storage && this.hive.room.storage.isActive() && this.hive.phase === 0 && Apiary.useBucket)
      Apiary.destroyTime = Game.time;

    let futureResourceCells = _.filter(Game.flags, f => f.memory.hive === this.hive.roomName && f.color === COLOR_YELLOW && f.secondaryColor === COLOR_YELLOW);
    if (this.hive.controller.level < 4 && Game.time % 100 === 0) {
      _.forEach(futureResourceCells, f => {
        if (!(f.pos.roomName in Game.rooms))
          return
        // if (this.hive.room.energyCapacityAvailable < 400 && !this.hive.bassboost && f.pos.roomName !== this.hive.roomName)
        let route = Traveler.findTravelPath(f.pos, this.hive, {
          offRoad: true, weightOffRoad: 2,
          roomCallback: (roomName, matrix) => {
            let roads = Memory.cache.roomPlanner[roomName] && Memory.cache.roomPlanner[roomName].road;
            if (!roads)
              return;
            _.forEach(roads.pos, p => {
              matrix.set(p.x, p.y, 1);
            });
            return matrix;
          }
        }).path;
        _.forEach(route, r => {
          if (!(r.roomName in Game.rooms))
            return
          let roads = Memory.cache.roomPlanner[r.roomName] && Memory.cache.roomPlanner[r.roomName].road;
          if (roads && roads.pos.filter(p => p.x === r.x && p.y == r.y).length && !r.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length)
            if (!r.lookFor(LOOK_STRUCTURES).length)
              r.createConstructionSite(STRUCTURE_ROAD);
            else if (!r.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED).length)
              r.createFlag("remove_" + makeId(4), COLOR_GREY, COLOR_RED);
        });
      });
      this.hive.shouldRecalc = 2;
    }
  }

  run() {
    if (!this.master.beesAmount && this.hive.phase > 0 && this.hive.state === hiveStates.economy && Apiary.useBucket)
      Apiary.destroyTime = Game.time;
  }
}
