
import { beeStates } from "../enums";
import { findOptimalResource } from "../abstract/utils";

import type { Bee } from "./bee";

type TransferTarget = StructureLink | StructureTerminal | StructureStorage | StructureTower
  | StructureLab | StructurePowerSpawn | StructureExtension | StructureSpawn | StructureFactory;

export class TransferRequest {
  ref: string;
  to: TransferTarget;
  toAmount: number;
  from: TransferTarget | Tombstone | Ruin | Resource;
  fromAmount: number;
  resource: ResourceConstant | undefined;
  inProcess = 0;
  beeProcess = 0;
  amount: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  // 0 - refill
  // 1 - mostly labs boosting
  // 2 - towers?
  // 4 - terminal
  // 5 - not important shit
  // 6 - pickup
  stillExists: boolean

  nextup: TransferRequest | undefined;

  constructor(ref: string, from: TransferRequest["from"], to: TransferRequest["to"], priority: TransferRequest["priority"]
    , res: ResourceConstant | undefined, amount: number) {
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
      this.fromAmount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(this.resource);
    }
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
      if (bee.store.getUsedCapacity() !== bee.store.getUsedCapacity(this.resource)) {
        bee.state = beeStates.fflush;
      } else if (bee.store.getUsedCapacity() < Math.min(this.amount, this.toAmount, bee.store.getCapacity()))
        bee.state = beeStates.refill;
      else
        bee.state = beeStates.work;
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

  process(bee: Bee) {
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
        else {
          let res = this.resource || findOptimalResource(this.from.store, -1);
          if (this.resource === undefined)
            amountBee = Math.min(amountBee, (<Store<ResourceConstant, false>>this.from.store).getUsedCapacity(res));
          ans = bee.withdraw(this.from, res, amountBee);
        }
        if (ans === OK && this.resource)
          bee.goTo(this.to);
        break;

      case beeStates.work:
        amountBee = Math.min(this.amount, bee.store.getUsedCapacity(this.resource), this.toAmount);
        if (bee.transfer(this.to, this.resource || findOptimalResource(bee.store), amountBee) === OK) {
          this.amount -= amountBee;
          this.toAmount -= amountBee;
          if (!this.isValid()) {
            if (this.nextup && this.nextup.isValid()) {
              if (bee.store.getUsedCapacity(this.resource) === amountBee)
                bee.goTo(this.nextup.from);
              else
                bee.goTo(this.nextup.to);
              bee.target = this.nextup.ref;
            }
          } else
            bee.goTo(this.from);
        }
        break;
    }
  }
}
