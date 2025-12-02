import React, { useMemo, useCallback } from 'react';
import { Text, View, StyleSheet, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';

interface MentionTextProps {
  text: string;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
  onPress?: () => void;
}

export function MentionText({ text, style, numberOfLines, onPress }: MentionTextProps) {
  const router = useRouter();

  const parts = useMemo(() => {
    // Split text by mentions (@username)
    const mentionRegex = /@([A-Za-z0-9_.]+)/g;
    const parts: Array<{ text: string; isMention: boolean }> = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.index),
          isMention: false,
        });
      }

      // Add mention
      parts.push({
        text: match[0], // Full match including @
        isMention: true,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        isMention: false,
      });
    }

    return parts.length > 0 ? parts : [{ text, isMention: false }];
  }, [text]);

  const handleMentionPress = useCallback(
    (mention: string) => {
      const username = mention.replace(/^@/, '');
      if (!username) return;
      router.push(`/${username}` as any);
    },
    [router],
  );

  return (
    <Text style={style} numberOfLines={numberOfLines} onPress={onPress}>
      {parts.map((part, index) =>
        part.isMention ? (
          <Text
            key={index}
            style={styles.mentionText}
            onPress={() => handleMentionPress(part.text)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={index}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  mentionText: {
    color: '#1DA1F2',
    fontWeight: '600',
  },
});

