'use strict';

const bodyParser = require('@medley/body-parser');
const logger = require('./logger');
const shouldEatFood = require('./shouldEatFood');

module.exports = {
  method: 'POST',
  path: '/move',
  preHandler: bodyParser.json(),
  handler: function handleMove(req, res) {
    const move = getMove(req.body);
    logger.info('Move:', move);
    res.send({move});
  },
};

function getHead(snake) {
  return snake.body[0];
}

function getMove(game) {
  const {
    board,
    you: snake,
  } = game;
  const head = getHead(snake);
  const boardNodes = buildBoardNodes(board, head);
  const targets = getTargets(board, snake, boardNodes);

  logger.info('Location:', head, 'Length:', snake.body.length);
  logger.debug('Targets:', targets);

  for (let i = 0; i < targets.length; i++) {
    const pathToTarget = getPathToTarget(targets[i], snake, board, boardNodes);

    if (pathToTarget !== null) {
      // logger.debug('Path to Target:', pathToTarget.map(point => ({x: point.x, y: point.y})));
      return getDirectionToPoint(head, pathToTarget[0]);
    }

    resetBoardNodes(boardNodes);
  }

  const fallbackTarget = getFarthestReachablePoint(head, boardNodes);
  logger.debug('Fallback target:', fallbackTarget);
  const pathToTarget = getPathToTarget(fallbackTarget, snake, board, boardNodes);

  if (pathToTarget !== null) {
    // logger.debug('Path to Target:', pathToTarget.map(point => ({x: point.x, y: point.y})));
    return getDirectionToPoint(head, pathToTarget[0]);
  }

  const fallbackPoint = getAnySafePoint(head, board, boardNodes);
  logger.debug('Fallback point:', fallbackPoint);
  if (fallbackPoint !== null) {
    return getDirectionToPoint(head, fallbackPoint);
  }

  return 'up'; // Should only reach here if all is lost
}

function getDirectionToPoint(head, point) {
  if (point.x > head.x) {
    return 'right';
  }
  if (point.x < head.x) {
    return 'left';
  }
  return point.y < head.y
    ? 'up'
    : 'down';
}

function getTargets(board, mySnake, boardNodes) {
  const {food, snakes} = board;
  const myHead = getHead(mySnake);
  const targets = [];

  for (const foodPoint of food) {
    if (shouldEatFood(foodPoint, mySnake, board, boardNodes)) {
      targets.push({
        point: foodPoint,
        distance: distanceBetweenPoints(myHead, foodPoint),
      });
    } else {
      logger.info('Did not eat food because afraid of cornering self:', foodPoint);
    }
  }

  for (const snake of snakes) {
    if (!shouldAttackSnake(snake, mySnake, board, boardNodes)) {
      continue;
    }

    const snakeHead = getHead(snake);
    targets.push({
      point: snakeHead,
      distance: distanceBetweenPoints(myHead, snakeHead),
    });
  }

  if (targets.length > 0) {
    targets.sort(compareDistance);
  }

  return targets.map(target => target.point).concat(getCorners(board, boardNodes, myHead));
}

function distanceBetweenPoints(pointA, pointB) {
  return Math.abs(pointA.x - pointB.x) + Math.abs(pointA.y - pointB.y);
}

function compareDistance(a, b) {
  return a.distance - b.distance;
}

function shouldAttackSnake(theirSnake, mySnake, board, boardNodes) {
  if (theirSnake.body.length >= mySnake.body.length) {
    return false;
  }

  if (board.snakes.length <= 2) { // Only 2 left? Go for the kill!
    return true;
  }

  // Search 2 squares around their snake. If there are more than 9 snake
  // parts within the range around their snake, don't attack it.
  const SEARCH_RANGE = 2;
  const SNAKE_PARTS_LIMIT = 9;

  const theirHead = getHead(theirSnake);

  const minX = Math.max(theirHead.x - SEARCH_RANGE, 0);
  const maxX = Math.min(theirHead.x + SEARCH_RANGE, boardNodes.length - 1);

  const minY = Math.max(theirHead.y - SEARCH_RANGE, 0);
  const maxY = Math.min(theirHead.y + SEARCH_RANGE, boardNodes.length - 1);

  let numSnakeParts = -1; // Start with -1 to discount their head (since it'll get counted below)

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (boardNodes[x][y].hasSnake) {
        ++numSnakeParts;
      }
    }
  }

  const shouldAttack = numSnakeParts <= SNAKE_PARTS_LIMIT;
  if (!shouldAttack) {
    logger.info('Not attacking snake with', numSnakeParts, 'parts around it:', theirHead);
  }
  return shouldAttack;
}

// Get the corners, prioritizing the ones with the least snake parts near them
// and then prioritizing the corners that are the farthest away
function getCorners(board, boardNodes, head) {
  return [
    makeCorner(0, 0, board, boardNodes),
    makeCorner(0, board.height - 1, board, boardNodes),
    makeCorner(board.width - 1, 0, board, boardNodes),
    makeCorner(0, board.height - 1, board, boardNodes),
  ].sort((a, b) => {
    return (a.numSnakeParts - b.numSnakeParts) ||
      (distanceBetweenPoints(b, head) - distanceBetweenPoints(a, head));
  });
}

