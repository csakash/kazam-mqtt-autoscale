import { integer } from 'aws-sdk/clients/cloudfront';
import mqtt from 'mqtt';

const brokers = [
  "mqtt://172.31.34.98:1883",
  "mqtt://172.31.36.68:1883",
  "mqtt://172.31.46.51:1883"
];

const clientCounts: {[broker: string]: number} = {};
const testClientsPerBroker = 5;

const topic = 'kazam';
const numberOfMessages = 100;
let count = 0;

const publishMessages = (brokerUrl: string, msgCount: integer) => {
  return new Promise<void>((resolve, reject) => {
    const client = mqtt.connect(brokerUrl);
    count = count + 1;
    console.log(count)
    client.on('connect', () => {
      const message = count.toString();
      console.log(`Connected to MQTT broker at ${brokerUrl}`);

      for (let i=0; i<msgCount; i++){
      client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error(`Publish error to ${brokerUrl}: `, error);
          reject(error);
        } else {
          console.log(`${i} Message published to ${brokerUrl} at ${topic}: ${message}`);
          
        }

  
      client.end(false, {}, () => {
        console.log(`Disconnected from ${brokerUrl}`);
        resolve();
      });
    })
  }
  ;

    client.on('error', (error) => {
      console.error(`Connection error to ${brokerUrl}: `, error);
      reject(error);
    });
  });
})};


const publishToAllBrokers = async () => {
  for (const broker of brokers) {
    try {
      await publishMessages(broker, 20);
    } catch (error) {
      console.error(`Error publishing to broker ${broker}: `, error);
    }
  }
};

publishToAllBrokers().then(() => {
  console.log('Finished publishing messages to all brokers');
}).catch((error) => {
  console.error('Error in publishing script: ', error);
});

const simulateClients = (brokerUrl: string, numClients: number) => {
  for (let i = 0; i<numClients; i++){
      const client = mqtt.connect(brokerUrl);

      client.on('connect', () => {
          console.log(`Simulated client connected to ${brokerUrl} , ${i}`);
          clientCounts[brokerUrl] = count;
          count = count + 1
      });

      client.on('error', (error) => {
          console.error(`Simulated client connection error to ${brokerUrl}`, error);
      })
  }
}

const startTest = async() => {

  brokers.forEach((broker) => {
      simulateClients(broker, testClientsPerBroker)
  })
}

startTest().then(() => {
  console.log(`Started test for auto scaling EMQX broker`);
}).catch((error) => {
  console.error(`Error starting test: `, error)
})
