import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useMentions, type MentionUser } from '../hooks/useMentions';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  multiline?: boolean;
  maxLength?: number;
  onSubmitEditing?: () => void;
  containerStyle?: any;
  popupPosition?: 'above' | 'below' | 'auto';
}

// Reserved mention types
const RESERVED_MENTIONS: MentionUser[] = [
  {
    id: 'everyone',
    username: 'everyone',
    display_name: 'Everyone',
    avatar_url: null,
  },
  {
    id: 'highlight',
    username: 'highlight',
    display_name: 'Highlight',
    avatar_url: null,
  },
];

export function MentionInput({
  value,
  onChangeText,
  placeholder = 'Write something...',
  style,
  multiline = true,
  maxLength,
  onSubmitEditing,
  containerStyle,
  popupPosition: popupPositionProp = 'auto',
}: MentionInputProps) {
  const { searchResults, isSearching, searchUsers, clearResults } = useMentions();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popupPosition, setPopupPosition] = useState<'above' | 'below'>('below');
  const inputRef = useRef<TextInput>(null);
  const inputContainerRef = useRef<View>(null);

  const handleChangeText = (text: string) => {
    onChangeText(text);

    // Find the last @ symbol before cursor
    const cursorPosition = text.length; // In React Native, we track cursor differently
    const textBeforeCursor = text;
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space or newline after @ (meaning mention is complete)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        const query = textAfterAt.trim().toLowerCase();
        
        // Always show suggestions when @ is typed, prioritizing reserved mentions
        setShowSuggestions(true);
        setSelectedIndex(0);
        
        // If query is empty or matches reserved mentions, show reserved mentions first
        if (query.length === 0 || RESERVED_MENTIONS.some(m => m.username.startsWith(query))) {
          // Only search users if query doesn't match reserved mentions exactly
          if (query.length > 0 && !RESERVED_MENTIONS.some(m => m.username === query)) {
            searchUsers(query);
          } else {
            clearResults();
          }
        } else {
          // Query doesn't match reserved mentions, search for users
          searchUsers(query);
        }
      } else {
        setShowSuggestions(false);
        setMentionStart(null);
        clearResults();
      }
    } else {
      setShowSuggestions(false);
      setMentionStart(null);
      clearResults();
    }
  };

  const insertMention = (user: MentionUser) => {
    if (mentionStart === null) return;

    const currentValue = value;
    const beforeMention = currentValue.substring(0, mentionStart);
    // Find where the @ mention text ends
    const afterAt = currentValue.substring(mentionStart);
    const spaceIndex = afterAt.indexOf(' ');
    const newlineIndex = afterAt.indexOf('\n');
    const endIndex =
      spaceIndex !== -1 && newlineIndex !== -1
        ? Math.min(spaceIndex, newlineIndex)
        : spaceIndex !== -1
          ? spaceIndex
          : newlineIndex !== -1
            ? newlineIndex
            : afterAt.length;
    const afterMention = currentValue.substring(mentionStart + endIndex);

    // Insert the mention with a space after
    const mentionText = `@${user.username} `;
    const newValue = beforeMention + mentionText + afterMention;

    onChangeText(newValue);
    setShowSuggestions(false);
    setMentionStart(null);
    clearResults();

    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Get combined suggestions (reserved mentions first, then search results)
  const getSuggestions = (): MentionUser[] => {
    if (mentionStart === null) return [];
    
    // Get the current query from the value
    const textAfterAt = value.substring(mentionStart + 1);
    const spaceIndex = textAfterAt.indexOf(' ');
    const newlineIndex = textAfterAt.indexOf('\n');
    const endIndex = spaceIndex !== -1 && newlineIndex !== -1
      ? Math.min(spaceIndex, newlineIndex)
      : spaceIndex !== -1
        ? spaceIndex
        : newlineIndex !== -1
          ? newlineIndex
          : textAfterAt.length;
    const query = textAfterAt.substring(0, endIndex).trim().toLowerCase();
    
    // Filter reserved mentions based on query - always show if query is empty or matches
    const filteredReserved = RESERVED_MENTIONS.filter(m => 
      query.length === 0 || m.username.startsWith(query)
    );
    
    // Filter search results to exclude reserved usernames
    const filteredSearchResults = searchResults.filter(u => 
      u.username !== 'everyone' && u.username !== 'highlight'
    );
    
    // Always return reserved mentions first, then search results
    return [...filteredReserved, ...filteredSearchResults];
  };

  const handleKeyPress = (e: any) => {
    const suggestions = getSuggestions();
    if (showSuggestions && suggestions.length > 0) {
      if (e.nativeEvent.key === 'Enter' && !multiline) {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        return;
      }
    }
  };

  const renderSuggestion = ({ item, index }: { item: MentionUser; index: number }) => {
    const isReserved = item.id === 'everyone' || item.id === 'highlight';
    return (
      <TouchableOpacity
        style={[
          styles.suggestionItem,
          index === selectedIndex && styles.suggestionItemSelected,
          isReserved && styles.reservedMentionItem,
        ]}
        onPress={() => insertMention(item)}
        activeOpacity={0.7}
      >
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.suggestionAvatar}
          />
        ) : (
          <View style={[styles.suggestionAvatar, styles.reservedAvatar]}>
            <Text style={styles.reservedAvatarText}>
              {item.display_name?.charAt(0) || item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.suggestionContent}>
          <Text style={styles.suggestionName}>
            {item.display_name || item.username}
          </Text>
          <Text style={styles.suggestionUsername}>@{item.username}</Text>
        </View>
        {isReserved && (
          <View style={styles.reservedBadge}>
            <Text style={styles.reservedBadgeText}>Special</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const inputRefCallback = (node: TextInput | null) => {
    inputRef.current = node;
  };

  // Measure input position and determine popup placement
  const measureInputPosition = () => {
    // If popupPosition is explicitly set, use it
    if (popupPositionProp === 'above') {
      setPopupPosition('above');
      return;
    }
    if (popupPositionProp === 'below') {
      setPopupPosition('below');
      return;
    }
    
    // Auto mode: measure and decide
    if (inputContainerRef.current && showSuggestions) {
      inputContainerRef.current.measureInWindow((x, y, width, height) => {
        const spaceBelow = SCREEN_HEIGHT - (y + height);
        const spaceAbove = y;
        const estimatedPopupHeight = 200; // Max height of popup
        
        // If not enough space below but enough above, show above
        if (spaceBelow < estimatedPopupHeight && spaceAbove > estimatedPopupHeight) {
          setPopupPosition('above');
        } else {
          setPopupPosition('below');
        }
      });
    }
  };

  useEffect(() => {
    if (showSuggestions) {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        measureInputPosition();
      }, 100);
    }
  }, [showSuggestions, popupPositionProp]);

  return (
    <View ref={inputContainerRef} style={[styles.container, containerStyle]} onLayout={measureInputPosition}>
      <TextInput
        ref={inputRefCallback}
        value={value}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        placeholderTextColor="#999"
        style={[styles.input, style]}
        multiline={multiline}
        maxLength={maxLength}
        onSubmitEditing={onSubmitEditing}
      />
      {showSuggestions && (getSuggestions().length > 0 || isSearching) && (
        <View style={[
          styles.suggestionsContainer,
          popupPosition === 'above' ? styles.suggestionsContainerAbove : styles.suggestionsContainerBelow
        ]}>
          {isSearching ? (
            <View style={styles.suggestionItem}>
              <ActivityIndicator size="small" color="#FF6B00" />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          ) : getSuggestions().length > 0 ? (
            <ScrollView
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              bounces={false}
            >
              {getSuggestions().map((item, index) => {
                const isReserved = item.id === 'everyone' || item.id === 'highlight';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.suggestionItem,
                      index === selectedIndex && styles.suggestionItemSelected,
                      isReserved && styles.reservedMentionItem,
                    ]}
                    onPress={() => insertMention(item)}
                    activeOpacity={0.7}
                  >
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.suggestionAvatar}
                      />
                    ) : (
                      <View style={[styles.suggestionAvatar, styles.reservedAvatar]}>
                        <Text style={styles.reservedAvatarText}>
                          {item.display_name?.charAt(0) || item.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionName}>
                        {item.display_name || item.username}
                      </Text>
                      <Text style={styles.suggestionUsername}>@{item.username}</Text>
                    </View>
                    {isReserved && (
                      <View style={styles.reservedBadge}>
                        <Text style={styles.reservedBadgeText}>Special</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.suggestionItem}>
              <Text style={styles.noResultsText}>No users found</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minWidth: 0, // Important for flex children
  },
  input: {
    fontSize: 15,
    color: '#000',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    width: '100%',
  },
  suggestionsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  suggestionsContainerBelow: {
    top: '100%',
    marginTop: 4,
  },
  suggestionsContainerAbove: {
    bottom: '100%',
    marginBottom: 4,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  suggestionItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  suggestionUsername: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    padding: 12,
  },
  reservedMentionItem: {
    backgroundColor: '#FFF5E6',
  },
  reservedAvatar: {
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reservedAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reservedBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  reservedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

