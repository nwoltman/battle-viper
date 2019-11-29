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
    if (!shouldAttackSnake(snake, mySnake, boardNodes)) {
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

  return targets.map(target => target.point).concat(getCorners(board, myHead));
}

function distanceBetweenPoints(pointA, pointB) {
  return Math.abs(pointA.x - pointB.x) + Math.abs(pointA.y - pointB.y);
}

function compareDistance(a, b) {
  return a.distance - b.distance;
}

function shouldAttackSnake(theirSnake, mySnake, boardNodes) {
  if (theirSnake.body.length >= mySnake.body.length) {
    return false;
  }

  // Search 2 squares around their snake. If there are more than 8 snake
  // parts within the range around their snake, don't attack it.
  const SEARCH_RANGE = 2;
  const SNAKE_PARTS_LIMIT = 8;

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

  const shouldAttack = numSnakeParts < SNAKE_PARTS_LIMIT;
  if (!shouldAttack) {
    logger.info('Not attacking snake with', numSnakeParts, 'around it:', theirHead);
  }
  return shouldAttack;
}

function getCorners(board, head) {
  return [
    {
      x: 0,
      y: 0,
    },
    {
      x: 0,
      y: board.height - 1,
    },
    {
      x: board.width - 1,
      y: 0,
    },
    {
      x: board.width - 1,
      y: board.height - 1,
    },
  ].sort((a, b) => distanceBetweenPoints(b, head) - distanceBetweenPoints(a, head));
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
  return siblingNodes.length > 0 ? siblingNodes[0] : null;
}
