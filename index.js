'use strict';

const medley = require('@medley/medley');
const logger = require('./logger');

const app = medley();

app.route(require('./move'));

app.post('/start', function start(req, res) {
  logger.info('Starting Game');
  res.send({
    color: '#0958EB',
    headType: 'evil',
    tailType: 'bolt',
  });
});

app.post('/end', function end(req, res) {
  res.send('OK');
});

app.post('/ping', function ping(req, res) {
  res.send('OK');
});

app.get('/', (req, res) => {
  res.headers['content-type'] = 'text/html;charset=utf-8';
  res.send(`
    See Battle Viper's battles at:
    <a href="https://play.battlesnake.com/s/snk_SdD9kJPb9tkhTbpMtXrvp69f/">
      https://play.battlesnake.com/s/snk_SdD9kJPb9tkhTbpMtXrvp69f/
    </a>
  `);
});

app.get('/favicon.ico', (req, res) => {
  res.headers['content-type'] = 'image/x-icon';
  res.send();
});

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
const port = process.env.PORT || 9001;
app.listen(port, '::', () => {
  console.log('Server listening on port %s', port);
});
