const net = require('net');

const host = 'hf60-22099.azdigihost.com';
const ports = [21, 22, 2222, 2082, 2083, 3306];

ports.forEach(port => {
  const s = new net.Socket();
  s.setTimeout(2500);
  s.on('connect', () => {
    console.log(`Port ${port} on ${host} is OPEN`);
    s.destroy();
  });
  s.on('error', (err) => {
    // console.log(`Port ${port} error: ${err.message}`);
  });
  s.on('timeout', () => {
    s.destroy();
  });
  s.connect(port, host);
});
