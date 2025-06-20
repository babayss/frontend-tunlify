const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const supabase = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user tunnels
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: tunnels, error } = await supabase
      .from('tunnels')
      .select(`
        *,
        server_locations!tunnels_location_fkey(name)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get tunnels error:', error);
      return res.status(500).json({ message: 'Failed to fetch tunnels' });
    }

    // Format response
    const formattedTunnels = tunnels.map(tunnel => ({
      ...tunnel,
      location_name: tunnel.server_locations?.name || tunnel.location
    }));

    res.json(formattedTunnels);
  } catch (error) {
    console.error('Get tunnels error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create tunnel (ngrok-style) - FIXED: Remove target_ip and target_port requirements
router.post('/', authenticateToken, [
  body('subdomain')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain must be 3-50 characters, lowercase letters, numbers, and hyphens only'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Location must be 2-10 characters')
], async (req, res) => {
  try {
    console.log('🔍 Create tunnel request:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { subdomain, location } = req.body;

    console.log(`🔍 Creating tunnel: ${subdomain}.${location} for user ${req.user.id}`);

    // Check if subdomain is already taken in this location
    const { data: existingTunnel } = await supabase
      .from('tunnels')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('location', location)
      .single();

    if (existingTunnel) {
      console.log(`❌ Subdomain already taken: ${subdomain}.${location}`);
      return res.status(409).json({ 
        message: `Subdomain '${subdomain}' is already taken in ${location}` 
      });
    }

    // Check if location exists
    const { data: locationData, error: locationError } = await supabase
      .from('server_locations')
      .select('id, name')
      .eq('region_code', location)
      .single();

    if (locationError || !locationData) {
      console.log(`❌ Invalid location: ${location}`);
      return res.status(400).json({ message: 'Invalid server location' });
    }

    // Generate unique connection token
    const connectionToken = crypto.randomBytes(32).toString('hex');
    console.log(`🔑 Generated connection token: ${connectionToken.substring(0, 8)}...`);

    // Create tunnel WITHOUT target_ip and target_port (ngrok-style)
    const { data: tunnel, error: createError } = await supabase
      .from('tunnels')
      .insert([{
        user_id: req.user.id,
        subdomain,
        location,
        connection_token: connectionToken,
        status: 'inactive', // Will be active when client connects
        client_connected: false,
        // NO target_ip and target_port - client will specify local address
      }])
      .select()
      .single();

    if (createError) {
      console.error('❌ Create tunnel error:', createError);
      return res.status(500).json({ message: 'Failed to create tunnel' });
    }

    console.log(`✅ Tunnel created successfully: ${subdomain}.${location}.tunlify.biz.id`);
    
    res.status(201).json({
      ...tunnel,
      tunnel_url: `https://${subdomain}.${location}.${process.env.TUNNEL_BASE_DOMAIN || 'tunlify.biz.id'}`,
      setup_instructions: {
        download_url: 'https://github.com/tunlify/client/releases/latest',
        command: `./tunlify-client -token=${connectionToken} -local=127.0.0.1:3000`
      }
    });

  } catch (error) {
    console.error('❌ Create tunnel error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete tunnel
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tunnel belongs to user
    const { data: tunnel, error: findError } = await supabase
      .from('tunnels')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError || !tunnel) {
      return res.status(404).json({ message: 'Tunnel not found' });
    }

    // Delete tunnel
    const { error: deleteError } = await supabase
      .from('tunnels')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete tunnel error:', deleteError);
      return res.status(500).json({ message: 'Failed to delete tunnel' });
    }

    console.log(`🗑️ Tunnel deleted: ${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`);

    res.json({ message: 'Tunnel deleted successfully' });

  } catch (error) {
    console.error('Delete tunnel error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update tunnel status (for client connections)
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['active', 'inactive']),
  body('client_connected').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { status, client_connected } = req.body;

    // Check if tunnel belongs to user
    const { data: tunnel, error: findError } = await supabase
      .from('tunnels')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError || !tunnel) {
      return res.status(404).json({ message: 'Tunnel not found' });
    }

    // Update status
    const updateData = { status };
    if (client_connected !== undefined) {
      updateData.client_connected = client_connected;
      if (client_connected) {
        updateData.last_connected = new Date().toISOString();
      }
    }

    const { data: updatedTunnel, error: updateError } = await supabase
      .from('tunnels')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update tunnel status error:', updateError);
      return res.status(500).json({ message: 'Failed to update tunnel status' });
    }

    console.log(`🔄 Tunnel status updated: ${tunnel.subdomain}.${tunnel.location} -> ${status} (connected: ${client_connected})`);

    res.json(updatedTunnel);

  } catch (error) {
    console.error('Update tunnel status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Client authentication endpoint (for Golang client)
router.post('/auth', [
  body('connection_token').isLength({ min: 32, max: 64 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid connection token', 
        errors: errors.array() 
      });
    }

    const { connection_token } = req.body;

    // Find tunnel by connection token
    const { data: tunnel, error } = await supabase
      .from('tunnels')
      .select(`
        *,
        users!tunnels_user_id_fkey(email, name)
      `)
      .eq('connection_token', connection_token)
      .single();

    if (error || !tunnel) {
      return res.status(401).json({ message: 'Invalid connection token' });
    }

    // Update tunnel as connected
    await supabase
      .from('tunnels')
      .update({ 
        client_connected: true, 
        status: 'active',
        last_connected: new Date().toISOString()
      })
      .eq('id', tunnel.id);

    console.log(`🔗 Client connected: ${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`);
    console.log(`👤 User: ${tunnel.users.email}`);

    res.json({
      tunnel_id: tunnel.id,
      subdomain: tunnel.subdomain,
      location: tunnel.location,
      tunnel_url: `https://${tunnel.subdomain}.${tunnel.location}.${process.env.TUNNEL_BASE_DOMAIN || 'tunlify.biz.id'}`,
      user: tunnel.users.name
    });

  } catch (error) {
    console.error('Client auth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
