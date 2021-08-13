import { excavationCell } from "./cells/excavationCell";
import { storageCell } from "./cells/storageCell";
import { upgradeCell } from "./cells/upgradeCell";
import { defenseCell } from "./cells/defenseCell";
import { respawnCell } from "./cells/respawnCell";
import { developmentCell } from "./cells/developmentCell";

import { builderMaster } from "./beeMaster/civil/builder";
import { annexMaster } from "./beeMaster/civil/annexer";
import { puppetMaster } from "./beeMaster/civil/puppet";

import { profile } from "./profiler/decorator";

import { CreepSetup } from "./creepSetups";

// TODO visuals VISUALS_ON
import { UPDATE_EACH_TICK, LOGGING_CYCLE } from "./settings";


export interface SpawnOrder {
  master: string;
  amount: number;
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // how urgent is this spawn
}

interface hiveCells {
  defenseCell: defenseCell;
  developmentCell?: developmentCell;
  respawnCell: respawnCell;
  storageCell?: storageCell;
  upgradeCell?: upgradeCell;
  excavationCell?: excavationCell;
}

@profile
class repairSheet {
  [STRUCTURE_RAMPART]: number = 200000;
  [STRUCTURE_WALL]: number = 200000;
  other: number = 1;
  collapse: number = 0.5;

  constructor(hiveStage: 0 | 1 | 2) {
    if (hiveStage == 0) {
      this[STRUCTURE_RAMPART] = 20000;
      this[STRUCTURE_WALL] = 20000;
      this.other = 0.7;
      this.collapse = 0.3;
    } else if (hiveStage == 2) {
      this[STRUCTURE_RAMPART] = 2000000;
      this[STRUCTURE_WALL] = 2000000;
      this.other = 1;
      this.collapse = 0.7;
    }
  }

  isAnEmergency(structure: Structure): boolean {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return structure.hits < this[structure.structureType] * this.collapse;
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
  annexNames: string[];

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

  controller: StructureController;
  spawns: StructureSpawn[] = [];
  extensions: StructureExtension[] = [];
  towers: StructureTower[] = [];

  storage: StructureStorage | undefined;

  sources: Source[] = [];
  minerals: Mineral[] = [];

  pos: RoomPosition; // aka idle pos for creeps

  stage: 0 | 1 | 2 = 0;

  constructor(roomName: string, annexNames: string[]) {
    this.roomName = roomName;
    this.annexNames = annexNames;

    this.room = Game.rooms[roomName];
    this.updateRooms();
    this.controller = this.room.controller!;

    this.parseResources();
    this.parseStructures();

    this.cells = {
      respawnCell: new respawnCell(this),
      defenseCell: new defenseCell(this),
    };
    this.createCells();

    this.repairSheet = new repairSheet(this.stage);

    if (this.stage > 0)
      this.builder = new builderMaster(this);

    this.updateConstructionSites();
    this.updateRepairs();

    let flags = _.filter(this.room.find(FIND_FLAGS), (flag) => flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_CYAN);
    if (flags.length)
      this.pos = flags[0].pos;
    else if (this.cells.storageCell)
      this.pos = this.cells.storageCell.storage.pos;
    else
      this.pos = this.controller.pos;
  }

  updateRooms(): void {
    this.room = Game.rooms[this.roomName];
    this.annexes = <Room[]>_.compact(_.map(this.annexNames, (annexName) => {
      let annex = Game.rooms[annexName];
      if (!annex && !global.masters["masterPuppet_" + annexName])
        this.puppets.push(new puppetMaster(this, annexName));
      else if (annex && annex.controller && this.room.energyCapacityAvailable >= 650
        && !global.masters["masterAnnexer_" + annexName])
        this.claimers.push(new annexMaster(this, annex.controller));
      return annex;
    }));
    this.rooms = [this.room].concat(this.annexes);

    let flags = _.filter(this.room.find(FIND_FLAGS), (flag) => flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_CYAN);
    if (flags.length)
      this.pos = flags[0].pos;
  }

  parseResources() {
    this.sources = [];
    _.forEach(this.rooms, (room) => {
      let sources = room.find(FIND_SOURCES);
      this.sources = this.sources.concat(sources);
    });

    this.minerals = this.room.find(FIND_MINERALS);
  }

  private parseStructures() {
    this.storage = this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined;

    this.spawns = [];
    this.extensions = [];
    this.towers = [];

    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (structure instanceof StructureSpawn && structure.isActive())
        this.spawns.push(structure);
      else if (structure instanceof StructureExtension && structure.isActive())
        this.extensions.push(structure);
      else if (structure instanceof StructureTower && structure.isActive())
        this.towers.push(structure);
    });
  }

  private createCells() {
    // well for naming purpuses i think i need to recreate this cells
    if (this.cells.respawnCell.time != Game.time)
      this.cells.respawnCell = new respawnCell(this);
    if (this.cells.respawnCell.time != Game.time)
      this.cells.defenseCell = new defenseCell(this);

    if (this.storage) {
      this.cells.storageCell = new storageCell(this, this.storage);

      if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
        this.stage = 1;
        this.cells.upgradeCell = new upgradeCell(this, this.room.controller!);
        this.cells.excavationCell = new excavationCell(this, this.sources, this.minerals);
      }
    }

    if (this.stage == 0) {
      this.cells.developmentCell = new developmentCell(this, this.room.controller!, this.sources);
    }

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

  // add to list a new creep
  wish(order: SpawnOrder) {
    this.orderList.push(order);
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
    if (UPDATE_EACH_TICK || Game.time % 50 == 19)
      this.parseStructures();
    if (Game.time % LOGGING_CYCLE == 0)
      this.updateLog();

    _.forEach(this.cells, (cell) => {
      cell.update();
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      cell.run();
    });
  }
}
