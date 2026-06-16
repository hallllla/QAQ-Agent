<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { AgentSettings } from '../types';

const props = defineProps<{
  settings: AgentSettings;
}>();

const emit = defineEmits<{
  save: [settings: AgentSettings];
  close: [];
}>();

const form = reactive<AgentSettings>({ ...props.settings });

// 同步 props 变化
watch(
  () => props.settings,
  (newVal) => {
    Object.assign(form, newVal);
  },
  { deep: true }
);

const handleSave = () => {
  emit('save', { ...form });
};
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <h2>⚙️ Agent 设置</h2>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="settings-body">
      <!-- LLM 提供商 -->
      <div class="setting-group">
        <label>LLM 提供商</label>
        <div class="radio-group">
          <label class="radio-option" :class="{ active: form.provider === 'openai' }">
            <input
              type="radio"
              name="provider"
              value="openai"
              :checked="form.provider === 'openai'"
              @change="form.provider = 'openai'"
            />
            <span>OpenAI</span>
          </label>
          <label class="radio-option" :class="{ active: form.provider === 'ollama' }">
            <input
              type="radio"
              name="provider"
              value="ollama"
              :checked="form.provider === 'ollama'"
              @change="form.provider = 'ollama'"
            />
            <span>Ollama (本地)</span>
          </label>
        </div>
      </div>

      <!-- API Key -->
      <div v-if="form.provider === 'openai'" class="setting-group">
        <label>API Key</label>
        <input
          type="password"
          class="setting-input"
          v-model="form.apiKey"
          placeholder="sk-..."
        />
        <small>支持 OpenAI 及兼容 API 的密钥</small>
      </div>

      <!-- 模型名称 -->
      <div class="setting-group">
        <label>模型名称</label>
        <input
          type="text"
          class="setting-input"
          v-model="form.model"
          :placeholder="form.provider === 'openai' ? 'gpt-4o-mini' : 'llama3.1'"
        />
        <small>
          {{
            form.provider === 'openai'
              ? '例如: gpt-4o, gpt-4o-mini, gpt-3.5-turbo'
              : '例如: llama3.1, mistral, qwen2.5'
          }}
        </small>
      </div>

      <!-- Base URL -->
      <div class="setting-group">
        <label>
          {{ form.provider === 'openai' ? '自定义 API 地址 (可选)' : 'Ollama 地址' }}
        </label>
        <input
          type="text"
          class="setting-input"
          v-model="form.baseUrl"
          :placeholder="
            form.provider === 'openai'
              ? 'https://api.openai.com/v1 (默认)'
              : 'http://localhost:11434'
          "
        />
        <small>
          {{
            form.provider === 'openai'
              ? '留空使用 OpenAI 官方地址，可填入兼容 API 地址'
              : '本地 Ollama 服务地址'
          }}
        </small>
      </div>

      <!-- Temperature -->
      <div class="setting-group">
        <label>Temperature: {{ form.temperature }}</label>
        <input
          type="range"
          class="setting-range"
          min="0"
          max="2"
          step="0.1"
          v-model.number="form.temperature"
        />
        <div class="range-labels">
          <span>精确 (0)</span>
          <span>创意 (2)</span>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <button class="btn btn-secondary" @click="emit('close')">取消</button>
      <button class="btn btn-primary" @click="handleSave">保存设置</button>
    </div>
  </div>
</template>
