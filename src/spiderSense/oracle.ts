import type { PuppetMaster } from "beeMasters/civil/puppet";
import { SWARM_MASTER } from "orders/swarm-nums";
import { prefix } from "static/enums";
import { goodSpot, makeId } from "static/utils";

export class Oracle {
  // #region Properties (2)

  private sightNextTick: Set<string> = new Set();

  /** all requests for current tick to show rooms */
  public roomSight: string[] = [];
  /** the ones that can't be reached by observer  */
  public roomSightSpotter: string[] = [];

  private spotters: { [roomName: string]: PuppetMaster } = {};

  public catchSpotter(master: PuppetMaster) {
    if (this.spotters[master.roomName]) return;
    this.spotters[master.roomName] = master;
  }

  // #endregion Properties (2)

  // #region Public Methods (2)

  public requestSight(roomName: string) {
    if (!this.sightNextTick.has(roomName)) this.sightNextTick.add(roomName);
  }

  public update() {
    _.forEach(this.roomSight, (roomName) => {
      if (
        _.filter(
          Apiary.hives,
          (h) =>
            h.cells.observe &&
            h.pos.getRoomRangeTo(roomName) < h.cells.observe.observerRange
        ).length ||
        this.spotters[roomName] ||
        Game.rooms[roomName]
      )
        return;
      const hive = _.min(Apiary.hives, (h) => h.pos.getRoomRangeTo(roomName));
      // stop early spam
      if (hive.cells.storage.master.beesAmount)
        hive.createSwarm(
          prefix.spotter + makeId(6),
          goodSpot(roomName),
          SWARM_MASTER.puppet
        );
    });
  }

  public run() {
    // 80% chance to keep each request
    _.forEach(this.roomSight, (roomName) =>
      !this.sightNextTick.has(roomName) && Math.random() < 0.8
        ? this.sightNextTick.add(roomName)
        : undefined
    );
    this.roomSight = Array.from(this.sightNextTick);
    this.sightNextTick = new Set();
  }

  // #endregion Public Methods (2)
}
