import { producer, consumer, connectKafka } from './kafkaClient';
import AWS from 'aws-sdk';

AWS.config.update({
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
    region: 'us-east-2'
  });

const ec2 = new AWS.EC2();
const elbv2 = new AWS.ELBv2();

const targetGroupArn = 'arn:aws:elasticloadbalancing:us-east-2:077044764520:targetgroup/kazam-mqtt-tg/32b23bd2aeae5f11';
const maxInstances = 8;


const handleScaleEvent = async () => {
    await consumer.subscribe({
        topic: 'mqtt-scale-event', fromBeginning: true
    })

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const scaleAction = message.value?.toString();

            console.log(`Received scale event: ${scaleAction}`)

            if (scaleAction === 'scale-up'){
                await scaleUp();
            } else if (scaleAction === 'scale-down'){
                await scaleDown()
            }
        }
    })
}

const getStoppedInstances = async(): Promise<string[]> => {
    const params = {
        Filters: [
            {
                Name: 'instance-state-name',
                Values: ['stopped']
            },
            {
                Name: 'tag:AutoScalingGroupName',
                Values: ['kazam-asg']
            },
            {
                Name: 'tag:Role',
                Values: ['Scalable']
            }
        ]
    }

    const response = await ec2.describeInstances(params).promise();
    
    const instances = response.Reservations?.flatMap(reservation =>
        reservation.Instances?.map(instance => instance.InstanceId).filter((id): id is string => id !== undefined) || []
      ) || [];

    return instances
}

// console.log(getStoppedInstances())

const scaleUp = async() => {
    const stoppedInstances = await getStoppedInstances();
    // console.log(stoppedInstances)
    console.log("Currently Stopped Instances: ", stoppedInstances.length)
    console.log(stoppedInstances)

    if (stoppedInstances.length == 0) {
        console.log('No stopped instances available for scaling up');
        return;
    }

    const instancesToStart = stoppedInstances.slice(0, Math.max(0, stoppedInstances.length));

    if (instancesToStart.length > 0) {
        console.log(`Starting instances: ${instancesToStart.join(', ')}`);

        await ec2.startInstances({ InstanceIds: instancesToStart }).promise();

        await registerInstancesWithLoadBalancer(instancesToStart);

        console.log('Triggered scale-up action');
    } else {
        console.log('Maximum number of instances already running');
    }

    let balanced_nodes_payload = {
        "event": "increase",
        "stopped_instances": instancesToStart
    }
    await producer.send({
        topic: 'mqtt-scale-event',
        messages: [{ key: 'scale', value: JSON.stringify(balanced_nodes_payload) }]
      });

}

const scaleDown = async() => {
    const runningInstances = await getRunningInstances();

    console.log("Currently Running Instances: ", runningInstances.length)
    console.log(runningInstances)


    if (runningInstances.length === 0) {
        console.log('Minimum number of instances already running')
        return;
    }

    const instancesToStop = runningInstances.slice(0, runningInstances.length);

    console.log(`Stopping instances: ${instancesToStop.join(', ')}`);

    await deregisterInstancesWithLoadBalancer(instancesToStop);
    await ec2.stopInstances({ InstanceIds: instancesToStop}).promise();

    console.log('Triggered scale-down action')

    await producer.send({
        topic: 'mqtt-scale-event',
        messages: [{ key: 'scale', value: 'rebalancing-complete' }]
      });
    
    let balanced_nodes_payload = {
        "event": "reduce",
        "stopped_instances": instancesToStop
    }
    await producer.send({
        topic: 'mqtt-scale-event',
        messages: [{ key: 'scale', value: JSON.stringify(balanced_nodes_payload) }]
      });
}

const getRunningInstances = async (): Promise<string[]> => {
    const params = {
      Filters: [
        {
          Name: 'instance-state-name',
          Values: ['running']
        },
        {
            Name: 'tag:AutoScalingGroupName',
            Values: ['kazam-asg'] 
        },
        {
            Name: 'tag:Role',
            Values: ['Scalable']
        }
      ]
    };
  
    const response = await ec2.describeInstances(params).promise();
    console.log("RESPONSE: ", response)
    const instances = response.Reservations?.flatMap(reservation =>
      reservation.Instances?.map(instance => instance.InstanceId).filter((id): id is string => id !== undefined) || []
    ) || [];
  
    return instances;
  };

const registerInstancesWithLoadBalancer = async(instanceIds: string[]) => {
    const params: AWS.ELBv2.RegisterTargetsInput = {
        TargetGroupArn: targetGroupArn,
        Targets: instanceIds.map(id => ({ Id: id }))
    };

    await elbv2.registerTargets(params).promise();
}
const deregisterInstancesWithLoadBalancer = async(instanceIds: string[]) => {
    const params: AWS.ELBv2.DeregisterTargetsInput = {
        TargetGroupArn: targetGroupArn,
        Targets: instanceIds.map(id => ({ Id: id }))
    }

    await elbv2.deregisterTargets(params).promise()
}

connectKafka().then(() => {
    handleScaleEvent();
  }).catch((error) => {
    console.error('Error connecting to Kafka: ', error);
  });