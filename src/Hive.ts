import { Cell } from "./cells/_Cell";
import { respawnCell } from "./cells/base/respawnCell";
import { defenseCell } from "./cells/base/defenseCell";

import { developmentCell } from "./cells/stage0/developmentCell";

import { storageCell } from "./cells/stage1/storageCell";
import { upgradeCell } from "./cells/stage1/upgradeCell";
import { excavationCell } from "./cells/stage1/excavationCell";
import { laboratoryCell } from "./cells/stage1/laboratoryCell";

import { builderMaster } from "./beeMasters/economy/builder";

import { safeWrap } from "./utils";
import { profile } from "./profiler/decorator";
import { UPDATE_EACH_TICK } from "./settings";

import { CreepSetup } from "./creepSetups";

export interface SpawnOrder {
  amount: number;
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // how urgent is this creep
  master?: string;
}

interface hiveCells {
  storage?: storageCell;
  defense: defenseCell;
  spawn: respawnCell;
  upgrade?: upgradeCell;
  excavation?: excavationCell;
  dev?: developmentCell;
  lab?: laboratoryCell;
}

@profile
class repairSheet {
  [STRUCTURE_RAMPART]: number = 200000;
  [STRUCTURE_WALL]: number = 200000;
  other: number = 1;
  collapse: number = 0.75;
  road_collapse: number = 0.5;

  constructor(hiveStage: 0 | 1 | 2) {
    if (hiveStage == 0) {
      this[STRUCTURE_RAMPART] = 20000;
      this[STRUCTURE_WALL] = 20000;
      this.other = 0.7;
      this.collapse = 0.5;
    } else if (hiveStage == 2) {
      this[STRUCTURE_RAMPART] = 2000000;
      this[STRUCTURE_WALL] = 2000000;
      this.other = 1;
      this.collapse = 0.86;
      this.road_collapse = 0.25;
    }
  }

  getHits(structure: Structure): number {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return this[structure.structureType];
      }
      case STRUCTURE_ROAD: {
        return structure.hits < structure.hitsMax * this.other * this.road_collapse ? structure.hits : 0;
      }
      default: {
        return structure.hitsMax * this.other;
      }
    }
  }

  isAnEmergency(structure: Structure): boolean {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return structure.hits < this[structure.structureType] * this.collapse;
      }
      case STRUCTURE_ROAD: {
        return structure.hits < structure.hitsMax * this.other * this.road_collapse;
      }
      default: {
        return structure.hits < structure.hitsMax * this.other * this.collapse;
      }
    }
  }

  isAnRepairCase(structure: Structure): boolean {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return structure.hits < this[structure.structureType];
      }
      case STRUCTURE_ROAD: {
        return false;
      }
      default: {
        return structure.hits < structure.hitsMax * this.other;
      }
    }
  }
}

