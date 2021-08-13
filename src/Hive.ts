import { respawnCell } from "./cells/stage0/respawnCell";
import { defenseCell } from "./cells/stage0/defenseCell";
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
  defenseCell: defenseCell;
  respawnCell: respawnCell;
  storageCell?: storageCell;
  upgradeCell?: upgradeCell;
  excavationCell?: excavationCell;
  developmentCell?: developmentCell;
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
    this.updateRooms();

    this.stage = 0
    if (this.room.storage)
      this.stage = 1;

    if (this.room.controller!.level == 8)
      this.stage = 2;

    let sourcesAll: Source[] = [];
    _.forEach(this.rooms, (room) => {
      sourcesAll = sourcesAll.concat(room.find(FIND_SOURCES));
    });

    let minerals = this.room.find(FIND_MINERALS);

    // create your own fun hive with this cool brand new cells
    this.cells = {
      respawnCell: new respawnCell(this),
      defenseCell: new defenseCell(this),
    };

    if (this.stage == 0)
      this.cells.developmentCell = new developmentCell(this, this.room.controller!, sourcesAll);
    else {
      this.cells.storageCell = new storageCell(this, this.room.storage!);
      this.cells.upgradeCell = new upgradeCell(this, this.room.controller!);
      this.cells.excavationCell = new excavationCell(this, sourcesAll, minerals);
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

    let flags = _.filter(this.room.find(FIND_FLAGS), (flag) => flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_CYAN);
    if (flags.length)
      this.pos = flags[0].pos;
    else if (this.cells.storageCell)
      this.pos = this.cells.storageCell.storage.pos;
    else
      this.pos = this.room.controller!.pos;
  }

  addAnex(annexName: string) {
    this.annexNames.push(annexName);

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

    let flags = _.filter(this.room.find(FIND_FLAGS), (flag) => flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_CYAN);
    if (flags.length)
      this.pos = flags[0].pos;
  }

  private updateCellData() {
    this.cells.respawnCell.spawns = [];
    this.cells.respawnCell.extensions = [];
    this.cells.defenseCell.towers = [];

    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (structure instanceof StructureExtension && structure.isActive())
        this.cells.respawnCell.extensions.push(structure);
      else if (structure instanceof StructureSpawn && structure.isActive())
        this.cells.respawnCell.spawns.push(structure);
      else if (structure instanceof StructureTower && structure.isActive())
        this.cells.defenseCell.towers.push(structure);
    });
  }

  private updateConstructionSites() {
    this.constructionSites = [];
    _.forEach(this.rooms, (room) => {
      this.constructionSites = this.constructionSites.concat(room.find(FIND_CONSTRUCTION_SITES));
    });
  }

  private updateRepairs() {
    this.normalRepairs = [];
    this.emergencyRepairs = [];
    _.forEach(this.rooms, (room) => {
      _.forEach(room.find(FIND_STRUCTURES), (structure) => {
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
    if (UPDATE_EACH_TICK || Game.time % 10 == 0)
      this.updateRooms();
    if (UPDATE_EACH_TICK || Game.time % 10 == 1) {
      this.updateConstructionSites();
      this.updateRepairs();
    }
    if (Game.time % 50 == 29)
      this.updateCellData()
    if (Game.time % LOGGING_CYCLE == 0)
      this.updateLog();

    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.update(), cell.ref);
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.run(), cell.ref);
    });
  }
}
