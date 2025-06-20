#!/usr/bin/env node

const { program } = require('commander');
const axios = require('axios');
const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const http = require('http');
const https = require('https');
const url = require('url');
const chalk = require('chalk');
const ora = require('ora');

program
  .requiredOption('-t, --token <token>', 'Tunnel connection token')
  .requiredOption('-l, --local <address>', 'Local address to expose (e.g., 127.0.0.1:3000, localhost:22, https://10.1.1.124:8000)')
  .option('-p, --protocol <protocol>', 'Protocol type: http, tcp, udp', 'http')
  .option('-s, --server <url>', 'Tunlify server URL', 'https://api.tunlify.biz.id')
  .option('--insecure', 'Allow self-signed HTTPS certificates', false)
  .option('--verbose', 'Enable verbose logging', false)
  .parse();

const options = program.opts();

class TunlifyClient {
  constructor({ token, local, protocol, server, insecure, verbose }) {
    this.token = token;
    this.local = local;
    this.protocol = protocol.toLowerCase();
    this.server = server;
    this.insecure = insecure;
    this.verbose = verbose;
    this.ws = null;
    this.tunnelInfo = null;
    this.tcpConnections = new Map();
    this.udpSockets = new Map();
    this.spinner = null;
    
    // Parse local address
    this.parseLocalAddress();
  }

