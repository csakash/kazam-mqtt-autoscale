# EMQ Cluster Setup and Monitoring Solution

This repository contains the necessary configuration and scripts to set up an EMQX cluster, a Kafka server, and a Node.js application for monitoring and autoscaling.

## Table of Contents

- [Cluster Configuration](#cluster-configuration)
- [Additional Instances Setup](#additional-instances-setup)
- [Kafka Server Setup](#kafka-server-setup)
- [Node.js Application](#nodejs-application)
- [Execution Steps](#execution-steps)

## Cluster Configuration

To establish a robust EMQX cluster, follow these steps to configure three active nodes with 10 additional instances in a stopped state.

### EMQX1 Configuration

1. Configure the EMQX1 node with the following settings:

    ```bash
    node {
      name = "emqx@<private-ip-node-1>"
      cookie = "emqxsecretcookie"
      data_dir = "/var/lib/emqx"
    }

    cluster {
      name = emqxcl
      discovery_strategy = static
      static {
            seeds = ["emqx@<private-ip-node-2>", "emqx@<private-ip-node-3>"]
        }
    }

    dashboard {
        listeners.http {
            bind = 18083
        }
    }
    ```

2. Execute the following commands to verify the status and join the cluster:

    ```bash
    sudo systemctl status emqx
    sudo emqx_ctl cluster join emqx@<private-ip-node-2>
    sudo emqx_ctl cluster join emqx@<private-ip-node-3>
    ```

Repeat the same process for the other two nodes, ensuring the nodes listed in the seeds list are not the respective server’s IP. This completes the setup of a cluster with three interconnected brokers.

## Additional Instances Setup

1. **Create an AMI** from one of the configured servers.
2. **Launch 10 additional instances** using this AMI in a stopped state to be ready for scaling.

## Kafka Server Setup

Set up a Kafka server on a t2.medium instance by following the standard setup procedures available online.

## Node.js Application

The watcher instance will run a Node.js application to monitor MQTT ingress and egress as well as Kafka messages. It will also manage the scaling of servers.

### Scripts

- **watcher.ts** - Monitors EMQX and Kafka client activity.
- **scaler.ts** - Controls auto-scaling using AWS SDK.
- **publish.ts** - Simulates the test environment.
- **kafkaClient.ts** - Connects to the Kafka broker to create consumers and producers.

### Configuration Parameters

Set the number of clients and test clients as needed:

- **Client Threshold:**
    ```tsx
    const clientThreshold = 10; // Adjust to 10000 as needed
    ```

- **Test Clients:**
    ```tsx
    const testClientsPerBroker = 5; // Adjust to 12000 as needed
    ```

## Execution Steps

1. **Start the Scaler:**
    Begin by running `scaler.ts` to connect to Kafka and set up the AWS connection:

    ```bash
    npx ts-node src/scaler.ts
    ```

2. **Start the Watcher:**
    Next, run `watcher.ts` to connect to all brokers and Kafka. This script checks the client count every 60 seconds and monitors ingress/egress events to take appropriate actions:

    ```bash
    npx ts-node src/watcher.ts
    ```

3. **Run the Publisher:**
    Finally, run `publish.ts` to connect to the desired number of clients and test the scale-up/scale-down scenarios:

    ```bash
    npx ts-node src/publish.ts
    ```

This solution provides a scalable and monitored EMQ and Kafka setup, ensuring high availability and efficient resource management.

