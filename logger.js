'use strict';

const log4js = require('log4js');

log4js.configure({
  appenders: {
    stdout: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '[%p] %m',
      },
    },
  },
  categories: {
    default: {appenders: ['stdout'], level: 'info'},
  },
});

module.exports = log4js.getLogger();
