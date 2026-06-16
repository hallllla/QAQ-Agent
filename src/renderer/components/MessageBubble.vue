<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Message, ToolEvent } from '../types';

const props = defineProps<{
  message: Message;
}>();

const showTools = ref(false);

const isUser = computed(() => props.message.role === 'user');
const hasToolEvents = computed(
  () => props.message.toolEvents && props.message.toolEvents.length > 0
);

// 将 tool events 配对 (start + end)
const toolPairs = computed(() => {
  const pairs: Array<{ start: ToolEvent; end?: ToolEvent }> = [];
  if (!hasToolEvents.value) return pairs;

  for (const event of props.message.toolEvents!) {
    if (event.type === 'tool_start') {
      pairs.push({ start: event });
    } else if (event.type === 'tool_end') {
      const lastPair = pairs.find(
        (p) => p.start.toolName === event.toolName && !p.end
      );
      if (lastPair) {
        lastPair.end = event;
      }
    }
  }
  return pairs;
});

const formattedTime = computed(() => {
  return new Date(props.message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
});
</script>

<template>
  <div class="message-row" :class="isUser ? 'user-row' : 'assistant-row'">
    <div class="message-bubble" :class="isUser ? 'user-bubble' : 'assistant-bubble'">
      <!-- 头像 -->
      <div class="avatar">
        {{ isUser ? '👤' : '🤖' }}
      </div>

      <div class="bubble-content">
        <!-- 消息文本 -->
        <div
          class="message-text"
          :class="{
            loading: message.isLoading,
            error: message.isError,
          }"
        >
          <div v-if="message.isLoading" class="loading-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <div v-else class="text-content">{{ message.content }}</div>
        </div>

        <!-- 工具调用展示 -->
        <div v-if="hasToolEvents" class="tool-events">
          <button class="tool-toggle" @click="showTools = !showTools">
            🔧 工具调用 ({{ toolPairs.length }}) {{ showTools ? '▼' : '▶' }}
          </button>

          <div v-if="showTools" class="tool-details">
            <div
              v-for="(pair, idx) in toolPairs"
              :key="idx"
              class="tool-card"
            >
              <div class="tool-header">
                <span class="tool-name">📌 {{ pair.start.toolName }}</span>
                <span v-if="pair.end" class="tool-status">✅</span>
                <span v-else class="tool-status running">⏳</span>
              </div>
              <div v-if="pair.start.input" class="tool-section">
                <span class="tool-label">输入:</span>
                <pre class="tool-code">{{ pair.start.input }}</pre>
              </div>
              <div v-if="pair.end?.output" class="tool-section">
                <span class="tool-label">输出:</span>
                <pre class="tool-code">{{ pair.end.output }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 时间戳 -->
        <div class="message-time">{{ formattedTime }}</div>
      </div>
    </div>
  </div>
</template>
