import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'kazam-kafka',
  ssl: false,
  brokers: ['172.31.41.243:9092']
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: 'scale-events' });

export const connectKafka = async () => {
  await producer.connect();
  await consumer.connect();
};
