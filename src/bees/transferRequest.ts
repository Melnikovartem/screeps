import { beeStates } from "../static/enums";
import { findOptimalResource } from "../static/utils";
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
  // #region Properties (12)

  public amount: number;
  public beeProcess = 0;
  public from: TransferTarget | Tombstone | Ruin | Resource;
  public fromAmount: number;
  public inProcess = 0;
  public nextup: TransferRequest | undefined;
  public priority: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  public ref: string;
  public resource: ResourceConstant | undefined;
  // 0 - refill
  // 1 - mostly labs boosting
  // 2 - towers?
  // 4 - terminal
  // 5 - not important shit
  // 6 - pickup
  public stillExists: boolean;
  public to: TransferTarget | Creep | PowerCreep;
  public toAmount: number;

  // #endregion Properties (12)

  // #region Constructors (1)

  constructor(
    ref: string,
    from: TransferRequest["from"],
    to: TransferRequest["to"],
    priority: TransferRequest["priority"],
    res: ResourceConstant | undefined,
    amount: number
  ) {
    this.ref = ref;
    this.to = to;
    this.from = from;

    this.priority = priority;
    amount = amount;
    if (from instanceof Resource) {
      this.resource = from.resourceType;
      this.fromAmount = from.amount;
    } else {
      this.resource = res;
      this.fromAmount = (
        from.store as Store<ResourceConstant, false>
      ).getUsedCapacity(this.resource);
    }
    this.toAmount = (
      to.store as Store<ResourceConstant, false>
    ).getFreeCapacity(this.resource);
    this.amount = amount;
    this.stillExists = true;
  }

  // #endregion Constructors (1)

  // #region Public Methods (4)

  public isValid(inBee = 0) {
    if (!this.fromAmount && !this.inProcess && !inBee) return false;
    if (this.amount <= 0) return false;
    if (this.toAmount <= 0) return false;
    if (!this.stillExists) return false;
    if (this.from.id === this.to.id) return false;
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
    let transfer = false;
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
          if (this.nextup) transfer = this.nextup.process(bee);
          else bee.state = beeStates.work;
          return transfer;
        }
        break;

      case beeStates.work:
        if (bee.store.getUsedCapacity(this.resource) === 0)
          bee.state = beeStates.refill;
        break;
    }

    switch (bee.state) {
      case beeStates.refill:
        amountBee = Math.min(
          bee.store.getFreeCapacity(this.resource),
          this.fromAmount
        );
        let ans;
        if (this.from instanceof Resource) ans = bee.pickup(this.from);
        else {
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
        if (ans === OK) {
          transfer = true;
          if (
            this.nextup &&
            this.to instanceof StructureStorage &&
            this.fromAmount < bee.store.getFreeCapacity(this.resource)
          ) {
            bee.goTo(this.nextup.from);
            bee.target = this.nextup.ref;
          } else bee.goTo(this.to);
        }
        break;

      case beeStates.work:
        amountBee = Math.min(
          this.amount,
          bee.store.getUsedCapacity(this.resource),
          this.toAmount
        );
        if (
          bee.transfer(
            this.to,
            this.resource || findOptimalResource(bee.store),
            amountBee
          ) === OK
        ) {
          transfer = true;
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
        }
        break;
    }
    return transfer;
  }

  public update() {
    const from = Game.getObjectById(this.from.id) as
      | TransferRequest["from"]
      | null;
    if (from) {
      this.from = from;
      if (from instanceof Resource) this.fromAmount = from.amount;
      else
        this.fromAmount = (
          from.store as Store<ResourceConstant, false>
        ).getUsedCapacity(this.resource);
    } else if (this.from.pos.roomName in Game.rooms) this.stillExists = false;

    const to = Game.getObjectById(this.to.id) as TransferRequest["to"] | null;
    if (to) {
      this.to = to;
      this.toAmount = (
        to.store as Store<ResourceConstant, false>
      ).getFreeCapacity(this.resource);
    } else if (this.to.pos.roomName in Game.rooms) this.stillExists = false;

    this.inProcess = 0;
    this.beeProcess = 0;
  }

  // #endregion Public Methods (4)
}
