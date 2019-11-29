'use strict';

// Only eat food if there's a potential path from the food back to snake's own tail
function shouldEatFood(foodPoint, mySnake, board) {
  const {body} = mySnake;
  const stepsToFood = countStepsBetweenPoints(body[0], foodPoint);
  const boardNodes = buildBoardNodes(board, stepsToFood);
  const myTail = body[body.length - 1];
  return pathExists(foodPoint, myTail, boardNodes);
}

function countStepsBetweenPoints(pointA, pointB) {
  return Math.abs(pointA.x - pointB.x) + Math.abs(pointA.y - pointB.y);
}

function buildBoardNodes(board, numStepsToFood) {
  const boardNodes = [];

  // Build board
  for (let x = 0; x < board.width; x++) {
    const nodes = [];
    for (let y = 0; y < board.height; y++) {
      nodes[y] = createNode(x, y);
    }
    boardNodes[x] = nodes;
  }

  // Set snake locations
  for (const {body} of board.snakes) {
    for (let i = 0; i < body.length - numStepsToFood; i++) { // Ignore body parts that won't exist
      const point = body[i];
      boardNodes[point.x][point.y].hasSnake = true;
    }
  }

  return boardNodes;
}

function createNode(x, y) {
  return {
    x,
    y,
    hasSnake: false,
    discovered: false,
  };
}

function pathExists(startPoint, targetPoint, boardNodes) {
  const searchQueue = [
    boardNodes[startPoint.x][startPoint.y],
  ];

  while (searchQueue.length > 0) {
    const node = searchQueue.shift();

    for (const siblingNode of getSiblingNodes(node, boardNodes)) {
      if (siblingNode.hasSnake) {
        continue;
      }

      if (siblingNode.x === targetPoint.x && siblingNode.y === targetPoint.y) {
        return true; // Found path to target
      }

      if (siblingNode.discovered) {
        continue;
      }

      siblingNode.discovered = true;
      searchQueue.push(siblingNode);
    }
  }

  return false;
}

function getSiblingNodes(node, boardNodes) {
  const siblings = [];

  if (node.x > 0) {
    siblings.push(boardNodes[node.x - 1][node.y]);
  }
  if (node.x < boardNodes.length - 1) {
    siblings.push(boardNodes[node.x + 1][node.y]);
  }
  if (node.y > 0) {
    siblings.push(boardNodes[node.x][node.y - 1]);
  }
  if (node.y < boardNodes.length - 1) {
    siblings.push(boardNodes[node.x][node.y + 1]);
  }

  return siblings;
}

module.exports = shouldEatFood;
