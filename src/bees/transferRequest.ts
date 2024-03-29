import { beeStates } from "../static/enums";
import { findOptimalResource, reverseDirection } from "../static/utils";
import type { Bee } from "./bee";

type TransferTarget =
  | StructureLink
  | StructureTerminal
  | StructureStorage
  | StructureTower
  | StructureLab
  | StructurePowerSpawn
  | StructureExtension
  | StructureSpawn
  | StructureFactory
  | StructureContainer;

export class TransferRequest {
  // #region Properties (13)

  private fromAmount: number = 0;
  /** can be stuck at full storage if not complete (for early game hauling) */
  private ignoreToAmount: boolean;
  private inProcess = 0;
  private stillExists: boolean = true;

  public amount: number;
  public beeProcess = 0;
  public from: TransferTarget | Tombstone | Ruin | Resource;
  public nextup: TransferRequest | undefined;
  /* 0 - refill
   * 1 - mostly labs boosting / fastRefill
   * 2 - towers?
   * 4 - terminal / early stage mining
   * 5 - not important shit
   * 6 - pickup */
  public priority: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  public ref: string;
  public resource: ResourceConstant | undefined;
  public to: TransferTarget | Creep | PowerCreep;
  public toAmount: number = Infinity;

  // #endregion Properties (13)

  // #region Constructors (1)

  public constructor(
    ref: string,
    from: TransferRequest["from"],
    to: TransferRequest["to"],
    priority: TransferRequest["priority"],
    res: ResourceConstant | undefined,
    amount: number,
    ignoreToAmount = false
  ) {
    this.ref = ref;
    this.to = to;
    this.from = from;
    this.priority = priority;

    this.amount = amount;
    this.ignoreToAmount = ignoreToAmount;

    this.resource = res;
    if (from instanceof Resource) this.resource = from.resourceType;

    this.update();
  }

  // #endregion Constructors (1)

  // #region Public Methods (4)

  public isValid(inBee = 0) {
    if (!this.fromAmount && !this.inProcess && !inBee) return false;
    if (this.amount <= 0) return false;
    if (this.toAmount <= 0 && !this.ignoreToAmount) return false;
    if (!this.stillExists) return false;
    if (this.from?.id === this.to?.id) return false;
    return true;
  }

  public preprocess(bee: Bee) {
    this.inProcess += bee.store.getUsedCapacity(this.resource);
    ++this.beeProcess;
    if (bee.target !== this.ref) {
      bee.target = this.ref;
      if (
        bee.store.getUsedCapacity() !== bee.store.getUsedCapacity(this.resource)
      ) {
        bee.state = beeStates.fflush;
      } else if (
        bee.store.getUsedCapacity() <
        Math.min(this.amount, this.toAmount, bee.store.getCapacity())
      )
        bee.state = beeStates.refill;
      else bee.state = beeStates.work;
    }
    if (!this.isValid()) {
      if (this.nextup) {
        this.nextup.preprocess(bee);
      } else {
        bee.state = beeStates.fflush;
        delete bee.target;
      }
      return;
    }
  }

  public process(bee: Bee): boolean {
    let amountBee = 0;
    switch (bee.state) {
      case beeStates.refill:
        if (
          bee.store.getUsedCapacity() !==
          bee.store.getUsedCapacity(this.resource)
        )
          bee.state = beeStates.fflush;
        else if (!bee.store.getFreeCapacity(this.resource))
          bee.state = beeStates.work;
        else if (bee.store.getUsedCapacity(this.resource) >= this.amount)
          bee.state = beeStates.work;
        else if (!this.fromAmount) {
          let nextTranfer = false;
          if (this.nextup) nextTranfer = this.nextup.process(bee);
          else bee.state = beeStates.work;
          return nextTranfer;
        }
        break;

      case beeStates.work:
        if (bee.store.getUsedCapacity(this.resource) === 0)
          bee.state = beeStates.refill;
        break;
    }

    switch (bee.state) {
      case beeStates.refill: {
        amountBee = Math.min(
          bee.store.getFreeCapacity(this.resource),
          this.fromAmount
        );
        let ans;
        if (this.from instanceof Resource) {
          ans = bee.pickup(this.from);
          // if some more resources dropped @ location we record that
          this.amount = Math.max(this.amount, this.from.amount);
        } else {
          const res = this.resource || findOptimalResource(this.from.store, -1);
          if (this.resource === undefined)
            amountBee = Math.min(
              amountBee,
              (
                this.from.store as Store<ResourceConstant, false>
              ).getUsedCapacity(res)
            );
          ans = bee.withdraw(this.from, res, amountBee);
        }
        if (ans !== OK) return false;
        if (
          this.nextup &&
          this.to instanceof StructureStorage &&
          this.fromAmount < bee.store.getFreeCapacity(this.resource)
        ) {
          bee.goTo(this.nextup.from);
          bee.target = this.nextup.ref;
        } else bee.goTo(this.to);

        return true;
      }
      case beeStates.work:
        amountBee = Math.min(
          this.amount,
          bee.store.getUsedCapacity(this.resource),
          this.toAmount
        );
        // no need to force transfer for non valid transfer
        if (!amountBee && bee.pos.getRangeTo(this.to) <= 2) {
          // edgecase where managers surround spawn
          if (bee.pos.getRangeTo(this.to) === 1) {
            const awayFromTo = reverseDirection(
              bee.pos.getDirectionTo(this.to)
            );
            let posToRest = bee.pos.getPosInDirection(awayFromTo);
            if (!posToRest.isFree(true)) {
              let freePos = bee.pos
                .getOpenPositions(true)
                .filter((p) => p.getRangeTo(this.to) > 1);
              if (!freePos.length)
                freePos = bee.pos
                  .getOpenPositions()
                  .filter((p) => p.getRangeTo(this.to) > 1);
              if (freePos.length) posToRest = freePos[0];
            }
            bee.goTo(posToRest);
          }
          return false;
        }
        if (
          bee.transfer(
            this.to,
            this.resource || findOptimalResource(bee.store),
            amountBee
          ) !== OK
        )
          return false;
        this.amount -= amountBee;
        this.toAmount -= amountBee;
        if (!this.isValid()) {
          if (this.nextup && this.nextup.isValid()) {
            if (bee.store.getUsedCapacity(this.resource) === amountBee)
              bee.goTo(this.nextup.from);
            else bee.goTo(this.nextup.to);
            bee.target = this.nextup.ref;
          }
        } else bee.goTo(this.from);
        return true;
    }
    return false;
  }

  public update() {
    // update info about from
    const from =
      this.from &&
      (Game.getObjectById(this.from.id) as TransferRequest["from"] | null);
    if (from) {
      this.from = from;
      if (from instanceof Resource) this.fromAmount = from.amount;
      else this.fromAmount = from.store.getUsedCapacity(this.resource) || 0;
    } else if (this.from.pos.roomName in Game.rooms) this.stillExists = false;

    // update info about to
    const to =
      this.to &&
      (Game.getObjectById(this.to.id) as TransferRequest["to"] | null);
    if (to) {
      this.to = to;
      this.toAmount = to.store.getFreeCapacity(this.resource) || 0;
    } else if (this.to.pos.roomName in Game.rooms) this.stillExists = false;

    // reset counter of bees
    this.inProcess = 0;
    this.beeProcess = 0;
  }

  // #endregion Public Methods (4)
}
