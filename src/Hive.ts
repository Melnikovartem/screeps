import { excavationCell } from "./cells/excavationCell";
import { storageCell } from "./cells/storageCell";
import { upgradeCell } from "./cells/upgradeCell";
import { defenseCell } from "./cells/defenseCell";
import { respawnCell } from "./cells/respawnCell";
import { developmentCell } from "./cells/developmentCell";

import { builderMaster } from "./beeMaster/builder";
import { annexMaster } from "./beeMaster/annexer";
import { puppetMaster } from "./beeMaster/puppet";

import { CreepSetup } from "./creepSetups";

// TODO visuals
// const VISUALS_ON = true;

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
  roomTargets: Creep[] = [];
  annexTargets: Creep[] = [];

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

    this.repairSheet = new repairSheet();

    this.cells = {};
    this.parseStructures();

    if (this.stage > 0)
      this.builder = new builderMaster(this);
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
    this.updateConstructionSites();
    this.updateEmeregcyRepairs();
    this.updateNormalRepairs();

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
    this.roomTargets = _.filter(this.room.find(FIND_HOSTILE_CREEPS),
      (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL));
    this.annexTargets = [];
    _.forEach(this.annexes, (room) => {
      this.annexTargets = this.annexTargets.concat(
        _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL)))
    });
  }

  // add to list a new creep
  wish(order: spawnOrder) {
    // add some checks
    this.orderList.push(order);
  }

  update() {
    if (Game.time % 5 == 0) {
      this.updateRooms();
    } else if (Game.time % 5 == 1) {
      this.updateConstructionSites();
      this.updateEmeregcyRepairs();
      this.updateNormalRepairs();
    } else if (Game.time % 5 == 2) {
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
