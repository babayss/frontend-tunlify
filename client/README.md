# Tunlify Client

Advanced tunneling client that supports HTTP, TCP, and UDP protocols for exposing local services to the internet.

## 🚀 Features

- **Multi-Protocol Support**: HTTP/HTTPS, TCP, UDP
- **Service Presets**: SSH, RDP, MySQL, PostgreSQL, MongoDB, Redis, VNC, FTP, Mail servers, and more
- **Auto-Reconnection**: Automatic reconnection on connection loss
- **Real-time Monitoring**: Connection status and traffic monitoring
- **Cross-Platform**: Windows, macOS, Linux support
- **Secure**: End-to-end encrypted connections

## 📦 Installation

### Download Pre-built Binaries

Download the latest release for your platform:

- **Linux**: `tunlify-client-linux`
- **Windows**: `tunlify-client-windows.exe`
- **macOS**: `tunlify-client-macos`

### Build from Source

```bash
git clone https://github.com/tunlify/client.git
cd client
npm install
npm run build-all
```

## 🔧 Usage

### Basic HTTP Tunneling

```bash
# Expose local web server
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3000

# Expose with specific protocol
./tunlify-client -t YOUR_TOKEN -l localhost:8080 -p http
```

### SSH Tunneling

```bash
# Expose SSH server
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:22 -p tcp

# Connect from remote
ssh username@yourapp.id.tunlify.biz.id -p 12345
```

### Database Tunneling

```bash
# MySQL
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3306 -p tcp

# PostgreSQL
./tunlify-client -t YOUR_TOKEN -l localhost:5432 -p tcp

# MongoDB
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:27017 -p tcp

# Redis
./tunlify-client -t YOUR_TOKEN -l localhost:6379 -p tcp
```

### Remote Desktop (RDP)

```bash
# Expose Windows RDP
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3389 -p tcp

# Connect from remote
mstsc /v:yourapp.id.tunlify.biz.id:12345
```

### VNC Server

```bash
# Expose VNC server
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:5900 -p tcp

# Connect with VNC viewer
vncviewer yourapp.id.tunlify.biz.id:12345
```

### Game Servers

```bash
# Minecraft server
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:25565 -p tcp

# Connect in Minecraft
# Server Address: yourapp.id.tunlify.biz.id:12345
```

### UDP Services

```bash
# Expose UDP service
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:1234 -p udp

# Test with netcat
nc -u yourapp.id.tunlify.biz.id 12345
```

## 📋 Command Line Options

```
Options:
  -t, --token <token>      Tunnel connection token (required)
  -l, --local <address>    Local address to expose (required)
                          Examples: 127.0.0.1:3000, localhost:22, :8080, 3000
  -p, --protocol <type>    Protocol type: http, tcp, udp (default: "http")
  -s, --server <url>       Tunlify server URL (default: "https://api.tunlify.biz.id")
  --insecure              Allow self-signed HTTPS certificates
  --verbose               Enable verbose logging
  -h, --help              Display help for command
```

## 🔐 Getting Your Token

1. Sign up at [Tunlify Dashboard](https://tunlify.biz.id)
2. Create a new tunnel
3. Copy the connection token from the setup instructions

## 🌐 Supported Services

| Service | Default Port | Protocol | Example Usage |
|---------|-------------|----------|---------------|
| HTTP/HTTPS | 80/443 | HTTP | Web servers, APIs |
| SSH | 22 | TCP | Remote shell access |
| RDP | 3389 | TCP | Windows Remote Desktop |
| MySQL | 3306 | TCP | Database connections |
| PostgreSQL | 5432 | TCP | Database connections |
| MongoDB | 27017 | TCP | Database connections |
| Redis | 6379 | TCP | Cache server |
| FTP | 21 | TCP | File transfer |
| SMTP | 25 | TCP | Mail server |
| POP3 | 110 | TCP | Mail server |
| IMAP | 143 | TCP | Mail server |
| VNC | 5900 | TCP | Remote desktop |
| Minecraft | 25565 | TCP | Game server |
| Custom | Any | TCP/UDP | Any service |

## 🔧 Advanced Configuration

### Environment Variables

```bash
export TUNLIFY_TOKEN="your_token_here"
export TUNLIFY_SERVER="https://api.tunlify.biz.id"
export TUNLIFY_INSECURE="false"
export TUNLIFY_VERBOSE="false"

# Run without specifying options
./tunlify-client -l 127.0.0.1:3000
```

### Configuration File

Create `tunlify.config.json`:

```json
{
  "token": "your_token_here",
  "local": "127.0.0.1:3000",
  "protocol": "http",
  "server": "https://api.tunlify.biz.id",
  "insecure": false,
  "verbose": false
}
```

## 🐛 Troubleshooting

### Connection Issues

```bash
# Test with verbose logging
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3000 --verbose

# Test local service first
curl http://127.0.0.1:3000
telnet 127.0.0.1 22
```

### Common Errors

1. **"Local service not reachable"**
   - Ensure your local service is running
   - Check the port number is correct
   - Verify firewall settings

2. **"Invalid connection token"**
   - Check your token is correct
   - Ensure the tunnel exists in dashboard
   - Token might have expired

3. **"WebSocket connection failed"**
   - Check internet connection
   - Verify server URL is correct
   - Try with `--insecure` flag for testing

## 📊 Monitoring

The client provides real-time information about:

- Connection status
- Active connections
- Data transfer
- Error messages
- Reconnection attempts

## 🔒 Security

- All connections are encrypted end-to-end
- Tokens are unique per tunnel
- No data is stored on Tunlify servers
- Local services remain on your machine

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

- Documentation: [https://docs.tunlify.biz.id](https://docs.tunlify.biz.id)
- Issues: [GitHub Issues](https://github.com/tunlify/client/issues)
- Email: support@tunlify.biz.id

## 🎯 Examples

### Development Workflow

```bash
# Start your local development server
npm run dev  # Usually runs on port 3000

# In another terminal, start tunnel
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3000

# Share the public URL with team members
# https://myapp.id.tunlify.biz.id
```

### Database Access

```bash
# Start tunnel for MySQL
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3306 -p tcp

# Connect from remote location
mysql -h myapp.id.tunlify.biz.id -P 12345 -u username -p
```

### Remote Administration

```bash
# SSH access
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:22 -p tcp
ssh admin@myapp.id.tunlify.biz.id -p 12345

# RDP access
./tunlify-client -t YOUR_TOKEN -l 127.0.0.1:3389 -p tcp
mstsc /v:myapp.id.tunlify.biz.id:12345
```