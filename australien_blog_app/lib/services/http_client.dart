// lib/services/http_client.dart
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'dart:io';

/// Creates an HTTP client configured for slow connections (Pi + Cloudflare tunnel)
http.Client createConfiguredClient() {
  final ioClient = HttpClient();

  // Configure for slow/unreliable connections
  ioClient.connectionTimeout = Duration(seconds: 30);
  ioClient.idleTimeout = Duration(minutes: 5);

  // Important: Don't auto-disconnect on errors
  ioClient.autoUncompress = true;

  return IOClient(ioClient);
}

// Singleton instance
final http.Client configuredHttpClient = createConfiguredClient();