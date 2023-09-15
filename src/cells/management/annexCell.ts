import { Cell } from "cells/_Cell";
import type { Hive } from "hive/hive";
import { markResources } from "hive/hive-mining";
import { SWARM_MASTER } from "orders/swarm-nums";
import type { SwarmOrder } from "orders/swarmOrder";
import { prefix, roomStates } from "static/enums";
import { goodSpot } from "static/utils";
import { Traveler } from "Traveler/TravelerModified";

export class AnnexCell extends Cell {
  // #region Properties (6)

  private allResourcesMarked = true;
  private noVisionAnnex: string[] = [];
  /** annexer or safeSK master */
  private swarms: { [roomName: string]: SwarmOrder<any> } = {};

  public allResourcesRoads = true;
  public annexInDanger: string[] = [];
  public override master = undefined;

  // #endregion Properties (6)

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

  // #region Public Methods (5)

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

  public canSpawnMiners(roomName: string) {
    if (this.annexInDanger.includes(roomName)) return false;
    const roomState = Apiary.intel.getRoomState(roomName);
    switch (roomState) {
      case roomStates.SKfrontier:
        return this.swarms[roomName].master.beesAmount;
      case roomStates.ownedByMe:
      case roomStates.reservedByMe:
      case roomStates.SKcentral:
      case roomStates.noOwner:
        return true;
      /* case roomStates.corridor:
      case roomStates.reservedByInvader:
      case roomStates.reservedByEnemy:
      case roomStates.ownedByEnemy:
        return false; */
    }
    return false;
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
    if (Apiary.intTime % 200 === 0) this.noVisionAnnex = [...this.annexNames];
    this.updateVisionAnnex();
    this.checkResources();
  }

  // #endregion Public Methods (5)

  // #region Private Methods (5)

  private addAnnexMaster(annexName: string) {
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
    const contPos = Game.rooms[roomName]?.controller?.pos;
    if (existing) {
      if (contPos && contPos !== existing.pos) existing.setPosition(contPos);
      this.swarms[roomName] = existing;
      return;
    }
    const pos = contPos || goodSpot(roomName);
    const order = this.hive.createSwarm(ref, pos, type);
    this.swarms[roomName] = order;
  }

  private checkResources() {
    if (this.allResourcesRoads && this.allResourcesMarked && Apiary.intTime > 0)
      return;
    this.allResourcesRoads = true;
    this.allResourcesMarked = true;

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
        // can't mark the resource
        // wait for vision code to do it's thing
        this.allResourcesMarked = false;
        return;
      }

      markResources(this.hive);
    });
  }

  private updateDangerAnnex() {
    this.annexInDanger = [];
    _.forEach(this.annexNames, (annexName) => {
      const path = Traveler.findRoute(this.hiveName, annexName, {
        ignoreCurrent: true,
      });
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

  private updateVisionAnnex() {
    for (let i = 0; i < this.noVisionAnnex.length; ++i) {
      const annexName = this.noVisionAnnex[i];
      const room = Game.rooms[annexName];
      if (!room) {
        Apiary.oracle.requestSight(annexName);
        continue;
      }
      this.noVisionAnnex.splice(i, 1);
      --i;
    }
  }

  // #endregion Private Methods (5)
}
