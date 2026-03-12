import net from 'node:net';
import { spawn } from 'node:child_process';
import process from 'node:process';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parsePort(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port in ${name}: ${raw}`);
  }
  return port;
}

function connectAndRead({ host, port, timeoutMs = 4000, bytes = 256, initialWrite }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (initialWrite) {
        socket.write(initialWrite);
      }
    });

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const total = Buffer.concat(chunks);
      if (total.length >= bytes || total.includes(0x0a)) {
        finish(resolve, total.toString('utf8'));
      }
    });

    socket.on('timeout', () => {
      const total = Buffer.concat(chunks).toString('utf8');
      if (total) {
        finish(resolve, total);
        return;
      }
      finish(reject, new Error(`Timed out connecting to ${host}:${port}`));
    });

    socket.on('error', (error) => finish(reject, error));
    socket.on('end', () => {
      const total = Buffer.concat(chunks).toString('utf8');
      if (total) {
        finish(resolve, total);
        return;
      }
      finish(reject, new Error(`Connection closed before data from ${host}:${port}`));
    });
  });
}

async function checkSsh(label, host, port) {
  const response = await connectAndRead({ host, port, initialWrite: 'SSH-2.0-VibeShellSmoke\r\n' });
  if (!response.startsWith('SSH-')) {
    throw new Error(`${label} expected SSH banner, got: ${JSON.stringify(response.trim())}`);
  }
  return `${label} ok (${host}:${port}) banner=${response.trim()}`;
}

async function checkFtp(label, host, port) {
  const response = await connectAndRead({ host, port });
  const line = response.trim();
  if (!line.startsWith('220')) {
    throw new Error(`${label} expected FTP 220 banner, got: ${JSON.stringify(line)}`);
  }
  return `${label} ok (${host}:${port}) banner=${line}`;
}

function connectSocket({ host, port, timeoutMs = 4000 }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(resolve, socket));
    socket.on('timeout', () => {
      socket.destroy();
      finish(reject, new Error(`Timed out connecting to ${host}:${port}`));
    });
    socket.on('error', (error) => {
      socket.destroy();
      finish(reject, error);
    });
  });
}

function readFtpReply(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1);
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(last);
      }
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('FTP connection closed before reply was received'));
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}

async function sendFtpCommand(socket, command) {
  socket.write(`${command}\r\n`);
  return readFtpReply(socket);
}

async function checkFtpLogin(host, port, user, password) {
  const socket = await connectSocket({ host, port });
  try {
    const banner = await readFtpReply(socket);
    if (!banner.startsWith('220')) {
      throw new Error(`FTP login check expected 220 banner, got: ${JSON.stringify(banner)}`);
    }

    const userReply = await sendFtpCommand(socket, `USER ${user}`);
    if (!userReply.startsWith('230') && !userReply.startsWith('331')) {
      throw new Error(`FTP USER failed: ${userReply}`);
    }

    if (userReply.startsWith('331')) {
      const passReply = await sendFtpCommand(socket, `PASS ${password}`);
      if (!passReply.startsWith('230')) {
        throw new Error(`FTP PASS failed: ${passReply}`);
      }
    }

    const pwdReply = await sendFtpCommand(socket, 'PWD');
    if (!pwdReply.startsWith('257')) {
      throw new Error(`FTP PWD failed: ${pwdReply}`);
    }

    await sendFtpCommand(socket, 'QUIT').catch(() => {});
    return `FTP login ok (${host}:${port}) user=${user} pwd=${pwdReply}`;
  } finally {
    socket.destroy();
  }
}

function runCommand(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...extraEnv },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with ${code}`));
    });
  });
}

async function checkSshCommand(host, port, user, keyPath, remoteCommand) {
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-p', String(port),
  ];
  if (keyPath) {
    args.push('-i', keyPath);
  }
  args.push(`${user}@${host}`, remoteCommand);

  const { stdout } = await runCommand('ssh', args);
  return `SSH command ok (${host}:${port}) output=${stdout.trim()}`;
}

async function checkSftpCommand(host, port, user, keyPath, remotePath) {
  const args = [
    '-b', '-',
    '-P', String(port),
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
  ];
  if (keyPath) {
    args.push('-i', keyPath);
  }
  args.push(`${user}@${host}`);

  return new Promise((resolve, reject) => {
    const child = spawn('sftp', args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(`SFTP command ok (${host}:${port}) path=${remotePath || '.'} output=${stdout.trim() || '(empty)'}`);
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `sftp exited with ${code}`));
    });

    child.stdin.write(`ls ${remotePath || '.'}\nquit\n`);
    child.stdin.end();
  });
}

async function main() {
  const targetHost = requireEnv('SMOKE_HOST');
  const sshPort = parsePort('SMOKE_SSH_PORT', 22);
  const ftpPort = parsePort('SMOKE_FTP_PORT', 21);
  const sftpPort = parsePort('SMOKE_SFTP_PORT', sshPort);

  const checks = [
    () => checkSsh('SSH', targetHost, sshPort),
    () => checkFtp('FTP', targetHost, ftpPort),
    () => checkSsh('SFTP', targetHost, sftpPort),
  ];

  if (process.env.SMOKE_FTP_USER && process.env.SMOKE_FTP_PASSWORD) {
    checks.push(() =>
      checkFtpLogin(
        targetHost,
        ftpPort,
        process.env.SMOKE_FTP_USER,
        process.env.SMOKE_FTP_PASSWORD
      )
    );
  }

  if (process.env.SMOKE_SSH_USER) {
    checks.push(() =>
      checkSshCommand(
        targetHost,
        sshPort,
        process.env.SMOKE_SSH_USER,
        process.env.SMOKE_SSH_KEY_PATH,
        process.env.SMOKE_SSH_COMMAND || 'pwd'
      )
    );
    checks.push(() =>
      checkSftpCommand(
        targetHost,
        sftpPort,
        process.env.SMOKE_SSH_USER,
        process.env.SMOKE_SSH_KEY_PATH,
        process.env.SMOKE_SFTP_PATH || '.'
      )
    );
  }

  let failures = 0;

  for (const run of checks) {
    try {
      const result = await run();
      console.log(result);
    } catch (error) {
      failures += 1;
      console.error(String(error instanceof Error ? error.message : error));
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
