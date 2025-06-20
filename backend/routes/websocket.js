const WebSocket = require('ws');
const url = require('url');
const supabase = require('../config/database');

// WebSocket server for tunnel connections
function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws/tunnel'
  });

  // Store active tunnel connections
  const activeTunnels = new Map();
  
  // Store pending requests waiting for responses
  const pendingRequests = new Map();

  wss.on('connection', async (ws, req) => {
    const query = url.parse(req.url, true).query;
    const connectionToken = query.token;

    console.log('🔌 WebSocket connection attempt with token:', connectionToken?.substring(0, 8) + '...');

    if (!connectionToken) {
      console.log('❌ WebSocket: No connection token provided');
      ws.close(1008, 'Connection token required');
      return;
    }

    try {
      // Authenticate tunnel
      const { data: tunnel, error } = await supabase
        .from('tunnels')
        .select(`
          *,
          users!tunnels_user_id_fkey(email, name)
        `)
        .eq('connection_token', connectionToken)
        .single();

      if (error || !tunnel) {
        console.log('❌ WebSocket: Invalid connection token');
        ws.close(1008, 'Invalid connection token');
        return;
      }

      console.log(`✅ WebSocket: Client connected for tunnel ${tunnel.subdomain}.${tunnel.location}`);
      console.log(`👤 User: ${tunnel.users.email}`);

      // Update tunnel status
      await supabase
        .from('tunnels')
        .update({ 
          client_connected: true, 
          status: 'active',
          last_connected: new Date().toISOString()
        })
        .eq('id', tunnel.id);

      // Store connection
      const tunnelKey = `${tunnel.subdomain}.${tunnel.location}`;
      activeTunnels.set(tunnelKey, {
        ws,
        tunnel,
        localAddress: null,
        connected: true,
        lastHeartbeat: Date.now(),
        requestCount: 0,
        responseCount: 0
      });

      console.log(`📊 Active tunnels: ${activeTunnels.size}`);

      // Handle messages from client
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          console.log(`📨 WebSocket message from client: ${data.type}`);

          switch (data.type) {
            case 'set_local_address':
              // Client tells us their local address
              const connection = activeTunnels.get(tunnelKey);
              if (connection) {
                connection.localAddress = data.address;
                console.log(`🎯 Local address set: ${data.address} for ${tunnelKey}`);
                
                // Send acknowledgment
                ws.send(JSON.stringify({
                  type: 'local_address_ack',
                  address: data.address
                }));
              }
              break;

            case 'response':
              // CRITICAL: Client sends response back to browser
              const requestId = data.requestId;
              console.log(`📤 Response from client for request: ${requestId}`);
              console.log(`📊 Response status: ${data.statusCode}`);
              console.log(`📊 Response headers:`, Object.keys(data.headers || {}));
              console.log(`📊 Response body length:`, data.body ? String(data.body).length : 0);
              
              if (pendingRequests.has(requestId)) {
                const { resolve } = pendingRequests.get(requestId);
                pendingRequests.delete(requestId);
                
                // Update response count
                const conn = activeTunnels.get(tunnelKey);
                if (conn) {
                  conn.responseCount++;
                }
                
                // CRITICAL: Ensure proper response structure
                const responseData = {
                  statusCode: data.statusCode || 200,
                  headers: data.headers || {},
                  body: data.body
                };
                
                // Clean up problematic headers that can cause gateway issues
                if (responseData.headers && typeof responseData.headers === 'object') {
                  const problematicHeaders = [
                    'content-length',
                    'transfer-encoding', 
                    'connection',
                    'upgrade',
                    'keep-alive',
                    'host',
                    'x-powered-by',
                    'server'
                  ];
                  
                  problematicHeaders.forEach(header => {
                    delete responseData.headers[header];
                    delete responseData.headers[header.toLowerCase()];
                    delete responseData.headers[header.toUpperCase()];
                  });
                  
                  // Ensure headers are strings and valid
                  Object.keys(responseData.headers).forEach(key => {
                    const value = responseData.headers[key];
                    if (value !== null && value !== undefined) {
                      responseData.headers[key] = String(value);
                    } else {
                      delete responseData.headers[key];
                    }
                  });
                }
                
                console.log(`✅ Resolving request ${requestId} with status ${responseData.statusCode}`);
                resolve(responseData);
              } else {
                console.log(`⚠️  No pending request found for ID: ${requestId}`);
              }
              break;

            case 'heartbeat':
              // Client heartbeat
              const conn = activeTunnels.get(tunnelKey);
              if (conn) {
                conn.lastHeartbeat = Date.now();
              }
              ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
              break;

            case 'error':
              // Client error
              console.log(`❌ Client error: ${data.message}`);
              if (data.requestId && pendingRequests.has(data.requestId)) {
                const { reject } = pendingRequests.get(data.requestId);
                pendingRequests.delete(data.requestId);
                reject(new Error(data.message));
              }
              break;

            default:
              console.log(`⚠️  Unknown message type: ${data.type}`);
          }
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', async () => {
        console.log(`🔌 WebSocket: Client disconnected for tunnel ${tunnelKey}`);
        
        // Update tunnel status
        await supabase
          .from('tunnels')
          .update({ 
            client_connected: false, 
            status: 'inactive'
          })
          .eq('id', tunnel.id);

        // Remove from active connections
        activeTunnels.delete(tunnelKey);
        
        // Reject any pending requests
        for (const [requestId, { reject }] of pendingRequests.entries()) {
          if (pendingRequests.get(requestId).tunnelKey === tunnelKey) {
            reject(new Error('Client disconnected'));
            pendingRequests.delete(requestId);
          }
        }
        
        console.log(`📊 Active tunnels: ${activeTunnels.size}`);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${tunnelKey}:`, error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        tunnel: {
          id: tunnel.id,
          subdomain: tunnel.subdomain,
          location: tunnel.location,
          url: `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`
        },
        message: 'WebSocket connection established successfully'
      }));

    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  // CRITICAL: Enhanced request forwarding function
  const forwardRequest = async (tunnelKey, requestData) => {
    const connection = activeTunnels.get(tunnelKey);
    
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Tunnel client not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update request count
      connection.requestCount++;
      
      // CRITICAL: Set timeout with proper cleanup
      const timeout = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          console.log(`❌ Request ${requestId} timed out after 30 seconds`);
          reject(new Error('Request timeout - local application did not respond within 30 seconds'));
        }
      }, 30000); // 30 second timeout

      // Store pending request with enhanced metadata
      pendingRequests.set(requestId, { 
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`✅ Request ${requestId} resolved with status ${data.statusCode}`);
          resolve(data);
        }, 
        reject: (error) => {
          clearTimeout(timeout);
          console.log(`❌ Request ${requestId} rejected: ${error.message}`);
          reject(error);
        },
        timestamp: Date.now(),
        tunnelKey: tunnelKey,
        method: requestData.method,
        url: requestData.url
      });

      // Send request to client
      const message = {
        type: 'request',
        requestId,
        method: requestData.method,
        url: requestData.url,
        headers: requestData.headers,
        body: requestData.body
      };

      console.log(`📤 Sending request to client: ${requestId} ${requestData.method} ${requestData.url}`);
      
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        console.error(`❌ Failed to send request ${requestId}:`, error);
        reject(new Error('Failed to send request to client: ' + error.message));
      }
    });
  };

  // Enhanced cleanup function for stale connections and requests
  const cleanupStaleConnections = () => {
    const now = Date.now();
    const staleTimeout = 5 * 60 * 1000; // 5 minutes
    const requestTimeout = 2 * 60 * 1000; // 2 minutes for requests
    
    // Clean up stale connections
    for (const [tunnelKey, connection] of activeTunnels.entries()) {
      if (now - connection.lastHeartbeat > staleTimeout) {
        console.log(`🧹 Cleaning up stale connection: ${tunnelKey}`);
        console.log(`   Requests: ${connection.requestCount}, Responses: ${connection.responseCount}`);
        connection.ws.close();
        activeTunnels.delete(tunnelKey);
      }
    }
    
    // Clean up stale requests
    for (const [requestId, request] of pendingRequests.entries()) {
      if (now - request.timestamp > requestTimeout) {
        console.log(`🧹 Cleaning up stale request: ${requestId} (${request.method} ${request.url})`);
        request.reject(new Error('Request cleanup - timeout'));
        pendingRequests.delete(requestId);
      }
    }
    
    // Log statistics
    if (activeTunnels.size > 0) {
      console.log(`📊 Active: ${activeTunnels.size} tunnels, ${pendingRequests.size} pending requests`);
    }
  };

  // Run cleanup every 2 minutes
  setInterval(cleanupStaleConnections, 2 * 60 * 1000);

  return { activeTunnels, forwardRequest };
}

module.exports = { setupWebSocketServer };
