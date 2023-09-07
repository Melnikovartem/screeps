import type { PuppetMaster } from "beeMasters/civil/puppet";

export class Oracle {
  // #region Properties (2)

  private sightNextTick: Set<string> = new Set();

  /** all requests for current tick to show rooms */
  public roomSight: string[] = [];
  /** the ones that can't be reached by observer  */
  public roomSightSpotter: string[] = [];

  private spotters: PuppetMaster[] = [];

  public catchSpotter(master: PuppetMaster) {
    this.spotters.push(master);
  }

  // #endregion Properties (2)

  // #region Public Methods (2)

  public requestSight(roomName: string) {
    if (!this.sightNextTick.has(roomName)) this.sightNextTick.add(roomName);
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
