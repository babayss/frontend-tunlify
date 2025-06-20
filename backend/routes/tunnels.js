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

// Function to generate a random port in safe range
const generateRandomPort = () => {
  // Use port range 10000-60000 to avoid conflicts with system ports
  return Math.floor(Math.random() * 50000) + 10000;
};

// Function to find an available port
const findAvailablePort = async (location, maxAttempts = 20) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = generateRandomPort();
    
    // Check if port is already in use in this location
    const { data: existingPort } = await supabase
      .from('tunnels')
      .select('id')
      .eq('location', location)
      .eq('target_port', port)
      .single();

    if (!existingPort) {
      return port;
    }
  }
  
  throw new Error('Unable to find available port after multiple attempts');
};

// Get user tunnels with enhanced information
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

    // Format response with enhanced information
    const formattedTunnels = tunnels.map(tunnel => {
      // Determine service type from target_port if not explicitly set
      let serviceType = 'custom';
      let preset = PORT_PRESETS.custom;
      
      if (tunnel.target_port) {
        // Find matching preset by port
        for (const [key, value] of Object.entries(PORT_PRESETS)) {
          if (value.port === tunnel.target_port) {
            serviceType = key;
            preset = value;
            break;
          }
        }
      }
      
      // Determine protocol - HTTP for ports 80/443, TCP for others
      const protocol = tunnel.target_port === 80 || tunnel.target_port === 443 ? 'http' : 'tcp';
      
      // Build tunnel URL
      let tunnelUrl;
      if (protocol === 'http') {
        tunnelUrl = `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`;
      } else {
        tunnelUrl = `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.target_port}`;
      }

      return {
        ...tunnel,
        service_type: serviceType,
        protocol: protocol,
        local_port: tunnel.target_port, // For compatibility with frontend
        remote_port: tunnel.target_port,
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
          port: tunnel.target_port,
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

// Create tunnel with proper port assignment using existing schema
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
    .optional()
    .isIn(Object.keys(PORT_PRESETS))
    .withMessage('Invalid service type'),
  body('local_port')
    .optional()
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

    const { 
      subdomain, 
      location, 
      service_type = 'custom', 
      local_port = 3000, 
      remote_port, 
      protocol 
    } = req.body;
    
    const preset = PORT_PRESETS[service_type] || PORT_PRESETS.custom;

    console.log(`🔍 Creating ${service_type} tunnel: ${subdomain}.${location} for user ${req.user.id}`);
    console.log(`🔍 Preset info:`, preset);

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
    console.log(`🔍 Final protocol: ${finalProtocol}`);

    // CRITICAL FIX: Proper port assignment using existing schema
    let targetPort;
    let targetIp = locationData.ip_address; // Use server IP as target
    
    if (finalProtocol === 'http') {
      // For HTTP, use standard ports
      targetPort = 80; // Will be handled by reverse proxy
      console.log(`🌐 HTTP tunnel - using port 80 for reverse proxy`);
    } else {
      // For TCP/UDP, assign a unique port
      if (remote_port) {
        // User specified a port, check if it's available
        const { data: existingPort } = await supabase
          .from('tunnels')
          .select('id')
          .eq('location', location)
          .eq('target_port', remote_port)
          .single();

        if (existingPort) {
          return res.status(409).json({ 
            message: `Port ${remote_port} is already in use in ${location}` 
          });
        }
        
        targetPort = parseInt(remote_port);
        console.log(`🎯 Using user-specified port: ${targetPort}`);
      } else {
        // Auto-assign a random port in safe range
        try {
          targetPort = await findAvailablePort(location);
          console.log(`🎲 Auto-assigned random port: ${targetPort}`);
        } catch (error) {
          console.error('❌ Port assignment failed:', error);
          return res.status(500).json({ message: 'Unable to assign available port' });
        }
      }
    }

    // Generate unique connection token
    const connectionToken = crypto.randomBytes(32).toString('hex');
    console.log(`🔑 Generated connection token: ${connectionToken.substring(0, 8)}...`);

    // CRITICAL: Use existing database schema
    const tunnelData = {
      user_id: req.user.id,
      subdomain,
      location,
      target_ip: targetIp,
      target_port: targetPort,
      connection_token: connectionToken,
      status: 'inactive',
      client_connected: false,
    };

    console.log(`🔍 Tunnel data for database:`, tunnelData);

    // Create tunnel
    const { data: tunnel, error: createError } = await supabase
      .from('tunnels')
      .insert([tunnelData])
      .select()
      .single();

    if (createError) {
      console.error('❌ Create tunnel error:', createError);
      return res.status(500).json({ message: 'Failed to create tunnel' });
    }

    console.log(`✅ Tunnel created in database:`, tunnel);

    // CRITICAL FIX: Prepare response with proper URLs and commands
    let tunnelUrl, clientCommand;
    
    if (finalProtocol === 'http') {
      tunnelUrl = `https://${subdomain}.${location}.tunlify.biz.id`;
      clientCommand = `./tunlify-client -token=${connectionToken} -local=127.0.0.1:${local_port}`;
    } else {
      tunnelUrl = `${subdomain}.${location}.tunlify.biz.id:${targetPort}`;
      clientCommand = `./tunlify-client -token=${connectionToken} -local=127.0.0.1:${local_port} -protocol=${finalProtocol}`;
    }

    console.log(`✅ ${service_type.toUpperCase()} tunnel created successfully:`);
    console.log(`   URL: ${tunnelUrl}`);
    console.log(`   Protocol: ${finalProtocol.toUpperCase()}`);
    console.log(`   Local: 127.0.0.1:${local_port}`);
    console.log(`   Target: ${targetIp}:${targetPort}`);
    
    const responseData = {
      ...tunnel,
      service_type: service_type,
      protocol: finalProtocol,
      local_port: local_port,
      remote_port: targetPort,
      service_info: {
        name: preset.name,
        description: preset.description,
        protocol: finalProtocol
      },
      connection_info: {
        host: `${subdomain}.${location}.tunlify.biz.id`,
        port: targetPort,
        protocol: finalProtocol
      },
      tunnel_url: tunnelUrl,
      setup_instructions: {
        download_url: 'https://github.com/tunlify/client/releases/latest',
        command: clientCommand,
        connection_examples: generateConnectionExamples(service_type, subdomain, location, targetPort, finalProtocol)
      }
    };

    console.log(`🔍 Response data:`, responseData);
    res.status(201).json(responseData);

  } catch (error) {
    console.error('❌ Create tunnel error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate connection examples for different services
function generateConnectionExamples(serviceType, subdomain, location, port, protocol) {
  const host = `${subdomain}.${location}.tunlify.biz.id`;
  const examples = {};

  // For HTTP, no port needed in examples
  if (protocol === 'http') {
    examples.browser = `https://${host}`;
    examples.curl = `curl https://${host}`;
    return examples;
  }

  // For TCP/UDP, port is required
  if (!port) {
    examples.error = 'Port not assigned for TCP/UDP service';
    return examples;
  }

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

    default:
      if (protocol === 'tcp') {
        examples.tcp = `telnet ${host} ${port}`;
        examples.netcat = `nc ${host} ${port}`;
      } else if (protocol === 'udp') {
        examples.udp = `nc -u ${host} ${port}`;
        examples.netcat_udp = `nc -u ${host} ${port}`;
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

    console.log(`🗑️ Tunnel deleted: ${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.target_port}`);

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

    console.log(`🔄 Tunnel status updated: ${tunnel.subdomain}.${tunnel.location}:${tunnel.target_port} -> ${status} (connected: ${client_connected})`);

    res.json(updatedTunnel);

  } catch (error) {
    console.error('Update tunnel status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// CRITICAL FIX: Client authentication endpoint with proper schema
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
      console.log(`❌ Invalid connection token: ${connection_token.substring(0, 8)}...`);
      return res.status(401).json({ message: 'Invalid connection token' });
    }

    console.log(`🔍 Found tunnel for auth:`, {
      id: tunnel.id,
      subdomain: tunnel.subdomain,
      location: tunnel.location,
      target_ip: tunnel.target_ip,
      target_port: tunnel.target_port
    });

    // Update tunnel as connected
    await supabase
      .from('tunnels')
      .update({ 
        client_connected: true, 
        status: 'active',
        last_connected: new Date().toISOString()
      })
      .eq('id', tunnel.id);

    // Determine service type and protocol from target_port
    let serviceType = 'custom';
    let preset = PORT_PRESETS.custom;
    
    if (tunnel.target_port) {
      for (const [key, value] of Object.entries(PORT_PRESETS)) {
        if (value.port === tunnel.target_port) {
          serviceType = key;
          preset = value;
          break;
        }
      }
    }
    
    const protocol = tunnel.target_port === 80 || tunnel.target_port === 443 ? 'http' : 'tcp';
    
    // CRITICAL FIX: Proper tunnel URL generation for client response
    let tunnelUrl;
    if (protocol === 'http') {
      tunnelUrl = `https://${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id`;
    } else {
      // ENSURE we have a valid target_port for TCP/UDP
      if (!tunnel.target_port) {
        console.error(`❌ No target port for TCP/UDP tunnel: ${tunnel.id}`);
        return res.status(500).json({ message: 'Invalid tunnel configuration - missing target port' });
      }
      tunnelUrl = `${tunnel.subdomain}.${tunnel.location}.tunlify.biz.id:${tunnel.target_port}`;
    }

    console.log(`🔗 Client connected: ${tunnelUrl}`);
    console.log(`👤 User: ${tunnel.users.email}`);
    console.log(`🔧 Service: ${preset.name} (${protocol.toUpperCase()})`);
    console.log(`🎯 Target: ${tunnel.target_ip}:${tunnel.target_port}`);

    const responseData = {
      tunnel_id: tunnel.id,
      subdomain: tunnel.subdomain,
      location: tunnel.location,
      local_port: tunnel.target_port, // For client compatibility
      remote_port: tunnel.target_port,
      protocol: protocol,
      service_type: serviceType,
      service_name: preset.name,
      tunnel_url: tunnelUrl,
      target_ip: tunnel.target_ip,
      target_port: tunnel.target_port,
      server_ip: tunnel.server_locations.ip_address,
      user: tunnel.users.name
    };

    console.log(`🔍 Auth response data:`, responseData);
    res.json(responseData);

  } catch (error) {
    console.error('Client auth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;