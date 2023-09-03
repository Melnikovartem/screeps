import { setups } from "bees/creepSetups";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix } from "static/enums";

import { Cell } from "../_Cell";

/** takes over in case of emergencies
 * // no spawn
 * // low lvl controller
 * // VERY low energy
 */
@profile
export class DevelopmentCell extends Cell {
  // #region Properties (3)

  // public override master: BootstrapMaster;
  public shouldRecalc: boolean = true;

  // #endregion Properties (3)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.developmentCell);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get controller() {
    return this.hive.controller;
  }

  public override get pos() {
    return this.hive.controller.pos;
  }

  public get managerBeeCount() {
    let accumRoadTime = 0;

    _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
        const coef = cell.master.ratePT;
        accumRoadTime +=
          (cell.roadTime + Math.max(cell.restTime, cell.roadTime, 100)) * coef;
    });

    const body = setups.managerQueen.getBody(
      this.hive.room.energyCapacityAvailable
    ).body;
    const carryCapacity =
      body.filter((b) => b === CARRY).length * CARRY_CAPACITY;

    let rounding = (x: number) => Math.round(x - 0.15);
    if (this.controller.level <= 2) rounding = (x) => Math.round(x + 0.15);
    console.log(
      Apiary.intTime,
      "managerTargetBeeCount",
      rounding(accumRoadTime / carryCapacity)
    );
    return rounding(accumRoadTime / carryCapacity);
  }

  public minerBeeCount(resource: Source | Mineral) {
    if (resource instanceof Mineral) return 0;
    const workAmount = Math.floor(
      this.hive.room.energyCapacityAvailable /
        (BODYPART_COST[WORK] + BODYPART_COST[MOVE] * 0.5)
    );
    const maxBees = Math.round(
      resource.energyCapacity / ENERGY_REGEN_TIME / workAmount
    );
    return Math.max(
      Math.min(Math.floor(resource.pos.getOpenPositions(true).length), maxBees),
      1
    );
  }

  public get builderBeeCount() {
    return 0;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (3)

  public addResources() {
    _.forEach([this.hiveName].concat(this.hive.annexNames), (miningRoom) => {
      const room = Game.rooms[miningRoom];
      if (!room) return;

      _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
        if (cell.container)
          this.sCell.requestToStorage([cell.container], 4, RESOURCE_ENERGY);
      });

      _.forEach(room.find(FIND_DROPPED_RESOURCES), (r) => {
        if (r.resourceType === RESOURCE_ENERGY)
          this.sCell.requestToStorage([r], 4, RESOURCE_ENERGY);
      });

      // use storage from own room cause it can be not active?
      if (
        miningRoom !== this.hiveName ||
        this.hive.storage instanceof StructureSpawn
      )
        _.forEach(room.find(FIND_STRUCTURES), (s) => {
          if (
            s.structureType !== STRUCTURE_STORAGE &&
            s.structureType !== STRUCTURE_TERMINAL &&
            s.structureType !== STRUCTURE_CONTAINER
          )
            return;
          this.sCell.requestToStorage([s], 4, RESOURCE_ENERGY);
        });
    });
  }

  public run() {
    if (this.hive.phase > 0 && this.hive.state === hiveStates.economy)
      this.delete();
  }

  public override update() {
    if (Apiary.intTime % 10 === 0) this.addResources();
  }

  // #endregion Public Methods (3)
}
