import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions,
  Keyboard,
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
}

export function MentionInput({
  value,
  onChangeText,
  placeholder = 'Write something...',
  style,
  multiline = true,
  maxLength,
  onSubmitEditing,
  containerStyle,
}: MentionInputProps) {
  const { searchResults, isSearching, searchUsers, clearResults } = useMentions();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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
        const query = textAfterAt.trim();
        if (query.length > 0) {
          searchUsers(query);
          setShowSuggestions(true);
          setSelectedIndex(0);
        } else {
          setShowSuggestions(false);
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

  const handleKeyPress = (e: any) => {
    if (showSuggestions && searchResults.length > 0) {
      if (e.nativeEvent.key === 'Enter' && !multiline) {
        e.preventDefault();
        insertMention(searchResults[selectedIndex]);
        return;
      }
    }
  };

  const renderSuggestion = ({ item, index }: { item: MentionUser; index: number }) => (
    <TouchableOpacity
      style={[
        styles.suggestionItem,
        index === selectedIndex && styles.suggestionItemSelected,
      ]}
      onPress={() => insertMention(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri: item.avatar_url || 'https://via.placeholder.com/32',
        }}
        style={styles.suggestionAvatar}
      />
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionName}>
          {item.display_name || item.username}
        </Text>
        <Text style={styles.suggestionUsername}>@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  const inputRefCallback = (node: TextInput | null) => {
    inputRef.current = node;
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  return (
    <View ref={inputContainerRef} style={[styles.container, containerStyle]}>
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
      <Modal
        visible={showSuggestions}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowSuggestions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSuggestions(false)}
        >
          <View style={[styles.suggestionsContainer, { marginBottom: Math.max(keyboardHeight + 80, 100) }]}>
            {isSearching ? (
              <View style={styles.suggestionItem}>
                <ActivityIndicator size="small" color="#FF6B00" />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSuggestion}
                keyExtractor={(item) => item.id}
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              />
            ) : (
              <View style={styles.suggestionItem}>
                <Text style={styles.noResultsText}>No users found</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginHorizontal: 16,
    maxHeight: Math.min(SCREEN_HEIGHT * 0.4, 200),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
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
});

