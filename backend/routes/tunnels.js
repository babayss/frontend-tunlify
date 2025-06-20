const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const supabase = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Predefined port configurations for common services
const PORT_PRESETS = {
  ssh: { port: 22, name: 'SSH Server', protocol: 'tcp', description: 'Secure Shell remote access' },
  rdp: { port: 3389, name: 'Remote Desktop', protocol: 'tcp', description: 'Windows Remote Desktop Protocol' },
  ftp: { port: 21, name: 'FTP Server', protocol: 'tcp', description: 'File Transfer Protocol' },
  smtp: { port: 25, name: 'SMTP Mail', protocol: 'tcp', description: 'Simple Mail Transfer Protocol' },
  pop3: { port: 110, name: 'POP3 Mail', protocol: 'tcp', description: 'Post Office Protocol v3' },
  imap: { port: 143, name: 'IMAP Mail', protocol: 'tcp', description: 'Internet Message Access Protocol' },
  mysql: { port: 3306, name: 'MySQL Database', protocol: 'tcp', description: 'MySQL Database Server' },
  postgresql: { port: 5432, name: 'PostgreSQL', protocol: 'tcp', description: 'PostgreSQL Database Server' },
  mongodb: { port: 27017, name: 'MongoDB', protocol: 'tcp', description: 'MongoDB Database Server' },
  redis: { port: 6379, name: 'Redis Cache', protocol: 'tcp', description: 'Redis In-Memory Database' },
  vnc: { port: 5900, name: 'VNC Server', protocol: 'tcp', description: 'Virtual Network Computing' },
  teamviewer: { port: 5938, name: 'TeamViewer', protocol: 'tcp', description: 'TeamViewer Remote Access' },
  minecraft: { port: 25565, name: 'Minecraft Server', protocol: 'tcp', description: 'Minecraft Game Server' },
  http: { port: 80, name: 'HTTP Server', protocol: 'http', description: 'Web Server (HTTP)' },
  https: { port: 443, name: 'HTTPS Server', protocol: 'http', description: 'Secure Web Server (HTTPS)' },
  custom: { port: null, name: 'Custom Port', protocol: 'tcp', description: 'Custom TCP/UDP port' }
};

