import 'package:flutter/material.dart';

class DeleteMessageDialog extends StatelessWidget {
  final bool isAdmin;
  final bool isOwnMessage;
  final VoidCallback onConfirm;
  
  const DeleteMessageDialog({
    super.key,
    required this.isAdmin,
    required this.isOwnMessage,
    required this.onConfirm,
  });

  static Future<bool?> show(
    BuildContext context, {
    required bool isAdmin,
    required bool isOwnMessage,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => DeleteMessageDialog(
        isAdmin: isAdmin,
        isOwnMessage: isOwnMessage,
        onConfirm: () {
          Navigator.of(context).pop(true);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      title: Row(
        children: [
          Icon(
            Icons.warning_rounded,
            color: Colors.red.shade600,
            size: 28,
          ),
          const SizedBox(width: 12),
          const Text(
            'Delete Message',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isAdmin && !isOwnMessage
                ? 'You are about to delete another user\'s message as an admin. This action cannot be undone.'
                : 'Are you sure you want to delete this message? This action cannot be undone.',
            style: TextStyle(
              fontSize: 15,
              color: Colors.grey.shade700,
              height: 1.4,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
          child: Text(
            'Cancel',
            style: TextStyle(
              color: Colors.grey.shade600,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ElevatedButton(
          onPressed: onConfirm,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red.shade600,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.delete_outline, size: 18),
              SizedBox(width: 6),
              Text(
                'Delete',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
