import { PLANNER_STAMP_STOP } from "antBrain/hivePlanner/planner-utils";
import { prefix } from "static/enums";

import type { Visuals } from "./visuals";
import { VISUAL_COLORS } from "./visuals-constants";

export function visualizePlanner(this: Visuals) {
  const ch = Apiary.colony.planner.checking;
  if (!ch) return;

  const hiveName = ch.roomName;
  if (this.objectBusy(hiveName)) return;

  // add structures
  const ap = ch.active;

  this.objectNew({}, hiveName);
  for (const pos of ch.positions)
    this.anchor.vis.circle(pos.x, pos.y, {
      fill: "#FFC82A",
      opacity: 0.5,
      stroke: "#FFA600",
      strokeWidth: 1,
    });

  this.table(
    [["                  ", "current", "best", "      "]].concat(
      _.map(
        ch.active.metrics as unknown as { [ref: string]: number },
        (value, ref) =>
          [
            ref || "NaN",
            "" + value,
            ch.best.metrics[ref as "ramps"] || "NaN",
          ] as string[]
      )
    )
  );

  // table: number of sources/minerals by roomName
  const roomResources = _.map(
    _.unique(
      _.map(ch.sources, (p) => p.roomName).concat(
        _.map(ch.minerals, (p) => p.roomName)
      )
    ),
    (roomName) => [
      roomName,
      "" + ch.sources.filter((p) => p.roomName === roomName).length,
      "" + ch.minerals.filter((p) => p.roomName === roomName).length,
    ]
  );
  this.table([["name  ", "sources", "minerals"]].concat(roomResources));

  // add info about cells
  for (const [cellRef, value] of Object.entries(ap.posCell)) {
    const SIZE = 0.3;
    const pos = { x: value[0], y: value[1] };

    const outEdge = { width: 0.15, color: VISUAL_COLORS.cells.edge };
    this.anchor.vis.line(
      pos.x - SIZE,
      pos.y - SIZE,
      pos.x + SIZE,
      pos.y + SIZE,
      outEdge
    );
    this.anchor.vis.line(
      pos.x + SIZE,
      pos.y - SIZE,
      pos.x - SIZE,
      pos.y + SIZE,
      outEdge
    );

    const style: LineStyle = {
      opacity: 0.7,
      color: VISUAL_COLORS.cells.default,
    };
    switch (cellRef) {
      case prefix.laboratoryCell:
        style.color = VISUAL_COLORS.cells.lab; // +
        break;
      case prefix.excavationCell:
        style.color = VISUAL_COLORS.cells.exav;
        break;
      case prefix.defenseCell:
        style.color = VISUAL_COLORS.cells.def; // +
        break;
      case prefix.powerCell:
        style.color = VISUAL_COLORS.cells.power; // +
        break;
      case prefix.fastRefillCell:
        style.color = VISUAL_COLORS.cells.fastRef;
        break;
      case prefix.upgradeCell:
        style.color = VISUAL_COLORS.cells.upgrade; // +
        break;
      default:
        if (
          cellRef.slice(0, prefix.resourceCells.length) ===
          (prefix.resourceCells as string)
        )
          style.color = VISUAL_COLORS.cells.res; // +
    }

    this.anchor.vis.line(
      pos.x - SIZE,
      pos.y - SIZE,
      pos.x + SIZE,
      pos.y + SIZE,
      style
    );
    this.anchor.vis.line(
      pos.x + SIZE,
      pos.y - SIZE,
      pos.x - SIZE,
      pos.y + SIZE,
      style
    );
  }

  for (const roomName in ap.rooms) {
    if (this.objectBusy(roomName)) continue;
    const plan = ap.rooms[roomName].compressed;
    this.objectNew({}, roomName);

    const vis = this.anchor.vis;
    const hive = Apiary.hives[roomName];
    if (hive) {
      this.nukeInfo(hive);
      _.forEach(hive.cells.defense.getNukeDefMap()[0], (p) =>
        vis.structure(p.pos.x, p.pos.y, STRUCTURE_RAMPART)
      );
    }

    for (const sType in plan) {
      const structureType = sType as BuildableStructureConstant;
      for (const value of plan[structureType]!.que) {
        if (value !== PLANNER_STAMP_STOP)
          vis.structure(value[0], value[1], structureType);
      }
    }
    vis.connectRoads();
  }
}
