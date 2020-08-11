const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');

const auth = require('@feathersjs/authentication-client');

// const socket = io('http://localhost:3030');












// const socket = io('http://maestro:3030');




const socket = io('http://maestro:3030');
const app = feathers();

app.configure(socketio(socket));

app.configure(auth({
  storageKey: 'auth'
}))

const start = async () => {
  const requestService = app.service('requests');


  const workActivity = async ( item ) => {


    // console.log(item)
    
  
    // GET THE RELATED REQUEST ACTIVITY FOR THIS BLOCK
    const requestActivity = await app.service('request-activities').find({
      query: {
        parent_workflow_block: `${item._id}`,
        parent_request: `${item.parent_request_id}`
      }
    });
  
    // MAKE SURE THERE IS ACTUALLY AN ACTIVITY FOR THIS BLOCK
    if( requestActivity.total > 0 ) {
  
      // THERE SHOULD BE ONLY ONE, IF THERE IS MORE THAN 
      // ONE WE HAVE AN ISSUE...
      const activity  = requestActivity.data[0];

      // console.log(activity)
  
      // await app.service('request-activities').patch(activity._id, { state: 'complete'} );
  
      // IF THIS ACTIVITY IS COMPLETE MOVE ON TO THE CHILDREN...
      if( activity.state == 'complete' ) {
        console.log('\n\n\n ==== COMPLETE ==== \n\n\n');
        item.children.forEach( c => {
          c.parent_request_id = item.parent_request_id;
          workActivity(c);
        });
      }
      else {
  
  
        // update syslog
        // app.service('syslog').create({
        //   category: 'info',
        //   topic: 'maestro/request-manager',
        //   message: `Send ${item.name} activity for request ${item._id} to request-task-queue.`,
        //   has_parent: true,
        //   parent_service_path: 'requests',
        //   parent_id: request._id
        // });
  
        const blockType = await app.service('block-types').get(item.type);
  
        console.log(blockType)
        app.service('request-task-queue').create({
          request_id: item.parent_request_id,
          activity_id: activity._id,
          workflow_block_id: item._id,
          type: blockType.topic,
          state: 'new',
          working: false
        });
  
  
  
        // const taskQueueItem = app.service('request-task-queue')
        //   .create({
        //     task_item_data: item,
        //     task_activity_data: activity
        //   })
          // .then( res => {
          //   console.log(res);
          //   app.service('request-activity').patch(activity._id, { task_queue_id: res._id });
          // });
  
  
  
        console.log('====  ITEM + ACTIVITY ====');
  
        console.log(activity.parent_workflow_block);
        console.log(item.name);
        console.log(item._id);
        console.log(activity._id);
        console.log(activity.state);
      }
    }
  };
  
  // work request
  const workRequest = async request => {
  
    // work children - starting with start bloc
    // need to add logging here and some logic...
    
    request._start_block.children.forEach( c => {
      c.parent_request_id = request._id;
      workActivity(c);
    })


  };
  
  //process request
  const processRequest = async request => {
    // update syslog
    app.service('syslog').create({
      category: 'info',
      topic: 'maestro/request-manager',
      message: `Request ${request._id} has been picked up by the request-manager queue, state is ${request.state} and working is ${request.working}`,
      has_parent: true,
      parent_service_path: 'requests',
      parent_id: request._id
    });
  
    // get the parent workflow for this request
    const parentWorkflow = await app.service('workflows').get(request.parent_workflow);
  
    // append the partentWorkflow data to the request object
    parentWorkflow._workflow_data = parentWorkflow;
  
    // find the start block for the parentWorkflow
    // we will use this block to itterate through the child
    // blocks and match those to the request activities
    const findStartBlock = await app.service('workflow-blocks')
      .find({
        query: {
          parent_workflow: `${request.parent_workflow}`,
          start: true
        }
      });
  
    // validate that only one item was returned before
    // continuing with the request
    if( findStartBlock.total == 0 || findStartBlock > 1) {
      app.service('syslog').create({
        category: 'error',
        topic: 'maestro/request-manager',
        message: `More than one start block was found when processing request ${request._id}. Unable to move forward, marking request as failed.`,
        has_parent: true,
        parent_service_path: 'requests',
        parent_id: request._id
      });
  
      // set request state to error/failed...
      app.service('requests').patch(request._id, {
        working: 'error',
        state: 'error',
        stage: 'error',
        substage: 'multiple-start-blocks',
        error_msg: `More than one start block was found when processing request ${request._id}. Unable to move forward, marking request as failed.`
      });
  
  
    }
    else {
      request._start_block = findStartBlock.data[0];
      app.service('syslog').create({
        category: 'info',
        topic: 'maestro/request-manager',
        message: `Found start block with id ${request._start_block._id} for request ${request._id}.`,
        has_parent: true,
        parent_service_path: 'requests',
        parent_id: request._id
      });
  
      // continue to work loop
      console.log('work it!')
      workRequest(request);
    }
  }
  

  const checkStateActivities = async request => {
    const allActivities = await app.service('request-activities').find({
      query: {
        parent_request: request._id
      }
    });

    console.log(allActivities.total -1);

    const completeActivities = await app.service('request-activities').find({
      query: {
        parent_request: request._id,
        state: 'complete'
      }
    });

    console.log(completeActivities.total);

    const total = allActivities.total - 1;
    const complete = completeActivities.total;

    if(total == complete) {
      await app.service('requests').patch(request._id, {
        state: 'complete',
        ui_start_header: 'stack-provisioned',
        ui_end_icon: 'success',
        ui_start_icon: 'success',
        stage: 'provisioned',
        request_state: 'provisioned',
        overall_state: 'provisioned',
        substage: 'provisioned'
      });

      await app.service('stacks').create({
        name: request.name,
        parent_request: request._id,
        parent_workflow: request.parent_workflow,
        state: 'provisioned',
        has_issues: false,
        needs_update: false,
        version: 1,
        revision: 1,
        has_questions: false,
        active: true,
        destroyed: false,
        owner: request.created_by
      })
    }
  }
  
  
  requestService.on('created', async request => {
    console.log('CREATE')
    setTimeout( () => {
      if(request.state != 'complete') {
        processRequest(request);
        checkStateActivities(request);
      }
    }, 5000);
  });
  
  requestService.on('patched', async request => {
    

    if(request.state != 'complete') {
      processRequest(request);
      checkStateActivities(request);
    }
  });
  
  
  app.authenticate({
    strategy: 'local',
    email: 'admin@system.local',
    password: 'P0pc0rn1'
  })
  .then( () => {
    app.service('maestro-status').create({
      service: 'maestro/task-manager/request-manager',
      topic: 'service-started',
      created_at: new Date()
    })
    .then( () => {
      console.log('\n\n\nMaestro Request Manager is running.\n\n\n')
    })
  })
  .catch( e => {
    console.log('Could not connect to API retrying in 5 seconds...');
  })
}

start();
