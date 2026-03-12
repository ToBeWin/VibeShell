export function formatSshConnectionError(error: unknown): string {
  const raw = String(error ?? '').trim();
  const message = raw.replace(/^Error:\s*/i, '');

  if (!message) {
    return 'The SSH connection failed.';
  }

  if (/authentication rejected|auth failed|permission denied/i.test(message)) {
    return 'Authentication was rejected. Check the username, password, or private key settings.';
  }

  if (/host key|failed to receive host key/i.test(message)) {
    return 'Host key verification did not complete. Verify and trust the host key before retrying.';
  }

  if (/timed out|timeout/i.test(message)) {
    return 'The server timed out before completing the SSH connection.';
  }

  if (/connection refused|connection failed|could not resolve|no route to host|network is unreachable/i.test(message)) {
    return 'The server could not be reached. Check the host, port, and network connectivity.';
  }

  if (/private key parse failed/i.test(message)) {
    return 'The private key could not be parsed. Check the key format and passphrase.';
  }

  return message;
}
