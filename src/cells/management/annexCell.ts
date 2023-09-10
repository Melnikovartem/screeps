import { Cell } from "cells/_Cell";
import type { Hive } from "hive/hive";
import { markResources } from "hive/hive-mining";
import { SWARM_MASTER } from "orders/swarm-nums";
import type { SwarmOrder } from "orders/swarmOrder";
import { prefix, roomStates } from "static/enums";
import { goodSpot } from "static/utils";
import { Traveler } from "Traveler/TravelerModified";

export class AnnexCell extends Cell {
  // #region Properties (5)

  private allResourcesMarked = true;
  /** annexer or safeSK master */
  private swarms: { [roomName: string]: SwarmOrder<any> } = {};

  public allResourcesRoads = true;
  public annexInDanger: string[] = [];
  public override master = undefined;

  // #endregion Properties (5)

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

  // #region Public Methods (6)

  /**
   * Add an annex to the hive
   * @param {string} annexName - The name of the annex to add
   */
  public addAnnex(annexName: string) {
    // adding to variable
    if (!this.annexNames.includes(annexName)) {
      this.annexNames.push(annexName);
      this.allResourcesMarked = false;
      // update cache
      this.hive.cache.annex = this.annexNames;
    }
  }

  public addAnnexMaster(annexName: string) {
    if (this.swarms[annexName]) return;
    switch (Apiary.intel.getRoomState(annexName)) {
      case roomStates.reservedByEnemy:
      case roomStates.reservedByInvader:
      case roomStates.noOwner:
      case roomStates.reservedByMe: {
        this.addMaster(prefix.reserve, annexName, SWARM_MASTER.annex, 650);
        break;
      }
      case roomStates.SKfrontier: {
        this.addMaster(prefix.safesk, annexName, SWARM_MASTER.sk, 5500);
        break;
      }
      case roomStates.SKcentral:
        // no master needed
        break;
      default:
        return;
    }
  }

  public removeAnnex(annexName: string) {
    const index = this.annexNames.indexOf(annexName);
    if (index !== -1) {
      this.annexNames.splice(index, 1);
      // update cache
      this.hive.cache.annex = this.annexNames;
    }
    if (this.swarms[annexName]) this.swarms[annexName].delete();
    this.hive.cells.excavation.roomRemoveCells(annexName);
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
          else this.addAnnexMaster(annexName);
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

  // #endregion Public Methods (6)

  // #region Private Methods (1)

  private addMaster(
    prefixMaster: string,
    roomName: string,
    type: SWARM_MASTER,
    energyCheck: number
  ) {
    const ref = prefixMaster + roomName;
    if (
      this.hive.room.energyCapacityAvailable < energyCheck ||
      this.hive.bassboost
    )
      return;
    const existing = Apiary.orders[ref];
    if (existing) {
      this.swarms[roomName] = existing;
      return;
    }
    const order = this.hive.createSwarm(ref, goodSpot(roomName), type);
    this.swarms[roomName] = order;
  }

  // #endregion Private Methods (1)
}
