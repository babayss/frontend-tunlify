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
      
      // FIXED: Ensure remote_port is always defined
      const remotePort = tunnel.remote_port || tunnel.local_port || preset.port || 80;
      const protocol = tunnel.protocol || preset.protocol || 'tcp';
      
      // FIXED: Generate proper tunnel URL based on protocol
      let tunnelUrl;
      if (protocol === 'http') {
        tunnelUrl = `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`;
      } else {
        tunnelUrl = `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${remotePort}`;
      }

      return {
        ...tunnel,
        // Ensure remote_port is never undefined
        remote_port: remotePort,
        protocol: protocol,
        location_name: tunnel.server_locations?.name || tunnel.location,
        server_ip: tunnel.server_locations?.ip_address,
        service_info: {
          name: preset.name,
          description: preset.description,
          protocol: protocol
        },
        tunnel_url: tunnelUrl,
        connection_info: {
          host: `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`,
          port: remotePort,
          protocol: protocol
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

    // Determine final protocol
    const finalProtocol = protocol || preset.protocol || 'tcp';

    // FIXED: For TCP/UDP services, assign a unique remote port if not specified
    let finalRemotePort = remote_port;
    
    if (finalProtocol === 'http') {
      // For HTTP, no remote port needed (uses standard 80/443)
      finalRemotePort = null;
    } else if (!finalRemotePort) {
      // Generate a random port in the range 10000-60000 for TCP/UDP
      finalRemotePort = Math.floor(Math.random() * 50000) + 10000;
      
      // Check if port is already in use and find an available one
      let attempts = 0;
      while (attempts < 10) {
        const { data: existingPort } = await supabase
          .from('tunnels')
          .select('id')
          .eq('location', location)
          .eq('remote_port', finalRemotePort)
          .single();

        if (!existingPort) break;
        
        finalRemotePort = Math.floor(Math.random() * 50000) + 10000;
        attempts++;
      }
      
      if (attempts >= 10) {
        return res.status(500).json({ message: 'Unable to assign available port' });
      }
    }

    // Generate unique connection token
    const connectionToken = crypto.randomBytes(32).toString('hex');
    console.log(`🔑 Generated connection token: ${connectionToken.substring(0, 8)}...`);

    // Create tunnel
    const { data: tunnel, error: createError } = await supabase
      .from('tunnels')
      .insert([{
        user_id: req.user.id,
        subdomain,
        location,
        service_type,
        local_port,
        remote_port: finalRemotePort, // This will be null for HTTP, or a number for TCP/UDP
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

    // FIXED: Prepare response with proper port handling
    const displayPort = finalRemotePort || 80; // Use 80 as default for display
    
    const tunnelUrl = finalProtocol === 'http' 
      ? `https://${subdomain}.${location}.tunlify.biz.id`
      : `${subdomain}.${location}.tunlify.biz.id:${finalRemotePort}`;

    const clientCommand = finalProtocol === 'http'
      ? `./tunlify-client -token=${connectionToken} -local=127.0.0.1:${local_port}`
      : `./tunlify-client -token=${connectionToken} -local=127.0.0.1:${local_port} -protocol=${finalProtocol}`;

    console.log(`✅ ${service_type.toUpperCase()} tunnel created successfully: ${tunnelUrl}`);
    
    res.status(201).json({
      ...tunnel,
      // Ensure remote_port is never undefined in response
      remote_port: finalRemotePort,
      service_info: {
        name: preset.name,
        description: preset.description,
        protocol: finalProtocol
      },
      connection_info: {
        host: `${subdomain}.${location}.tunlify.biz.id`,
        port: finalRemotePort || 80, // Fallback for display
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

  // FIXED: Handle cases where port might be null (for HTTP)
  const displayPort = port || 80;

  switch (serviceType) {
    case 'ssh':
      examples.ssh = `ssh username@${host} -p ${displayPort}`;
      examples.scp = `scp -P ${displayPort} file.txt username@${host}:/path/`;
      examples.sftp = `sftp -P ${displayPort} username@${host}`;
      break;

    case 'rdp':
      examples.windows = `mstsc /v:${host}:${displayPort}`;
      examples.remmina = `remmina rdp://${host}:${displayPort}`;
      examples.freerdp = `xfreerdp /v:${host}:${displayPort} /u:username`;
      break;

    case 'mysql':
      examples.mysql_cli = `mysql -h ${host} -P ${displayPort} -u username -p database_name`;
      examples.connection_string = `mysql://username:password@${host}:${displayPort}/database_name`;
      examples.workbench = `Host: ${host}, Port: ${displayPort}`;
      break;

    case 'postgresql':
      examples.psql = `psql -h ${host} -p ${displayPort} -U username -d database_name`;
      examples.connection_string = `postgresql://username:password@${host}:${displayPort}/database_name`;
      examples.pgadmin = `Host: ${host}, Port: ${displayPort}`;
      break;

    case 'mongodb':
      examples.mongo_cli = `mongo mongodb://${host}:${displayPort}/database_name`;
      examples.connection_string = `mongodb://username:password@${host}:${displayPort}/database_name`;
      examples.compass = `mongodb://${host}:${displayPort}`;
      break;

    case 'redis':
      examples.redis_cli = `redis-cli -h ${host} -p ${displayPort}`;
      examples.connection_string = `redis://${host}:${displayPort}`;
      break;

    case 'vnc':
      examples.vnc_viewer = `${host}:${displayPort}`;
      examples.tightvnc = `vncviewer ${host}:${displayPort}`;
      break;

    case 'ftp':
      examples.ftp_cli = `ftp ${host} ${displayPort}`;
      examples.filezilla = `Host: ${host}, Port: ${displayPort}, Protocol: FTP`;
      break;

    case 'smtp':
      examples.smtp_config = `SMTP Server: ${host}, Port: ${displayPort}`;
      examples.telnet_test = `telnet ${host} ${displayPort}`;
      break;

    case 'minecraft':
      examples.minecraft_client = `Server Address: ${host}:${displayPort}`;
      examples.direct_connect = `${host}:${displayPort}`;
      break;

    case 'http':
    case 'https':
      examples.browser = `https://${host}`;
      examples.curl = `curl https://${host}`;
      break;

    default:
      if (protocol === 'tcp') {
        examples.tcp = `telnet ${host} ${displayPort}`;
      } else if (protocol === 'udp') {
        examples.udp = `nc -u ${host} ${displayPort}`;
      } else {
        examples.generic = `Connect to ${host}:${displayPort} using ${protocol.toUpperCase()} protocol`;
      }
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

    const portDisplay = tunnel.remote_port ? `:${tunnel.remote_port}` : '';
    console.log(`🗑️ Tunnel deleted: ${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id${portDisplay}`);

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

    const portDisplay = tunnel.remote_port ? `:${tunnel.remote_port}` : '';
    console.log(`🔄 Tunnel status updated: ${tunnel.subdomain}.${tunnel.location}${portDisplay} -> ${status} (connected: ${client_connected})`);

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

    // FIXED: Handle remote_port properly for display
    const displayPort = tunnel.remote_port || 80;
    const protocol = tunnel.protocol || preset.protocol || 'tcp';
    
    const tunnelUrl = protocol === 'http' 
      ? `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`
      : `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${displayPort}`;

    console.log(`🔗 Client connected: ${tunnelUrl}`);
    console.log(`👤 User: ${tunnel.users.email}`);
    console.log(`🔧 Service: ${preset.name} (${protocol})`);

    res.json({
      tunnel_id: tunnel.id,
      subdomain: tunnel.subdomain,
      location: tunnel.location,
      local_port: tunnel.local_port,
      remote_port: tunnel.remote_port, // This might be null for HTTP
      protocol: protocol,
      service_type: tunnel.service_type,
      service_name: preset.name,
      tunnel_url: tunnelUrl,
      server_ip: tunnel.server_locations.ip_address,
      user: tunnel.users.name
    });

  } catch (error) {
    console.error('Client auth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;