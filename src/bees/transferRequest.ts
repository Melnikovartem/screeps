import type { Bee } from "./bee";
import { beeStates } from "../enums";

type TransferTarget = StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab | StructurePowerSpawn | StructureExtension | StructureSpawn;

export class TransferRequest {
  ref: string;
  to: TransferTarget;
  toAmount: number;
  from: TransferTarget;
  fromAmount: number;
  resource: ResourceConstant;
  inProcess = 0;
  amount: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5;

  nextup: TransferRequest | undefined;

  constructor(ref: string, from: TransferTarget, to: TransferTarget, priority: 0 | 1 | 2 | 3 | 4 | 5
    , res: ResourceConstant, amount: number) {
    this.ref = ref;
    this.to = to;
    this.from = from;

    this.priority = priority;
    amount = amount;
    this.resource = res;
    this.fromAmount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(this.resource);
    this.toAmount = (<Store<ResourceConstant, false>>to.store).getFreeCapacity(this.resource);
    this.amount = amount;
  }

  update() {
    let from = <TransferTarget | null>Game.getObjectById(this.from.id);
    if (from) {
      this.from = from;
      this.fromAmount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(this.resource);
    }
    let to = <TransferTarget | null>Game.getObjectById(this.from.id);
    if (to) {
      this.to = to;
      this.toAmount = (<Store<ResourceConstant, false>>to.store).getFreeCapacity(this.resource);
    }
    this.inProcess = 0;
  }

  isValid() {
    if (this.amount > 0 && !this.fromAmount && !this.inProcess)
      return false;
    if (!this.toAmount)
      return false
    if (this.amount <= 0)
      return false;
    return true;
  }

  process(bee: Bee) {
    this.inProcess += bee.store.getUsedCapacity(this.resource);
    bee.target = this.ref;
    if (!this.isValid()) {
      if (this.nextup)
        this.nextup.process(bee);
      else {
        bee.state = beeStates.fflush;
        delete bee.target;
      }
      return;
    }

    let amountBee = 0;
    switch (bee.state) {
      case beeStates.refill:
        if (bee.store.getUsedCapacity() !== bee.store.getUsedCapacity(this.resource))
          bee.state = beeStates.fflush;
        else if (!bee.store.getFreeCapacity(this.resource))
          bee.state = beeStates.work;
        else if (bee.store.getUsedCapacity(this.resource) >= this.amount)
          bee.state = beeStates.work;
        else if (!this.fromAmount) {
          if (this.nextup) {
            this.nextup.process(bee);
            bee.target = this.ref;
          } else
            bee.state = beeStates.work;
          return;
        }
        break;

      case beeStates.work:
        if (bee.store.getUsedCapacity(this.resource) === 0)
          bee.state = beeStates.refill;
        break;
    }

    switch (bee.state) {
      case beeStates.refill:
        amountBee = Math.min(bee.store.getFreeCapacity(this.resource), this.fromAmount);
        if (bee.withdraw(this.from, this.resource, amountBee) === OK) {
          this.fromAmount -= amountBee;
          bee.goTo(this.to);
        }
        break;

      case beeStates.work:
        amountBee = Math.min(this.amount, bee.store.getUsedCapacity(this.resource), this.toAmount);
        if (bee.transfer(this.to, this.resource, amountBee) === OK) {
          this.amount -= amountBee;
          this.toAmount -= amountBee;
        }
        if (!this.isValid() && this.nextup) {
          if (bee.store.getUsedCapacity(this.resource) === amountBee)
            bee.goTo(this.nextup.from)
          else
            bee.goTo(this.nextup.to)
          bee.target = this.nextup.ref;
        }
        break;
    }
  }
}
