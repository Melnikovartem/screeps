import { Traveler } from "Traveler/TravelerModified";

import { BootstrapMaster } from "../../beeMasters/economy/bootstrap";
import type { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";
import { hiveStates, prefix } from "../../static/enums";
import { makeId } from "../../static/utils";
import { Cell } from "../_Cell";

@profile
export class DevelopmentCell extends Cell {
  controller: StructureController;
  master: BootstrapMaster;
  shouldRecalc: boolean = true;
  handAddedResources: RoomPosition[] = [];
  addedRooms: string[] = [];
  constructor(hive: Hive) {
    super(hive, prefix.developmentCell);
    this.controller = this.hive.controller;
    this.master = new BootstrapMaster(this);
  }

  get pos() {
    return this.hive.controller.pos;
  }

  addResources() {
    this.handAddedResources = [];
    _.forEach(
      [this.hive.roomName].concat(this.hive.annexNames),
      (miningRoom) => {
        const room = Game.rooms[miningRoom];
        if (!room) return;

        _.forEach(room.find(FIND_DROPPED_RESOURCES), (r) => {
          if (r.resourceType === RESOURCE_ENERGY)
            this.handAddedResources.push(r.pos);
        });

        _.forEach(room.find(FIND_STRUCTURES), (s) => {
          if (
            s.structureType === STRUCTURE_STORAGE ||
            s.structureType === STRUCTURE_CONTAINER ||
            s.structureType === STRUCTURE_TERMINAL
          )
            this.handAddedResources.push(s.pos);
        });
      }
    );
    _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
      if (cell.container) this.handAddedResources.push(cell.container.pos);
    });
  }

  update() {
    super.update();
    if (
      this.hive.room.storage &&
      this.hive.room.storage.isActive() &&
      this.hive.phase === 0 &&
      Apiary.useBucket
    )
      Apiary.destroyTime = Game.time;

    const futureResourceCells = _.filter(
      Game.flags,
      (f) =>
        f.memory.hive === this.hive.roomName &&
        f.color === COLOR_YELLOW &&
        f.secondaryColor === COLOR_YELLOW
    );
    if (
      Game.time % 100 === 0 &&
      this.hive.controller.level > 1 &&
      this.hive.state === 0 &&
      this.hive.state === hiveStates.economy &&
      this.master.beesAmount
    ) {
      const addRouteTo = (pos: RoomPosition) => {
        // if (this.hive.room.energyCapacityAvailable < 400 && !this.hive.bassboost && f.pos.roomName !== this.hive.roomName)
        const route = Traveler.findTravelPath(
          pos,
          this.hive.cells.spawn.fastRefPos || this.hive,
          {
            offRoad: true,
            weightOffRoad: 5,
            roomCallback: (roomName, matrix) => {
              const roads =
                Memory.cache.roomPlanner[roomName] &&
                Memory.cache.roomPlanner[roomName].road;
              if (!roads) return;
              _.forEach(roads.pos, (p) => {
                matrix.set(p.x, p.y, 1);
              });
              return matrix;
            },
          }
        ).path;
        let placed = 0;
        _.some(route, (r) => {
          if (!(r.roomName in Game.rooms)) return false;
          const roads =
            Memory.cache.roomPlanner[r.roomName] &&
            Memory.cache.roomPlanner[r.roomName].road;
          if (
            roads &&
            roads.pos.filter((p) => p.x === r.x && p.y == r.y).length
          ) {
            if (
              r
                .lookFor(LOOK_STRUCTURES)
                .filter((s) => s.structureType === STRUCTURE_ROAD).length
            )
              ++placed;
            else if (!r.lookFor(LOOK_STRUCTURES).length) {
              r.createConstructionSite(STRUCTURE_ROAD);
              ++placed;
            } else if (
              !r
                .lookFor(LOOK_FLAGS)
                .filter(
                  (f) =>
                    f.color === COLOR_GREY && f.secondaryColor === COLOR_RED
                ).length
            )
              r.createFlag("remove_" + makeId(4), COLOR_GREY, COLOR_RED);
          }
          return placed > 5;
        });
      };
      _.forEach(futureResourceCells, (f) => addRouteTo(f.pos));
      addRouteTo(this.hive.controller.pos);
      this.hive.shouldRecalc = 2;
    }
  }

  run() {
    if (
      !this.master.beesAmount &&
      this.hive.phase > 0 &&
      this.hive.state === hiveStates.economy &&
      Apiary.useBucket
    )
      Apiary.destroyTime = Game.time;
  }
}
