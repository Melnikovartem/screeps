import { roomStates } from "static/enums";

export function roomStateNatural(roomName: string) {
  const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  if (!parsed) return roomStates.corridor; // failsafe
  const [x, y] = [+parsed[2] % 10, +parsed[4] % 10];
  if (x === 0 || y === 0) return roomStates.corridor;
  if (x === 5 && y === 5) return roomStates.SKcentral;
  // 4 <= x or y <= 6
  if (Math.abs(x - 5) <= 1 && Math.abs(y - 5) <= 1)
    return roomStates.SKfrontier;
  return roomStates.noOwner;
}

export function naturalResourceCapacity(
  roomName: string,
  maxPossible = true
): number {
  const state = Apiary.intel.getRoomState(roomName);
  switch (state) {
    case roomStates.ownedByMe:
    case roomStates.reservedByMe:
      return SOURCE_ENERGY_CAPACITY;
    case roomStates.SKcentral:
    case roomStates.SKfrontier:
      return SOURCE_ENERGY_KEEPER_CAPACITY;
    case roomStates.noOwner:
      if (!maxPossible) return SOURCE_ENERGY_NEUTRAL_CAPACITY;
    // fallthrough
    case roomStates.ownedByEnemy:
    case roomStates.reservedByEnemy:
    case roomStates.reservedByInvader:
      if (maxPossible) return SOURCE_ENERGY_CAPACITY;
  }
  return 0;
}
