import { excavationCell } from "./cells/excavationCell";
import { storageCell } from "./cells/storageCell";
import { upgradeCell } from "./cells/upgradeCell";
import { defenseCell } from "./cells/defenseCell";
import { respawnCell } from "./cells/respawnCell";
import { developmentCell } from "./cells/developmentCell";

import { builderMaster } from "./beeMaster/civil/builder";
import { annexMaster } from "./beeMaster/civil/annexer";
import { puppetMaster } from "./beeMaster/civil/puppet";

import { CreepSetup } from "./creepSetups";

// TODO visuals VISUALS_ON
import { UPDATE_EACH_TICK } from "./settings";


export interface spawnOrder {
  master: string;
  amount: number;
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5; // how urgent is this spawn
}

interface hiveCells {
  respawnCell?: respawnCell;
  excavationCell?: excavationCell;
  storageCell?: storageCell;
  upgradeCell?: upgradeCell;
  developmentCell?: developmentCell;
  defenseCell?: defenseCell;
}

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


export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  roomName: string;
  annexNames: string[];

  room: Room;
  annexes: Room[] = []; // this room and annexes
  rooms: Room[] = []; //this room and annexes
  cells: hiveCells;
  repairSheet: repairSheet;

  orderList: spawnOrder[] = [];

  //targets for defense systems
  roomTargets: boolean = false;
  annexesTargets: boolean = false;

  // some structures (aka preprocess of filters)
  constructionSites: ConstructionSite[] = [];
  emergencyRepairs: Structure[] = [];
  normalRepairs: Structure[] = [];

  builder?: builderMaster;
  claimers: annexMaster[] = [];
  puppets: puppetMaster[] = [];

  stage: 0 | 1 | 2 = 0;

  constructor(roomName: string, annexNames: string[]) {
    this.roomName = roomName;
    this.annexNames = annexNames;

    this.room = Game.rooms[roomName];
    this.updateRooms();

    this.cells = {};
    this.parseStructures();

    this.repairSheet = new repairSheet(this.stage);

    if (this.stage > 0)
      this.builder = new builderMaster(this);

    this.updateConstructionSites();
    this.updateEmeregcyRepairs();
    this.updateNormalRepairs();

    this.findTargets();
  }

  updateRooms(): void {
    this.room = Game.rooms[this.roomName];
    this.annexes = <Room[]>_.compact(_.map(this.annexNames, (annexName) => {
      let annex = Game.rooms[annexName];
      if (!annex && !global.masters["master_puppetFor_" + annexName])
        this.puppets.push(new puppetMaster(this, annexName));
      else if (annex && annex.controller && this.room.energyCapacityAvailable >= 650
        && !global.masters["master_annexerRoom_" + annexName])
        this.claimers.push(new annexMaster(this, annex.controller));
      return annex;
    }));
    this.rooms = [this.room].concat(this.annexes);
  }

  private parseStructures() {

    let spawns: StructureSpawn[] = [];
    let extensions: StructureExtension[] = [];
    let towers: StructureTower[] = [];

    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (structure instanceof StructureSpawn && structure.isActive())
        spawns.push(structure);
      else if (structure instanceof StructureExtension && structure.isActive())
        extensions.push(structure);
      else if (structure instanceof StructureTower && structure.isActive())
        towers.push(structure);
    });

    let storage = this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined;

    let allSources: Source[] = [];
    _.forEach(this.rooms, (room) => {
      let sources = room.find(FIND_SOURCES);
      allSources = allSources.concat(sources);
    });

    this.cells.respawnCell = new respawnCell(this, spawns, extensions);

    if (storage) {
      this.cells.storageCell = new storageCell(this, storage);

      if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
        this.stage = 1;
        this.cells.upgradeCell = new upgradeCell(this, this.room.controller!);

        if (allSources.length) {
          this.cells.excavationCell = new excavationCell(this, allSources);
        }
      }
    }

    if (this.stage == 0) {
      this.cells.developmentCell = new developmentCell(this, this.room.controller!, allSources);
    }

    if (towers.length) {
      this.cells.defenseCell = new defenseCell(this, towers);
    }
  }

  private updateConstructionSites() {
    this.constructionSites = [];
    _.forEach(this.rooms, (room) => {
      this.constructionSites = this.constructionSites.concat(room.find(FIND_CONSTRUCTION_SITES));
    });
  }


  private updateEmeregcyRepairs() {
    this.emergencyRepairs = [];
    _.forEach(this.rooms, (room) => {
      this.emergencyRepairs = this.emergencyRepairs.concat(
        _.filter(room.find(FIND_STRUCTURES), (structure) => this.repairSheet.isAnEmergency(structure)))
    });
  }

  private updateNormalRepairs() {
    this.normalRepairs = [];
    _.forEach(this.rooms, (room) => {
      this.normalRepairs = this.normalRepairs.concat(
        _.filter(room.find(FIND_STRUCTURES), (structure) => this.repairSheet.isAnRepairCase(structure)))
    });
  }

  // look for targets inside room
  private findTargets() {
    this.roomTargets = this.room.find(FIND_HOSTILE_CREEPS).length ? true : false;
    _.some(this.annexes, (room) => {
      let annexTargets = room.find(FIND_HOSTILE_CREEPS)

      if (annexTargets.length > 0) {
        if (!Game.flags["defend_" + room.name]) {
          new Flag("defend_" + room.name, COLOR_BLUE, COLOR_BLUE, room.name, annexTargets[0].pos.x, annexTargets[0].pos.y);
          console.log("new defender flag for " + room.name);
        }
        if (!this.annexesTargets)
          this.annexesTargets = annexTargets.length > 0;
      }
    });
  }

  // add to list a new creep
  wish(order: spawnOrder) {
    // add some checks
    this.orderList.push(order);
  }

  update() {
    if (UPDATE_EACH_TICK || Game.time % 5 == 0) {
      this.updateRooms();
    }
    if (UPDATE_EACH_TICK || Game.time % 5 == 1) {
      this.updateConstructionSites();
      this.updateEmeregcyRepairs();
      this.updateNormalRepairs();
    }
    if (UPDATE_EACH_TICK || Game.time % 5 == 2) {
      this.findTargets();
    }

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
