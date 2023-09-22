// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army
import type { SwarmOrder } from "orders/swarmOrder";

import type { Bee } from "../bees/bee";
import { profile } from "../profiler/decorator";
import { Master } from "./_Master";

// Master for just a job
// can itself spawn masters if needed?
@profile
export abstract class SwarmMaster<T> extends Master<SwarmOrder<T>> {
  // #region Properties (1)

  public override newBee = (bee: Bee) => {
    super.newBee(bee);
    if (
      // new bee
      bee.creep.memory.born + 1 === Game.time ||
      // missed bee due to lag
      (this.parent.spawned < this.beesAmount &&
        bee.creep.memory.born + 10 <= Game.time)
    )
      this.parent.newSpawn();
  };

  // #endregion Properties (1)

  // #region Constructors (1)

  // @todo replace with SwarmOrder that just holds a pos in cache
  // flags are costly and can't be placed in uloaded rooms :/
  public constructor(order: SwarmOrder<T>) {
    super(order);
    if (!this.info) this.parent.special = this.defaultInfo();
  }

  // #endregion Constructors (1)

  // #region Public Abstract Accessors (1)

  public abstract get maxSpawns(): number;

  // #endregion Public Abstract Accessors (1)

  // #region Protected Accessors (2)

  protected get info() {
    return this.parent.special;
  }

  protected set info(value) {
    this.parent.special = value;
  }

  // #endregion Protected Accessors (2)

  // #region Public Methods (1)

  public override checkBees(spawnExtreme?: boolean, spawnCycle?: number) {
    if (
      this.parent.spawned >= this.maxSpawns &&
      !this.waitingForBees &&
      !this.beesAmount
    ) {
      // master lived its all
      this.parent.delete();
      return false;
    }
    // we spawned max amount
    if (this.parent.spawned >= this.maxSpawns) return false;
    return super.checkBees(spawnExtreme, spawnCycle);
  }

  // #endregion Public Methods (1)

  // #region Public Abstract Methods (1)

  public abstract defaultInfo(): T;

  // #endregion Public Abstract Methods (1)
}
