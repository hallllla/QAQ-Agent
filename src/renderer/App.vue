<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Message, ToolEvent, AgentSettings } from './types';
import ChatWindow from './components/ChatWindow.vue';
import SettingsPanel from './components/SettingsPanel.vue';

const messages = ref<Message[]>([]);
const showSettings = ref(false);
const settings = ref<AgentSettings>({
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  baseUrl: '',
  temperature: 0.7,
});

let cleanupToolListener: (() => void) | null = null;

// 加载设置
onMounted(async () => {
  const saved = await window.electronAPI.getSettings();
  if (saved) settings.value = saved;

  // 监听工具事件
  cleanupToolListener = window.electronAPI.onToolEvent((event: ToolEvent) => {
    const idx = messages.value.findIndex(
      (m) => m.role === 'assistant' && m.isLoading
    );
    if (idx !== -1) {
      const msg = { ...messages.value[idx] };
      msg.toolEvents = [...(msg.toolEvents || []), event];
      messages.value[idx] = msg;
    }
  });
});

onUnmounted(() => {
  cleanupToolListener?.();
});

const handleSend = async (text: string) => {
  // 添加用户消息
  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });

  // 添加加载中的助手消息
  const assistantId = `assistant-${Date.now()}`;
  messages.value.push({
    id: assistantId,
    role: 'assistant',
    content: '正在思考...',
    timestamp: Date.now(),
    isLoading: true,
    toolEvents: [],
  });

  // 调用 Agent
  const result = await window.electronAPI.chat(text);

  // 更新助手消息
  const idx = messages.value.findIndex((m) => m.id === assistantId);
  if (idx !== -1) {
    messages.value[idx] = {
      ...messages.value[idx],
      content: result.success
        ? result.data!.response
        : `错误: ${result.error}`,
      isLoading: false,
      isError: !result.success,
      toolCalls: result.success ? result.data!.toolCalls : [],
    };
  }
};

const handleSaveSettings = async (newSettings: AgentSettings) => {
  await window.electronAPI.saveSettings(newSettings);
  settings.value = newSettings;
  showSettings.value = false;
};

const handleClearChat = () => {
  messages.value = [];
};
</script>

<template>
  <div class="app">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-left">
        <div class="logo">🤖</div>
        <h1>LangGraph Agent</h1>
      </div>
      <div class="header-right">
        <button
          class="header-btn"
          @click="handleClearChat"
          title="清空对话"
        >
          🗑️ 清空
        </button>
        <button
          class="header-btn"
          :class="{ active: showSettings }"
          @click="showSettings = !showSettings"
          title="设置"
        >
          ⚙️ 设置
        </button>
      </div>
    </header>

    <div class="app-body">
      <!-- 设置面板 -->
      <SettingsPanel
        v-if="showSettings"
        :settings="settings"
        @save="handleSaveSettings"
        @close="showSettings = false"
      />

      <!-- 聊天窗口 -->
      <ChatWindow :messages="messages" @send="handleSend" />
    </div>
  </div>
</template>
