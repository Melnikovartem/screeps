import { ClearMaster } from "beeMasters/civil/clear";
import { HelpTransferMaster } from "beeMasters/civil/helpTransfer";
import { HelpUpgradeMaster } from "beeMasters/civil/helpUpgrade";
import { PickupMaster } from "beeMasters/civil/pickup";
import { DepositMaster } from "beeMasters/corridorMining/deposit";
import { PowerMaster } from "beeMasters/corridorMining/power";
import { findOptimalResource } from "static/utils";

import type { FlagOrder } from "./order";

export function actCivil(order: FlagOrder) {
  if (!order.hive.cells.storage) {
    order.delete();
    return;
  }
  if (!order.master)
    switch (order.secondaryColor) {
      case COLOR_GREEN:
        if (!order.master) {
          const hive = Apiary.hives[order.pos.roomName];
          if (hive && hive.cells.storage && !order.ref.includes("manual")) {
            // if inside room move by storage system
            let targets: (Tombstone | Ruin | Resource | StructureStorage)[] =
              order.pos.lookFor(LOOK_RESOURCES).filter((r) => r.amount > 0);
            targets = targets.concat(
              order.pos
                .lookFor(LOOK_RUINS)
                .filter((r) => r.store.getUsedCapacity() > 0)
            );
            targets = targets.concat(
              order.pos
                .lookFor(LOOK_TOMBSTONES)
                .filter((r) => r.store.getUsedCapacity() > 0)
            );
            const resources: Resource[] = [];
            _.forEach(targets, (t) => {
              if (t instanceof Resource) resources.push(t);
              else
                hive.cells.storage!.requestToStorage(
                  [t],
                  1,
                  findOptimalResource(t.store)
                );
            });
            hive.cells.storage.requestToStorage(resources, 1, undefined);
            if (!targets.length) order.delete();
            order.acted = false;
            return;
          }
          // pickup it up
          order.master = new PickupMaster(order);
          const regex = /^\d*/.exec(order.ref);
          if (regex && regex[0]) order.master.maxSpawns = +regex[0];
          order.master.targetBeeCount = order.master.maxSpawns;
        }
        break;
      case COLOR_WHITE:
        if (Apiary.hives[order.pos.roomName])
          order.master = new HelpUpgradeMaster(order);
        else order.delete();
        break;
      case COLOR_GREY:
        if (Apiary.hives[order.pos.roomName])
          order.master = new HelpTransferMaster(order);
        else order.delete();
        break;
      case COLOR_YELLOW:
        if (order.hive.puller)
          order.master = new PowerMaster(order, order.hive.puller);
        break;
      case COLOR_BLUE:
        if (order.hive.puller)
          order.master = new DepositMaster(order, order.hive.puller);
        break;
      case COLOR_RED:
        order.master = new ClearMaster(order);
        break;
    }
}
