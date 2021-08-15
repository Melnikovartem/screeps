import { Cell } from "./cells/_Cell";
import { respawnCell } from "./cells/base/respawnCell";
import { defenseCell } from "./cells/base/defenseCell";
import { laboratoryCell } from "./cells/base/laboratoryCell";

import { developmentCell } from "./cells/stage0/developmentCell";

import { storageCell } from "./cells/stage1/storageCell";
import { upgradeCell } from "./cells/stage1/upgradeCell";
import { excavationCell } from "./cells/stage1/excavationCell";

import { builderMaster } from "./beeMaster/civil/builder";
import { annexMaster } from "./beeMaster/civil/annexer";
import { puppetMaster } from "./beeMaster/civil/puppet";


import { safeWrap } from "./utils";
import { profile } from "./profiler/decorator";
import { UPDATE_EACH_TICK, LOGGING_CYCLE } from "./settings";

import { CreepSetup } from "./creepSetups";

export interface SpawnOrder {
  master: string;
  amount: number;
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // how urgent is this creep
}

interface hiveCells {
  storage?: storageCell;
  defense: defenseCell;
  spawn: respawnCell;
  lab: laboratoryCell;
  upgrade?: upgradeCell;
  excavation?: excavationCell;
  dev?: developmentCell;
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

  orderList: SpawnOrder[] = [];

  // some structures (aka preprocess of filters)
  constructionSites: ConstructionSite[] = [];
  emergencyRepairs: Structure[] = [];
  normalRepairs: Structure[] = [];

  builder?: builderMaster;
  claimers: annexMaster[] = [];
  puppets: puppetMaster[] = [];

  pos: RoomPosition; // aka idle pos for creeps

  stage: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];
    this.pos = this.room.controller!.pos;

    this.stage = 0;
    if (this.room.storage)
      this.stage = 1;

    if (this.room.controller!.level == 8)
      this.stage = 2;

    // create your own fun hive with this cool brand new cells
    this.cells = {
      lab: new laboratoryCell(this),
      spawn: new respawnCell(this),
      defense: new defenseCell(this),
    };

    if (this.stage == 0)
      this.cells.dev = new developmentCell(this, this.room.controller!, this.room.find(FIND_SOURCES));
    else {
      this.cells.storage = new storageCell(this, this.room.storage!);
      this.cells.upgrade = new upgradeCell(this, this.room.controller!);
      this.cells.excavation = new excavationCell(this, this.room.find(FIND_SOURCES), this.room.find(FIND_MINERALS));
      this.builder = new builderMaster(this);
      if (this.stage == 2) {
        // TODO cause i haven' reached yet
      }
    }

    //look for new structures for those wich need them
    this.updateCellData();

    this.repairSheet = new repairSheet(this.stage);
    this.updateConstructionSites();
    this.updateRepairs();
  }

  addAnex(annexName: string) {
    if (!this.annexNames.includes(annexName)) {
      this.annexNames.push(annexName);
      this.updateRooms();
    }
  }

  updateRooms(): void {
    this.room = Game.rooms[this.roomName];
    this.annexes = <Room[]>_.compact(_.map(this.annexNames, (annexName) => {
      let annex = Game.rooms[annexName];
      if (!annex && !Apiary.masters["masterPuppet_" + annexName])
        this.puppets.push(new puppetMaster(this, annexName));
      else if (annex && annex.controller && this.room.energyCapacityAvailable >= 650
        && !Apiary.masters["masterAnnexer_" + annexName])
        this.claimers.push(new annexMaster(this, annex.controller));
      return annex;
    }));
    this.rooms = [this.room].concat(this.annexes);

    if (this.cells.excavation) {
      _.forEach(this.annexes, (room) => {
        _.forEach(room.find(FIND_SOURCES), (source) => {
          this.cells.excavation!.addResource(source);
        });
      });
    }
  }

  private updateCellData() {
    let extensions = this.cells.spawn.extensions;
    let spawns = this.cells.spawn.spawns;
    let towers = this.cells.defense.towers;
    let laboratories = this.cells.lab.laboratories;

    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (structure instanceof StructureExtension && structure.isActive() && !extensions.includes(structure))
        extensions.push(structure);
      else if (structure instanceof StructureSpawn && structure.isActive() && !spawns.includes(structure))
        spawns.push(structure);
      else if (structure instanceof StructureTower && structure.isActive() && !towers.includes(structure))
        towers.push(structure);
      else if (structure instanceof StructureLab && structure.isActive() && !laboratories.includes(structure))
        laboratories.push(structure);
    });
  }

  private updateConstructionSites() {
    this.constructionSites = [];
    _.forEach(this.rooms, (room) => {
      this.constructionSites = this.constructionSites.concat(_.filter(room.find(FIND_CONSTRUCTION_SITES), (site) => site.my));
    });
  }

  private updateRepairs() {
    this.normalRepairs = [];
    this.emergencyRepairs = [];
    _.forEach(this.room.find(FIND_STRUCTURES), (structure) => {
      if (this.repairSheet.isAnEmergency(structure))
        this.emergencyRepairs.push(structure);
      else if (this.repairSheet.isAnRepairCase(structure))
        this.normalRepairs.push(structure);
    });
    _.forEach(this.annexes, (room) => {
      _.forEach(room.find(FIND_STRUCTURES), (structure) => {
        if (structure.structureType == STRUCTURE_ROAD || structure.structureType == STRUCTURE_CONTAINER)
          if (this.repairSheet.isAnEmergency(structure))
            this.emergencyRepairs.push(structure);
          else if (this.repairSheet.isAnRepairCase(structure))
            this.normalRepairs.push(structure);
      });
    });
  }

  updateLog() {
    if (!Memory.log.hives[this.roomName])
      Memory.log.hives[this.roomName] = {};
    Memory.log.hives[this.roomName][Game.time] = {
      annexNames: this.annexNames,
      constructionSites: this.constructionSites.length,
      emergencyRepairs: this.emergencyRepairs.length,
      normalRepairs: this.normalRepairs.length,
      orderList: _.map(this.orderList, (order) => { return { master: order.master, amount: order.amount, priority: order.priority } }),
    };
  }

  update() {
    if (UPDATE_EACH_TICK || Game.time % 10 == 8) {
      this.updateRooms();
      this.updateConstructionSites();
      if (UPDATE_EACH_TICK || Game.time % 30 == 8)
        this.updateRepairs(); // cause costly
    }

    if (Game.time % 100 == 29)
      this.updateCellData();
    if (Game.time % LOGGING_CYCLE == 0)
      this.updateLog();

    if (UPDATE_EACH_TICK)
      _.forEach(this.cells, (cell) => { Cell.prototype.update.call(cell); });

    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.update(), "update " + cell.ref);
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.run(), "run " + cell.ref);
    });
  }
}
