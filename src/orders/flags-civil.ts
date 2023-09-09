import type { PickupInfo } from "beeMasters/civil/pickup";
import { findOptimalResource } from "static/utils";

import type { FlagCommand } from "./flagCommands";
import { SWARM_MASTER } from "./swarm-nums";

export function actCivil(command: FlagCommand) {
  if (!command.hive.cells.storage) {
    command.delete();
    return;
  }

  switch (command.secondaryColor) {
    case COLOR_GREEN: {
      command.acted = false;
      const hive = Apiary.hives[command.pos.roomName];
      if (hive && hive.cells.storage && !command.ref.includes("manual")) {
        // if inside room move by storage system
        let targets: (Tombstone | Ruin | Resource | StructureStorage)[] =
          command.pos.lookFor(LOOK_RESOURCES).filter((r) => r.amount > 0);
        targets = targets.concat(
          command.pos
            .lookFor(LOOK_RUINS)
            .filter((r) => r.store.getUsedCapacity() > 0)
        );
        targets = targets.concat(
          command.pos
            .lookFor(LOOK_TOMBSTONES)
            .filter((r) => r.store.getUsedCapacity() > 0)
        );
        const resources: Resource[] = [];
        _.forEach(targets, (t) => {
          if (t instanceof Resource) resources.push(t);
          else
            hive.cells.storage.requestToStorage(
              [t],
              1,
              findOptimalResource(t.store)
            );
        });
        hive.cells.storage.requestToStorage(resources, 1, undefined);
        if (!targets.length) command.delete();
        command.acted = false;
        return;
      }
      // pickup it up
      const order = command.createSwarm(SWARM_MASTER.pickup);
      if (!order) return;
      const regex = /^\d*/.exec(command.ref);
      if (regex && regex[0]) (order.special as PickupInfo).tc = +regex[0];
      break;
    }
    case COLOR_WHITE:
      if (Apiary.hives[command.pos.roomName])
        command.createSwarm(SWARM_MASTER.helpupgrade);
      else command.delete();
      break;
    case COLOR_GREY:
      if (Apiary.hives[command.pos.roomName])
        command.createSwarm(SWARM_MASTER.helptransfer);
      else command.delete();
      break;
    case COLOR_YELLOW:
      if (command.hive.cells.observe) {
        const room = Game.rooms[command.pos.roomName];
        if (!room) {
          command.acted = false;
          Apiary.oracle.requestSight(command.pos.roomName);
          return;
        }
        command.hive.cells.observe.powerCheck(room);
      }
      break;
    case COLOR_BLUE:
      if (command.hive.cells.observe) {
        const room = Game.rooms[command.pos.roomName];
        if (!room) {
          command.acted = false;
          Apiary.oracle.requestSight(command.pos.roomName);
          return;
        }
        command.hive.cells.observe.depositCheck(room);
      }
      break;
    case COLOR_RED:
      command.createSwarm(SWARM_MASTER.clear);
      break;
  }
}
