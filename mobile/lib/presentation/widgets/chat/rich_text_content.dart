import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';

/// A widget that renders text with @mentions highlighted
class RichTextContent extends StatelessWidget {
  final String content;
  final TextStyle? style;
  final TextStyle? mentionStyle;
  final int? maxLines;
  final TextOverflow? overflow;
  final Function(String userId, String displayName)? onMentionTap;

  const RichTextContent({
    super.key,
    required this.content,
    this.style,
    this.mentionStyle,
    this.maxLines,
    this.overflow,
    this.onMentionTap,
  });

  @override
  Widget build(BuildContext context) {
    final defaultStyle = style ?? Theme.of(context).textTheme.bodyMedium;
    final defaultMentionStyle = mentionStyle ??
        defaultStyle?.copyWith(
          color: Colors.blue.shade700,
          fontWeight: FontWeight.w600,
          backgroundColor: Colors.blue.withOpacity(0.1),
        );

    final spans = _parseContent(content, defaultStyle!, defaultMentionStyle!);

    return RichText(
      text: TextSpan(children: spans),
      maxLines: maxLines,
      overflow: overflow ?? TextOverflow.clip,
    );
  }

  List<InlineSpan> _parseContent(
    String text,
    TextStyle defaultStyle,
    TextStyle mentionStyle,
  ) {
    final spans = <InlineSpan>[];

    // Regex to match @mentions (handles names with spaces)
    // Matches @name or @"Name With Spaces"
    final mentionRegex = RegExp(r'@([a-zA-Z0-9_]+|"[^"]+")');

    int lastIndex = 0;

    for (final match in mentionRegex.allMatches(text)) {
      // Add text before this mention
      if (match.start > lastIndex) {
        spans.add(TextSpan(
          text: text.substring(lastIndex, match.start),
          style: defaultStyle,
        ));
      }

      // Extract the display name from the mention
      String mentionText = match.group(0)!;
      String displayName = match.group(1)!;

      // Remove quotes if present
      if (displayName.startsWith('"') && displayName.endsWith('"')) {
        displayName = displayName.substring(1, displayName.length - 1);
      }

      // Add the mention with styling
      spans.add(TextSpan(
        text: mentionText,
        style: mentionStyle,
        recognizer: onMentionTap != null
            ? (TapGestureRecognizer()
              ..onTap = () => onMentionTap!(displayName, displayName))
            : null,
      ));

      lastIndex = match.end;
    }

    // Add remaining text after last mention
    if (lastIndex < text.length) {
      spans.add(TextSpan(
        text: text.substring(lastIndex),
        style: defaultStyle,
      ));
    }

    // If no spans were added (no mentions found), just return the full text
    if (spans.isEmpty) {
      spans.add(TextSpan(text: text, style: defaultStyle));
    }

    return spans;
  }
}

/// A widget that renders message content with mentions, links, and markdown-style formatting
class FormattedTextContent extends StatelessWidget {
  final String content;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final bool isOwnMessage;
  final Function(String userId, String displayName)? onMentionTap;
  final Function(String url)? onLinkTap;

  const FormattedTextContent({
    super.key,
    required this.content,
    this.style,
    this.maxLines,
    this.overflow,
    this.isOwnMessage = false,
    this.onMentionTap,
    this.onLinkTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final baseStyle = style ?? theme.textTheme.bodyMedium!.copyWith(
      color: isOwnMessage ? Colors.white : (isDark ? Colors.grey[200] : Colors.grey[900]),
    );

    final mentionStyle = baseStyle.copyWith(
      color: isOwnMessage ? Colors.white : Colors.blue.shade700,
      fontWeight: FontWeight.w600,
      backgroundColor: isOwnMessage
          ? Colors.white.withOpacity(0.15)
          : Colors.blue.withOpacity(0.1),
    );

    final linkStyle = baseStyle.copyWith(
      color: isOwnMessage ? Colors.white : Colors.blue.shade600,
      decoration: TextDecoration.underline,
    );

    final boldStyle = baseStyle.copyWith(fontWeight: FontWeight.bold);
    final italicStyle = baseStyle.copyWith(fontStyle: FontStyle.italic);
    final codeStyle = baseStyle.copyWith(
      fontFamily: 'monospace',
      backgroundColor: isOwnMessage
          ? Colors.white.withOpacity(0.1)
          : Colors.grey.withOpacity(0.15),
    );

    final spans = _parseFormattedContent(
      content,
      baseStyle,
      mentionStyle,
      linkStyle,
      boldStyle,
      italicStyle,
      codeStyle,
    );

    return RichText(
      text: TextSpan(children: spans),
      maxLines: maxLines,
      overflow: overflow ?? TextOverflow.clip,
    );
  }

  List<InlineSpan> _parseFormattedContent(
    String text,
    TextStyle baseStyle,
    TextStyle mentionStyle,
    TextStyle linkStyle,
    TextStyle boldStyle,
    TextStyle italicStyle,
    TextStyle codeStyle,
  ) {
    final spans = <InlineSpan>[];

    // Combined regex for mentions, URLs, bold, italic, and code
    // Order matters: more specific patterns first
    final combinedRegex = RegExp(
      r'(@[a-zA-Z0-9_]+|@"[^"]+")|' // Mentions
      r'(https?://[^\s]+)|' // URLs
      r'(\*\*[^*]+\*\*)|' // Bold **text**
      r'(\*[^*]+\*)|' // Italic *text*
      r'(`[^`]+`)', // Code `text`
    );

    int lastIndex = 0;

    for (final match in combinedRegex.allMatches(text)) {
      // Add text before this match
      if (match.start > lastIndex) {
        spans.add(TextSpan(
          text: text.substring(lastIndex, match.start),
          style: baseStyle,
        ));
      }

      final fullMatch = match.group(0)!;

      if (match.group(1) != null) {
        // Mention
        String displayName = fullMatch.substring(1);
        if (displayName.startsWith('"') && displayName.endsWith('"')) {
          displayName = displayName.substring(1, displayName.length - 1);
        }

        spans.add(TextSpan(
          text: fullMatch,
          style: mentionStyle,
          recognizer: onMentionTap != null
              ? (TapGestureRecognizer()..onTap = () => onMentionTap!(displayName, displayName))
              : null,
        ));
      } else if (match.group(2) != null) {
        // URL
        spans.add(TextSpan(
          text: fullMatch,
          style: linkStyle,
          recognizer: onLinkTap != null
              ? (TapGestureRecognizer()..onTap = () => onLinkTap!(fullMatch))
              : null,
        ));
      } else if (match.group(3) != null) {
        // Bold
        final innerText = fullMatch.substring(2, fullMatch.length - 2);
        spans.add(TextSpan(text: innerText, style: boldStyle));
      } else if (match.group(4) != null) {
        // Italic
        final innerText = fullMatch.substring(1, fullMatch.length - 1);
        spans.add(TextSpan(text: innerText, style: italicStyle));
      } else if (match.group(5) != null) {
        // Code
        final innerText = fullMatch.substring(1, fullMatch.length - 1);
        spans.add(TextSpan(text: innerText, style: codeStyle));
      }

      lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      spans.add(TextSpan(
        text: text.substring(lastIndex),
        style: baseStyle,
      ));
    }

    if (spans.isEmpty) {
      spans.add(TextSpan(text: text, style: baseStyle));
    }

    return spans;
  }
}
