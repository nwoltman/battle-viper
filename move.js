'use strict';

const bodyParser = require('@medley/body-parser');
const logger = require('./logger');

module.exports = {
  method: 'POST',
  path: '/move',
  preHandler: bodyParser.json(),
  handler: function move(req, res) {
    logger.info('Move Request:\nBoard:', req.body.board, '\nSnake:', req.body.you);
    res.send({move: 'up'});
  },
};
