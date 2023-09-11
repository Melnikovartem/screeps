import type { PuppetMaster } from "beeMasters/civil/puppet";
import { SWARM_MASTER } from "orders/swarm-nums";
import { prefix } from "static/enums";
import { goodSpot, makeId } from "static/utils";

export class Oracle {
  // #region Properties (4)

  /** all requests for current tick to show rooms */
  private roomSight: string[] = [];
  /** the ones that can't be reached by observer  */
  private roomSightSpotter: string[] = [];
  private sightNextTick: Set<string> = new Set();
  private spotters: { [roomName: string]: PuppetMaster } = {};

  // #endregion Properties (4)

  // #region Public Methods (6)

  public catchSpotter(master: PuppetMaster) {
    if (this.spotters[master.roomName]) return;
    this.spotters[master.roomName] = master;
  }

  public getRoomToCheck(roomName: string, range: number): string | undefined {
    const pos = new RoomPosition(25, 25, roomName);
    const validRooms = this.roomSight.filter(
      (roomNameRequested) =>
        pos.getRoomRangeTo(roomNameRequested, "lin") <= range
    );
    if (!validRooms.length) return;
    const index = Math.floor(Math.random() * validRooms.length);
    return validRooms[index];
  }

  public requestSight(roomName: string) {
    if (!this.sightNextTick.has(roomName)) this.sightNextTick.add(roomName);
  }

  public roomChecked(roomName: string) {
    const index = this.roomSight.indexOf(roomName);
    if (index !== -1) this.roomSight.splice(index, 1);
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

  // #endregion Public Methods (6)
}
