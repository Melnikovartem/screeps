import type { BuildProject } from "hive/hive";
import { getCase, makeId } from "static/utils";

const CONSTRUCTIONS_PER_TYPE = 5;

export function checkBuildings(
  roomName: string,
  priorityQue: BuildableStructureConstant[],
  nukeAlert: boolean,
  specials: { [key in StructureConstant]?: number } = {},
  coef = 0.7
): [BuildProject[], number] {
  if (!(roomName in Game.rooms) || !Memory.cache.roomPlanner[roomName])
    return [[], 0];

  const contr = Game.rooms[roomName].controller;
  const hive = Apiary.hives[roomName];
  let controller: StructureController | { level: number } | undefined = contr;
  if (!controller) controller = { level: 0 };

  const ans: BuildProject[] = [];
  let constructions = 0;
  const defenseIndex = Math.min(
    priorityQue.indexOf(STRUCTURE_RAMPART),
    priorityQue.indexOf(STRUCTURE_WALL)
  );
  const firstDefense = defenseIndex > 0 ? priorityQue[defenseIndex] : "";
  let energyCost = 0;
  for (const sType of priorityQue) {
    if (ans.length && sType === firstDefense) break;
    if (!(sType in Memory.cache.roomPlanner[roomName])) continue;
    const cc = getCase({
      structureType: sType,
      pos: { roomName },
      hitsMax: 0,
    });
    const toadd: RoomPosition[] = [];
    let placed = 0;
    const positions = Memory.cache.roomPlanner[roomName][sType]!.pos;
    for (const positionToPut of positions) {
      const pos = new RoomPosition(positionToPut.x, positionToPut.y, roomName);
      const structure = _.filter(
        pos.lookFor(LOOK_STRUCTURES),
        (s) => s.structureType === sType
      )[0] as Structure<BuildableStructureConstant> | undefined;
      if (!structure) {
        const constructionSite = _.filter(
          pos.lookFor(LOOK_CONSTRUCTION_SITES),
          (s) => s.structureType === sType
        )[0];
        if (!constructionSite) {
          const place = _.filter(
            pos.lookFor(LOOK_STRUCTURES),
            (s) =>
              s.structureType !== STRUCTURE_RAMPART ||
              !(s as StructureRampart).my
          )[0];
          if (place && sType !== STRUCTURE_RAMPART) {
            if (hive) {
              if (
                sType !== STRUCTURE_SPAWN ||
                Object.keys(hive.cells.spawn).length > 1
              )
                place.destroy();
            } else if (
              !place.pos
                .lookFor(LOOK_FLAGS)
                .filter(
                  (f) =>
                    f.color === COLOR_GREY && f.secondaryColor === COLOR_RED
                ).length
            )
              place.pos.createFlag(
                "remove_" + makeId(4),
                COLOR_GREY,
                COLOR_RED
              );
          } else toadd.push(pos);
        } else if (constructionSite.structureType === sType) {
          ans.push({
            pos,
            sType,
            targetHits: 0,
            energyCost:
              constructionSite.progressTotal - constructionSite.progress,
            type: "construction",
          });
          ++constructions;
          if (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL) {
            let heal = getCase(constructionSite).heal;
            if (sType in specials) heal = specials[sType]!;
            ans.push({
              pos,
              sType,
              targetHits: heal,
              energyCost: Math.ceil(heal / 100),
              type: "repair",
            });
          }
        } else if (
          constructionSite.my &&
          constructionSite.structureType !== STRUCTURE_RAMPART &&
          sType !== STRUCTURE_RAMPART
        )
          constructionSite.remove();
      } else if (structure) {
        placed++;
        let heal = getCase(structure).heal;
        if (sType in specials) heal = specials[sType]!;
        if (
          nukeAlert &&
          (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL)
        ) {
          const nukeDmg = _.sum(pos.findInRange(FIND_NUKES, 2), (n) =>
            !n.pos.getRangeTo(pos) ? NUKE_DAMAGE[0] : NUKE_DAMAGE[2]
          );
          if (nukeDmg > 0 && nukeDmg <= heal * 2)
            heal = nukeDmg / coef + heal / 2;
          else if (nukeDmg > heal) heal = 0;
        }
        if (structure.hits < heal * coef)
          ans.push({
            pos,
            sType,
            targetHits: heal,
            energyCost: Math.ceil((heal - structure.hits) / 100),
            type: "repair",
          });
      }
    }
    energyCost += _.sum(ans, (bProject) => bProject.energyCost);
    if (!constructions)
      for (let i = 0; i < toadd.length && i < cc.amount - placed; ++i) {
        let anss;
        if (
          constructions < CONSTRUCTIONS_PER_TYPE &&
          (!nukeAlert || !toadd[i].findInRange(FIND_NUKES, 2).length)
        )
          if (sType === STRUCTURE_SPAWN)
            anss = toadd[i].createConstructionSite(
              sType,
              roomName.toLowerCase() + makeId(4)
            );
          else anss = toadd[i].createConstructionSite(sType);
        if (anss === OK) {
          ans.push({
            pos: toadd[i],
            sType,
            targetHits: 0,
            energyCost: CONSTRUCTION_COST[sType],
            type: "construction",
          });
          ++constructions;
        }
        energyCost += CONSTRUCTION_COST[sType];
        if (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL) {
          let heal = getCase({
            structureType: sType,
            pos: toadd[i],
            hitsMax: WALL_HITS_MAX,
          }).heal;
          if (sType in specials) heal = specials[sType]!;
          if (anss === OK)
            ans.push({
              pos: toadd[i],
              sType,
              targetHits: heal,
              energyCost: Math.ceil(heal / 100),
              type: "repair",
            });
          energyCost += Math.ceil(heal / 100);
        }
      }
  }
  return [ans, energyCost];
}
