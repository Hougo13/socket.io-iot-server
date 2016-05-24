var IOT = require('../lib/').default;

var iot = new IOT(3030)

// function test(value) {
//   return new Promise(function(resolve, reject) {
//     if (value.res.model == "raspberry" && value.res.new) {
//       value.client.rooms.push('room_'+value.res.id)
//       console.log('New room_'+value.res.id);
//     }
//     resolve(value)
//   });
// }
// iot.addSeq('connection', test)

iot.start()

iot.on('connection', (client) => {
  console.log("Connect:", client.id);
})
