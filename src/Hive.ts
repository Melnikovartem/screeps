import { Cell } from "./cells/_Cell";
import { CreepSetup } from "./creepSetups";

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
import { UPDATE_EACH_TICK, DEVELOPING } from "./settings";

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
export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  roomName: string;
  annexNames: string[] = [];

  room: Room;
  annexes: Room[] = []; // this room and annexes
  rooms: Room[] = []; //this room and annexes
  cells: hiveCells;

  spawOrders: { [id: string]: SpawnOrder } = {};

  builder?: builderMaster;

  pos: RoomPosition; // aka idle pos for creeps

  stage: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: 0 | 1 | 2;
  bassboost: Hive | null = null;

  structuresConst: RoomPosition[] = [];
  sumCost: number = 0;

  // help grow creeps from other colony

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];
    this.pos = this.room.controller!.pos;

    this.stage = 0;
    if (this.room.storage)
      this.stage = 1;

    if (this.stage === 1 && this.room.controller!.level === 8)
      this.stage = 2;

    // create your own fun hive with this cool brand new cells
    this.cells = {
      spawn: new respawnCell(this),
      defense: new defenseCell(this),
    };

    if (this.stage === 0)
      this.cells.dev = new developmentCell(this);
    else {
      this.cells.storage = new storageCell(this, this.room.storage!);
      this.cells.upgrade = new upgradeCell(this, this.room.controller!);
      this.cells.excavation = new excavationCell(this);
      this.cells.lab = new laboratoryCell(this);

      this.builder = new builderMaster(this);
      if (this.stage === 2) {
        // TODO cause i haven' reached yet
      }
    }

    //look for new structures for those wich need them
    this.updateCellData();
    this.shouldRecalc = 2;

    if (Apiary.logger)
      Apiary.logger.initHive(this.roomName);
  }

  addAnex(annexName: string) {
    if (!this.annexNames.includes(annexName))
      this.annexNames.push(annexName);
    if (annexName in Game.rooms) {
      this.shouldRecalc = 2;
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
          if (typeof flag === "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });

    _.forEach(this.room.find(FIND_MINERALS), (s) => {
      if (!Game.flags["mine_" + s.id]) {
        let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_CYAN);
        if (typeof flag === "string")
          Game.flags[flag].memory.hive = this.roomName;
      }
    });
  }

  private updateCellData() {
    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (this.updateCellStructure(structure, this.cells.spawn.extensions, STRUCTURE_EXTENSION) === ERR_INVALID_ARGS)
        if (this.updateCellStructure(structure, this.cells.spawn.spawns, STRUCTURE_SPAWN) === ERR_INVALID_ARGS)
          if (this.updateCellStructure(structure, this.cells.defense.towers, STRUCTURE_TOWER) === ERR_INVALID_ARGS)
            if (this.updateCellStructure(structure, this.cells.lab && this.cells.lab.laboratories, STRUCTURE_LAB) === ERR_INVALID_ARGS)
              void (0);
    });
  }

  private updateCellStructure<S extends Structure>(structure: Structure, structureMap: { [id: string]: S } | undefined, type: StructureConstant) {
    if (structureMap)
      if (type === structure.structureType) {
        if (structure.isActive())
          structureMap[structure.id] = <S>structure;
        else
          delete structureMap[structure.id];
        return OK;
      }
    return ERR_INVALID_ARGS;
  }

  updateStructures() {
    this.structuresConst = [];
    this.sumCost = 0;
    _.forEach(this.rooms, (r) => {
      let ans = Apiary.planner.checkBuildings(r.name);
      this.structuresConst = this.structuresConst.concat(ans.pos);
      this.sumCost += ans.sum;
    });
  }

  update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];
    if (UPDATE_EACH_TICK || Game.time % 10 === 8 || this.shouldRecalc) {
      this.updateRooms();
      this.updateStructures();
      if (this.shouldRecalc > 1) {
        this.markResources();
        _.forEach(this.rooms, (r) => {
          if (!Memory.cache.roomPlanner[r.name] || Memory.cache.roomPlanner[r.name] === {})
            Apiary.planner.resetPlanner(r.name);
        });
      }
      this.shouldRecalc = 0;
    }
    if (Game.time % 100 === 29)
      this.updateCellData();
    if (Apiary.logger)
      Apiary.logger.hiveLog(this);

    if (DEVELOPING)
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
