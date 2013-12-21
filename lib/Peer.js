var net = require('net');
var events = require('events');
var util = require('util');
var sha256 = require('sha256');

var Host = function Host(host, port) {
  if (typeof host === 'string') {
    if (host.indexOf(':') && !port) {
      var pieces = host.split(':');
      host = pieces[0];
      port = pieces[1];
    }
    this.host = host;
    this.port = +port || this.defaultPort;
    this.version = (!net.isIP(host) || net.isIPv4(host))? 4 : 6;
    return;
  } else if (Buffer.isBuffer(host)) {
    if (host.slice(0, 12).toString('hex') != Host.IPV6_IPV4_PADDING.toString('hex')) {
      this.host = host.toString('hex').match(/(.{1,4})/g).join(':').replace(/\:(0{2,4})/g, ':0').replace(/^(0{2,4})/g, ':0');
      this.port = +port || this.defaultPort;
      this.version = 6;
      return this;
    } else {
      this.host = Array.prototype.join.apply(host.slice(12), ['.']);
      this.port = +port || this.defaultPort;
      this.version = 4;
      return this;
    }
  } else {
    throw new Error('Cound not instantiate peer; invalid parameter type: '+ typeof host);
  }
};
Host.prototype.IPV6_IPV4_PADDING = new Buffer([0,0,0,0,0,0,0,0,0,0,255,255]);
Host.prototype.defaultPort = 8333;

var Message = exports.Message = function Message(magic) {
  this.buffer = new DataView(new ArrayBuffer(10000));
  this.cursor = 0;
  this.magicBytes = magic;
};
Message.prototype.checksum = function checksum() {
  var bytes = sha256.x2(Array.prototype.slice.apply(new Uint8Array(this.buffer.buffer.slice(0,this.cursor))), {asBytes:true});
  var dv = new DataView(new ArrayBuffer(4));
  for (var i = 0; i < 4; i++) {
  	dv.setUint8(i, bytes[i]);
  }
  return dv;
};
Message.prototype.build = function build(command) {
  var out = new DataView(new ArrayBuffer(this.cursor + 24));
  out.setUint32(0, this.magicBytes, true); // magic
  
  for (var i = 0; i < 12; i++) {
    var num = (i > command.length)? 0 : command.charCodeAt(i);
    out.setUint8(4+i, num); // command
  }
  
  out.setUint32(16, this.cursor, true); // length
  out.setUint32(20, this.checksum().getUint32(0)); // checksum
  for (var i = 0; i < this.cursor; i++) {
    out.setUint8(24+i, this.buffer.getUint8(i)); // payload
  }
  return out;
};
Message.prototype.pad = function pad(num) {
  var i8 = new Uint8Array(num);
  for (var i = 0; i < num; i++) {
    i8[i] = 0;
  }
  return this.put(new DataView(i8.buffer));
};
Message.prototype.put = function put(data) {
  if (typeof data == 'number') {
    this.buffer.setUint8(this.cursor, data);
    this.cursor += 1;
    return this;
  }
  
  for (var i = 0; i < data.byteLength; i++) {
    this.buffer.setUint8(this.cursor+i, data.getUint8(i));
  }
  this.cursor += data.byteLength;
  return this;
};
Message.prototype.putInt16 = function putInt16(num) {
  var dv = new DataView(new ArrayBuffer(2));
  dv.setUint16(0, num, true);
  return this.put(dv);
};
Message.prototype.putInt32 = function putInt32(num) {
  var dv = new DataView(new ArrayBuffer(4));
  dv.setUint32(0, num, true);
  return this.put(dv);
};
Message.prototype.putInt64 = function putInt64(num) {
  var dv = new DataView(new ArrayBuffer(8));
  dv.setUint32(0, num, true);
  dv.setUint32(4, 0, true);
  return this.put(dv);
};
Message.prototype.putString = function putString(str) {
  var i8 = new Uint8Array(str.length);
  for(var i = 0; i < str.length; i++) {
    i8[i] = str.charCodeAt(i);
  }
  return this.put(new DataView(i8.buffer));
};
Message.prototype.putVarInt = function putVarInt(num) {
  if (num < 0xfd) {
    return this.put(num);
  } else if (num <= 0xffff) {
    return this.put(0xfd).putInt16(num);
  } else if (num <= 0xffffffff) {
    return this.put(0xfe).putInt32(num);
  } else {
    return this.put(0xff).putInt64(num);
  }
};
Message.prototype.putVarString = function putVarString(str) {
  return this.putVarInt(str.length).putString(str);
}


