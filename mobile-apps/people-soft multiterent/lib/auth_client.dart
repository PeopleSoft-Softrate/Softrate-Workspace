import 'dart:convert';
import 'package:http/http.dart' as http_base;
export 'package:http/http.dart' show MultipartRequest, MultipartFile, Response, StreamedResponse, ByteStream;
import 'package:shared_preferences/shared_preferences.dart';

// ── In-memory HTTP Response Cache ─────────────────────────────────────────
// Caches GET responses by URL for a configurable TTL.
// Dramatically reduces redundant API calls when navigating between screens.
class _CacheEntry {
  final http_base.Response response;
  final DateTime expiresAt;
  _CacheEntry(this.response, Duration ttl)
      : expiresAt = DateTime.now().add(ttl);
  bool get isValid => DateTime.now().isBefore(expiresAt);
}

final Map<String, _CacheEntry> _responseCache = {};

const Duration _defaultCacheTtl = Duration(minutes: 3);

/// Returns a cached response if valid, otherwise null.
http_base.Response? getCachedResponse(String url) {
  final entry = _responseCache[url];
  if (entry != null && entry.isValid) return entry.response;
  _responseCache.remove(url); // expired
  return null;
}

/// Stores a response in the cache.
void cacheResponse(String url, http_base.Response response,
    {Duration ttl = _defaultCacheTtl}) {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    _responseCache[url] = _CacheEntry(response, ttl);
  }
}

/// Invalidates the cache for a specific URL (call after mutations).
void invalidateCache(String url) => _responseCache.remove(url);

/// Clears the entire cache (e.g. on logout).
void clearCache() => _responseCache.clear();
// ──────────────────────────────────────────────────────────────────────────

class AuthClient extends http_base.BaseClient {
  final http_base.Client _inner = http_base.Client();

  @override
  Future<http_base.StreamedResponse> send(http_base.BaseRequest request) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    
    // Fallback for HR token if we didn't differentiate
    final hrToken = prefs.getString('hr_auth_token');
    if (token == null && hrToken != null) {
      request.headers['Authorization'] = 'Bearer $hrToken';
    }
    
    return _inner.send(request);
  }
}

final _client = AuthClient();

// ── Cached GET helper ──────────────────────────────────────────────────────
/// GET with optional caching. Pass [cacheTtl] to override the default 3-min TTL,
/// or [bypassCache] = true to always hit the network.
Future<http_base.Response> get(
  Uri url, {
  Map<String, String>? headers,
  Duration? cacheTtl,
  bool bypassCache = false,
}) async {
  final cacheKey = url.toString();
  if (!bypassCache) {
    final cached = getCachedResponse(cacheKey);
    if (cached != null) return cached;
  }
  final response = await _client.get(url, headers: headers);
  cacheResponse(cacheKey, response, ttl: cacheTtl ?? _defaultCacheTtl);
  return response;
}
// ──────────────────────────────────────────────────────────────────────────

Future<http_base.Response> post(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.post(url, headers: headers, body: body, encoding: encoding);
Future<http_base.Response> put(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.put(url, headers: headers, body: body, encoding: encoding);
Future<http_base.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.delete(url, headers: headers, body: body, encoding: encoding);
Future<http_base.Response> patch(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.patch(url, headers: headers, body: body, encoding: encoding);
Future<http_base.StreamedResponse> send(http_base.BaseRequest request) => _client.send(request);

