#!/usr/bin/env node

const { program } = require('commander');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const url = require('url');
const chalk = require('chalk');

program
  .requiredOption('-t, --token <token>', 'Tunnel token')
  .requiredOption('-l, --local <url>', 'Local URL to expose, e.g. http://127.0.0.1:8000')
  .option('-s, --server <url>', 'Tunlify server URL', 'https://api.tunlify.biz.id')
  .option('--insecure', 'Allow self-signed HTTPS certificate', false)
  .parse();

const options = program.opts();

class TunlifyClient {
  constructor({ token, local, server, insecure }) {
    this.token = token;
    this.local = local;
    this.server = server;
    this.insecure = insecure;
    this.ws = null;
  }

  async start() {
    const [status, error] = await this.testLocal();
    if (!status) {
      console.error(chalk.red(`❌ Local server not reachable: ${error}`));
      process.exit(1);
    }

    const wsUrl = this.server.replace(/^http/, 'ws') + `/ws/tunnel?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log(chalk.green('✅ WebSocket connected'));
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'request') {
          this.forwardRequest(msg);
        }
      } catch (e) {
        console.error(chalk.red('❌ Invalid message'), e.message);
      }
    });

    this.ws.on('close', () => {
      console.log(chalk.yellow('⚠️ Disconnected. Reconnecting in 5s...'));
      setTimeout(() => this.start(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error(chalk.red('❌ WS error'), err.message);
    });

    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }

  async testLocal() {
    try {
      const res = await axios.get(this.local, {
        timeout: 3000,
        httpsAgent: new https.Agent({ rejectUnauthorized: !this.insecure })
      });
      console.log(chalk.gray(`✅ Local reachable: ${this.local} (${res.status})`));
      return [true];
    } catch (err) {
      return [false, err.message];
    }
  }

  async forwardRequest(msg) {
    const { requestId, method, url: reqPath, headers, body } = msg;

    const localUrl = new URL(reqPath, this.local);
    const agent = localUrl.protocol === 'https:'
      ? new https.Agent({ rejectUnauthorized: !this.insecure })
      : undefined;

    try {
      const resp = await axios({
        method,
        url: localUrl.toString(),
        headers: this.sanitizeHeaders(headers),
        data: body,
        timeout: 25000,
        responseType: 'arraybuffer',
        httpsAgent: agent,
        validateStatus: () => true
      });

      const contentType = resp.headers['content-type'] || '';
      const isBinary = /image|video|audio|application\/octet-stream/.test(contentType);
      const encoding = isBinary ? 'base64' : 'utf8';

      const responsePayload = {
        type: 'response',
        requestId,
        statusCode: resp.status,
        headers: resp.headers,
        encoding,
        body: encoding === 'base64'
          ? Buffer.from(resp.data).toString('base64')
          : resp.data.toString()
      };

      this.ws.send(JSON.stringify(responsePayload));
    } catch (err) {
      this.ws.send(JSON.stringify({
        type: 'error',
        requestId,
        message: err.message
      }));
      console.error(chalk.red(`❌ Request error ${reqPath}: ${err.message}`));
    }
  }

  sanitizeHeaders(headers) {
    const skip = new Set([
      'host', 'connection', 'upgrade', 'x-forwarded-for',
      'x-real-ip', 'x-tunnel-subdomain', 'x-tunnel-region',
      'x-forwarded-host', 'x-forwarded-proto'
    ]);
    const result = {};
    for (const key in headers) {
      if (!skip.has(key.toLowerCase())) {
        result[key] = headers[key];
      }
    }
    return result;
  }
}

new TunlifyClient(options).start();
