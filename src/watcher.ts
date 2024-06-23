import mqtt from 'mqtt';
import { producer, consumer, connectKafka } from './kafkaClient';

const brokers = [
    "mqtt://172.31.34.98:1883",
    "mqtt://172.31.36.68:1883",
    "mqtt://172.31.46.51:1883"
]

const clientThreshold = 10; //10000
const testClientsPerBroker = 50; //12000
const clientCounts: {[broker: string]: number} = {};
const topic = 'kazam';

let count = 0;

const checkClientCount = async () => {
    console.log(clientCounts)
    const totalClients = Object.values(clientCounts).reduce((sum, count) => sum + count, 0);
    console.log(`Total clients connected: ${totalClients}`);
    
    if (totalClients > clientThreshold) {
      console.log('Client threshold exceeded, sending scale-up event to Kafka');
  
      await producer.send({
        topic: 'mqtt-scale-event',
        messages: [{ key: 'scale', value: 'scale-up' }]
      });
    } else if (totalClients <= clientThreshold){
        await producer.send({
            topic: 'mqtt-scale-event',
            messages: [{ key: 'scale', value: 'scale-down' }]
          }); 
    }
  };

  const publishMessages = (brokerUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(brokerUrl);
      count = count + 1;
      console.log(count)
      client.on('connect', () => {
        const message = count.toString();
        console.log(`Connected to MQTT broker at ${brokerUrl}`);
  
        // for (let i=0; i<msgCount; i++){
        client.publish(topic, message, { qos: 1 }, (error) => {
          if (error) {
            console.error(`Publish error to ${brokerUrl}: `, error);
            reject(error);
          } else {
            console.log(`Message published to ${brokerUrl} at ${topic}: ${message}`);
            
          }
  
        client.end(false, {}, () => {
          console.log(`Disconnected from ${brokerUrl}`);
          resolve();
        });
      })
    // }
    ;
  
      client.on('error', (error) => {
        console.error(`Connection error to ${brokerUrl}: `, error);
        reject(error);
      });
    });
  })};

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

const monitorKafkaLogs = async () => {
    await consumer.subscribe({
        topic: 'mqtt-scale-event', fromBeginning: true
    })

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const scaleAction = message.value?.toString();

            console.log(`Received scale event: ${scaleAction}`)

        }
    })
}

const monitorEMQXClients = () => {
    brokers.forEach((broker) => {
        const client = mqtt.connect(broker);

        client.on('connect', () => {
            console.log(`Connected to MQTT broker at ${broker}`);
            client.subscribe("kazam")
            clientCounts[broker] = count;
            count = count + 1;
        })

        client.on('message', (topic, message) => {
            clientCounts[broker] = parseInt(message.toString(), 10);
            checkClientCount();
        })

        client.on('error', (error) => {
            console.error(`Connection error to ${broker}: `, error);
          });
    })
    
}

const startTest = async() => {
    await connectKafka();
    // monitorEMQXClients();
    setTimeout(monitorEMQXClients, 5000) //60s
    //monitorKafkaLogs()
    // brokers.forEach((broker) => {
    //     simulateClients(broker, testClientsPerBroker)
    // })
}

startTest().then(() => {
    console.log(`Started test for auto scaling EMQX broker`);
}).catch((error) => {
    console.error(`Error starting test: `, error)
})