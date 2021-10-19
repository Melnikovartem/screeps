import type { Bee } from "./bee";
import { beeStates } from "../enums";

type TransferTarget = StructureLink | StructureTerminal | StructureStorage | StructureTower
  | StructureLab | StructurePowerSpawn | StructureExtension | StructureSpawn | StructureFactory;

export class TransferRequest {
  ref: string;
  to: TransferTarget;
  toAmount: number;
  from: TransferTarget | Tombstone | Ruin | Resource;
  fromAmount: number;
  resource: ResourceConstant;
  inProcess = 0;
  beeProcess = 0;
  amount: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  stillExists: boolean

  nextup: TransferRequest | undefined;

  constructor(ref: string, from: TransferRequest["from"], to: TransferRequest["to"], priority: 0 | 1 | 2 | 3 | 4 | 5
    , res: ResourceConstant, amount: number) {
    this.ref = ref;
    this.to = to;
    this.from = from;

    this.priority = priority;
    amount = amount;
    this.resource = res;
    if (from instanceof Resource)
      this.fromAmount = from.amount;
    else
      this.fromAmount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(this.resource);
    this.toAmount = (<Store<ResourceConstant, false>>to.store).getFreeCapacity(this.resource);
    this.amount = amount;
    this.stillExists = true;
  }

  update() {
    let from = <TransferRequest["from"] | null>Game.getObjectById(this.from.id);
    if (from) {
      this.from = from;
      if (from instanceof Resource)
        this.fromAmount = from.amount;
      else
        this.fromAmount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(this.resource);
    } else if (this.from.pos.roomName in Game.rooms)
      this.stillExists = false;

    let to = <TransferRequest["to"] | null>Game.getObjectById(this.to.id);
    if (to) {
      this.to = to;
      this.toAmount = (<Store<ResourceConstant, false>>to.store).getFreeCapacity(this.resource);
    } else if (this.to.pos.roomName in Game.rooms)
      this.stillExists = false;

    this.inProcess = 0;
    this.beeProcess = 0;
  }

  isValid(inBee = 0) {
    if (!this.fromAmount && !this.inProcess && !inBee)
      return false;
    if (this.amount <= 0)
      return false;
    if (!this.toAmount)
      return false;
    if (!this.stillExists)
      return false
    return true;
  }

  preprocess(bee: Bee) {
    this.inProcess += bee.store.getUsedCapacity(this.resource);
    ++this.beeProcess;
    if (bee.target !== this.ref) {
      bee.target = this.ref;
      bee.state = bee.store.getUsedCapacity() > bee.store.getUsedCapacity(this.resource) ? beeStates.fflush
        : (bee.store.getUsedCapacity() < Math.min(this.amount, this.toAmount) && bee.store.getFreeCapacity() > 0 ? beeStates.refill : beeStates.work);
    }
  }

  process(bee: Bee) {
    if (!this.isValid()) {
      if (this.nextup) {
        this.nextup.preprocess(bee);
        this.nextup.process(bee);
      } else {
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
          if (this.nextup)
            this.nextup.process(bee);
          else
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
        let ans;
        if (this.from instanceof Resource)
          ans = bee.pickup(this.from);
        else
          ans = bee.withdraw(this.from, this.resource, amountBee);
        if (ans === OK) {
          this.fromAmount -= amountBee;
          bee.goTo(this.to);
        }
        break;

      case beeStates.work:
        amountBee = Math.min(this.amount, bee.store.getUsedCapacity(this.resource), this.toAmount);
        if (bee.transfer(this.to, this.resource, amountBee) === OK) {
          this.amount -= amountBee;
          this.toAmount -= amountBee;
          if (!this.isValid() && this.nextup && this.nextup.isValid()) {
            if (bee.store.getUsedCapacity(this.resource) === amountBee)
              bee.goTo(this.nextup.from);
            else
              bee.goTo(this.nextup.to);
            bee.target = this.nextup.ref;
          } else
            bee.goTo(this.from);
        }
        break;
    }
  }
}
