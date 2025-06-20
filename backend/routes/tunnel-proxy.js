const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

router.use('*', async (req, res) => {
  const startTime = Date.now();
  const subdomain = req.headers['x-tunnel-subdomain'];
  const region = req.headers['x-tunnel-region'];

  if (!subdomain || !region) {
    return res.status(400).json({ message: 'Missing subdomain/region' });
  }

  const { data, error } = await supabase
    .from('tunnels')
    .select('*, users!tunnels_user_id_fkey(email)')
    .eq('subdomain', subdomain)
    .eq('location', region)
    .eq('status', 'active')
    .limit(1);

  if (error || !data || data.length === 0) {
    return res.status(404).json({ message: 'Tunnel not found or inactive' });
  }

  const tunnel = data[0];
  if (!tunnel.client_connected) {
    return res.status(503).json({ message: 'Client not connected' });
  }

  const { activeTunnels, forwardRequest } = req.app.locals;
  const tunnelKey = `${subdomain}.${region}`;
  if (!activeTunnels || !activeTunnels.has(tunnelKey)) {
    return res.status(503).json({ message: 'WebSocket not connected' });
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const requestPayload = {
    type: 'request',
    requestId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body
  };

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout - local application did not respond within 30 seconds')), 30000)
    );
    const response = await Promise.race([
      forwardRequest(tunnelKey, requestPayload),
      timeout
    ]);

    const statusCode = parseInt(response.statusCode) || 200;
    res.status(statusCode);

    const headers = response.headers || {};
    const skipHeaders = ['content-length', 'connection', 'transfer-encoding'];
    for (const [k, v] of Object.entries(headers)) {
      if (!skipHeaders.includes(k.toLowerCase()) && v) {
        res.setHeader(k, String(v));
      }
    }

    if (response.encoding === 'base64' && response.body) {
      res.send(Buffer.from(response.body, 'base64'));
    } else if (typeof response.body === 'object') {
      res.json(response.body);
    } else {
      res.send(String(response.body || ''));
    }

  } catch (err) {
    console.error('❌ Tunnel proxy error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

module.exports = router;