@profile
export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  roomName: string;
  annexNames: string[] = [];

  room: Room;
  annexes: Room[] = []; // this room and annexes
  rooms: Room[] = []; //this room and annexes
  cells: hiveCells;
  repairSheet: repairSheet;

  spawOrders: { [id: string]: SpawnOrder } = {};

  // some structures (aka preprocess of filters)
  constructionSites: ConstructionSite[] = [];
  emergencyRepairs: Structure[] = [];
  normalRepairs: Structure[] = [];
  sumRepairs: number = 0;

  builder?: builderMaster;

  pos: RoomPosition; // aka idle pos for creeps

  stage: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: boolean;
  bassboost: Hive | null = null;

  // help grow creeps from other colony

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];
    this.pos = this.room.controller!.pos;

    this.stage = 0;
    if (this.room.storage)
      this.stage = 1;

    if (this.stage == 1 && this.room.controller!.level == 8)
      this.stage = 2;

    // create your own fun hive with this cool brand new cells
    this.cells = {
      spawn: new respawnCell(this),
      defense: new defenseCell(this),
    };

    if (this.stage == 0)
      this.cells.dev = new developmentCell(this);
    else {
      this.cells.storage = new storageCell(this, this.room.storage!);
      this.cells.upgrade = new upgradeCell(this, this.room.controller!);
      this.cells.excavation = new excavationCell(this);
      this.cells.lab = new laboratoryCell(this);

      this.builder = new builderMaster(this);
      if (this.stage == 2) {
        // TODO cause i haven' reached yet
      }
    }

    //look for new structures for those wich need them
    this.updateCellData();
    this.repairSheet = new repairSheet(this.stage);
    this.shouldRecalc = true;

    if (Apiary.logger)
      Apiary.logger.initHive(this.roomName);
  }

  addAnex(annexName: string) {
    if (!this.annexNames.includes(annexName))
      this.annexNames.push(annexName);
    if (annexName in Game.rooms) {
      this.shouldRecalc = true;
      return OK;
    } else
      return ERR_NOT_FOUND;
  }

  updateRooms(): void {
    this.room = Game.rooms[this.roomName];
    this.annexes = <Room[]>_.compact(_.map(this.annexNames, (annexName) => {
      let annex = Game.rooms[annexName];
      return annex;
    }));
    this.rooms = [this.room].concat(this.annexes);
  }

  // actually needs to be done only once, but well couple times each reboot is not worst scenario
  markResources() {
    _.forEach(this.rooms, (room) => {
      _.forEach(room.find(FIND_SOURCES), (s) => {
        if (!Game.flags["mine_" + s.id]) {
          let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_YELLOW);
          if (typeof flag == "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });

    _.forEach(this.room.find(FIND_MINERALS), (s) => {
      if (!Game.flags["mine_" + s.id]) {
        let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_CYAN);
        if (typeof flag == "string")
          Game.flags[flag].memory.hive = this.roomName;
      }
    });
  }

  private updateCellData() {
    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (this.updateCellStructure(structure, this.cells.spawn.extensions, STRUCTURE_EXTENSION) == ERR_INVALID_ARGS)
        if (this.updateCellStructure(structure, this.cells.spawn.spawns, STRUCTURE_SPAWN) == ERR_INVALID_ARGS)
          if (this.updateCellStructure(structure, this.cells.defense.towers, STRUCTURE_TOWER) == ERR_INVALID_ARGS)
            if (this.updateCellStructure(structure, this.cells.lab && this.cells.lab.laboratories, STRUCTURE_LAB) == ERR_INVALID_ARGS)
              void (0);
    });
  }

  private updateCellStructure<S extends Structure>(structure: Structure, structureMap: { [id: string]: S } | undefined, type: StructureConstant) {
    if (structureMap)
      if (type == structure.structureType) {
        if (structure.isActive())
          structureMap[structure.id] = <S>structure;
        else
          delete structureMap[structure.id];
        return OK;
      }
    return ERR_INVALID_ARGS;
  }

  private updateConstructionSites(rooms?: Room[]) {
    this.constructionSites = [];
    _.forEach(rooms ? rooms : this.rooms, (room) => {
      let roomInfo = Apiary.intel.getInfo(room.name, 10);
      if (roomInfo.safePlace)
        this.constructionSites = this.constructionSites.concat(_.filter(room.find(FIND_CONSTRUCTION_SITES), (site) => site.my));
    });
  }

  private updateRepairs() {
    this.normalRepairs = [];
    this.emergencyRepairs = [];
    this.sumRepairs = 0;
    _.forEach(this.room.find(FIND_STRUCTURES), (structure) => {
      if (structure.hitsMax > structure.hits)
        this.sumRepairs += Math.max(0, this.repairSheet.getHits(structure) - structure.hits);
      if (this.repairSheet.isAnEmergency(structure))
        this.emergencyRepairs.push(structure);
      else if (this.repairSheet.isAnRepairCase(structure))
        this.normalRepairs.push(structure);
    });
    _.forEach(this.annexes, (room) => {
      let roomInfo = Apiary.intel.getInfo(room.name, 10);
      if (roomInfo.safePlace)
        _.forEach(room.find(FIND_STRUCTURES), (structure) => {
          if (structure.structureType == STRUCTURE_ROAD || structure.structureType == STRUCTURE_CONTAINER) {
            this.sumRepairs += Math.max(0, this.repairSheet.getHits(structure) - structure.hits);
            if (this.repairSheet.isAnEmergency(structure))
              this.emergencyRepairs.push(structure);
            else if (this.repairSheet.isAnRepairCase(structure))
              this.normalRepairs.push(structure);
          }
        });
    });
    this.sumRepairs = Math.floor(this.sumRepairs / 100);
  }

  update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];
    if (UPDATE_EACH_TICK || Game.time % 10 == 8 || this.shouldRecalc) {
      this.updateRooms();
      this.updateConstructionSites();
      if (UPDATE_EACH_TICK || Game.time % 30 == 8 || this.shouldRecalc)
        this.updateRepairs(); // cause costly
      if (this.shouldRecalc) {
        this.markResources();
        this.shouldRecalc = false;
      }
    }

    if (Game.time % 100 == 29)
      this.updateCellData();
    if (Apiary.logger)
      Apiary.logger.hiveLog(this);

    if (UPDATE_EACH_TICK)
      _.forEach(this.cells, (cell) => { Cell.prototype.update.call(cell); });

    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.update(), cell.print + " update");
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.run(), cell.print + " run");
    });
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>${this.stage} ["${this.roomName}"]</a>`;
  }
}
