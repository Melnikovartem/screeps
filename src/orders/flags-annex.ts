import { PuppetMaster } from "beeMasters/civil/puppet";
import { AnnexMaster } from "beeMasters/economy/annexer";
import { SKMaster } from "beeMasters/war/safeSK";
import { hiveStates, prefix, roomStates } from "static/enums";

import type { FlagCommand } from "./flagCommands";

export function actAnnex(order: FlagCommand) {
  switch (order.secondaryColor) {
    case COLOR_PURPLE:
      if (order.pos.getRoomRangeTo(order.hive, "path") >= 6) {
        order.delete();
        break;
      }

      if (!order.fixedName(prefix.reserve + order.pos.roomName)) break;

      if (!order.master) {
        const roomState = Apiary.intel.getInfo(
          order.pos.roomName,
          Infinity
        ).roomState;
        switch (roomState) {
          case roomStates.ownedByMe:
            if (
              Apiary.hives[order.pos.roomName] &&
              Apiary.hives[order.pos.roomName].phase > 0
            )
              order.delete();
            else order.hive.addAnex(order.pos.roomName);
            break;
          case roomStates.reservedByEnemy:
          case roomStates.reservedByInvader:
          case roomStates.noOwner:
          case roomStates.reservedByMe:
            order.hive.addAnex(order.pos.roomName);
            if (order.hive.room.energyCapacityAvailable < 650) {
              order.master = new PuppetMaster(order);
              order.master.maxSpawns = Infinity;
            } else order.master = new AnnexMaster(order);
            break;
          case roomStates.SKfrontier:
            if (
              order.hive.room.energyCapacityAvailable >= 5500 &&
              !order.hive.bassboost
            ) {
              order.master = new SKMaster(order);
              order.hive.addAnex(order.pos.roomName);
            }
            break;
          case roomStates.SKcentral:
            if (
              order.hive.room.energyCapacityAvailable >= 5500 &&
              !order.hive.bassboost
            )
              order.hive.addAnex(order.pos.roomName);
            order.master = new PuppetMaster(order);
            order.master.maxSpawns = Infinity;
            break;
          default:
            order.delete();
        }
      }
      break;
    case COLOR_GREY:
      if (Object.keys(Apiary.hives).length < Game.gcl.level) {
        order.cre();
      } else order.acted = false;
      break;
    case COLOR_WHITE: {
      order.acted = false;
      const hiveToBoos = Apiary.hives[order.pos.roomName];
      if (!hiveToBoos || order.pos.roomName === order.hiveName) {
        order.delete();
        break;
      }

      if (!order.fixedName(prefix.boost + order.pos.roomName)) break;

      if (order.hive.state !== hiveStates.economy) {
        hiveToBoos.bassboost = null;
        break;
      }

      if (hiveToBoos.bassboost) {
        if (order.hive.phase > 0 && hiveToBoos.state === hiveStates.economy)
          order.delete();
        break;
      }

      hiveToBoos.bassboost = order.hive;
      hiveToBoos.cells.spawn.spawnQue = [];
      _.forEach(Apiary.masters, (c) => {
        if (c.hive.roomName === order.pos.roomName) c.waitingForBees = 0;
      });
      if (hiveToBoos.cells.dev && hiveToBoos.cells.dev.master)
        hiveToBoos.cells.dev.master.recalculateTargetBee();
      break;
    }
  }
}

export function deleteAnnex(order: FlagCommand) {
  switch (order.secondaryColor) {
    case COLOR_WHITE: {
      const hiveBoosted = Apiary.hives[order.pos.roomName];
      if (hiveBoosted) {
        hiveBoosted.bassboost = null;
        if (hiveBoosted.cells.dev && hiveBoosted.cells.dev.master)
          hiveBoosted.cells.dev.master.recalculateTargetBee();
      }
      break;
    }
    case COLOR_PURPLE: {
      const index = order.hive.annexNames.indexOf(order.pos.roomName);
      if (index !== -1) order.hive.annexNames.splice(index, 1);
      if (!Apiary.hives[order.pos.roomName])
        _.forEach(
          _.filter(
            Game.flags,
            (f) =>
              f.color === COLOR_YELLOW && f.pos.roomName === order.pos.roomName
          ),
          (f) => f.remove()
        );
      for (const ref in order.hive.cells.excavation.resourceCells)
        if (
          order.hive.cells.excavation.resourceCells[ref].pos.roomName ===
          order.pos.roomName
        ) {
          order.hive.cells.excavation.resourceCells[ref].master.delete();
          delete order.hive.cells.excavation.resourceCells[ref];
        }
      break;
    }
  }
}
