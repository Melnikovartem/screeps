import { Cell } from "../_Cell";
import { BootstrapMaster } from "../../beeMasters/economy/bootstrap";

import { hiveStates } from "../../enums";
import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class DevelopmentCell extends Cell {
  controller: StructureController;
  master: BootstrapMaster;
  shouldRecalc: boolean = true;
  handAddedResources: RoomPosition[] = [];
  addedRooms: string[] = [];
  pos: RoomPosition;

  constructor(hive: Hive) {
    super(hive, prefix.developmentCell + hive.room.name);
    this.controller = this.hive.room.controller!;
    this.master = new BootstrapMaster(this);
    this.pos = this.hive.room.controller ? this.hive.room.controller.pos : this.hive.rest;

    _.forEach(this.hive.room.find(FIND_DROPPED_RESOURCES), r => {
      if (r.resourceType === RESOURCE_ENERGY)
        this.handAddedResources.push(r.pos);
    });

    _.forEach(this.hive.room.find(FIND_STRUCTURES), s => {
      if (s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_TERMINAL)
        this.handAddedResources.push(s.pos);
    });
  }

  addRoom(room: Room) {
    _.forEach(room.find(FIND_DROPPED_RESOURCES), r => {
      if (r.resourceType === RESOURCE_ENERGY)
        this.handAddedResources.push(r.pos);
    });

    _.forEach(room.find(FIND_STRUCTURES), s => {
      if (s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER)
        this.handAddedResources.push(s.pos);
    });
  }

  update() {
    super.update();
    if (this.hive.room.storage && this.hive.room.storage.isActive() && this.hive.phase === 0 && Apiary.useBucket)
      Apiary.destroyTime = Game.time;
  }

  run() {
    if (!this.master.beesAmount && this.hive.phase > 0 && this.hive.state === hiveStates.economy && Apiary.useBucket)
      Apiary.destroyTime = Game.time;
  }
}
