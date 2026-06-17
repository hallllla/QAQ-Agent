<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { KnowledgeDocument, KBStats, KBProgressEvent } from '../types';

const emit = defineEmits<{
  close: [];
}>();

const documents = ref<KnowledgeDocument[]>([]);
const stats = ref<KBStats>({ documentCount: 0, chunkCount: 0 });
const isLoading = ref(false);
const progressMsg = ref('');

let cleanupProgress: (() => void) | null = null;

onMounted(async () => {
  await refresh();

  cleanupProgress = window.electronAPI.kb.onProgress((event: KBProgressEvent) => {
    if (event.type === 'indexing') {
      progressMsg.value = `正在索引: ${event.fileName}...`;
    } else if (event.type === 'done') {
      progressMsg.value = `✅ ${event.fileName} 索引完成 (${event.chunkCount} 个片段)`;
      refresh();
      setTimeout(() => { progressMsg.value = ''; }, 3000);
    } else if (event.type === 'error') {
      progressMsg.value = `❌ ${event.fileName} 索引失败: ${event.error}`;
      setTimeout(() => { progressMsg.value = ''; }, 5000);
    }
  });
});

onUnmounted(() => {
  cleanupProgress?.();
});

const refresh = async () => {
  documents.value = await window.electronAPI.kb.getDocuments();
  stats.value = await window.electronAPI.kb.getStats();
};

const handleAdd = async () => {
  isLoading.value = true;
  progressMsg.value = '正在选择文件...';
  try {
    const result = await window.electronAPI.kb.addDocument();
    if (result.success) {
      progressMsg.value = `成功添加 ${result.data!.length} 个文档`;
      await refresh();
      setTimeout(() => { progressMsg.value = ''; }, 3000);
    } else if (result.error && result.error !== '未选择文件') {
      progressMsg.value = `❌ ${result.error}`;
      setTimeout(() => { progressMsg.value = ''; }, 5000);
    } else {
      progressMsg.value = '';
    }
  } catch (e: any) {
    progressMsg.value = `❌ ${e.message}`;
  } finally {
    isLoading.value = false;
  }
};

const handleRemove = async (doc: KnowledgeDocument) => {
  if (!confirm(`确定删除「${doc.name}」吗？`)) return;
  await window.electronAPI.kb.removeDocument(doc.id);
  await refresh();
};

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="kb-panel">
    <div class="kb-header">
      <h2>📚 知识库管理</h2>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="kb-body">
      <!-- 统计信息 -->
      <div class="kb-stats">
        <div class="stat-item">
          <span class="stat-value">{{ stats.documentCount }}</span>
          <span class="stat-label">文档数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.chunkCount }}</span>
          <span class="stat-label">片段数</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="kb-actions">
        <button
          class="btn btn-primary"
          @click="handleAdd"
          :disabled="isLoading"
        >
          {{ isLoading ? '索引中...' : '📂 添加文件' }}
        </button>
      </div>

      <!-- 进度消息 -->
      <div v-if="progressMsg" class="kb-progress">
        {{ progressMsg }}
      </div>

      <!-- 文档列表 -->
      <div class="kb-doc-list">
        <div v-if="documents.length === 0" class="kb-empty">
          <p>知识库为空</p>
          <small>点击上方按钮添加文档，支持 .txt .md .csv .json 等格式</small>
        </div>

        <div
          v-for="doc in documents"
          :key="doc.id"
          class="kb-doc-item"
        >
          <div class="doc-info">
            <div class="doc-name">📄 {{ doc.name }}</div>
            <div class="doc-meta">
              {{ doc.chunkCount }} 个片段 · {{ formatDate(doc.addedAt) }}
            </div>
          </div>
          <button
            class="doc-remove-btn"
            @click="handleRemove(doc)"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
