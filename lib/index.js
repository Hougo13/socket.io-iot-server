'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events2 = require('events');

var _events3 = _interopRequireDefault(_events2);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var debug = require('debug')('iot');

var iot = function (_events) {
  _inherits(iot, _events);

  function iot(port, params) {
    _classCallCheck(this, iot);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(iot).call(this));

    _lodash2.default.forIn(_lodash2.default.defaults(params, { lastId: 0 }), function (value, key) {
      _this[key] = value;
    });
    _this.started = false;
    _this.port = port;
    _this.pins = [];
    _this.seq = {};
    _this.clients = [];
    _this.rooms = [];
    _this.pins = [];
    return _this;
  }

  _createClass(iot, [{
    key: 'start',
    value: function start() {
      var _this2 = this;

      if (!this.started) {
        (function () {
          var io = require('socket.io')(_this2.port);
          io.on('connection', function (socket) {
            socket.on('identify', function (args) {
              debug('identify');
              _this2.identify(socket, args);
            });
            socket.on('link', function (args) {
              debug('link');
              _this2.link(socket, args);
            });
            socket.on('open', function (args) {
              debug('open');
              _this2.open(socket, args);
            });
            socket.on('update', function (args) {
              debug('update');
              _this2.update(socket, io, args);
            });
          });
          _this2.started = true;
          debug('server started');
        })();
      }
    }
  }, {
    key: 'addSeq',
    value: function addSeq(seq, prm) {
      if (!this.seq[seq]) {
        this.seq[seq] = [];
      }
      if (this.seq[seq].indexOf(prm) == -1) {
        this.seq[seq].push(prm);
        debug('add a function in sequence ' + seq);
      }
    }
  }, {
    key: 'injectSeq',
    value: function injectSeq(seq, value, callback) {
      if (this.seq[seq]) {
        var sq = this.seq['connection'].reduce(_q2.default.when, (0, _q2.default)(value));
        sq.then(callback);
      } else {
        callback(value);
      }
    }
  }, {
    key: 'removeSeq',
    value: function removeSeq(seq, prm) {
      var i = this.seq[seq].indexOf(prm);
      if (i > -1) {
        this.seq[seq].splice(i, 1);
        debug('remove a function in sequence ' + seq);
      }
    }
  }, {
    key: 'identify',
    value: function identify(socket, params) {
      var res = { id: params.id, model: params.model, new: false, error: false };
      if (!params.id) {
        res.new = true;
        res.id = ++this.lastId;
        var cl = { id: res.id, model: params.model, rooms: [], socket: socket };
        if (res.model == 'server') {
          debug("new " + 'room_' + res.id);
          // cl.rooms.push('room_'+res.id)
          this.rooms.push({
            id: 'room_' + res.id,
            owner: res.id,
            state: { active: false, last: _lodash2.default.now() },
            data: {}
          });
        }
        this.clients.push(cl);
      }
      var client = _lodash2.default.find(this.clients, { id: res.id });
      if (!client) {
        res.error = true;
        socket.emit('identify', res);
        debug('identification failed');
      } else {
        _lodash2.default.forIn(client.rooms, function (value) {
          debug(client.id + ' join ' + value);
          socket.join(value);
        });
        if (client.model == 'server') {
          var room = _lodash2.default.find(this.rooms, { owner: client.id });
          room.state = { active: true, last: _lodash2.default.now() };
          res.room = room.id;
          debug('active ' + room.id);
        }
        socket.emit('identify', res);
        this.emit('connection', client);
        debug('identification succeeded');
        // For 2.0
        // this.injectSeq('connection', {res, client, socket}, (value) => {
        //   _.forIn(client.rooms, (value) => {
        //     socket.join(value);
        //   });
        //   socket.emit('identify', value.res);
        //   this.emit('connection', value);
        //   debug('identification succeeded')
        // });
      }
    }
  }, {
    key: 'link',
    value: function link(socket, pin) {
      var opn = _lodash2.default.find(this.pins, { id: pin });
      if (opn) {
        var client = this.findClient(socket);
        client.rooms.push(opn.room);
        socket.join(opn.room);
        socket.emit('link', opn.room);
        debug(client.id + ' linked to ' + opn.room);
      } else {
        socket.emit('link', false);
        debug('linking failed');
      }
    }
  }, {
    key: 'open',
    value: function open(socket, pin) {
      var _this3 = this;

      var room = this.findRoom(socket);
      function error() {
        socket.emit("open", false);
      }
      if (room) {
        if (!_lodash2.default.find(this.pins, { id: pin })) {
          this.pins.push({ id: pin, room: room.id });
          setTimeout(function () {
            var i = _this3.pins.indexOf({ id: pin, room: room.id });
            if (i > -1) {
              _this3.pins.splice(i, 1);
            }
          }, 10000);
          socket.emit('open', true);
          debug(room.id + ' open with ' + pin);
        } else {
          error();
        }
      } else {
        error();
      }
    }
  }, {
    key: 'findClient',
    value: function findClient(socket) {
      var client = _lodash2.default.find(this.clients, function (c) {
        return c.socket.id == socket.id;
      });
      return client;
    }
  }, {
    key: 'findRoom',
    value: function findRoom(socket) {
      var client = this.findClient(socket);
      var room = _lodash2.default.find(this.rooms, { owner: client.id });
      return room;
    }
  }, {
    key: 'update',
    value: function update(socket, io, params) {
      var client = this.findClient(socket);
      if (client.model == 'server') {
        var room = this.findRoom(socket);
        io.to(room.id).emit('update', params);
        debug('broadcast update');
      } else {
        var _room = _lodash2.default.find(this.rooms, { id: params.to });
        if (_room.state.active) {
          var server = _lodash2.default.find(this.clients, { id: _room.owner });
          server.socket.emit('update', params);
          debug('send update to ' + server.id);
        }
      }
    }
    // sendRoomState(roomId) {
    //   let room = _.find(this.rooms, {id: roomId});
    //   let clients = _.find(this.clients, (o) => {
    //     return o.rooms.indexOf(roomId) > -1
    //   });
    //   let d =  {id: roomId, active: room.state.active, last: room.state.last}
    //   _.forEach(clients, (client) => {
    //     client.socket.emit('room', d);
    //   });
    // }
    //
    // update(socket, data) {
    //
    // }

  }]);

  return iot;
}(_events3.default);

/*
Todos:
-Event protocol
-Optimized database
*/


exports.default = iot;