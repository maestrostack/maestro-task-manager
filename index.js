const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');

const auth = require('@feathersjs/authentication-client');

const socket = io('http://localhost:3030');
const app = feathers();

app.configure(socketio(socket));

app.configure(auth({
  storageKey: 'auth'
}))

const taskQueue = app.service('request-task-queue');

taskQueue.on('created', task => {
  if(task.type == 'provision/terraform') {
    workTask(task)
  }
});

const getTaskBlock = async (id) => {
  const block = await app.service('blocks').get(id);

  return block;
} 

const workTask = async (task) => {
  const block = await getTaskBlock(task._block);
  console.log(block);
}


app.authenticate({
  strategy: 'local',
  email: 'admin@system.local',
  password: 'P0pc0rn1'
})
.then( () => {
  // Use the messages service from the server
  console.log('\n\n\n====================\n| MAESTRO READY!   |\n====================')
})
.catch( e => {
  console.log(e);
})
