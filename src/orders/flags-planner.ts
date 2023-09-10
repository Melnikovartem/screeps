import type { FlagCommand } from "./flagCommands";

// can be only one of this at each time cause they create checking object on planner
const ONLY_ONE_ACTIVE_PLAN: number[] = [
  COLOR_BLUE,
  COLOR_YELLOW,
  COLOR_CYAN,
  COLOR_ORANGE,
];

export function actPlanner(cm: FlagCommand) {
  // remove other active ones so that it can do it's job
  if (ONLY_ONE_ACTIVE_PLAN.includes(cm.flag.secondaryColor))
    _.forEach(Apiary.flags, (o) => {
      if (
        o.color === COLOR_WHITE &&
        ONLY_ONE_ACTIVE_PLAN.includes(o.secondaryColor) &&
        o.ref !== cm.ref
      )
        o.delete();
    });

  const pl = Apiary.colony.planner;

  switch (cm.secondaryColor) {
    case COLOR_BLUE: {
      // create plan for new room
      if (!pl.canStartNewPlan) {
        if ((Game.time - cm.createTime) % 100 === 0)
          console.log(`!CAN'T START PLAN @${cm.print}`);
        cm.acted = false;
        return;
      }
      pl.createPlan(cm.pos.roomName, [], [cm.pos]);
      console.log(`STARTED PLAN @${cm.pos.print}`);
      break;
    }
    case COLOR_CYAN: {
      // create plan for hive (placed inside one)
      if (cm.hiveName !== cm.pos.roomName) return;
      if (!pl.canStartNewPlan) {
        if ((Game.time - cm.createTime) % 100 === 0)
          console.log(`!CAN'T START PLAN @${cm.hive.print}`);
        cm.acted = false;
        return;
      }
      pl.createPlan(cm.hiveName, cm.hive.annexNames, [cm.pos, cm.hive.pos]);
      console.log(`STARTED PLAN @${cm.hive.print}`);
      break;
    }
    case COLOR_YELLOW:
      // create annex roads for hive
      if (!pl.canStartNewPlan) {
        if ((Game.time - cm.createTime) % 100 === 0)
          console.log(`!CAN'T START ROADS @${cm.print}`);
        cm.acted = false;
        return;
      }
      pl.createRoads(cm.hive);
      console.log(`STARTED ROADS @${cm.hive.print}`);
      break;
    case COLOR_ORANGE:
      if (!pl.checking) pl.justShow(cm.hiveName);
      // keep this flag to show plan
      cm.acted = false;
      break;
    case COLOR_RED: {
      const roomMatrix =
        pl.checking && pl.checking.active.rooms[cm.pos.roomName];
      if (!roomMatrix) {
        console.log(`NO PLAN FOUND @${cm.pos.print}`);
        return;
      }

      let sType = cm.ref.split("_")[0];
      if (sType === "wall") sType = STRUCTURE_WALL;

      if (sType in CONTROLLER_STRUCTURES)
        pl.addStructure(
          cm.pos,
          sType as BuildableStructureConstant,
          roomMatrix
        );
      else if (sType === "null") pl.emptySpot(cm.pos);
      else console.log(`NOT KNOWN STRUCTURE TYPE ${cm.print}`);
      break;
    }
    case COLOR_BROWN: {
      // clean from hostile stuff room
      const room = Game.rooms[cm.pos.roomName];
      if (room && room.controller && room.controller.my) {
        _.forEach(room.find(FIND_HOSTILE_STRUCTURES), (s) => s.destroy());
        _.forEach(room.find(FIND_HOSTILE_CONSTRUCTION_SITES), (c) =>
          c.remove()
        );
      }
      break;
    }
    case COLOR_GREY:
      // save current to active
      break;
    case COLOR_GREEN: {
      if (!pl.checking) {
        console.log("NO PLAN TO SAVE");
        return;
      }
      const metric = pl.recalcMetricsActive();
      pl.savePlan();
      console.log(`PLAN SAVED @${pl.checking?.roomName || "NONE"} : ${metric}`);
      break;
    }
    case COLOR_PURPLE: {
      if (!pl.checking) {
        console.log(`NO PLAN FOUND @${cm.pos.print}`);
        return;
      }
      const ap = pl.checking.active;
      const pos = ap.centers[0] as RoomPosition;
      const center = new RoomPosition(
        pos.x,
        pos.y,
        pos.roomName || cm.pos.roomName
      );
      const ans = pl.addRoad(center, cm.pos, ap);
      if (ans[0] === OK) console.log("ROAD ADDED @" + cm.print);
      else console.log("!ROAD INCOMPLETE @" + cm.print);
      break;
    }
  }
}

export function deletePlanner(cm: FlagCommand) {
  // if all white flags are gone remove
  // there should be white - orange one left
  // if only active left remove checking so it can do it's job
  if (
    !_.filter(
      Apiary.flags,
      (o) =>
        o.color === COLOR_WHITE &&
        cm.ref !== o.ref &&
        !ONLY_ONE_ACTIVE_PLAN.includes(cm.secondaryColor)
    ).length
  )
    Apiary.colony.planner.checking = undefined;
}
