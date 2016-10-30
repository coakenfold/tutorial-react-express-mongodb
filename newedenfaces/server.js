// Babel ES6/JSX Compiler

// The require hook is primarily recommended for simple cases.
// Not meant for production use

// All subsequent files required by node with the extensions .es6, .es, .jsx and .js will be transformed by Babel.
// Require Hook will use Babel presets we specified in package.json
require('babel-register');

// Just to be consistent and systematic, 
// I usually organize my module imports in the following order:
// - Core Node.js modules — path, querystring, http.
// - Third-party NPM libraries — mongoose, express, request.
// - Application files — controllers, models, config.

var async = require('async');
var request = require('request');
var xml2js = require('xml2js');

var mongoose = require('mongoose');
var Character = require('./models/character');
var config = require('./config');
var swig = require('swig');
var React = require('react');
var ReactDOM = require('react-dom/server');
var Router = require('react-router');
var routes = require('./app/routes');

var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');

mongoose.connect(config.database);
mongoose.connection.on('error', function(){
  console.info('Error: Could not connect to MongoDb. Dif you forget to run `mongod`?');
});

var app = express();

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname,'public')));

app.post('/api/characters', function(req, res, next){
  var gender = req.body.gender;
  var characterName = req.body.name;
  var characterIdLookupUrl = 'https://api.eveonline.com/eve/CharacterID.xml.aspx?names=' + characterName;

  var parser = new xml2js.Parser();

  async.waterfall([
    function(callback) {
      request.get(characterIdLookupUrl, function(err, request, xml){
        if (err) { return next(err); }

        parser.parseString(xml, function(err, parsedXml) {
          if (err) { return next(err); }
          try {
            var characterId = parsedXml.eveapi.result[0].rowset[0].row[0].$.characterID;

            Character.findOne({characterId: characterId }, function(err, character) {
              if (err) { return next(err); }

              if (character) {
                return res.status(409).send({ message: character.name + ' is already in the database.' });
              }

              callback(err, characterId);
            });
          } catch (e) {
            return res.status(400).send({ message: 'XML Parse Error' });
          }
        });
      });
    },
    function(characterId) {
      var characterInfoUrl = 'https://api.eveonline.com/eve/CharacterInfo.xml.aspx?characterID=' + characterId;
      request.get({ url: characterInfoUrl }, function(err, request, xml) {
        if (err) { return next(err); }

        parser.parseString(xml, function(err, parsedXml) {
          if (err) { return res.send(err); }

          try {
            var name = parsedXml.eveapi.result[0].characterName[0];
            var race = parsedXml.eveapi.result[0].race[0];
            var bloodline = parsedXml.eveapi.result[0].bloodline[0];

            var character = new Character({
              characterId: characterId,
              name: name,
              race: race,
              bloodline: bloodline,
              gender: gender,
              random: [Math.random(), 0]
            });

            character.save(function(err) {
              if (err) { return next(err); }
              res.send({ message: characterName + ' has been added successfully!' });
            });
          } catch (e) {
            res.status(400).send({ message: characterName + ' is not registered citizen of New Eden.'});
          }
        });
      });
    }
  ]);
});

app.use(function(req, res){
  Router.match({ routes: routes.default, location: req.url }, function(err, redirectLocation, renderProps) {
    if (err) {
      res.status(500).send(err.message);
    } else if (redirectLocation) {
      res.status(302).redirect(redirectLocation.pathname + redirectLocation.search);
    } else if (renderProps) {
      var html = ReactDOM.renderToString(React.createElement(Router.RoutingContext, renderProps));
      var page = swig.renderFile('views/index.html', { html: html});
      res.status(200).send(page);
    } else {
      res.status(404).send('Page Not Found');
    }
  });
});

// app.listen(app.get('port'), function(){
//   console.log('Express server is listening on port ' + app.get('port'));
// });
/**
 * Socket.io stuff.
 */
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var onlineUsers = 0;

io.sockets.on('connection', function(socket) {
  onlineUsers += 1;

  io.sockets.emit('onlineUsers', { onlineUsers: onlineUsers });

  socket.on('disconnect', function() {
    onlineUsers -= 1;
    io.sockets.emit('onlineUsers', { onlineUsers: onlineUsers });
  });
});

server.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});