// Get user tunnels with enhanced port information
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: tunnels, error } = await supabase
      .from('tunnels')
      .select(`
        *,
        server_locations!tunnels_location_fkey(name, ip_address)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get tunnels error:', error);
      return res.status(500).json({ message: 'Failed to fetch tunnels' });
    }

    // Format response with port information
    const formattedTunnels = tunnels.map(tunnel => {
      const preset = PORT_PRESETS[tunnel.service_type] || PORT_PRESETS.custom;
      return {
        ...tunnel,
        location_name: tunnel.server_locations?.name || tunnel.location,
        server_ip: tunnel.server_locations?.ip_address,
        service_info: {
          name: preset.name,
          description: preset.description,
          protocol: tunnel.protocol || preset.protocol
        },
        tunnel_url: tunnel.protocol === 'http' 
          ? `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`
          : `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.remote_port || tunnel.local_port}`,
        connection_info: {
          host: `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`,
          port: tunnel.remote_port || tunnel.local_port,
          protocol: tunnel.protocol || 'tcp'
        }
      };
    });

    res.json(formattedTunnels);
  } catch (error) {
    console.error('Get tunnels error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get available port presets
router.get('/presets', (req, res) => {
  res.json(PORT_PRESETS);
});

// Create tunnel with port support
router.post('/', authenticateToken, [
  body('subdomain')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain must be 3-50 characters, lowercase letters, numbers, and hyphens only'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Location must be 2-10 characters'),
  body('service_type')
    .isIn(Object.keys(PORT_PRESETS))
    .withMessage('Invalid service type'),
  body('local_port')
    .isInt({ min: 1, max: 65535 })
    .withMessage('Local port must be between 1-65535'),
  body('remote_port')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('Remote port must be between 1-65535'),
  body('protocol')
    .optional()
    .isIn(['tcp', 'udp', 'http'])
    .withMessage('Protocol must be tcp, udp, or http')
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

    const { subdomain, location, service_type, local_port, remote_port, protocol } = req.body;
    const preset = PORT_PRESETS[service_type];

    console.log(`🔍 Creating ${service_type} tunnel: ${subdomain}.${location} for user ${req.user.id}`);

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
      .select('id, name, ip_address')
      .eq('region_code', location)
      .single();

    if (locationError || !locationData) {
      console.log(`❌ Invalid location: ${location}`);
      return res.status(400).json({ message: 'Invalid server location' });
    }

    // For TCP/UDP services, assign a unique remote port if not specified
    let finalRemotePort = remote_port;
    if (!finalRemotePort && (protocol === 'tcp' || protocol === 'udp' || service_type !== 'http')) {
      // Generate a random port in the range 10000-60000
      finalRemotePort = Math.floor(Math.random() * 50000) + 10000;
      
      // Check if port is already in use
      const { data: existingPort } = await supabase
        .from('tunnels')
        .select('id')
        .eq('location', location)
        .eq('remote_port', finalRemotePort)
        .single();

      if (existingPort) {
        // Try a few more times
        for (let i = 0; i < 5; i++) {
          finalRemotePort = Math.floor(Math.random() * 50000) + 10000;
          const { data: checkPort } = await supabase
            .from('tunnels')
            .select('id')
            .eq('location', location)
            .eq('remote_port', finalRemotePort)
            .single();
          
          if (!checkPort) break;
        }
      }
    }

    // Generate unique connection token
    const connectionToken = crypto.randomBytes(32).toString('hex');
    console.log(`🔑 Generated connection token: ${connectionToken.substring(0, 8)}...`);

    // Determine final protocol
    const finalProtocol = protocol || preset.protocol || 'tcp';

    // Create tunnel
    const { data: tunnel, error: createError } = await supabase
      .from('tunnels')
      .insert([{
        user_id: req.user.id,
        subdomain,
        location,
        service_type,
        local_port,
        remote_port: finalRemotePort,
        protocol: finalProtocol,
        connection_token: connectionToken,
        status: 'inactive',
        client_connected: false,
      }])
      .select()
      .single();

    if (createError) {
      console.error('❌ Create tunnel error:', createError);
      return res.status(500).json({ message: 'Failed to create tunnel' });
    }

    console.log(`✅ ${service_type.toUpperCase()} tunnel created successfully: ${subdomain}.${location}.tunlify.biz.id:${finalRemotePort}`);
    
    // Prepare response based on service type
    const tunnelUrl = finalProtocol === 'http' 
      ? `https://${subdomain}.${location}.tunlify.biz.id`
      : `${subdomain}.${location}.tunlify.biz.id:${finalRemotePort}`;

    const clientCommand = finalProtocol === 'http'
      ? `./tunlify-client -token=${connectionToken} -local=127.0.0.1:${local_port}`
      : `./tunlify-client -token=${connectionToken} -local=127.0.0.1:${local_port} -protocol=${finalProtocol}`;

    res.status(201).json({
      ...tunnel,
      service_info: {
        name: preset.name,
        description: preset.description,
        protocol: finalProtocol
      },
      connection_info: {
        host: `${subdomain}.${location}.tunlify.biz.id`,
        port: finalRemotePort,
        protocol: finalProtocol
      },
      tunnel_url: tunnelUrl,
      setup_instructions: {
        download_url: 'https://github.com/tunlify/client/releases/latest',
        command: clientCommand,
        connection_examples: generateConnectionExamples(service_type, subdomain, location, finalRemotePort, finalProtocol)
      }
    });

  } catch (error) {
    console.error('❌ Create tunnel error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate connection examples for different services
function generateConnectionExamples(serviceType, subdomain, location, port, protocol) {
  const host = `${subdomain}.${location}.tunlify.biz.id`;
  const examples = {};

  switch (serviceType) {
    case 'ssh':
      examples.ssh = `ssh username@${host} -p ${port}`;
      examples.scp = `scp -P ${port} file.txt username@${host}:/path/`;
      examples.sftp = `sftp -P ${port} username@${host}`;
      break;

    case 'rdp':
      examples.windows = `mstsc /v:${host}:${port}`;
      examples.remmina = `remmina rdp://${host}:${port}`;
      examples.freerdp = `xfreerdp /v:${host}:${port} /u:username`;
      break;

    case 'mysql':
      examples.mysql_cli = `mysql -h ${host} -P ${port} -u username -p database_name`;
      examples.connection_string = `mysql://username:password@${host}:${port}/database_name`;
      examples.workbench = `Host: ${host}, Port: ${port}`;
      break;

    case 'postgresql':
      examples.psql = `psql -h ${host} -p ${port} -U username -d database_name`;
      examples.connection_string = `postgresql://username:password@${host}:${port}/database_name`;
      examples.pgadmin = `Host: ${host}, Port: ${port}`;
      break;

    case 'mongodb':
      examples.mongo_cli = `mongo mongodb://${host}:${port}/database_name`;
      examples.connection_string = `mongodb://username:password@${host}:${port}/database_name`;
      examples.compass = `mongodb://${host}:${port}`;
      break;

    case 'redis':
      examples.redis_cli = `redis-cli -h ${host} -p ${port}`;
      examples.connection_string = `redis://${host}:${port}`;
      break;

    case 'vnc':
      examples.vnc_viewer = `${host}:${port}`;
      examples.tightvnc = `vncviewer ${host}:${port}`;
      break;

    case 'ftp':
      examples.ftp_cli = `ftp ${host} ${port}`;
      examples.filezilla = `Host: ${host}, Port: ${port}, Protocol: FTP`;
      break;

    case 'smtp':
      examples.smtp_config = `SMTP Server: ${host}, Port: ${port}`;
      examples.telnet_test = `telnet ${host} ${port}`;
      break;

    case 'minecraft':
      examples.minecraft_client = `Server Address: ${host}:${port}`;
      examples.direct_connect = `${host}:${port}`;
      break;

    case 'http':
    case 'https':
      examples.browser = `https://${host}`;
      examples.curl = `curl https://${host}`;
      break;

    default:
      examples.generic = `Connect to ${host}:${port} using ${protocol.toUpperCase()} protocol`;
  }

  return examples;
}

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

    console.log(`🗑️ Tunnel deleted: ${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.remote_port}`);

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

    console.log(`🔄 Tunnel status updated: ${tunnel.subdomain}.${tunnel.location}:${tunnel.remote_port} -> ${status} (connected: ${client_connected})`);

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
        users!tunnels_user_id_fkey(email, name),
        server_locations!tunnels_location_fkey(name, ip_address)
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

    const preset = PORT_PRESETS[tunnel.service_type] || PORT_PRESETS.custom;

    console.log(`🔗 Client connected: ${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.remote_port}`);
    console.log(`👤 User: ${tunnel.users.email}`);
    console.log(`🔧 Service: ${preset.name} (${tunnel.protocol})`);

    res.json({
      tunnel_id: tunnel.id,
      subdomain: tunnel.subdomain,
      location: tunnel.location,
      local_port: tunnel.local_port,
      remote_port: tunnel.remote_port,
      protocol: tunnel.protocol,
      service_type: tunnel.service_type,
      service_name: preset.name,
      tunnel_url: tunnel.protocol === 'http' 
        ? `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`
        : `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.remote_port}`,
      server_ip: tunnel.server_locations.ip_address,
      user: tunnel.users.name
    });

  } catch (error) {
    console.error('Client auth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;