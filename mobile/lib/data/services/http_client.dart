import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config/api_config.dart';

// Provider for HTTP client
final httpClientProvider = Provider<HttpClient>((ref) {
  return HttpClient();
});

class HttpClient {
  late final Dio _dio;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  HttpClient() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: ApiConfig.httpTimeout,
      receiveTimeout: ApiConfig.httpReceiveTimeout,
      sendTimeout: ApiConfig.httpSendTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add interceptors
    _addInterceptors();
  }

  void _addInterceptors() {
    // Request interceptor - Add Firebase ID token to requests
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Get Firebase ID token for authentication
        final user = _auth.currentUser;
        if (user != null) {
          try {
            // Force refresh token to avoid expired token errors
            // This ensures we always have a fresh token (especially important after 1 hour)
            final idToken = await user.getIdToken(true); // true = force refresh
            options.headers['Authorization'] = 'Bearer $idToken';
            
            if (ApiConfig.enableApiLogging) {
              print('🔑 Fresh Firebase token obtained for ${options.method} ${options.uri}');
            }
          } catch (e) {
            if (ApiConfig.enableApiLogging) {
              print('❌ Failed to get Firebase ID token: $e');
            }
            // Don't block the request - let it try and fail gracefully
          }
        } else {
          if (ApiConfig.enableApiLogging) {
            print('⚠️ No Firebase user found for ${options.method} ${options.uri}');
          }
        }

        if (ApiConfig.enableApiLogging) {
          print('🚀 ${options.method} ${options.uri}');
          if (options.data != null) {
            print('📤 Data: ${options.data}');
          }
        }

        handler.next(options);
      },
      onResponse: (response, handler) {
        if (ApiConfig.enableApiLogging) {
          print('✅ ${response.statusCode} ${response.requestOptions.uri}');
          print('📥 Data: ${response.data}');
        }
        handler.next(response);
      },
      onError: (error, handler) {
        if (ApiConfig.enableApiLogging) {
          print('❌ ${error.response?.statusCode} ${error.requestOptions.uri}');
          print('💥 Error: ${error.message}');
          if (error.response?.data != null) {
            print('📥 Error Data: ${error.response?.data}');
          }
        }
        handler.next(error);
      },
    ));
  }

  // GET request
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // POST request
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // PUT request
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // DELETE request
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // Error handler
  Exception _handleDioError(DioException dioError) {
    switch (dioError.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return NetworkException('Connection timeout. Please check your internet connection.');
      
      case DioExceptionType.badResponse:
        final statusCode = dioError.response?.statusCode;
        final errorData = dioError.response?.data;
        
        switch (statusCode) {
          case 400:
            return BadRequestException(errorData?['message'] ?? 'Bad request');
          case 401:
            return UnauthorizedException(errorData?['message'] ?? 'Unauthorized');
          case 403:
            return ForbiddenException(errorData?['message'] ?? 'Forbidden');
          case 404:
            return NotFoundException(errorData?['message'] ?? 'Not found');
          case 500:
            return ServerException(errorData?['message'] ?? 'Internal server error');
          default:
            return ServerException(errorData?['message'] ?? 'Server error');
        }
      
      case DioExceptionType.cancel:
        return NetworkException('Request was cancelled');
      
      case DioExceptionType.connectionError:
        return NetworkException('No internet connection');
      
      default:
        return NetworkException('An unexpected error occurred');
    }
  }
}

// Custom Exceptions
class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
  
  @override
  String toString() => 'NetworkException: $message';
}

class BadRequestException implements Exception {
  final String message;
  BadRequestException(this.message);
  
  @override
  String toString() => 'BadRequestException: $message';
}

class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException(this.message);
  
  @override
  String toString() => 'UnauthorizedException: $message';
}

class ForbiddenException implements Exception {
  final String message;
  ForbiddenException(this.message);
  
  @override
  String toString() => 'ForbiddenException: $message';
}

class NotFoundException implements Exception {
  final String message;
  NotFoundException(this.message);
  
  @override
  String toString() => 'NotFoundException: $message';
}

class ServerException implements Exception {
  final String message;
  ServerException(this.message);
  
  @override
  String toString() => 'ServerException: $message';
}
