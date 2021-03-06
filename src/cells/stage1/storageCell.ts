import { Cell } from "../_Cell";
import { ManagerMaster } from "../../beeMasters/economy/manager";
import { TransferRequest } from "../../bees/transferRequest";

import { prefix, hiveStates } from "../../enums";
import { BASE_MINERALS } from "./laboratoryCell";
// import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Hive, ResTarget } from "../../Hive";

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.1);

@profile
export class StorageCell extends Cell {

  storage: StructureStorage | StructureTerminal;
  link: StructureLink | undefined;
  linkState: { using: string, priority: 0 | 1, lastUpdated: number } | undefined;
  terminal: StructureTerminal | undefined;
  master: ManagerMaster;

  requests: { [id: string]: TransferRequest } = {};
  resTargetTerminal: { "energy": number } & ResTarget = {
    energy: TERMINAL_ENERGY,
  };

  usedCapacity: ResTarget = {}

  constructor(hive: Hive, storage: StructureStorage | StructureTerminal) {
    super(hive, prefix.storageCell + "_" + hive.room.name);
    this.storage = storage;
    this.terminal = this.hive.room.terminal;
    this.master = new ManagerMaster(this);
    this.findLink();
  }

  requestFromStorage(objects: TransferRequest["to"][], priority: TransferRequest["priority"]
    , res: TransferRequest["resource"], amount: number = Infinity, fitStore = false): number {
    let sum = 0;
    let prev: TransferRequest | undefined;
    for (let i = 0; i < objects.length; ++i) {
      let ref = objects[i].id;
      let existing = this.requests[ref];
      let amountCC = amount;
      if (fitStore)
        amountCC = Math.min(amountCC, (<Store<ResourceConstant, false>>objects[i].store).getFreeCapacity(res));
      if (existing && existing.priority <= priority) {
        if (existing.resource === res && existing.to.id === ref)
          existing.amount = amountCC;
        continue;
      }
      if (amountCC <= 0)
        continue;
      let request = new TransferRequest(ref, this.storage, objects[i], priority, res, amountCC);
      if (!request.isValid())
        continue;
      this.requests[ref] = request;
      if (prev)
        this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  requestToStorage(objects: TransferRequest["from"][], priority: TransferRequest["priority"]
    , res: TransferRequest["resource"], amount: number = Infinity, fitStore = false): number {
    let sum = 0;
    let prev: TransferRequest | undefined;
    amount = Math.min(amount, this.storage.store.getFreeCapacity(res));
    for (let i = 0; i < objects.length; ++i) {
      let ref = objects[i].id;
      let existing = this.requests[ref];
      if (existing && existing.priority <= priority)
        continue;
      let amountCC = amount;
      if (fitStore && !(objects[i] instanceof Resource))
        amountCC = Math.min(amountCC, (<Store<ResourceConstant, false>>(<Exclude<TransferRequest["from"], Resource>>objects[i]).store).getUsedCapacity(res));
      if (amountCC <= 0)
        continue;
      let request = new TransferRequest(ref, objects[i], this.storage, priority, res, amountCC);
      if (!request.isValid())
        continue;
      this.requests[ref] = request;
      if (prev)
        this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  pickupResources() {
    let resources = this.hive.room.find(FIND_DROPPED_RESOURCES).filter(r => r.resourceType !== RESOURCE_ENERGY || r.amount >= 100);
    let tombstones = this.hive.room.find(FIND_TOMBSTONES).filter(t => t.store.getUsedCapacity() > 0);
    let enemies = Apiary.intel.getInfo(this.hive.roomName, 10).enemies.map(e => e.object);
    let rrs = (<(Resource | Tombstone)[]>resources).concat(tombstones);
    if (enemies.length)
      rrs = rrs.filter(rr => {
        let enemy = rr.pos.findClosest(enemies)!;
        if (enemy.pos.getRangeTo(rr) > 4 && !this.hive.cells.defense.wasBreached(enemy.pos, rr.pos))
          return true;
        delete this.requests[rr.id];
        return false;
      });
    return this.requestToStorage(rrs, 6, undefined, 1200, true);
  }

  findLink() {
    this.link = <StructureLink | undefined>_.filter(this.pos.findInRange(FIND_MY_STRUCTURES, 2),
      structure => structure.structureType === STRUCTURE_LINK)[0];
  }

  update() {
    super.update();
    this.usedCapacity = {};
    if (!this.storage && Apiary.useBucket) {
      Apiary.destroyTime = Game.time;
      return;
    }

    if (!this.link && this.hive.controller.level >= 5)
      this.findLink();

    for (let k in this.requests)
      this.requests[k].update();

    if (!this.linkState) {
      if (this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5)
        this.requestToStorage([this.link], this.hive.state >= hiveStates.battle ? 1 : 4, RESOURCE_ENERGY);
    } else if (this.linkState.lastUpdated + 5 <= Game.time)
      this.linkState = undefined;

    this.hive.stateChange("lowenergy", this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 10000);
    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 4000 && !this.hive.cells.dev && Apiary.useBucket)
      Apiary.destroyTime = Game.time;

    //if (!Object.keys(this.requests).length)
    if (this.storage instanceof StructureStorage)
      this.updateTerminal();
    else if (this.hive.room.storage)
      Apiary.destroyTime = Game.time;
  }

  updateTerminal() {
    if (Game.time % 4 !== 0)
      return;
    if (!this.terminal) {
      if (this.hive.room.terminal && Apiary.useBucket)
        Apiary.destroyTime = Game.time;
      return;
    }

    /* if (Game.flags[prefix.terminal + this.hive.roomName]) {
      if (this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < this.resTargetTerminal[RESOURCE_ENERGY])
        this.requestFromStorage([this.terminal], 4, RESOURCE_ENERGY);
      else {
        let res = findOptimalResource(this.storage.store, -1);
        this.requestFromStorage([this.terminal], 4, res);
      }
      return;
    } */

    for (let r in this.terminal.store) {
      let res = <ResourceConstant>r;
      if (!this.resTargetTerminal[res]) {
        let used = this.terminal.store.getUsedCapacity(res);
        if ((used > 1000 || !Object.keys(this.requests).length)
          && this.requestToStorage([this.terminal], res === RESOURCE_ENERGY && this.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000 ? 4 : 2, res, Math.min(used, 3000)) > 0)
          return;
      }
    }

    for (let r in this.resTargetTerminal) {
      let res = <ResourceConstant>r;
      let balance = this.terminal.store.getUsedCapacity(res) - this.resTargetTerminal[res]!;
      if (balance < 0) {
        if (this.requestFromStorage([this.terminal], 4, res, Math.min(-balance, 3000)) > 0)
          return;
      } else if (balance > 1000 || !Object.keys(this.requests).length) {
        if (this.requestToStorage([this.terminal], res === RESOURCE_ENERGY && this.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000 ? 4 : 2, res, Math.min(balance, 3000)) > 0)
          return;
      }
    }
  }

  run() {
    for (let k in this.requests) {
      if (!this.requests[k].isValid())
        delete this.requests[k];
    }
  }

  getUsedCapacity(resource: ResourceConstant) {
    if (this.usedCapacity[resource])
      return this.usedCapacity[resource]!;
    let amount = this.storage.store.getUsedCapacity(resource);
    if (this.terminal) {
      let toAdd = this.terminal.store.getUsedCapacity(resource);
      if (resource && resource in this.resTargetTerminal)
        toAdd = Math.max(0, toAdd - this.resTargetTerminal[resource]!);
      amount += toAdd;
    }

    _.forEach(this.master.activeBees, bee => {
      amount += bee.store.getUsedCapacity(resource);
    });

    if ((resource in REACTION_TIME || BASE_MINERALS.includes(resource)) && this.hive.cells.lab)
      _.forEach(this.hive.cells.lab.laboratories, lab => {
        let toAdd = lab.store.getUsedCapacity(resource);
        if (toAdd)
          amount += toAdd;
      });

    if (this.hive.cells.factory)
      amount += this.hive.cells.factory.factory.store.getUsedCapacity(resource);
    if (this.hive.cells.power)
      switch (resource) {
        case RESOURCE_OPS:
          let powerManager = this.hive.cells.power.powerManagerBee;
          if (powerManager)
            amount += powerManager.store.getUsedCapacity(resource);
          break;
        case RESOURCE_POWER:
          amount += this.hive.cells.power.powerSpawn.store.getUsedCapacity(resource);
          break;
      }
    this.usedCapacity[resource] = amount;
    return amount;
  }
}