var Peer = exports.Peer = function Peer(host, port) {
  events.EventEmitter.call(this);
  if (host instanceof Host) {
    this.host = host;
  } else {
    this.host = new Host(host, port);
  }
};
util.inherits(Peer, events.EventEmitter);

Peer.prototype.MAX_RECEIVE_BUFFER = 10000;
Peer.prototype.magicBytes = 0xD9B4BEF9;

Peer.prototype.connect = function connect() {
  this.inbound = new DataView(new ArrayBuffer(this.MAX_RECEIVE_BUFFER));
  this.inboundCursor = 0;
  
  var socket = this.socket = net.createConnection(this.host.port, this.host.host, this.handleConnect.bind(this));
  socket.on('error', this.handleError.bind(this));
  socket.on('data', this.handleData.bind(this));
  socket.on('end', this.handleEnd.bind(this));
  
  return this.socket;
};

Peer.prototype.disconnect = function disconnect() {
  this.socket.destroy();
};

Peer.prototype.handleConnect = function handleConnect() {
  this.emit('connect', {
    peer: this,
  });
};

Peer.prototype.handleEnd = function handleEnd() {
  this.emit('end', {
    peer: this,
  });
};

Peer.prototype.handleError = function handleError(data) {
  this.emit('error', {
    peer: this,
    error: data
  });
};

Peer.prototype.send = function send(data, callback) {
  this.socket.write(new Buffer(data), null, callback);
};

Peer.prototype.handleData = function handleData(data) {
  // Add data to incoming buffer
  if (data.length + this.inboundCursor > this.inbound.byteLength) {
    throw new Error('Peer exceeded max receiving buffer');
  }
  for (var i = 0; i < data.length; i++) {
    this.inbound.setUint8(this.inboundCursor + i, data[i]);
  }
  this.inboundCursor += data.length;
  
  if (this.inboundCursor < 20) return; // Can't process something less than 20 bytes in size
  
  var found = false;
  for (var i = 0; i < this.inboundCursor; i++) {
    if (this.inbound.getUint32(i, true) == this.magicBytes) {
      found = true;
      break;
    }
  }
  if (!found) return; // No magic bytes yet...
  
  var msgStart = i;
  
  // Get command
  var cmd = [];
  for (var i = 0; i < 12; i++) {
    var s = this.inbound.getUint8(msgStart+4+i)
    if (s > 0) {
      cmd.push(String.fromCharCode(s));
    }
  }
  cmd = cmd.join('');
  
  var payloadLength = this.inbound.getUint32(msgStart+16, true);
  var checksum = this.inbound.getUint32(msgStart+20, false);
  
  if (this.inboundCursor < msgStart+payloadLength+24) return; // Not the whole message yet
  
  if (payloadLength > 0) {
    var payload = new DataView(this.inbound.buffer.slice(msgStart+24, msgStart+24+payloadLength));
    var checksumCalc = sha256.x2(Array.prototype.slice.apply(new Uint8Array(payload.buffer)), {asBytes:true});
    var dv = new DataView(new ArrayBuffer(4));
    for (var i = 0; i < 4; i++) {
    	dv.setUint8(i, checksumCalc[i]);
    }
    if (checksum != dv.getUint32(0)) {
      console.log('Supplied checksum of '+checksum.toString(16)+' does not match calculated checksum of '+dv.getUint32(0).toString(16));
    }
  } else {
    var payload = false;
  }
  
  this.emit('message', {
    peer: this,
    command: cmd,
    data: payload
  });
  this.inboundCursor = 0; // Reset inbound buffer
};