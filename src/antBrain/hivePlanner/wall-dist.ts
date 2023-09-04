export const ROOM_DIMENTIONS = 50;

/**
 * This is good for anything that isn't a diagonal, as searches all adjacent tiles when finding distance
 */
export function distanceTransform(
  initialCM: CostMatrix,
  roomVisual?: RoomVisual,
  x1 = 0,
  y1 = 0,
  x2 = ROOM_DIMENTIONS - 1,
  y2 = ROOM_DIMENTIONS - 1
) {
  // Use a costMatrix to record distances

  const distanceCM = new PathFinder.CostMatrix();

  let x;
  let y;

  for (
    x = Math.max(x1 - 1, 0);
    x < Math.min(x2 + 1, ROOM_DIMENTIONS - 1);
    x += 1
  ) {
    for (
      y = Math.max(y1 - 1, 0);
      y < Math.min(y2 + 1, ROOM_DIMENTIONS - 1);
      y += 1
    ) {
      distanceCM.set(x, y, initialCM.get(x, y) === 255 ? 0 : 255);
    }
  }

  let top;
  let left;
  let topLeft;
  let topRight;
  let bottomLeft;

  // Loop through the xs and ys inside the bounds

  for (x = x1; x <= x2; x += 1) {
    for (y = y1; y <= y2; y += 1) {
      top = distanceCM.get(x, y - 1);
      left = distanceCM.get(x - 1, y);
      topLeft = distanceCM.get(x - 1, y - 1);
      topRight = distanceCM.get(x + 1, y - 1);
      bottomLeft = distanceCM.get(x - 1, y + 1);

      distanceCM.set(
        x,
        y,
        Math.min(
          Math.min(top, left, topLeft, topRight, bottomLeft) + 1,
          distanceCM.get(x, y)
        )
      );
    }
  }

  let bottom;
  let right;
  let bottomRight;

  // Loop through the xs and ys inside the bounds

  for (x = x2; x >= x1; x -= 1) {
    for (y = y2; y >= y1; y -= 1) {
      bottom = distanceCM.get(x, y + 1);
      right = distanceCM.get(x + 1, y);
      bottomRight = distanceCM.get(x + 1, y + 1);
      topRight = distanceCM.get(x + 1, y - 1);
      bottomLeft = distanceCM.get(x - 1, y + 1);

      distanceCM.set(
        x,
        y,
        Math.min(
          Math.min(bottom, right, bottomRight, topRight, bottomLeft) + 1,
          distanceCM.get(x, y)
        )
      );
    }
  }

  if (roomVisual) {
    // Loop through the xs and ys inside the bounds

    for (x = x1; x <= x2; x += 1) {
      for (y = y1; y <= y2; y += 1) {
        roomVisual.rect(x - 0.5, y - 0.5, 1, 1, {
          fill: `hsl(${200}${distanceCM.get(x, y) * 10}, 100%, 60%)`,
          opacity: 0.4,
        });
      }
    }
  }

  return distanceCM;
}

/**
 * This is good for finding open diamond-shaped areas, as it voids adjacent diagonal tiles when finding distance
 */
export function diagonalDistanceTransform(
  initialCM: CostMatrix,
  roomVisual?: RoomVisual,
  x1 = 0,
  y1 = 0,
  x2 = ROOM_DIMENTIONS - 1,
  y2 = ROOM_DIMENTIONS - 1
) {
  // Use a costMatrix to record distances

  const distanceCM = new PathFinder.CostMatrix();

  let x;
  let y;

  for (x = x1; x <= x2; x += 1) {
    for (y = y1; y <= y2; y += 1) {
      distanceCM.set(x, y, initialCM.get(x, y) === 255 ? 0 : 255);
    }
  }

  let top;
  let left;

  // Loop through the xs and ys inside the bounds

  for (x = x1; x <= x2; x += 1) {
    for (y = y1; y <= y2; y += 1) {
      top = distanceCM.get(x, y - 1);
      left = distanceCM.get(x - 1, y);

      distanceCM.set(
        x,
        y,
        Math.min(Math.min(top, left) + 1, distanceCM.get(x, y))
      );
    }
  }

  let bottom;
  let right;

  // Loop through the xs and ys inside the bounds

  for (x = x2; x >= x1; x -= 1) {
    for (y = y2; y >= y1; y -= 1) {
      bottom = distanceCM.get(x, y + 1);
      right = distanceCM.get(x + 1, y);

      distanceCM.set(
        x,
        y,
        Math.min(Math.min(bottom, right) + 1, distanceCM.get(x, y))
      );
    }
  }

  if (roomVisual) {
    // Loop through the xs and ys inside the bounds

    for (x = x1; x <= x2; x += 1) {
      for (y = y1; y <= y2; y += 1) {
        roomVisual.rect(x - 0.5, y - 0.5, 1, 1, {
          fill: `hsl(${200}${distanceCM.get(x, y) * 10}, 100%, 60%)`,
          opacity: 0.4,
        });
      }
    }
  }

  return distanceCM;
}
