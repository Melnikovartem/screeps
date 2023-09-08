import { Cell } from "cells/_Cell";
import type { Hive } from "hive/hive";
import { markResources } from "hive/hive-mining";
import { prefix } from "static/enums";
import { Traveler } from "Traveler/TravelerModified";

export class AnnexCell extends Cell {
  // #region Properties (2)

  private allResourcesMarked = true;
  public allResourcesRoads = true;

  public annexInDanger: string[] = [];

  // #endregion Properties (2)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.annexCell);
  }

  // #endregion Constructors (1)

  // #region Private Accessors (1)

  private get annexNames() {
    return this.hive.annexNames;
  }

  // #endregion Private Accessors (1)

  // #region Public Methods (4)

  /**
   * Add an annex to the hive
   * @param {string} annexName - The name of the annex to add
   */
  public addAnnex(annexName: string) {
    // adding to variable
    if (!this.annexNames.includes(annexName)) this.annexNames.push(annexName);
  }

  public override run(): void {}

  public override update(): void {
    if (Apiary.intTime % 32 === 0) this.updateDangerAnnex();

    if (
      Apiary.intTime % 100 === 5 ||
      !this.allResourcesMarked ||
      !this.allResourcesRoads
    ) {
      this.allResourcesMarked = true;
      this.allResourcesRoads = true;
      _.forEach(this.annexNames, (annexName) => {
        if (
          _.filter(
            this.hive.cells.excavation.resourceCells,
            (r) => annexName === r.pos.roomName
          ).length
        ) {
          if (!Memory.longterm.roomPlanner[this.hiveName]?.rooms[annexName])
            this.allResourcesRoads = false;
          return;
        }

        if (!Game.rooms[annexName]) {
          this.allResourcesMarked = false;
          Apiary.oracle.requestSight(annexName);
          return;
        }

        markResources(this.hive);
      });
      this.hive.allResources = false;
    }
  }

  public updateDangerAnnex() {
    this.annexInDanger = [];
    _.forEach(this.annexNames, (annexName) => {
      const path = Traveler.findRoute(this.hiveName, annexName);
      if (path)
        for (const roomName in path) {
          if (roomName === this.hiveName) continue;
          if (
            !Apiary.intel.getInfo(roomName, 25).safePlace &&
            (!Apiary.hives[roomName] ||
              Apiary.hives[roomName].cells.defense.isBreached)
          ) {
            this.annexInDanger.push(annexName);
            return;
          }
        }
    });
  }

  // #endregion Public Methods (4)
}
