import events from 'events';
import _ from 'lodash';
import Q from 'q';
let debug = require('debug')('iot')

export default class iot extends events {

  constructor(port, params) {
    super();
    _.forIn(_.defaults(params, {lastId: 0}), (value, key) => {
      this[key] = value
    })
    this.started = false;
    this.port = port;
    this.pins = [];
    this.seq = {};
    this.clients = [];
    this.rooms = [];
    this.pins = [];
  }

  start() {
    if (!this.started) {
      let io = require('socket.io')(this.port)
      io.on('connection', (socket) => {
        socket.on('identify', (args) =>  {
          debug('identify')
          this.identify(socket, args)
        });
        socket.on('link', (args) =>  {
          debug('link')
          this.link(socket, args)
        });
        socket.on('open', (args) =>  {
          debug('open')
          this.open(socket, args)
        });
        socket.on('update', (args) =>  {
          debug('update')
          this.update(socket, io, args)
        });
      });
      this.started = true
      debug('server started')
    }
  }

  addSeq(seq, prm) {
    if (!this.seq[seq]) {
      this.seq[seq] = []
    }
    if (this.seq[seq].indexOf(prm) == -1) {
      this.seq[seq].push(prm);
      debug('add a function in sequence '+seq)
    }
  }

  injectSeq(seq, value, callback) {
    if (this.seq[seq]) {
      let sq = this.seq['connection'].reduce(Q.when, Q(value));
      sq.then(callback)
    } else {
      callback(value);
    }
  }

  removeSeq(seq, prm) {
    let i = this.seq[seq].indexOf(prm)
    if (i > -1) {
      this.seq[seq].splice(i, 1);
      debug('remove a function in sequence '+seq)
    }
  }

  identify(socket, params) {
    let res = {id: params.id, model:params.model, new: false, error: false};
    if (!params.id) {
      res.new = true;
      res.id = ++this.lastId;
      let cl = {id: res.id, model: params.model, rooms: [], socket};
      if (res.model == 'server') {
        debug("new "+'room_'+res.id)
        // cl.rooms.push('room_'+res.id)
        this.rooms.push({
          id: 'room_'+res.id,
          owner: res.id,
          state: {active: false, last:_.now()},
          data: {}
        })
      }
      this.clients.push(cl);
    }
    let client = _.find(this.clients, {id: res.id});
    if (!client) {
      res.error = true;
      socket.emit('identify', res);
      debug('identification failed')
    } else {
      _.forIn(client.rooms, (value) => {
        debug(client.id+' join '+value)
        socket.join(value);
      });
      if (client.model == 'server') {
        let room = _.find(this.rooms, {owner: client.id});
        room.state = {active: true, last:_.now()};
        res.room = room.id;
        debug('active '+room.id)
      }
      socket.emit('identify', res);
      this.emit('connection', client);
      debug('identification succeeded')
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

  link(socket, pin) {
    let opn = _.find(this.pins, {id: pin});
    if (opn) {
      let client = this.findClient(socket);
      client.rooms.push(opn.room)
      socket.join(opn.room)
      socket.emit('link', opn.room);
      debug(client.id+' linked to '+opn.room)
    } else {
      socket.emit('link', false);
      debug('linking failed')
    }
  }

  open(socket, pin) {
    let room = this.findRoom(socket)
    function error() {
      socket.emit("open", false)
    }
    if (room) {
      if (!_.find(this.pins, {id: pin})) {
        this.pins.push({id: pin, room: room.id})
        setTimeout(() => {
          let i = this.pins.indexOf({id: pin, room: room.id})
          if (i > -1) {
            this.pins.splice(i, 1)
          }
        }, 10000);
        socket.emit('open', true)
        debug(room.id+' open with '+pin)
      } else { error(); }
    } else { error(); }
  }

  findClient(socket) {
    let client = _.find(this.clients, (c) => {
      return c.socket.id == socket.id
    })
    return client;
  }

  findRoom(socket){
    let client = this.findClient(socket);
    let room = _.find(this.rooms, {owner: client.id});
    return room
  }

  update(socket, io, params) {
    let client = this.findClient(socket);
    if (client.model == 'server') {
      let room = this.findRoom(socket);
      io.to(room.id).emit('update', params);
      debug('broadcast update');
    } else {
      let room = _.find(this.rooms, {id: params.to});
      if (room.state.active) {
        let server = _.find(this.clients, {id: room.owner})
        server.socket.emit('update', params);
        debug('send update to '+server.id);
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
}

/*
Todos:
-Event protocol
-Optimized database
*/
