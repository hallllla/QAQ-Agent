<script setup lang="ts">
import { ref, watch, nextTick, type Ref } from 'vue';
import type { Message } from '../types';
import MessageBubble from './MessageBubble.vue';

const props = defineProps<{
  messages: Message[];
}>();

const emit = defineEmits<{
  send: [text: string];
}>();

const input = ref('');
const isSending = ref(false);
const messagesEndRef = ref<HTMLDivElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 自动滚动到底部
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  }
);

// 消息内容变化时也滚动 (工具事件更新)
watch(
  () => props.messages.map(m => m.toolEvents?.length).join(','),
  async () => {
    await nextTick();
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  }
);

// 自动调整输入框高度
watch(input, () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 150)}px`;
  }
});

const handleSend = async () => {
  const text = input.value.trim();
  if (!text || isSending.value) return;

  input.value = '';
  isSending.value = true;

  try {
    await emit('send', text);
  } finally {
    isSending.value = false;
    textareaRef.value?.focus();
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const handleSuggestion = (text: string) => {
  emit('send', text);
};
</script>

<template>
  <div class="chat-window">
    <!-- 消息列表 -->
    <div class="messages-container">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">🤖</div>
        <h2>LangGraph Agent</h2>
        <p>一个基于 LangGraph 的桌面 AI 助手</p>
        <div class="suggestions">
          <button @click="handleSuggestion('帮我算一下 (123 + 456) * 7 等于多少')">
            🧮 帮我算一下 (123 + 456) * 7
          </button>
          <button @click="handleSuggestion('现在几点了？')">
            🕐 现在几点了？
          </button>
          <button @click="handleSuggestion('帮我分析一下这段文字: Hello World 你好世界 12345')">
            📝 分析一段文字
          </button>
          <button @click="handleSuggestion('生成一个 1 到 100 之间的随机数')">
            🎲 生成随机数
          </button>
        </div>
      </div>

      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
      <div ref="messagesEndRef"></div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          class="message-input"
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          v-model="input"
          @keydown="handleKeyDown"
          :rows="1"
          :disabled="isSending"
        />
        <button
          class="send-btn"
          @click="handleSend"
          :disabled="!input.trim() || isSending"
        >
          <span v-if="isSending" class="spinner"></span>
          <span v-else>发送</span>
        </button>
      </div>
    </div>
  </div>
</template>
