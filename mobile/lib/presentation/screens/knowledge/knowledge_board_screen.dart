import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/models/knowledge_topic.dart';
import '../../../data/services/knowledge_service.dart';
import '../../widgets/knowledge/topic_card.dart';
import 'topic_detail_screen.dart';

class KnowledgeBoardScreen extends ConsumerStatefulWidget {
  final String workspaceId;

  const KnowledgeBoardScreen({
    super.key,
    required this.workspaceId,
  });

  @override
  ConsumerState<KnowledgeBoardScreen> createState() =>
      _KnowledgeBoardScreenState();
}

class _KnowledgeBoardScreenState extends ConsumerState<KnowledgeBoardScreen> {
  List<KnowledgeTopic> _topics = [];
  List<KnowledgeCategory> _categories = [];
  bool _isLoading = true;
  String? _selectedCategory;
  String _searchQuery = '';
  String _sortBy = 'last_activity_at';
  int _total = 0;

  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    await Future.wait([
      _loadTopics(),
      _loadCategories(),
    ]);
  }

  Future<void> _loadTopics() async {
    setState(() => _isLoading = true);

    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.getTopics(
        widget.workspaceId,
        category: _selectedCategory,
        search: _searchQuery.isEmpty ? null : _searchQuery,
        sortBy: _sortBy,
      );

      if (mounted) {
        setState(() {
          _topics = response.topics;
          _total = response.total;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load topics: $e')),
        );
      }
    }
  }

  Future<void> _loadCategories() async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final categories = await service.getCategories(widget.workspaceId);

      if (mounted) {
        setState(() => _categories = categories);
      }
    } catch (e) {
      debugPrint('Failed to load categories: $e');
    }
  }

  Future<void> _handleVote(String topicId, String voteType) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.voteOnTopic(
        widget.workspaceId,
        topicId,
        voteType,
      );

      setState(() {
        _topics = _topics.map((t) {
          if (t.id == topicId) {
            return t.copyWith(
              userVote: voteType,
              upvotesCount: response.upvotesCount,
              downvotesCount: response.downvotesCount,
            );
          }
          return t;
        }).toList();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to vote: $e')),
      );
    }
  }

  Future<void> _handleRemoveVote(String topicId) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.removeTopicVote(
        widget.workspaceId,
        topicId,
      );

      setState(() {
        _topics = _topics.map((t) {
          if (t.id == topicId) {
            return t.copyWith(
              userVote: null,
              upvotesCount: response.upvotesCount,
              downvotesCount: response.downvotesCount,
            );
          }
          return t;
        }).toList();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to remove vote: $e')),
      );
    }
  }

  void _navigateToTopic(KnowledgeTopic topic) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => TopicDetailScreen(
          workspaceId: widget.workspaceId,
          topicId: topic.id,
          onTopicDeleted: _loadTopics,
        ),
      ),
    );
  }

  void _onSearch(String query) {
    setState(() => _searchQuery = query);
    _loadTopics();
  }

  void _onCategoryChanged(String? category) {
    setState(() => _selectedCategory = category);
    _loadTopics();
  }

  void _onSortChanged(String sortBy) {
    setState(() => _sortBy = sortBy);
    _loadTopics();
  }

  Color _parseColor(String? colorString) {
    if (colorString == null || colorString.isEmpty) {
      return Colors.indigo;
    }
    try {
      final hex = colorString.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (e) {
      return Colors.indigo;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // Header
          SliverAppBar(
            expandedHeight: 180,
            floating: false,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.indigo.shade600,
                      Colors.purple.shade600,
                    ],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 48),
                        Row(
                          children: [
                            const Icon(
                              Icons.menu_book_rounded,
                              color: Colors.white,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            const Text(
                              'Knowledge Base',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '$_total topics in your team\'s knowledge',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.add_rounded, color: Colors.white),
                onPressed: () {
                  // TODO: Create new topic
                },
              ),
            ],
          ),

          // Search bar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearch,
                decoration: InputDecoration(
                  hintText: 'Search topics...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _searchController.clear();
                            _onSearch('');
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: isDark ? Colors.grey[900] : Colors.grey[100],
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
          ),

          // Category chips
          SliverToBoxAdapter(
            child: SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _CategoryChip(
                    label: 'All Topics',
                    isSelected: _selectedCategory == null,
                    onTap: () => _onCategoryChanged(null),
                  ),
                  ..._categories.map((cat) => _CategoryChip(
                        label: cat.name,
                        color: _parseColor(cat.color),
                        isSelected: _selectedCategory == cat.id,
                        onTap: () => _onCategoryChanged(cat.id),
                      )),
                ],
              ),
            ),
          ),

          // Sort dropdown
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Text(
                    'Sort by:',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  const SizedBox(width: 8),
                  DropdownButton<String>(
                    value: _sortBy,
                    underline: const SizedBox(),
                    items: const [
                      DropdownMenuItem(
                        value: 'last_activity_at',
                        child: Text('Recent Activity'),
                      ),
                      DropdownMenuItem(
                        value: 'created_at',
                        child: Text('Newest'),
                      ),
                      DropdownMenuItem(
                        value: 'upvotes_count',
                        child: Text('Most Upvoted'),
                      ),
                      DropdownMenuItem(
                        value: 'comment_count',
                        child: Text('Most Discussed'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) _onSortChanged(value);
                    },
                  ),
                ],
              ),
            ),
          ),

          // Topics list
          if (_isLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_topics.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.menu_book_outlined,
                      size: 64,
                      color: Colors.grey[400],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _searchQuery.isNotEmpty
                          ? 'No topics match "$_searchQuery"'
                          : 'No topics yet',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Be the first to create a topic!',
                      style: TextStyle(color: Colors.grey[500]),
                    ),
                  ],
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final topic = _topics[index];
                  return TopicCard(
                    topic: topic,
                    onTap: () => _navigateToTopic(topic),
                    onVote: (type) => _handleVote(topic.id, type),
                    onRemoveVote: () => _handleRemoveVote(topic.id),
                  );
                },
                childCount: _topics.length,
              ),
            ),

          // Bottom padding
          const SliverToBoxAdapter(
            child: SizedBox(height: 80),
          ),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final Color? color;
  final bool isSelected;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.label,
    this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? Colors.indigo;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onTap(),
        selectedColor: chipColor.withOpacity(0.2),
        checkmarkColor: chipColor,
        labelStyle: TextStyle(
          color: isSelected ? chipColor : null,
          fontWeight: isSelected ? FontWeight.w600 : null,
        ),
      ),
    );
  }
}
