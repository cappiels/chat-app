import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'http_client.dart';

// Provider for version check service
final versionCheckServiceProvider = Provider<VersionCheckService>((ref) {
  final httpClient = ref.watch(httpClientProvider);
  return VersionCheckService(httpClient);
});

class VersionCheckService {
  final HttpClient _httpClient;
  static const String _testFlightUrl = 'itms-beta://beta.itunes.apple.com/v1/app/6743532280';
  static const String _appStoreUrl = 'https://beta.itunes.apple.com/v1/app/6743532280';

  VersionCheckService(this._httpClient);

  /// Compare two version strings (e.g., "1.8.116" vs "1.8.117")
  /// Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
  int _compareVersions(String v1, String v2) {
    final parts1 = v1.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final parts2 = v2.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    // Pad shorter version with zeros
    while (parts1.length < 3) parts1.add(0);
    while (parts2.length < 3) parts2.add(0);

    for (int i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }
    return 0;
  }

  /// Check if an update is available
  Future<UpdateCheckResult> checkForUpdate() async {
    try {
      // Get current app version
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;

      // Get server version
      final response = await _httpClient.get('/api/version');

      if (response.statusCode == 200) {
        final serverVersion = response.data['version'] as String;

        final comparison = _compareVersions(currentVersion, serverVersion);
        final needsUpdate = comparison < 0;

        debugPrint('📱 Version check: current=$currentVersion, server=$serverVersion, needsUpdate=$needsUpdate');

        return UpdateCheckResult(
          currentVersion: currentVersion,
          latestVersion: serverVersion,
          updateAvailable: needsUpdate,
        );
      }

      return UpdateCheckResult(
        currentVersion: currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        error: 'Failed to check version',
      );
    } catch (e) {
      debugPrint('❌ Version check error: $e');
      return UpdateCheckResult(
        currentVersion: 'unknown',
        latestVersion: 'unknown',
        updateAvailable: false,
        error: e.toString(),
      );
    }
  }

  /// Open TestFlight to update the app
  Future<void> openTestFlight() async {
    try {
      // Try TestFlight URL scheme first (opens TestFlight app directly)
      final testFlightUri = Uri.parse(_testFlightUrl);
      if (await canLaunchUrl(testFlightUri)) {
        await launchUrl(testFlightUri, mode: LaunchMode.externalApplication);
        return;
      }

      // Fallback to web URL
      final webUri = Uri.parse(_appStoreUrl);
      if (await canLaunchUrl(webUri)) {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('❌ Failed to open TestFlight: $e');
    }
  }

  /// Show update dialog
  Future<void> showUpdateDialog(BuildContext context, UpdateCheckResult result) async {
    if (!result.updateAvailable) return;

    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.system_update, color: Colors.blue.shade600),
            ),
            const SizedBox(width: 12),
            const Text('Update Available'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'A new version of Crew Chat is available!',
              style: TextStyle(fontSize: 15, color: Colors.grey.shade800),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your version',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                      Text(
                        'v${result.currentVersion}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  Icon(Icons.arrow_forward, color: Colors.grey.shade400),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Latest version',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                      Text(
                        'v${result.latestVersion}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Update via TestFlight to get the latest features and fixes.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              'Later',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              openTestFlight();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue.shade600,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text('Update Now'),
          ),
        ],
      ),
    );
  }
}

class UpdateCheckResult {
  final String currentVersion;
  final String latestVersion;
  final bool updateAvailable;
  final String? error;

  UpdateCheckResult({
    required this.currentVersion,
    required this.latestVersion,
    required this.updateAvailable,
    this.error,
  });
}