  parseLocalAddress() {
    let host = '127.0.0.1';
    let port = 3000;
    let isHttps = false;

    try {
      // Check if it's a full URL (http:// or https://)
      if (this.local.startsWith('http://') || this.local.startsWith('https://')) {
        const parsedUrl = new URL(this.local);
        host = parsedUrl.hostname;
        port = parseInt(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80);
        isHttps = parsedUrl.protocol === 'https:';
        
        this.log(`Parsed URL: ${this.local} -> ${host}:${port} (HTTPS: ${isHttps})`, 'debug');
      }
      // Check if it contains a colon (host:port format)
      else if (this.local.includes(':')) {
        const parts = this.local.split(':');
        if (parts[0]) host = parts[0];
        port = parseInt(parts[1]);
      }
      // Just a port number
      else if (/^\d+$/.test(this.local)) {
        port = parseInt(this.local);
      }
      // Invalid format
      else {
        throw new Error(`Invalid local address format: ${this.local}`);
      }

      // Validate port
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid port number: ${port}. Must be between 1-65535`);
      }

      this.localHost = host;
      this.localPort = port;
      this.isHttps = isHttps;

      this.log(`Local address parsed: ${host}:${port} (HTTPS: ${isHttps})`, 'debug');

    } catch (error) {
      console.error(chalk.red(`❌ Error parsing local address: ${error.message}`));
      console.error(chalk.yellow('💡 Supported formats:'));
      console.error(chalk.yellow('   - 127.0.0.1:3000'));
      console.error(chalk.yellow('   - localhost:22'));
      console.error(chalk.yellow('   - :8080'));
      console.error(chalk.yellow('   - 3000'));
      console.error(chalk.yellow('   - http://10.1.1.124:8000'));
      console.error(chalk.yellow('   - https://10.1.1.124:8000'));
      process.exit(1);
    }
  }

  log(message, level = 'info') {
    if (!this.verbose && level === 'debug') return;
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = level === 'error' ? chalk.red('❌') : 
                   level === 'warn' ? chalk.yellow('⚠️') : 
                   level === 'success' ? chalk.green('✅') : 
                   chalk.blue('ℹ️');
    
    console.log(`${chalk.gray(timestamp)} ${prefix} ${message}`);
  }

  async start() {
    this.spinner = ora('Connecting to Tunlify...').start();

    try {
      // Authenticate and get tunnel info
      await this.authenticate();
      
      // Test local service
      await this.testLocalService();
      
      // Connect WebSocket
      await this.connectWebSocket();
      
      this.spinner.succeed('Connected successfully!');
      this.displayTunnelInfo();
      
    } catch (error) {
      this.spinner.fail(`Connection failed: ${error.message}`);
      process.exit(1);
    }
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.server}/api/tunnels/auth`, {
        connection_token: this.token
      }, {
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: !this.insecure })
      });

      this.tunnelInfo = response.data;
      this.log(`Authenticated for tunnel: ${this.tunnelInfo.tunnel_url}`, 'success');
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid connection token');
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async testLocalService() {
    const testConnection = () => {
      return new Promise((resolve, reject) => {
        if (this.protocol === 'udp') {
          // For UDP, we can't really test connectivity, so just resolve
          resolve(true);
          return;
        }

        // For HTTP protocol, test with HTTP request
        if (this.protocol === 'http') {
          const testUrl = `${this.isHttps ? 'https' : 'http'}://${this.localHost}:${this.localPort}`;
          
          const agent = this.isHttps 
            ? new https.Agent({ rejectUnauthorized: !this.insecure })
            : undefined;

          axios.get(testUrl, {
            timeout: 3000,
            httpsAgent: agent,
            validateStatus: () => true // Accept any status code
          })
          .then(() => resolve(true))
          .catch((error) => {
            if (error.code === 'ECONNREFUSED') {
              reject(new Error('Connection refused - service not running'));
            } else if (error.code === 'ENOTFOUND') {
              reject(new Error('Host not found'));
            } else {
              // For HTTP, even errors like 404 mean the service is responding
              resolve(true);
            }
          });
          
          return;
        }

        // For TCP, test with socket connection
        const socket = net.createConnection({
          host: this.localHost,
          port: this.localPort,
          timeout: 3000
        });

        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('error', (err) => {
          reject(err);
        });

        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });
    };

    try {
      await testConnection();
      const serviceType = this.protocol === 'http' ? 'HTTP service' : `${this.protocol.toUpperCase()} service`;
      const serviceUrl = this.protocol === 'http' 
        ? `${this.isHttps ? 'https' : 'http'}://${this.localHost}:${this.localPort}`
        : `${this.localHost}:${this.localPort}`;
      
      this.log(`${serviceType} reachable: ${serviceUrl}`, 'success');
    } catch (error) {
      const serviceUrl = this.protocol === 'http' 
        ? `${this.isHttps ? 'https' : 'http'}://${this.localHost}:${this.localPort}`
        : `${this.localHost}:${this.localPort}`;
        
      throw new Error(`Local service not reachable at ${serviceUrl}: ${error.message}`);
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.server.replace(/^http/, 'ws') + `/ws/tunnel?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.log('WebSocket connected', 'success');
        
        // Send local address info
        const localAddress = this.protocol === 'http' && this.isHttps
          ? `https://${this.localHost}:${this.localPort}`
          : `${this.localHost}:${this.localPort}`;
          
        this.ws.send(JSON.stringify({
          type: 'set_local_address',
          address: localAddress,
          protocol: this.protocol,
          https: this.isHttps
        }));
        
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        this.log(`WebSocket disconnected (${code}): ${reason}`, 'warn');
        this.cleanup();
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.log('Attempting to reconnect...', 'info');
          this.connectWebSocket().catch(() => {
            this.log('Reconnection failed, retrying in 10 seconds...', 'error');
          });
        }, 5000);
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`WebSocket error: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'connected':
          this.log('Tunnel established successfully', 'success');
          break;
          
        case 'local_address_ack':
          this.log(`Local address confirmed: ${message.address}`, 'debug');
          break;
          
        case 'request':
          if (this.protocol === 'http') {
            this.handleHttpRequest(message);
          } else {
            this.log(`Received ${this.protocol.toUpperCase()} request: ${message.requestId}`, 'debug');
            this.handleTcpUdpRequest(message);
          }
          break;
          
        case 'tcp_connect':
          this.handleTcpConnect(message);
          break;
          
        case 'tcp_data':
          this.handleTcpData(message);
          break;
          
        case 'tcp_close':
          this.handleTcpClose(message);
          break;
          
        case 'udp_data':
          this.handleUdpData(message);
          break;
          
        case 'heartbeat':
          this.ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;
          
        default:
          this.log(`Unknown message type: ${message.type}`, 'debug');
      }
    } catch (error) {
      this.log(`Error parsing WebSocket message: ${error.message}`, 'error');
    }
  }

  // HTTP Request Handler (enhanced for HTTPS support)
  async handleHttpRequest(message) {
    const { requestId, method, url: reqPath, headers, body } = message;
    
    this.log(`${method} ${reqPath}`, 'debug');

    try {
      // Build the local URL with proper protocol
      const protocol = this.isHttps ? 'https' : 'http';
      const localUrl = new URL(reqPath, `${protocol}://${this.localHost}:${this.localPort}`);
      
      const agent = this.isHttps
        ? new https.Agent({ rejectUnauthorized: !this.insecure })
        : undefined;

      const response = await axios({
        method,
        url: localUrl.toString(),
        headers: this.sanitizeHeaders(headers),
        data: body,
        timeout: 25000,
        responseType: 'arraybuffer',
        httpsAgent: agent,
        validateStatus: () => true
      });

      const contentType = response.headers['content-type'] || '';
      const isBinary = /image|video|audio|application\/octet-stream|application\/pdf/.test(contentType);
      const encoding = isBinary ? 'base64' : 'utf8';

      const responsePayload = {
        type: 'response',
        requestId,
        statusCode: response.status,
        headers: response.headers,
        encoding,
        body: encoding === 'base64'
          ? Buffer.from(response.data).toString('base64')
          : response.data.toString()
      };

      this.ws.send(JSON.stringify(responsePayload));
      
    } catch (error) {
      this.log(`HTTP request error: ${error.message}`, 'error');
      this.ws.send(JSON.stringify({
        type: 'error',
        requestId,
        message: error.message
      }));
    }
  }

  // Enhanced TCP/UDP Request Handler
  handleTcpUdpRequest(message) {
    const { requestId, method, url: reqPath, headers, body } = message;
    
    this.log(`Handling ${this.protocol.toUpperCase()} request: ${requestId}`, 'debug');

    if (this.protocol === 'tcp') {
      // For TCP, establish a persistent connection
      this.handleTcpRequest(message);
    } else if (this.protocol === 'udp') {
      // For UDP, handle as datagram
      this.handleUdpRequest(message);
    } else {
      this.log(`Unsupported protocol for direct handling: ${this.protocol}`, 'error');
      this.ws.send(JSON.stringify({
        type: 'error',
        requestId,
        message: `Unsupported protocol: ${this.protocol}`
      }));
    }
  }

  // TCP Request Handler
  handleTcpRequest(message) {
    const { requestId, body } = message;
    
    // Create TCP connection to local service
    const socket = net.createConnection({
      host: this.localHost,
      port: this.localPort
    });

    socket.on('connect', () => {
      this.log(`TCP connection established for request: ${requestId}`, 'debug');
      
      // Send the request data if any
      if (body) {
        const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
        socket.write(buffer);
      }
    });

    socket.on('data', (data) => {
      this.log(`TCP response data received: ${data.length} bytes`, 'debug');
      
      // Send response back through WebSocket
      this.ws.send(JSON.stringify({
        type: 'response',
        requestId,
        statusCode: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        encoding: 'base64',
        body: data.toString('base64')
      }));
    });

    socket.on('close', () => {
      this.log(`TCP connection closed for request: ${requestId}`, 'debug');
    });

    socket.on('error', (error) => {
      this.log(`TCP connection error for request ${requestId}: ${error.message}`, 'error');
      
      this.ws.send(JSON.stringify({
        type: 'error',
        requestId,
        message: error.message
      }));
    });

    // Store connection for potential cleanup
    this.tcpConnections.set(requestId, socket);
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      if (this.tcpConnections.has(requestId)) {
        socket.destroy();
        this.tcpConnections.delete(requestId);
      }
    }, 30000);
  }

  // UDP Request Handler
  handleUdpRequest(message) {
    const { requestId, body } = message;
    
    const socket = dgram.createSocket('udp4');
    
    socket.on('message', (msg, rinfo) => {
      this.log(`UDP response received: ${msg.length} bytes`, 'debug');
      
      // Send response back through WebSocket
      this.ws.send(JSON.stringify({
        type: 'response',
        requestId,
        statusCode: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        encoding: 'base64',
        body: msg.toString('base64')
      }));
      
      socket.close();
    });

    socket.on('error', (error) => {
      this.log(`UDP socket error for request ${requestId}: ${error.message}`, 'error');
      
      this.ws.send(JSON.stringify({
        type: 'error',
        requestId,
        message: error.message
      }));
      
      socket.close();
    });

    // Send UDP packet
    if (body) {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      socket.send(buffer, this.localPort, this.localHost, (error) => {
        if (error) {
          this.log(`UDP send error: ${error.message}`, 'error');
          this.ws.send(JSON.stringify({
            type: 'error',
            requestId,
            message: error.message
          }));
        }
      });
    }

    // Auto-cleanup after 5 seconds for UDP
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.close();
      }
    }, 5000);
  }

  // TCP Connection Handler
  handleTcpConnect(message) {
    const { connectionId } = message;
    
    this.log(`New TCP connection: ${connectionId}`, 'debug');

    const socket = net.createConnection({
      host: this.localHost,
      port: this.localPort
    });

    socket.on('connect', () => {
      this.log(`TCP connected to local service: ${connectionId}`, 'debug');
      this.tcpConnections.set(connectionId, socket);
      
      this.ws.send(JSON.stringify({
        type: 'tcp_connect_ack',
        connectionId
      }));
    });

    socket.on('data', (data) => {
      this.ws.send(JSON.stringify({
        type: 'tcp_data',
        connectionId,
        data: data.toString('base64')
      }));
    });

    socket.on('close', () => {
      this.log(`TCP connection closed: ${connectionId}`, 'debug');
      this.tcpConnections.delete(connectionId);
      
      this.ws.send(JSON.stringify({
        type: 'tcp_close',
        connectionId
      }));
    });

    socket.on('error', (error) => {
      this.log(`TCP connection error ${connectionId}: ${error.message}`, 'error');
      this.tcpConnections.delete(connectionId);
      
      this.ws.send(JSON.stringify({
        type: 'tcp_error',
        connectionId,
        error: error.message
      }));
    });
  }

  // TCP Data Handler
  handleTcpData(message) {
    const { connectionId, data } = message;
    const socket = this.tcpConnections.get(connectionId);
    
    if (socket && !socket.destroyed) {
      const buffer = Buffer.from(data, 'base64');
      socket.write(buffer);
    }
  }

  // TCP Close Handler
  handleTcpClose(message) {
    const { connectionId } = message;
    const socket = this.tcpConnections.get(connectionId);
    
    if (socket && !socket.destroyed) {
      socket.destroy();
      this.tcpConnections.delete(connectionId);
    }
  }

  // UDP Data Handler
  handleUdpData(message) {
    const { sessionId, data, remoteAddress, remotePort } = message;
    
    this.log(`UDP data from ${remoteAddress}:${remotePort}`, 'debug');

    const buffer = Buffer.from(data, 'base64');
    
    // Create UDP socket if not exists
    if (!this.udpSockets.has(sessionId)) {
      const socket = dgram.createSocket('udp4');
      this.udpSockets.set(sessionId, socket);
      
      socket.on('message', (msg, rinfo) => {
        this.ws.send(JSON.stringify({
          type: 'udp_response',
          sessionId,
          data: msg.toString('base64'),
          localAddress: rinfo.address,
          localPort: rinfo.port
        }));
      });
      
      socket.on('error', (error) => {
        this.log(`UDP socket error: ${error.message}`, 'error');
        this.udpSockets.delete(sessionId);
      });
    }

    const socket = this.udpSockets.get(sessionId);
    socket.send(buffer, this.localPort, this.localHost);
  }

  sanitizeHeaders(headers) {
    const skipHeaders = new Set([
      'host', 'connection', 'upgrade', 'x-forwarded-for',
      'x-real-ip', 'x-tunnel-subdomain', 'x-tunnel-region',
      'x-forwarded-host', 'x-forwarded-proto', 'content-length',
      'transfer-encoding'
    ]);
    
    const result = {};
    for (const [key, value] of Object.entries(headers || {})) {
      if (!skipHeaders.has(key.toLowerCase()) && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  displayTunnelInfo() {
    console.log('\n' + chalk.green('🚀 Tunnel Active!'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    console.log(chalk.bold('📋 Tunnel Information:'));
    console.log(`   Service: ${chalk.yellow(this.tunnelInfo.service_name || 'Custom Port')}`);
    console.log(`   Protocol: ${chalk.yellow(this.protocol.toUpperCase())}`);
    
    const localUrl = this.protocol === 'http' && this.isHttps
      ? `https://${this.localHost}:${this.localPort}`
      : `${this.localHost}:${this.localPort}`;
    console.log(`   Local: ${chalk.yellow(localUrl)}`);
    console.log(`   Remote: ${chalk.yellow(this.tunnelInfo.tunnel_url)}`);
    
    if (this.tunnelInfo.remote_port && this.protocol !== 'http') {
      console.log(`   Remote Port: ${chalk.yellow(this.tunnelInfo.remote_port)}`);
    }
    
    console.log('\n' + chalk.bold('🔗 Connection Examples:'));
    this.displayConnectionExamples();
    
    console.log('\n' + chalk.gray('Press Ctrl+C to stop the tunnel'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  }

  displayConnectionExamples() {
    const { service_type, tunnel_url, remote_port } = this.tunnelInfo;
    const host = tunnel_url.replace(/^https?:\/\//, '').split(':')[0];
    
    switch (service_type) {
      case 'ssh':
        console.log(`   SSH: ${chalk.green(`ssh username@${host} -p ${remote_port}`)}`);
        console.log(`   SCP: ${chalk.green(`scp -P ${remote_port} file.txt username@${host}:/path/`)}`);
        break;
        
      case 'rdp':
        console.log(`   Windows: ${chalk.green(`mstsc /v:${host}:${remote_port}`)}`);
        console.log(`   Linux: ${chalk.green(`xfreerdp /v:${host}:${remote_port} /u:username`)}`);
        break;
        
      case 'mysql':
        console.log(`   MySQL CLI: ${chalk.green(`mysql -h ${host} -P ${remote_port} -u username -p`)}`);
        console.log(`   Connection String: ${chalk.green(`mysql://username:password@${host}:${remote_port}/database`)}`);
        break;
        
      case 'postgresql':
        console.log(`   psql: ${chalk.green(`psql -h ${host} -p ${remote_port} -U username -d database`)}`);
        console.log(`   Connection String: ${chalk.green(`postgresql://username:password@${host}:${remote_port}/database`)}`);
        break;
        
      case 'mongodb':
        console.log(`   Mongo CLI: ${chalk.green(`mongo mongodb://${host}:${remote_port}/database`)}`);
        console.log(`   Connection String: ${chalk.green(`mongodb://username:password@${host}:${remote_port}/database`)}`);
        break;
        
      case 'redis':
        console.log(`   Redis CLI: ${chalk.green(`redis-cli -h ${host} -p ${remote_port}`)}`);
        break;
        
      case 'vnc':
        console.log(`   VNC Viewer: ${chalk.green(`${host}:${remote_port}`)}`);
        break;
        
      case 'ftp':
        console.log(`   FTP: ${chalk.green(`ftp ${host} ${remote_port}`)}`);
        break;
        
      case 'minecraft':
        console.log(`   Minecraft: ${chalk.green(`${host}:${remote_port}`)}`);
        break;
        
      case 'http':
      case 'https':
        console.log(`   Browser: ${chalk.green(tunnel_url)}`);
        console.log(`   cURL: ${chalk.green(`curl ${tunnel_url}`)}`);
        if (this.isHttps) {
          console.log(`   Local HTTPS: ${chalk.yellow(`https://${this.localHost}:${this.localPort}`)}`);
        }
        break;
        
      default:
        if (this.protocol === 'tcp') {
          console.log(`   TCP: ${chalk.green(`telnet ${host} ${remote_port}`)}`);
        } else if (this.protocol === 'udp') {
          console.log(`   UDP: ${chalk.green(`nc -u ${host} ${remote_port}`)}`);
        }
    }
  }

  cleanup() {
    // Close all TCP connections
    for (const [connectionId, socket] of this.tcpConnections) {
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
    this.tcpConnections.clear();

    // Close all UDP sockets
    for (const [sessionId, socket] of this.udpSockets) {
      socket.close();
    }
    this.udpSockets.clear();
  }

  // Graceful shutdown
  shutdown() {
    this.log('Shutting down tunnel...', 'info');
    
    if (this.spinner && this.spinner.isSpinning) {
      this.spinner.stop();
    }
    
    this.cleanup();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n' + chalk.yellow('🛑 Received interrupt signal'));
  if (global.client) {
    global.client.shutdown();
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('\n' + chalk.yellow('🛑 Received terminate signal'));
  if (global.client) {
    global.client.shutdown();
  } else {
    process.exit(0);
  }
});

// Start the client
const client = new TunlifyClient(options);
global.client = client;
client.start().catch((error) => {
  console.error(chalk.red(`❌ Failed to start client: ${error.message}`));
  process.exit(1);
});