function makeCorner(x, y, board, boardNodes) {
  let numSnakeParts = 0;

  const halfWidth = Math.trunc(board.width / 2);
  const minX = x === 0 ? 0 : halfWidth;
  const maxX = x === 0 ? halfWidth : board.width - 1;

  const halfHeight = Math.trunc(board.height / 2);
  const minY = y === 0 ? 0 : halfHeight;
  const maxY = y === 0 ? halfHeight : board.height - 1;

  for (let i = minX; i <= maxX; i++) {
    for (let j = minY; j <= maxY; j++) {
      if (boardNodes[i][j].hasSnake) {
        ++numSnakeParts;
      }
    }
  }

  return {
    x,
    y,
    numSnakeParts,
  };
}

function buildBoardNodes(board, myHead) {
  const boardNodes = [];

  // Build board
  for (let x = 0; x < board.width; x++) {
    const nodes = [];

    for (let y = 0; y < board.height; y++) {
      nodes[y] = createNode(x, y);
    }

    boardNodes[x] = nodes;
  }

  // Set food locations
  for (const foodPoint of board.food) {
    boardNodes[foodPoint.x][foodPoint.y].hasFood = true;
  }

  // Set snake locations
  for (const snake of board.snakes) {
    const {body} = snake;

    for (let i = 0; i < body.length - 1; i++) { // Ignore tails
      const point = body[i];
      boardNodes[point.x][point.y].hasSnake = true;
    }

    const head = body[0];

    if (head.x === myHead.x && head.y === myHead.y) {
      continue; // Ignore own head
    }

    const potentialSnakeNodes = getSiblingNodesWithoutSnake(head, board, boardNodes);
    for (const node of potentialSnakeNodes) {
      node.potentialSnake = snake;
    }
  }

  return boardNodes;
}

function createNode(x, y) {
  return {
    x,
    y,
    hasFood: false,
    hasSnake: false,
    potentialSnake: null,
    discovered: false,
    path: [],
  };
}

function resetBoardNodes(boardNodes) {
  for (let x = 0; x < boardNodes.length; x++) {
    const nodes = boardNodes[x];

    for (let y = 0; y < nodes.length; y++) {
      nodes[y].discovered = false;
      nodes[y].path = [];
    }
  }
}

// BFS search
function getPathToTarget(target, snake, board, boardNodes) {
  const head = getHead(snake);
  const searchQueue = [
    boardNodes[head.x][head.y], // Head is intial search node
  ];

  while (searchQueue.length > 0) {
    const node = searchQueue.shift();

    for (const siblingNode of getSiblingNodesWithoutSnake(node, board, boardNodes)) {
      if (siblingNode.x === target.x && siblingNode.y === target.y) { // sibling is target
        const pathToTarget = node.path.concat(siblingNode);

        // Avoid this path if the first step is where another snake might be
        const {potentialSnake} = pathToTarget[0];
        if (potentialSnake !== null && potentialSnake.body.length >= snake.body.length) {
          continue;
        }

        return pathToTarget;
      }

      if (siblingNode.discovered) {
        continue;
      }

      siblingNode.discovered = true;
      siblingNode.path = node.path.concat(siblingNode);
      searchQueue.push(siblingNode);
    }
  }

  return null; // No path to target (right now)
}

function getSiblingNodesWithoutSnake(node, board, boardNodes) {
  const siblings = [];

  if (node.x > 0) {
    const siblingNode = boardNodes[node.x - 1][node.y];
    if (!siblingNode.hasSnake) {
      siblings.push(siblingNode);
    }
  }
  if (node.x < board.width - 1) {
    const siblingNode = boardNodes[node.x + 1][node.y];
    if (!siblingNode.hasSnake) {
      siblings.push(siblingNode);
    }
  }
  if (node.y > 0) {
    const siblingNode = boardNodes[node.x][node.y - 1];
    if (!siblingNode.hasSnake) {
      siblings.push(siblingNode);
    }
  }
  if (node.y < board.height - 1) {
    const siblingNode = boardNodes[node.x][node.y + 1];
    if (!siblingNode.hasSnake) {
      siblings.push(siblingNode);
    }
  }

  return siblings;
}

function getFarthestReachablePoint(head, boardNodes) {
  const farthestPoints = [
    getFarthestReachablePointWithDirection(head, boardNodes, {x: 1, y: 1}),
    getFarthestReachablePointWithDirection(head, boardNodes, {x: 1, y: -1}),
    getFarthestReachablePointWithDirection(head, boardNodes, {x: -1, y: 1}),
    getFarthestReachablePointWithDirection(head, boardNodes, {x: -1, y: -1}),
  ].sort((a, b) => distanceBetweenPoints(b, head) - distanceBetweenPoints(a, head));
  logger.debug('Reachable Points:', farthestPoints);
  return farthestPoints[0];
}

function getFarthestReachablePointWithDirection(head, boardNodes, direction) {
  const point = {
    x: head.x,
    y: head.y,
  };

  for (;;) {
    const nextX = point.x + direction.x;
    if (nextX < boardNodes.length && nextX >= 0 && !boardNodes[nextX][point.y].hasSnake) {
      point.x = nextX;
      continue;
    }

    const nextY = point.y + direction.y;
    if (nextY < boardNodes.length && nextY >= 0 && !boardNodes[point.x][nextY].hasSnake) {
      point.y = nextY;
      continue;
    }

    return point;
  }
}

function getAnySafePoint(head, board, boardNodes) {
  const siblingNodes = getSiblingNodesWithoutSnake(head, board, boardNodes);

  if (siblingNodes.length === 0) {
    return null;
  }

  // Try to return a point with food
  for (let i = 0; i < siblingNodes.length; i++) {
    if (siblingNodes[i].hasFood) {
      return siblingNodes[i];
    }
  }

  return siblingNodes[0]; // Just return the first available point
}
