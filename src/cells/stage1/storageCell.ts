import { Cell } from "../_Cell";
import { ManagerMaster } from "../../beeMasters/economy/manager";
import { TransferRequest } from "../../bees/transferRequest";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.2);

@profile
export class StorageCell extends Cell {

  storage: StructureStorage;
  links: { [id: string]: StructureLink } = {};
  linksState: { [id: string]: "idle" | "busy" } = {};
  terminal: StructureTerminal | undefined;
  master: ManagerMaster;
  desiredBalance: { [key in ResourceConstant]?: number } = {
    [RESOURCE_ENERGY]: Math.round(STORAGE_CAPACITY * 0.4),
    "XGH2O": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // upgrade
    "XLH2O": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // repair
    "XLHO2": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // heal
    "XKHO2": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // rangedAttack
    "XZHO2": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // move
  }

  requests: { [id: string]: TransferRequest } = {};

  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, prefix.storageCell + hive.room.name);

    this.storage = storage;

    let links = <StructureLink[]>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      structure => structure.structureType === STRUCTURE_LINK);

    _.forEach(links, l => {
      this.links[l.id] = l;
      this.linksState[l.id] = "idle";
    });

    this.terminal = <StructureTerminal>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 5),
      structure => structure.structureType === STRUCTURE_TERMINAL)[0];

    this.pos = storage.pos;
    this.master = new ManagerMaster(this);
  }

  requestFromStorage(objects: TransferRequest["to"][], priority: TransferRequest["priority"]
    , res: TransferRequest["resource"] = RESOURCE_ENERGY, amount: number = Infinity, fitStore = false): number {
    let sum = 0;
    let prev: TransferRequest | undefined;
    amount = Math.min(amount, this.storage.store.getUsedCapacity(res));
    for (let i = 0; i < objects.length; ++i) {
      let ref = objects[i].structureType + "_" + objects[i].id;
      if (this.requests[ref] && this.requests[ref].priority === priority && this.requests[ref].to.id === objects[i].id)
        continue;
      let amountCC = amount;
      if (fitStore)
        amountCC = Math.min(amountCC, (<Store<ResourceConstant, false>>objects[i].store).getFreeCapacity(res));
      if (amountCC <= 0)
        continue;
      this.requests[ref] = new TransferRequest(ref, this.storage, objects[i], priority, res, amountCC);
      if (prev)
        this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  requestToStorage(objects: TransferRequest["from"][], priority: TransferRequest["priority"]
    , res: TransferRequest["resource"] = RESOURCE_ENERGY, amount: number = Infinity, fitStore = false): number {
    let sum = 0;
    let prev: TransferRequest | undefined;

    amount = Math.min(amount, this.storage.store.getFreeCapacity(res));
    for (let i = 0; i < objects.length; ++i) {
      let ref = objects[i].structureType + "_" + objects[i].id
      if (this.requests[ref] && this.requests[ref].priority === priority && this.requests[ref].from.id === objects[i].id)
        continue;
      let amountCC = amount;
      if (fitStore)
        amountCC = Math.min(amountCC, (<Store<ResourceConstant, false>>objects[i].store).getUsedCapacity(res));
      if (amountCC <= 0)
        continue;
      this.requests[ref] = new TransferRequest(ref, objects[i], this.storage, priority, res, amountCC);
      if (prev)
        this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  getFreeLink(sendIn: boolean = false): StructureLink | undefined {
    let links = _.filter(this.links, l => !sendIn || this.linksState[l.id] === "idle").sort(
      (a, b) => (b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY)) * (sendIn ? -1 : 1));
    if (sendIn || !links.length)
      return links[0];
    else
      return links.reduce((prev, curr) => curr.cooldown < prev.cooldown ? curr : prev);
  }

  update() {
    super.update(["links"]);

    if (!this.storage) {
      Apiary.destroyTime = Game.time;
      return;
    }


    for (let k in this.requests)
      this.requests[k].update();

    if ((!Object.keys(this.requests).length || this.storage.store.getFreeCapacity() < 10000) && this.terminal) {
      if (this.terminal.store.getFreeCapacity() > this.terminal.store.getCapacity() * 0.1) {
        let freeCap = this.storage.store.getCapacity() * 0.8 - this.storage.store.getUsedCapacity();
        let res: ResourceConstant = RESOURCE_ENERGY;
        let amount = this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) - TERMINAL_ENERGY;
        if (amount >= 0) {
          amount = 0;
          // target amount in storage [80% - 9900, 80%]
          if (freeCap > 9900)
            for (let resourceConstant in this.terminal.store) {
              let resource = <ResourceConstant>resourceConstant;
              let newAmount = this.terminal.store.getUsedCapacity(resource);
              if (resource === RESOURCE_ENERGY)
                newAmount -= TERMINAL_ENERGY;
              if (newAmount < amount || !amount && newAmount > 0) {
                res = resource;
                amount = newAmount;
              }
            }
          else if (freeCap < 0) {
            for (let resourceConstant in this.storage.store) {
              let resource = <ResourceConstant>resourceConstant;
              let newAmount = this.storage.store.getUsedCapacity(resource);
              if (resource in this.desiredBalance)
                newAmount -= this.desiredBalance[resource]!;
              if (-amount < newAmount) {
                res = resource;
                amount = -newAmount;
              }
            }
            amount = Math.max(amount, freeCap);
          }
        }

        if (amount > 0)
          this.requestToStorage([this.terminal],
            this.storage.store.getFreeCapacity() < 10000 ? 2 : 5, res, Math.min(amount, 5500, freeCap));
        else if (amount < 0)
          this.requestFromStorage([this.terminal], 5, res, Math.min(-amount, 5500));
      }
    }

    for (let id in this.links) {
      let link = this.links[id];
      this.linksState[id] = "idle";
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5)
        this.requestToStorage([link], 3);
    }

    this.hive.stateChange("lowenergy", this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000);
    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 8000 && !this.hive.cells.dev)
      Apiary.destroyTime = Game.time;
  }

  run() {
    for (let k in this.requests)
      if (!this.requests[k].isValid())
        delete this.requests[k];

    if (this.terminal && !this.terminal.cooldown) {
      let amountSend: number = 0;

      for (let resourceConstant in this.desiredBalance) {
        let resource = <ResourceConstant>resourceConstant;
        let balance = this.getUsedCapacity(resource) - this.desiredBalance[resource]!;
        if (balance < 0) {
          let amount = -balance;
          let hurry = amount > this.desiredBalance[resource]! * 0.9;
          if (hurry)
            amount = Math.floor(amount * 0.25);
          if (this.askAid(resource, amount, hurry))
            return;
        }
      }

      amountSend = 0;

      if (this.terminal.store.getFreeCapacity() > this.terminal.store.getCapacity() * 0.3)
        return;

      let res: ResourceConstant = RESOURCE_ENERGY;
      let amount: number = 0;
      for (let resourceConstant in this.terminal.store) {
        let resource = <ResourceConstant>resourceConstant;

        if (this.desiredBalance[resource] && this.getUsedCapacity(resource) <= this.desiredBalance[resource]!)
          continue;

        let newAmount = this.terminal.store.getUsedCapacity(resource);
        if (resource === RESOURCE_ENERGY)
          newAmount -= TERMINAL_ENERGY;
        if (newAmount > amount) {
          res = resource;
          amount = newAmount;
        }
      }

      amountSend = this.sendAid(res, amount);

      if (amountSend === 0)
        Apiary.broker.sellShort(this.terminal, res, amount);
    }
  }

  askAid(res: ResourceConstant, amount: number, hurry?: boolean) {
    if (!this.terminal)
      return 0;
    let hives = _.filter(Apiary.hives, h => h.roomName != this.hive.roomName && h.cells.storage && h.cells.storage.terminal
      && (!h.cells.storage.desiredBalance[res] || h.cells.storage.storage.store.getUsedCapacity(res) > h.cells.storage.desiredBalance[res]!));

    if (!hives.length) {
      if (res === RESOURCE_ENERGY)
        return 0;
      let ans = Apiary.broker.buyIn(this.terminal, res, amount, hurry);

      if (ans === "short")
        return amount;
      return 0;
    }

    let closest = hives.reduce((prev, curr) => this.pos.getRoomRangeTo(prev) > this.pos.getRoomRangeTo(curr) ? curr : prev);
    let sCell = closest.cells.storage!;
    if (!sCell.requests[STRUCTURE_TERMINAL + "_" + sCell.terminal!.id]) {
      let deiseredIn = sCell.desiredBalance[res] ? sCell.desiredBalance[res]! : 0;
      sCell.requestFromStorage([sCell.terminal!], 5, res, sCell.storage.store.getUsedCapacity(res) - deiseredIn, true);
    }

    return 0;
  }

  sendAid(res: ResourceConstant, amount: number) {
    if (!this.terminal)
      return 0;
    let hives = _.filter(Apiary.hives, h => h.roomName != this.hive.roomName && h.cells.storage
      && h.cells.storage.desiredBalance[res] && h.cells.storage.terminal
      && h.cells.storage.getUsedCapacity(res) < h.cells.storage.desiredBalance[res]!);

    if (!hives.length)
      return 0;

    let amoundSend: number = 0;
    let closest = hives.reduce((prev, curr) => this.pos.getRoomRangeTo(prev) > this.pos.getRoomRangeTo(curr) ? curr : prev);
    let terminalTo = closest.cells.storage! && closest.cells.storage!.terminal!;
    amoundSend = Math.min(amount, terminalTo.store.getFreeCapacity(res));

    let energyCost = Game.market.calcTransactionCost(10000, this.pos.roomName, terminalTo.pos.roomName) / 10000;
    let energyCap = Math.floor(this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    amoundSend = Math.min(amoundSend, energyCap);

    if (res === RESOURCE_ENERGY && amoundSend * (1 + energyCost) > this.terminal.store.getUsedCapacity(RESOURCE_ENERGY))
      amoundSend = Math.floor(amoundSend * (1 - energyCost));

    let ans = this.terminal.send(res, amoundSend, terminalTo.pos.roomName);
    if (ans === OK && Apiary.logger)
      Apiary.logger.newTerminalTransfer(this.terminal, terminalTo, amoundSend, res);

    return amoundSend;
  }

  getUsedCapacity(resource?: ResourceConstant) {
    let amount = this.storage.store.getUsedCapacity(resource);
    if (this.terminal) {
      let toAdd = this.terminal.store.getUsedCapacity(resource);
      if (resource === RESOURCE_ENERGY)
        toAdd = Math.max(0, toAdd - TERMINAL_ENERGY);
      amount += toAdd;
    }

    _.forEach(this.master.activeBees, bee => {
      amount += bee.store.getUsedCapacity(resource);
    });

    if (resource && resource in REACTION_TIME && this.hive.cells.lab)
      _.forEach(this.hive.cells.lab.laboratories, lab => {
        let toAdd = lab.store.getUsedCapacity(resource);
        if (toAdd)
          amount += toAdd;
      });

    return amount;
  }
}
